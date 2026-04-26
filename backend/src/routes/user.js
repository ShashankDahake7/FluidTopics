const express = require('express');
const router = express.Router();
const ReadingHistory = require('../models/ReadingHistory');
const Analytics = require('../models/Analytics');
const { auth: authenticate } = require('../middleware/auth');
const {
  updateBehaviorProfile,
  getPersonalizedRecommendations,
  getUserInterestProfile,
  getSearchBoostParams,
} = require('../services/personalization/personalizationService');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/user/profile — Get user interest profile & preferences
 */
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await getUserInterestProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/user/preferences — Update user preferences
 */
router.patch('/preferences', async (req, res, next) => {
  try {
    const { interests, products, language, theme, documentIds, topicIds, releaseNotesOnly } = req.body;
    const User = require('../models/User');

    const update = {};
    if (interests) update['preferences.interests'] = interests;
    if (products) update['preferences.products'] = products;
    if (language) update['preferences.language'] = language;
    if (theme) update['preferences.theme'] = theme;
    if (Array.isArray(documentIds)) update['preferences.documentIds'] = documentIds;
    if (Array.isArray(topicIds))    update['preferences.topicIds']    = topicIds;
    if (typeof releaseNotesOnly === 'boolean') update['preferences.releaseNotesOnly'] = releaseNotesOnly;
    if (Array.isArray(req.body.priorityDocumentIds)) update['preferences.priorityDocumentIds'] = req.body.priorityDocumentIds;
    if (Array.isArray(req.body.priorityTopicIds))    update['preferences.priorityTopicIds']    = req.body.priorityTopicIds;
    if (typeof req.body.priorityReleaseNotes === 'boolean') update['preferences.priorityReleaseNotes'] = req.body.priorityReleaseNotes;

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    res.json({ message: 'Preferences updated', preferences: user.preferences });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/history — Get reading history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;

    const total = await ReadingHistory.countDocuments({ userId: req.user.id });
    const history = await ReadingHistory.find({ userId: req.user.id })
      .sort({ lastVisitedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('topicId', 'title slug metadata viewCount')
      .lean();

    res.json({
      history: history.map((h) => ({
        topic: h.topicId,
        visitCount: h.visitCount,
        lastVisitedAt: h.lastVisitedAt,
        duration: h.duration,
        scrollDepth: h.scrollDepth,
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/user/history — Clear reading history
 */
router.delete('/history', async (req, res, next) => {
  try {
    await ReadingHistory.deleteMany({ userId: req.user.id });
    res.json({ message: 'Reading history cleared' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/recommendations — Personalized recommendations
 */
router.get('/recommendations', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const recommendations = await getPersonalizedRecommendations(
      req.user.id,
      parseInt(limit)
    );
    res.json({ recommendations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/track-view — Track a topic view (updates behavior profile)
 */
router.post('/track-view', async (req, res, next) => {
  try {
    const { topicId } = req.body;
    if (!topicId) return res.status(400).json({ error: 'topicId required' });

    await updateBehaviorProfile(req.user.id, topicId);
    res.json({ message: 'View tracked' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/track-engagement — Track engagement (time, scroll)
 */
router.post('/track-engagement', async (req, res, next) => {
  try {
    const { topicId, duration, scrollDepth } = req.body;
    if (!topicId) return res.status(400).json({ error: 'topicId required' });

    const { trackEngagement } = require('../services/analytics/analyticsService');
    await trackEngagement(req.user.id, topicId, { duration, scrollDepth });
    res.json({ message: 'Engagement tracked' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/searches — Recent unique search queries by this user
 */
router.get('/searches', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const items = await Analytics.aggregate([
      { $match: { userId: req.user._id, eventType: 'search', 'data.query': { $ne: '' } } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: '$data.query',
          lastUsed: { $first: '$timestamp' },
          resultCount: { $first: '$data.resultCount' },
          count: { $sum: 1 },
        } },
      { $sort: { lastUsed: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: '$_id', lastUsed: 1, resultCount: 1, count: 1 } },
    ]);
    res.json({ searches: items });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/user/searches — clear all saved searches for this user
 */
router.delete('/searches', async (req, res, next) => {
  try {
    await Analytics.deleteMany({ userId: req.user._id, eventType: 'search' });
    res.json({ message: 'Search history cleared' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
