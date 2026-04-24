const Analytics = require('../../models/Analytics');
const ReadingHistory = require('../../models/ReadingHistory');
const Topic = require('../../models/Topic');
const Document = require('../../models/Document');
const User = require('../../models/User');

/**
 * Track an analytics event
 */
const trackEvent = async (eventData) => {
  const event = await Analytics.create(eventData);

  // Update user behavior counters
  if (eventData.userId) {
    const updates = { 'behaviorProfile.lastActiveAt': new Date() };
    if (eventData.eventType === 'search') {
      updates.$inc = { 'behaviorProfile.totalSearches': 1 };
    }
    await User.findByIdAndUpdate(eventData.userId, updates).catch(() => {});
  }

  return event;
};

/**
 * Track reading engagement (duration, scroll depth)
 */
const trackEngagement = async (userId, topicId, { duration, scrollDepth }) => {
  if (!topicId) return null;

  const update = {
    lastVisitedAt: new Date(),
  };

  if (duration > 0) update.duration = duration;
  if (scrollDepth > 0) update.scrollDepth = scrollDepth;

  return ReadingHistory.findOneAndUpdate(
    { userId, topicId },
    { $set: update },
    { new: true }
  );
};

/**
 * Get enhanced dashboard analytics
 */
const getDashboardStats = async (days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalSearches,
    totalViews,
    totalClicks,
    topQueries,
    failedSearches,
    dailyStats,
    searchSuccessRate,
    ctrData,
    engagementMetrics,
    contentStats,
    topViewedTopics,
    userActivity,
  ] = await Promise.all([
    // Total searches
    Analytics.countDocuments({ eventType: 'search', timestamp: { $gte: since } }),

    // Total views
    Analytics.countDocuments({ eventType: 'view', timestamp: { $gte: since } }),

    // Total clicks (from search results)
    Analytics.countDocuments({ eventType: 'click', timestamp: { $gte: since } }),

    // Top search queries
    Analytics.aggregate([
      { $match: { eventType: 'search', timestamp: { $gte: since }, 'data.query': { $ne: '' } } },
      {
        $group: {
          _id: '$data.query',
          count: { $sum: 1 },
          avgResults: { $avg: '$data.resultCount' },
          avgResponseTime: { $avg: '$data.responseTime' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          query: '$_id',
          count: 1,
          avgResults: { $round: ['$avgResults', 0] },
          avgResponseTime: { $round: ['$avgResponseTime', 0] },
          _id: 0,
        },
      },
    ]),

    // Failed searches (0 results)
    Analytics.aggregate([
      { $match: { eventType: 'search', timestamp: { $gte: since }, 'data.resultCount': 0 } },
      { $group: { _id: '$data.query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { query: '$_id', count: 1, _id: 0 } },
    ]),

    // Daily event counts
    Analytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]),

    // Search success rate (searches with results / total searches)
    Analytics.aggregate([
      { $match: { eventType: 'search', timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withResults: {
            $sum: { $cond: [{ $gt: ['$data.resultCount', 0] }, 1, 0] },
          },
          avgResponseTime: { $avg: '$data.responseTime' },
        },
      },
    ]),

    // Click-through rate (clicks / views from search)
    Analytics.aggregate([
      {
        $match: {
          eventType: { $in: ['search', 'click'] },
          timestamp: { $gte: since },
        },
      },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),

    // Engagement metrics
    ReadingHistory.aggregate([
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          avgScrollDepth: { $avg: '$scrollDepth' },
          avgVisits: { $avg: '$visitCount' },
          totalReaders: { $sum: 1 },
        },
      },
    ]),

    // Content stats
    Promise.all([
      Document.countDocuments(),
      Topic.countDocuments(),
      Topic.aggregate([
        { $group: { _id: '$metadata.product', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]),

    // Top viewed topics
    Topic.find()
      .sort({ viewCount: -1 })
      .limit(10)
      .select('title slug viewCount metadata.tags metadata.product')
      .lean(),

    // Active users
    User.aggregate([
      {
        $match: {
          'behaviorProfile.lastActiveAt': { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          activeUsers: { $sum: 1 },
          avgViews: { $avg: '$behaviorProfile.totalViews' },
          avgSearches: { $avg: '$behaviorProfile.totalSearches' },
        },
      },
    ]),
  ]);

  // Transform daily stats
  const dailyMap = {};
  dailyStats.forEach((item) => {
    const date = item._id.date;
    if (!dailyMap[date]) dailyMap[date] = { date, searches: 0, views: 0, clicks: 0 };
    const typeKey = item._id.type + 's';
    if (dailyMap[date][typeKey] !== undefined) {
      dailyMap[date][typeKey] = item.count;
    }
  });

  // Calculate CTR
  const searchCount = ctrData.find((d) => d._id === 'search')?.count || 0;
  const clickCount = ctrData.find((d) => d._id === 'click')?.count || 0;
  const clickThroughRate = searchCount > 0 ? ((clickCount / searchCount) * 100).toFixed(1) : 0;

  // Search success rate
  const successData = searchSuccessRate[0] || {};
  const successRate =
    successData.total > 0
      ? ((successData.withResults / successData.total) * 100).toFixed(1)
      : 100;

  // Product breakdown
  const productBreakdown = contentStats[2].map((p) => ({
    product: p._id || 'Uncategorized',
    topicCount: p.count,
  }));

  return {
    totalSearches,
    totalViews,
    totalClicks,
    clickThroughRate: parseFloat(clickThroughRate),
    searchSuccessRate: parseFloat(successRate),
    avgSearchResponseTime: Math.round(successData.avgResponseTime || 0),
    topQueries,
    failedSearches,
    dailyStats: Object.values(dailyMap),
    engagement: engagementMetrics[0] || {
      avgDuration: 0,
      avgScrollDepth: 0,
      avgVisits: 0,
      totalReaders: 0,
    },
    contentStats: {
      documents: contentStats[0],
      topics: contentStats[1],
      productBreakdown,
    },
    topViewedTopics,
    userActivity: userActivity[0] || { activeUsers: 0, avgViews: 0, avgSearches: 0 },
  };
};

/**
 * Get content gap analysis — topics with searches but no matching content
 */
const getContentGaps = async (days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get searches with 0 results grouped by query
  const gaps = await Analytics.aggregate([
    {
      $match: {
        eventType: 'search',
        timestamp: { $gte: since },
        'data.resultCount': 0,
      },
    },
    {
      $group: {
        _id: '$data.query',
        searchCount: { $sum: 1 },
        lastSearched: { $max: '$timestamp' },
        uniqueUsers: { $addToSet: '$userId' },
      },
    },
    { $sort: { searchCount: -1 } },
    { $limit: 30 },
    {
      $project: {
        query: '$_id',
        searchCount: 1,
        lastSearched: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        _id: 0,
      },
    },
  ]);

  return gaps;
};

/**
 * Export analytics as CSV-friendly data
 */
const exportAnalytics = async (eventType, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await Analytics.find({
    ...(eventType ? { eventType } : {}),
    timestamp: { $gte: since },
  })
    .sort({ timestamp: -1 })
    .limit(5000)
    .populate('userId', 'name email')
    .lean();

  return events.map((e) => ({
    timestamp: e.timestamp,
    eventType: e.eventType,
    user: e.userId?.name || 'anonymous',
    email: e.userId?.email || '',
    query: e.data?.query || '',
    topicId: e.data?.topicId || '',
    resultCount: e.data?.resultCount || 0,
    responseTime: e.data?.responseTime || 0,
    clickPosition: e.data?.clickPosition || 0,
  }));
};

module.exports = {
  trackEvent,
  trackEngagement,
  getDashboardStats,
  getContentGaps,
  exportAnalytics,
};
