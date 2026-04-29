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

// POST /api/analytics/v2/khub/views-heatmap — Content usage heatmap
// Returns a heatmap of content usage categorized by metadata, simulating the FT Analytics API.
router.post('/v2/khub/views-heatmap', auth, requireRole('admin', 'editor', 'superadmin'), async (req, res, next) => {
  try {
    const { startDate, endDate, levels } = req.body;
    
    // In a real implementation, we would aggregate the `AnalyticsEvent` collection
    // based on the requested metadata levels and date range.
    // For now, we return a mock response that matches the exact structure requested by the FT API spec.
    res.json({
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      totalDisplayCount: 20134,
      results: [
        {
          metadataKey: "Category",
          metadataLabel: "Category",
          metadataValue: "Reference Guides",
          displayCount: 17233,
          children: [
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "public",
              displayCount: 16829,
              children: []
            },
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "internal",
              displayCount: 273,
              children: []
            },
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "onprem",
              displayCount: 111,
              children: []
            },
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "premium",
              displayCount: 20,
              children: []
            }
          ]
        },
        {
          metadataKey: "Category",
          metadataLabel: "Category",
          metadataValue: "How To",
          displayCount: 2901,
          children: [
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "public",
              displayCount: 1889,
              children: []
            },
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "internal",
              displayCount: 1010,
              children: []
            },
            {
              metadataKey: "audience",
              metadataLabel: "Audience",
              metadataValue: "released",
              displayCount: 2,
              children: []
            }
          ]
        }
      ]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
