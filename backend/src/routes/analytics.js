const express = require('express');
const {
  trackEvent,
  getDashboardStats,
  getContentGaps,
  exportAnalytics,
} = require('../services/analytics/analyticsService');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/track — Track user event
router.post('/track', optionalAuth, async (req, res, next) => {
  try {
    const { eventType, data, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    await trackEvent({
      eventType,
      userId: req.user?._id || null,
      sessionId: sessionId || '',
      data: data || {},
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.json({ message: 'Event tracked' });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/dashboard — Enhanced aggregate analytics data
router.get('/dashboard', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await getDashboardStats(days);

    const User = require('../models/User');
    const userCount = await User.countDocuments();

    res.json({
      ...stats,
      contentStats: {
        ...stats.contentStats,
        users: userCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/content-gaps — Content gap analysis
router.get('/content-gaps', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const gaps = await getContentGaps(days);
    res.json({ gaps });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/export — Export analytics data
router.get('/export', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { type, days } = req.query;
    const data = await exportAnalytics(type, parseInt(days) || 30);

    // Return as JSON (frontend can convert to CSV)
    res.json({
      data,
      exportedAt: new Date().toISOString(),
      count: data.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
