const express = require('express');
const {
  trackEvent,
  getDashboardStats,
  getContentGaps,
  exportAnalytics,
} = require('../services/analytics/analyticsService');
const { auth, requireTierOrAdminRoles, optionalAuth } = require('../middleware/auth');
const { analyticsFromReq } = require('../utils/clientIp');
const { ANALYTICS: AR_ANALYTICS } = require('../constants/adminRoles');

const analyticsEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_ANALYTICS);
const analyticsAdmin = requireTierOrAdminRoles(['admin'], AR_ANALYTICS);

const User = require('../models/User');
const Analytics = require('../models/Analytics');
const Rating = require('../models/Rating');
const Topic = require('../models/Topic');
const Document = require('../models/Document');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const Bookmark = require('../models/Bookmark');
const PersonalBook = require('../models/PersonalBook');
const SavedSearch = require('../models/SavedSearch');
const Collection = require('../models/Collection');
const { resolveSessionKeys } = require('../services/analytics/sessionConstants');
const { clientSessionIdFromReq } = require('../utils/clientSessionId');

const router = express.Router();

// POST /api/analytics/track — Track user event
router.post('/track', optionalAuth, async (req, res, next) => {
  try {
    const { eventType, data, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }
    if (eventType === 'event' && !(data && data.ftEvent)) {
      return res.status(400).json({ error: 'data.ftEvent is required when eventType is "event"' });
    }

    await trackEvent({
      eventType,
      userId: req.user?._id || null,
      sessionId: (sessionId && String(sessionId).trim()) || clientSessionIdFromReq(req),
      data: data || {},
      userAgent: req.headers['user-agent'],
      ...analyticsFromReq(req),
    });

    res.json({ message: 'Event tracked' });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/dashboard — Enhanced aggregate analytics data
router.get('/dashboard', auth, analyticsEditor, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await getDashboardStats(days);
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
router.get('/content-gaps', auth, analyticsEditor, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const gaps = await getContentGaps(days);
    res.json({ gaps });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/export — Export analytics data
router.get('/export', auth, analyticsAdmin, async (req, res, next) => {
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

// POST /api/analytics/v2/documents/views-top — Top documents by view count (Analytics, date range)
router.post('/v2/documents/views-top', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { getDocumentViewsTop } = require('../services/analytics/documentViewsService');
    const payload = await getDocumentViewsTop(req.body || {});
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v2/documents/:id/topics/views-heatmap
router.post('/v2/documents/:id/topics/views-heatmap', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, userId } = req.body || {};
    const {
      getTopicViewCountsForDocument,
      countDocumentViewsInRange,
      parseStart,
      parseEnd,
    } = require('../services/analytics/documentViewsService');

    const Document = require('../models/Document');
    const Topic = require('../models/Topic');
    const doc = await Document.findById(id).select('title metadata tocTree').lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const [topicCounts, docPeriodViews] = await Promise.all([
      getTopicViewCountsForDocument(id, { startDate, endDate, userId }),
      countDocumentViewsInRange(id, { startDate, endDate, userId }),
    ]);

    function metaEntries(meta) {
      const metaObj = {};
      const cf = meta?.customFields;
      if (cf instanceof Map) {
        for (const [k, v] of cf.entries()) metaObj[k] = v;
      } else if (cf && typeof cf === 'object') {
        Object.assign(metaObj, cf);
      }
      return Object.entries(metaObj).map(([key, v]) => ({
        key,
        label: key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key,
        values: [String(v ?? '')],
      }));
    }

    const documentInformation = {
      id: doc._id.toString(),
      title: doc.title,
      type: 'STRUCTURED_DOCUMENT',
      displayCount: docPeriodViews,
      link: `/dashboard/docs/${doc._id}`,
      metadata: metaEntries(doc.metadata || {}),
    };

    const buildHierarchy = (nodes) => {
      if (!nodes?.length) return [];
      return nodes.map((n) => {
        const idStr = String(n.topicId || n.id || '');
        return {
          id: idStr,
          title: n.title,
          displayCount: idStr ? topicCounts[idStr] || 0 : 0,
          children: n.children ? buildHierarchy(n.children) : [],
        };
      });
    };

    let results = [];
    if (doc.tocTree && Array.isArray(doc.tocTree) && doc.tocTree.length) {
      results = buildHierarchy(doc.tocTree);
    } else {
      const topics = await Topic.find({ documentId: id }).select('_id title').lean();
      results = topics
        .map((t) => ({
          id: String(t._id),
          title: t.title,
          displayCount: topicCounts[String(t._id)] || 0,
          children: [],
        }))
        .sort((a, b) => b.displayCount - a.displayCount);
    }

    const since = parseStart(startDate);
    const until = parseEnd(endDate);

    res.json({
      startDate: since.toISOString(),
      endDate: until.toISOString(),
      documentInformation,
      results,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v2/topics/views-top — Top topics by view count (Analytics, date range)
router.post('/v2/topics/views-top', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { getTopicViewsTop } = require('../services/analytics/topicViewsService');
    const payload = await getTopicViewsTop(req.body || {});
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v1/khub/document-engagement — scatter + filters (retention window)
router.post('/v1/khub/document-engagement', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { retentionDays } = req.body || {};
    const days = Math.min(
      3650,
      Math.max(1, parseInt(retentionDays, 10) || 730),
    );
    const { getDocumentEngagement } = require('../services/analytics/documentEngagementService');
    const payload = await getDocumentEngagement({ retentionDays: days });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v1/khub/time-report — Content inventory over time
router.post('/v1/khub/time-report', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { startDate, endDate, groupByPeriod, filters } = req.body;
    
    if (!startDate || !endDate || !groupByPeriod) {
      return res.status(400).json({ error: 'startDate, endDate, and groupByPeriod are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    // Generate buckets
    const basePeriods = [];
    let current = new Date(start);
    while (current < end) {
      const nextDate = new Date(current);
      if (groupByPeriod === 'month') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (groupByPeriod === 'week') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      const periodEnd = nextDate > end ? new Date(end) : new Date(nextDate);
      basePeriods.push({
        periodStartDate: current.toISOString().split('T')[0],
        periodEndDate: periodEnd.toISOString().split('T')[0],
        startMs: current.getTime(),
        endMs: periodEnd.getTime(),
        count: 0
      });
      current = nextDate;
    }

    const requestedTypes = filters?.type || ['books', 'unstructuredDocuments', 'articles', 'topics', 'attachments'];
    const results = [];

    const Document = require('../models/Document');
    const Topic = require('../models/Topic');
    const UnstructuredDocument = require('../models/UnstructuredDocument');

    const bucketData = async (type, model) => {
      if (!requestedTypes.includes(type)) return;
      const docs = await model.find({ createdAt: { $gte: start, $lt: end } }).select('createdAt').lean();
      
      // Clone base periods
      const periods = basePeriods.map(p => ({
        periodStartDate: p.periodStartDate,
        periodEndDate: p.periodEndDate,
        startMs: p.startMs,
        endMs: p.endMs,
        count: 0
      }));

      docs.forEach(doc => {
        const t = new Date(doc.createdAt).getTime();
        const bucket = periods.find(p => t >= p.startMs && t < p.endMs);
        if (bucket) bucket.count++;
      });

      // Cleanup internal fields
      periods.forEach(p => {
        delete p.startMs;
        delete p.endMs;
      });

      results.push({ type, periods });
    };

    await bucketData('books', Document);
    await bucketData('topics', Topic);
    await bucketData('unstructuredDocuments', UnstructuredDocument);

    if (requestedTypes.includes('articles')) {
      const periods = basePeriods.map(p => ({ periodStartDate: p.periodStartDate, periodEndDate: p.periodEndDate, count: 0 }));
      results.push({ type: 'articles', periods });
    }
    if (requestedTypes.includes('attachments')) {
      const periods = basePeriods.map(p => ({ periodStartDate: p.periodStartDate, periodEndDate: p.periodEndDate, count: 0 }));
      results.push({ type: 'attachments', periods });
    }

    res.json({
      startDate,
      endDate,
      groupByPeriod,
      results
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analytics/v1/topics/ratings
 * Responds with information about the most rated topics.
 */
router.post('/v1/topics/ratings', auth, analyticsEditor, async (req, res) => {
  try {
    const { startDate, endDate, filters, paging, ratingType, sortOrder } = req.body;
    const page = paging?.page || 1;
    const perPage = paging?.perPage || 10;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }

    // Aggregate ratings grouped by topicId (inclusive end; align with reader /feedback sync)
    const aggregation = [
      { 
        $match: { 
          topicId: { $ne: null },
          createdAt: { $gte: start, $lte: end }
        } 
      },
      {
        $group: {
          _id: '$topicId',
          totalCount: { $sum: 1 },
          average: { $avg: '$value' }
        }
      }
    ];

    let ratingResults = await Rating.aggregate(aggregation);

    // Fetch topic details
    const topicIds = ratingResults.map(r => r._id);
    const topics = await Topic.find({ _id: { $in: topicIds } })
      .select('title documentId documentType')
      .lean();

    // Map ratings to topics
    let results = ratingResults.map(rr => {
      const topic = topics.find(t => t._id.toString() === rr._id.toString());
      if (!topic) return null;
      return {
        id: rr._id.toString(),
        title: topic.title,
        documentId: topic.documentId?.toString(),
        documentType: topic.documentType,
        rating: {
          type: ratingType || 'Stars',
          totalCount: rr.totalCount,
          average: rr.average
        }
      };
    }).filter(r => r !== null);

    // Fetch document details for metadata filtering and display
    const docIds = [...new Set(results.map(r => r.documentId).filter(Boolean))];
    const docs = await Document.find({ _id: { $in: docIds } }).select('title metadata customFields').lean();
    const unstructs = await UnstructuredDocument.find({ _id: { $in: docIds } }).select('title metadata').lean();

    results = results.map(r => {
      const doc = docs.find(d => d._id.toString() === r.documentId) || unstructs.find(u => u._id.toString() === r.documentId);
      if (!doc) return r;
      
      let metaArr = [];
      if (doc.metadata?.customFields) {
        // Handle Map if it is a Map
        const fields = doc.metadata.customFields instanceof Map ? doc.metadata.customFields : new Map(Object.entries(doc.metadata.customFields));
        for (let [k, v] of fields.entries()) {
          metaArr.push({ key: k, label: k, values: [v] });
        }
      } else if (doc.customFields) {
        for (let [k, v] of Object.entries(doc.customFields)) {
          metaArr.push({ key: k, label: k, values: [v] });
        }
      }

      return {
        ...r,
        document: {
          id: r.documentId,
          title: doc.title,
          type: r.documentType === 'UNSTRUCTURED_DOCUMENT' ? 'UNSTRUCTURED_DOCUMENT' : 'STRUCTURED_DOCUMENT',
          metadata: metaArr
        }
      };
    });

    // Apply Filters
    if (filters) {
      // Filter by Topic Title
      if (filters.titleContains) {
        const q = filters.titleContains.toLowerCase();
        results = results.filter(r => r.title.toLowerCase().includes(q));
      }
      // Filter by Document Title
      if (filters.document?.titleContains) {
        const q = filters.document.titleContains.toLowerCase();
        results = results.filter(r => r.document?.title.toLowerCase().includes(q));
      }
      // Filter by Document Metadata
      if (filters.document?.metadata && filters.document.metadata.length > 0) {
        results = results.filter(r => {
          if (!r.document?.metadata) return false;
          return filters.document.metadata.every(f => {
            const meta = r.document.metadata.find(m => m.key === f.key);
            if (!meta) return false;
            return f.values.some(v => meta.values.includes(v));
          });
        });
      }
    }

    // Sort
    const isWorstFirst = sortOrder === 'worstFirst';
    results.sort((a, b) => {
      const diff = a.rating.average - b.rating.average;
      return isWorstFirst ? diff : -diff;
    });

    // Paging
    const totalCount = results.length;
    const startIndex = (page - 1) * perPage;
    const paginatedResults = results.slice(startIndex, startIndex + perPage);

    res.json({
      startDate,
      endDate,
      paging: {
        page,
        perPage,
        totalCount,
        lastPage: startIndex + perPage >= totalCount
      },
      results: paginatedResults.map(r => ({
        id: r.id,
        title: r.title,
        link: `/reader/topic/${r.id}`, // Mock reader link
        rating: r.rating,
        document: r.document
      })),
      ratingType: ratingType || 'Stars'
    });

  } catch (err) {
    console.error('Error in /v1/topics/ratings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/analytics/v1/traffic/events/time-series
 * @desc    Traffic → Events chart (Fluid Topics-style keys; Analytics + ratings + assets)
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/traffic/events/time-series',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { startDate, endDate, groupByPeriod = 'month' } = req.body || {};
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }
      const { getEventsTimeSeries } = require('../services/analytics/eventsTimeSeriesService');
      const payload = await getEventsTimeSeries({ startDate, endDate, groupByPeriod });
      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/traffic/page-views
 * @desc    Time series of page views (`page.display` + data.path) for Traffic → Page views
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/page-views',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getPageViewsTimeSeries } = require('../services/analytics/pageViewsTimeSeriesService');
      const payload = await getPageViewsTimeSeries(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/traffic/countries
 * @desc    Traffic share by country (ISO from IP at ingest; geoip-lite)
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/countries',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getCountriesTraffic } = require('../services/analytics/countriesTrafficService');
      const payload = await getCountriesTraffic(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/traffic/browsers
 * @desc    Traffic share by browser family (User-Agent), static assets excluded
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/browsers',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getBrowsersTraffic } = require('../services/analytics/browsersTrafficService');
      const payload = await getBrowsersTraffic(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/traffic/device-types
 * @desc    Sessions by device (viewport from page.display), evolution + distribution
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/device-types',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getDeviceTypesAnalytics } = require('../services/analytics/deviceTypesAnalyticsService');
      const payload = await getDeviceTypesAnalytics(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/search/terms
 * @desc    Search term popularity (portal search only), paginated
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/search/terms',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getSearchTermsAnalytics } = require('../services/analytics/searchTermsAnalyticsService');
      const payload = await getSearchTermsAnalytics(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/search/no-results
 * @desc    Zero-hit portal searches (terms + facets), paginated
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/search/no-results',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getSearchNoResultsAnalytics } = require('../services/analytics/searchNoResultsAnalyticsService');
      const payload = await getSearchNoResultsAnalytics(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v1/traffic/user-activity
 * @desc    Get user traffic analytics (active vs total users)
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/traffic/user-activity',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, groupByPeriod = 'month' } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const realms = ['internal', 'sso', 'ldap', 'oidc'];

      // Helper to generate periods based on interval
      const generatePeriods = (s, e, group) => {
        const p = [];
        let cur = new Date(s);
        while (cur < e) {
          let pEnd = new Date(cur);
          if (group === 'day') pEnd.setDate(pEnd.getDate() + 1);
          else if (group === 'week') pEnd.setDate(pEnd.getDate() + 7);
          else if (group === 'month') pEnd.setMonth(pEnd.getMonth() + 1);
          
          if (pEnd > e) pEnd = new Date(e);
          
          p.push({
            periodStartDate: cur.toISOString(),
            periodEndDate: pEnd.toISOString(),
          });
          cur = new Date(pEnd);
        }
        return p;
      };

      const periods = generatePeriods(start, end, groupByPeriod);
      
      // OPTIMIZATION: Fetch all necessary data in two parallel queries
      const [users, analyticsEvents] = await Promise.all([
        User.find({ isActive: true }).select('_id realm createdAt').lean(),
        Analytics.find({ timestamp: { $gte: start, $lte: end } }).select('userId timestamp').lean()
      ]);

      const usersByRealm = { internal: [], sso: [], ldap: [], oidc: [] };
      const realmByUser = {};
      
      users.forEach(u => {
        if (usersByRealm[u.realm]) {
          usersByRealm[u.realm].push(u);
          realmByUser[u._id.toString()] = u.realm;
        }
      });

      // Pre-bucket active users by realm and period index
      const activeSets = {};
      realms.forEach(r => {
        periods.forEach((_, i) => activeSets[`${r}_${i}`] = new Set());
      });

      const periodTimes = periods.map(p => ({
        s: new Date(p.periodStartDate).getTime(),
        e: new Date(p.periodEndDate).getTime()
      }));

      analyticsEvents.forEach(ev => {
        const r = realmByUser[ev.userId?.toString()];
        if (!r) return;
        const evTime = new Date(ev.timestamp).getTime();
        for (let i = 0; i < periodTimes.length; i++) {
          if (evTime >= periodTimes[i].s && evTime < periodTimes[i].e) {
            activeSets[`${r}_${i}`].add(ev.userId.toString());
            break;
          }
        }
      });

      const finalResults = [];

      for (const realm of realms) {
        const realmPeriods = [];
        const rUsers = usersByRealm[realm] || [];

        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          const pEnd = periodTimes[i].e;

          let totalCount = 0;
          for (let j = 0; j < rUsers.length; j++) {
            if (new Date(rUsers[j].createdAt).getTime() <= pEnd) totalCount++;
          }

          realmPeriods.push({
            ...p,
            activeCount: activeSets[`${realm}_${i}`].size,
            totalCount
          });
        }
        finalResults.push({
          realm,
          periods: realmPeriods
        });
      }

      res.json({
        startDate,
        endDate,
        groupByPeriod,
        results: finalResults
      });
    } catch (err) {
      console.error('User Traffic Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /api/analytics/v1/users/assets/time-report
 * @desc    Get user assets creation report over time
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/users/assets/time-report',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, groupByPeriod = 'month', filters } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const requestedTypes = filters?.type || [
        'bookmarks',
        'personalBooks',
        'savedSearches',
        'savedSearchesWithAlert',
        'collections'
      ];

      // Helper to generate periods
      const generatePeriods = (s, e, group) => {
        const p = [];
        let cur = new Date(s);
        while (cur < e) {
          let pEnd = new Date(cur);
          if (group === 'day') pEnd.setDate(pEnd.getDate() + 1);
          else if (group === 'week') pEnd.setDate(pEnd.getDate() + 7);
          else if (group === 'month') pEnd.setMonth(pEnd.getMonth() + 1);
          if (pEnd > e) pEnd = new Date(e);
          p.push({ periodStartDate: cur.toISOString(), periodEndDate: pEnd.toISOString() });
          cur = new Date(pEnd);
        }
        return p;
      };

      const periods = generatePeriods(start, end, groupByPeriod);
      const results = [];

      for (const type of requestedTypes) {
        let Model;
        let extraFilter = {};

        switch (type) {
          case 'bookmarks': Model = Bookmark; break;
          case 'personalBooks': Model = PersonalBook; break;
          case 'savedSearches': Model = SavedSearch; break;
          case 'savedSearchesWithAlert': Model = SavedSearch; extraFilter = { notify: true }; break;
          case 'collections': Model = Collection; break;
          case 'personalTopics': Model = null; break; // Placeholder for UI parity
          default: continue;
        }

        const typePeriods = periods.map(p => ({ ...p, count: 0 }));

        if (Model) {
          const docs = await Model.find({
            ...extraFilter,
            createdAt: { $gte: start, $lte: end }
          }).select('createdAt').lean();

          const periodTimes = periods.map(p => ({
            s: new Date(p.periodStartDate).getTime(),
            e: new Date(p.periodEndDate).getTime()
          }));

          for (let i = 0; i < docs.length; i++) {
            const time = new Date(docs[i].createdAt).getTime();
            for (let j = 0; j < periodTimes.length; j++) {
              if (time >= periodTimes[j].s && time < periodTimes[j].e) {
                typePeriods[j].count++;
                break;
              }
            }
          }
        }
        
        results.push({ type, periods: typePeriods });
      }

      res.json({ startDate, endDate, groupByPeriod, results });
    } catch (err) {
      console.error('User Assets Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/* ====================================================================
 * Helper: generatePeriods  (shared between multiple endpoints below)
 * ==================================================================*/
function generatePeriodsHelper(startDate, endDate, groupByPeriod) {
  const p = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur < end) {
    let pEnd = new Date(cur);
    if (groupByPeriod === 'day') pEnd.setDate(pEnd.getDate() + 1);
    else if (groupByPeriod === 'week') pEnd.setDate(pEnd.getDate() + 7);
    else pEnd.setMonth(pEnd.getMonth() + 1);
    if (pEnd > end) pEnd = new Date(end);
    p.push({ periodStartDate: cur.toISOString(), periodEndDate: pEnd.toISOString() });
    cur = new Date(pEnd);
  }
  return p;
}

/* ====================================================================
 * Helper: classifySource  — heuristic to derive source type from
 *         the referrer URL stored in analytics data.
 * ==================================================================*/
function classifySource(referrer) {
  if (!referrer || referrer === '' || referrer === 'unknown') {
    return { type: 'direct', source: 'unknown' };
  }
  const lower = referrer.toLowerCase();
  // Social
  if (/facebook\.com|fb\.com/.test(lower))   return { type: 'social_facebook',  source: referrer };
  if (/twitter\.com|t\.co/.test(lower))      return { type: 'social_twitter',   source: referrer };
  if (/linkedin\.com/.test(lower))           return { type: 'social_linkedin',  source: referrer };
  if (/reddit\.com/.test(lower))             return { type: 'social_reddit',    source: referrer };
  // Organic search engines
  if (/google\.(com|[a-z]{2,3})/.test(lower))  return { type: 'organic_google',  source: referrer };
  if (/bing\.com/.test(lower))                return { type: 'organic_bing',    source: referrer };
  if (/yahoo\.com/.test(lower))               return { type: 'organic_yahoo',   source: referrer };
  if (/yandex\./.test(lower))                 return { type: 'organic_yandex',  source: referrer };
  if (/duckduckgo\.com/.test(lower))          return { type: 'organic_duckduckgo', source: referrer };
  if (/ecosia\.org/.test(lower))              return { type: 'organic_ecosia',  source: referrer };
  if (/brave\.com/.test(lower))               return { type: 'organic_brave',   source: referrer };
  // Default: referral
  return { type: 'referral', source: referrer };
}

function sourceCategory(fullType) {
  if (fullType.startsWith('social'))  return 'social';
  if (fullType.startsWith('organic')) return 'organic';
  if (fullType === 'direct')          return 'direct';
  return 'referral';
}

/**
 * @route   POST /api/analytics/v2/traffic/session-list
 * @desc    Paginated session rows with search/view metrics (Analytics-derived)
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/session-list',
  auth,
  analyticsEditor,
  async (req, res, next) => {
    try {
      const { getSessionList } = require('../services/analytics/sessionListService');
      const payload = await getSessionList(req.body || {});
      res.json(payload);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * @route   POST /api/analytics/v2/traffic/sessions
 * @desc    Number of user sessions logged during a selected period
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v2/traffic/sessions',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, groupByPeriod = 'month' } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const periods = generatePeriodsHelper(start, end, groupByPeriod);

      // Fetch all events in the range in one query
      const events = await Analytics.find({
        timestamp: { $gte: start, $lt: end }
      })
        .select('sessionId timestamp userId ip')
        .lean();

      const periodTimes = periods.map(p => ({
        s: new Date(p.periodStartDate).getTime(),
        e: new Date(p.periodEndDate).getTime()
      }));

      const sessionKeyByEvent = resolveSessionKeys(events);

      // Count distinct session keys per period (real sessionId or synthetic inactivity-based)
      const sessionSets = periods.map(() => new Set());

      for (const ev of events) {
        const sid = sessionKeyByEvent.get(String(ev._id)) || String(ev._id);
        const t = new Date(ev.timestamp).getTime();
        for (let i = 0; i < periodTimes.length; i++) {
          if (t >= periodTimes[i].s && t < periodTimes[i].e) {
            sessionSets[i].add(sid);
            break;
          }
        }
      }

      const results = periods.map((p, i) => ({
        periodStartDate: p.periodStartDate,
        periodEndDate: p.periodEndDate,
        sessionCount: sessionSets[i].size
      }));

      res.json({ startDate, endDate, results });
    } catch (err) {
      console.error('Sessions Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /api/analytics/v1/traffic/sources/evolution
 * @desc    Number of visits grouped by source type over time
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/traffic/sources/evolution',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, groupByPeriod = 'month', filters } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const periods = generatePeriodsHelper(start, end, groupByPeriod);

      const allowedSources = filters?.sourceTypes || ['direct', 'organic', 'referral', 'social'];

      // Fetch view-type events with their referrer data
      const matchQuery = { timestamp: { $gte: start, $lt: end } };
      if (filters?.authenticated === true)  matchQuery.userId = { $ne: null };
      if (filters?.authenticated === false) matchQuery.userId = null;

      const events = await Analytics.find(matchQuery)
        .select('timestamp data.filters')
        .lean();

      const periodTimes = periods.map(p => ({
        s: new Date(p.periodStartDate).getTime(),
        e: new Date(p.periodEndDate).getTime()
      }));

      // Build a count map: sourceCategory -> period index -> count
      const countMap = {};
      allowedSources.forEach(s => {
        countMap[s] = new Array(periods.length).fill(0);
      });

      for (const ev of events) {
        const referrer = ev.data?.filters?.get?.('referrer') || ev.data?.filters?.referrer || '';
        const { type } = classifySource(referrer);
        const cat = sourceCategory(type);
        if (!countMap[cat]) continue;

        const t = new Date(ev.timestamp).getTime();
        for (let i = 0; i < periodTimes.length; i++) {
          if (t >= periodTimes[i].s && t < periodTimes[i].e) {
            countMap[cat][i]++;
            break;
          }
        }
      }

      const results = allowedSources
        .filter(s => countMap[s])
        .map(name => ({
          name,
          periods: periods.map((p, i) => ({
            periodStartDate: p.periodStartDate,
            periodEndDate: p.periodEndDate,
            count: countMap[name][i]
          }))
        }));

      res.json({ startDate, endDate, results });
    } catch (err) {
      console.error('Sources Evolution Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /api/analytics/v1/traffic/sources/destination
 * @desc    Number of visits for each source type with target page type
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/traffic/sources/destination',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, filters } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const matchQuery = { timestamp: { $gte: start, $lt: end } };
      if (filters?.authenticated === true)  matchQuery.userId = { $ne: null };
      if (filters?.authenticated === false) matchQuery.userId = null;

      const events = await Analytics.find(matchQuery)
        .select('eventType data.filters data.topicId data.documentId')
        .lean();

      // Group by (fullType, source, targetPageType) -> count
      const buckets = {};

      for (const ev of events) {
        const referrer = ev.data?.filters?.get?.('referrer') || ev.data?.filters?.referrer || '';
        const classified = classifySource(referrer);

        let targetPageType = 'unknown';
        if (ev.eventType === 'search') targetPageType = 'searchPage';
        else if (ev.eventType === 'view' && ev.data?.topicId) targetPageType = 'readerPage';
        else if (ev.eventType === 'view' && ev.data?.documentId) targetPageType = 'viewerPage';
        else if (ev.eventType === 'view') targetPageType = 'homePage';

        const key = `${classified.type}||${classified.source}||${targetPageType}`;
        buckets[key] = (buckets[key] || 0) + 1;
      }

      const results = Object.entries(buckets).map(([key, count]) => {
        const [type, source, targetPageType] = key.split('||');
        return { type, source, targetPageType, count };
      }).sort((a, b) => b.count - a.count);

      res.json({ startDate, endDate, results });
    } catch (err) {
      console.error('Sources Destination Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /api/analytics/v1/traffic/sources/detail
 * @desc    Detailed information about visit sources (sunburst hierarchy)
 * @access  Private (Admin/Analytics roles)
 */
router.post(
  '/v1/traffic/sources/detail',
  auth,
  analyticsEditor,
  async (req, res) => {
    try {
      const { startDate, endDate, filters } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const matchQuery = { timestamp: { $gte: start, $lt: end } };
      if (filters?.authenticated === true)  matchQuery.userId = { $ne: null };
      if (filters?.authenticated === false) matchQuery.userId = null;

      const events = await Analytics.find(matchQuery)
        .select('data.filters')
        .lean();

      // Build hierarchy:  category -> childName -> count
      const tree = {};

      for (const ev of events) {
        const referrer = ev.data?.filters?.get?.('referrer') || ev.data?.filters?.referrer || '';
        const classified = classifySource(referrer);
        const cat = sourceCategory(classified.type);

        if (!tree[cat]) tree[cat] = { total: 0, children: {} };
        tree[cat].total++;

        // For 'direct' the child is always "unknown"
        const childName = cat === 'direct'
          ? 'unknown'
          : classified.type.includes('_')
            ? classified.type.split('_').slice(1).join('_') // e.g. "Google" from "organic_google"
            : classified.source;

        const displayName = childName.charAt(0).toUpperCase() + childName.slice(1);
        tree[cat].children[displayName] = (tree[cat].children[displayName] || 0) + 1;
      }

      const results = Object.entries(tree).map(([name, { total, children }]) => ({
        name,
        value: total,
        children: Object.entries(children)
          .map(([cName, cValue]) => ({ name: cName, value: cValue, children: [] }))
          .sort((a, b) => b.value - a.value)
      }));

      res.json({ startDate, endDate, results });
    } catch (err) {
      console.error('Sources Detail Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
