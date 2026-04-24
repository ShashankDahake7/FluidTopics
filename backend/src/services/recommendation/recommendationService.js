const Topic = require('../../models/Topic');

/**
 * Get content-based recommendations for a topic
 * Uses shared tags and same product/document for similarity
 */
const getRecommendations = async (topicId, limit = 5) => {
  const topic = await Topic.findById(topicId);
  if (!topic) return [];

  const query = {
    _id: { $ne: topicId },
  };

  // Build a scored recommendation query
  const candidates = await Topic.find({
    _id: { $ne: topicId },
    $or: [
      { 'metadata.tags': { $in: topic.metadata.tags || [] } },
      { 'metadata.product': topic.metadata.product },
      { documentId: topic.documentId },
    ],
  })
    .select('title slug metadata viewCount hierarchy.level')
    .limit(limit * 3)
    .lean();

  // Score candidates
  const scored = candidates.map((candidate) => {
    let score = 0;

    // Tag overlap
    const sharedTags = (candidate.metadata?.tags || []).filter((t) =>
      (topic.metadata?.tags || []).includes(t)
    );
    score += sharedTags.length * 3;

    // Same product
    if (candidate.metadata?.product === topic.metadata?.product && topic.metadata?.product) {
      score += 2;
    }

    // Same document
    if (candidate.documentId?.toString() === topic.documentId?.toString()) {
      score += 1;
    }

    // Popularity boost
    score += Math.min((candidate.viewCount || 0) / 100, 2);

    return { ...candidate, score };
  });

  // Sort by score and return top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

module.exports = { getRecommendations };
