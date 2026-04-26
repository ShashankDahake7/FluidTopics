const User = require('../../models/User');
const Topic = require('../../models/Topic');
const ReadingHistory = require('../../models/ReadingHistory');
const Bookmark = require('../../models/Bookmark');

/**
 * Update user behavior profile after viewing a topic
 * This builds the user's interest graph automatically
 */
const updateBehaviorProfile = async (userId, topicId) => {
  if (!userId) return;

  const topic = await Topic.findById(topicId).lean();
  if (!topic) return;

  const user = await User.findById(userId);
  if (!user) return;

  // Initialize behavior profile maps if needed
  if (!user.behaviorProfile) {
    user.behaviorProfile = {
      topTags: new Map(),
      topProducts: new Map(),
      totalViews: 0,
      totalSearches: 0,
    };
  }

  // Increment tag counts
  const tags = topic.metadata?.tags || [];
  tags.forEach((tag) => {
    const current = user.behaviorProfile.topTags?.get(tag) || 0;
    user.behaviorProfile.topTags.set(tag, current + 1);
  });

  // Increment product count
  if (topic.metadata?.product) {
    const current = user.behaviorProfile.topProducts?.get(topic.metadata.product) || 0;
    user.behaviorProfile.topProducts.set(topic.metadata.product, current + 1);
  }

  user.behaviorProfile.totalViews = (user.behaviorProfile.totalViews || 0) + 1;
  user.behaviorProfile.lastActiveAt = new Date();

  await user.save();

  // Upsert reading history
  await ReadingHistory.findOneAndUpdate(
    { userId, topicId },
    {
      $set: {
        documentId: topic.documentId,
        lastVisitedAt: new Date(),
      },
      $inc: { visitCount: 1 },
    },
    { upsert: true, new: true }
  );
};

/**
 * Get personalized recommendations for a user
 * Combines: user interest graph + reading history + collaborative signals
 */
const getPersonalizedRecommendations = async (userId, limit = 10) => {
  const user = await User.findById(userId).lean();
  if (!user) return [];

  // Get user's top interests from behavior
  const tagCounts = user.behaviorProfile?.topTags || {};
  const productCounts = user.behaviorProfile?.topProducts || {};

  // Convert Maps to sortable arrays
  const topTags = Object.entries(
    tagCounts instanceof Map ? Object.fromEntries(tagCounts) : tagCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const topProducts = Object.entries(
    productCounts instanceof Map ? Object.fromEntries(productCounts) : productCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([product]) => product);

  // Merge with explicit preferences
  const allInterestTags = [
    ...new Set([...topTags, ...(user.preferences?.interests || [])]),
  ];
  const allProducts = [
    ...new Set([...topProducts, ...(user.preferences?.products || [])]),
  ];

  // Get topics user has already viewed
  const viewedHistory = await ReadingHistory.find({ userId })
    .select('topicId')
    .lean();
  const viewedIds = viewedHistory.map((h) => h.topicId);

  // Find matching topics the user hasn't seen
  const query = { _id: { $nin: viewedIds } };
  const conditions = [];

  if (allInterestTags.length > 0) {
    conditions.push({ 'metadata.tags': { $in: allInterestTags } });
  }
  if (allProducts.length > 0) {
    conditions.push({ 'metadata.product': { $in: allProducts } });
  }

  if (conditions.length > 0) {
    query.$or = conditions;
  }

  const candidates = await Topic.find(query)
    .select('title slug metadata viewCount hierarchy.level')
    .limit(limit * 3)
    .lean();

  // Score and rank candidates
  const scored = candidates.map((topic) => {
    let score = 0;

    // Interest tag match (weighted by user's behavior frequency)
    (topic.metadata?.tags || []).forEach((tag) => {
      if (allInterestTags.includes(tag)) {
        const idx = allInterestTags.indexOf(tag);
        score += Math.max(10 - idx, 1); // Higher score for top interests
      }
    });

    // Product match
    if (topic.metadata?.product && allProducts.includes(topic.metadata.product)) {
      score += 5;
    }

    // Popularity signal
    score += Math.min((topic.viewCount || 0) / 50, 3);

    // Prefer higher-level topics for discovery
    if (topic.hierarchy?.level === 1) score += 2;

    return { ...topic, personalScore: score };
  });

  return scored.sort((a, b) => b.personalScore - a.personalScore).slice(0, limit);
};

/**
 * Get user's interest summary (for profile display)
 */
const getUserInterestProfile = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const tagCounts = user.behaviorProfile?.topTags || {};
  const productCounts = user.behaviorProfile?.topProducts || {};

  const topTags = Object.entries(
    tagCounts instanceof Map ? Object.fromEntries(tagCounts) : tagCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const topProducts = Object.entries(
    productCounts instanceof Map ? Object.fromEntries(productCounts) : productCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const recentHistory = await ReadingHistory.find({ userId })
    .sort({ lastVisitedAt: -1 })
    .limit(20)
    .populate('topicId', 'title slug metadata')
    .lean();

  const bookmarkCount = await Bookmark.countDocuments({ userId });

  return {
    name: user.name,
    email: user.email,
    role: user.role,
    lastLogin: user.lastLogin,
    interests: user.preferences?.interests || [],
    products: user.preferences?.products || [],
    documentIds: (user.preferences?.documentIds || []).map(String),
    topicIds:    (user.preferences?.topicIds    || []).map(String),
    releaseNotesOnly: !!user.preferences?.releaseNotesOnly,
    priorityDocumentIds: (user.preferences?.priorityDocumentIds || []).map(String),
    priorityTopicIds:    (user.preferences?.priorityTopicIds    || []).map(String),
    priorityReleaseNotes: !!user.preferences?.priorityReleaseNotes,
    topTags: topTags.map(([tag, count]) => ({ tag, count })),
    topProducts: topProducts.map(([product, count]) => ({ product, count })),
    totalViews: user.behaviorProfile?.totalViews || 0,
    totalSearches: user.behaviorProfile?.totalSearches || 0,
    bookmarkCount,
    recentHistory: recentHistory.map((h) => ({
      topic: h.topicId,
      visitCount: h.visitCount,
      lastVisitedAt: h.lastVisitedAt,
      duration: h.duration,
    })),
  };
};

/**
 * Get search boost parameters based on user preferences
 * Returns tags and products to boost in Elasticsearch queries
 */
const getSearchBoostParams = async (userId) => {
  if (!userId) return null;

  const user = await User.findById(userId).lean();
  if (!user) return null;

  const tagCounts = user.behaviorProfile?.topTags || {};
  const productCounts = user.behaviorProfile?.topProducts || {};

  const boostTags = Object.entries(
    tagCounts instanceof Map ? Object.fromEntries(tagCounts) : tagCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const boostProducts = Object.entries(
    productCounts instanceof Map ? Object.fromEntries(productCounts) : productCounts
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([product]) => product);

  // Merge with explicit preferences
  const allTags = [...new Set([...(user.preferences?.interests || []), ...boostTags])];
  const allProducts = [...new Set([...(user.preferences?.products || []), ...boostProducts])];

  return {
    tags: allTags,
    products: allProducts,
    language: user.preferences?.language || 'en',
    documentIds: (user.preferences?.priorityDocumentIds || []).map(String),
    topicIds:    (user.preferences?.priorityTopicIds    || []).map(String),
    releaseNotes: !!user.preferences?.priorityReleaseNotes,
  };
};

module.exports = {
  updateBehaviorProfile,
  getPersonalizedRecommendations,
  getUserInterestProfile,
  getSearchBoostParams,
};
