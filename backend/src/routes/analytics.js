const express = require('express');
const {
  trackEvent,
  getDashboardStats,
  getContentGaps,
  exportAnalytics,
} = require('../services/analytics/analyticsService');
const { auth, requireTierOrAdminRoles, optionalAuth } = require('../middleware/auth');
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

// POST /api/analytics/v2/documents/views-top — Top documents by view count
router.post('/v2/documents/views-top', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { startDate, endDate, paging, filters } = req.body;
    const page = paging?.page || 1;
    const perPage = paging?.perPage || 10;
    
    const Document = require('../models/Document');
    const UnstructuredDocument = require('../models/UnstructuredDocument');
    const Analytics = require('../models/Analytics');
    
    let userDocCounts = null;
    if (filters?.userId) {
      const views = await Analytics.aggregate([
        { $match: { eventType: 'view', userId: new (require('mongoose').Types.ObjectId)(filters.userId) } },
        { $group: { _id: '$data.documentId', count: { $sum: 1 } } }
      ]);
      userDocCounts = {};
      views.forEach(v => {
        if (v._id) userDocCounts[v._id.toString()] = v.count;
      });
    }
    
    // We get all documents, sort by viewCount descending
    const docs = await Document.find({}).sort({ viewCount: -1 }).select('_id title viewCount metadata createdAt originalFilename customFields');
    const unstruct = await UnstructuredDocument.find({}).sort({ viewCount: -1 }).select('_id title viewCount metadata createdAt filename');
    
    let all = [
      ...docs.map(d => {
        let metaObj = {};
        if (d.metadata && d.metadata.customFields) {
          for (let [k, v] of d.metadata.customFields.entries()) {
             metaObj[k] = v;
          }
        }
        const docId = d._id.toString();
        const displayCount = userDocCounts ? (userDocCounts[docId] || 0) : (d.viewCount || 0);
        return {
          id: docId,
          title: d.title || d.originalFilename,
          type: 'STRUCTURED_DOCUMENT',
          displayCount,
          link: `/dashboard/docs/${docId}`,
          metadata: Object.entries(metaObj).map(([k, v]) => ({ key: k, label: k, values: [v] }))
        };
      }),
      ...unstruct.map(u => {
        const uId = u._id.toString();
        const displayCount = userDocCounts ? (userDocCounts[uId] || 0) : (u.viewCount || 0);
        return {
          id: uId,
          title: u.title || u.filename,
          type: 'UNSTRUCTURED_DOCUMENT',
          displayCount,
          link: `/dashboard/unstructured/${uId}`,
          metadata: []
        };
      })
    ];
    
    if (userDocCounts) {
       all = all.filter(d => d.displayCount > 0);
    }
    
    // Apply type filter if specified
    if (filters && filters.type && filters.type.length > 0) {
      const allowedTypes = [];
      if (filters.type.includes('books')) allowedTypes.push('STRUCTURED_DOCUMENT');
      if (filters.type.includes('unstructuredDocuments')) allowedTypes.push('UNSTRUCTURED_DOCUMENT');
      
      if (allowedTypes.length > 0) {
        all = all.filter(d => allowedTypes.includes(d.type));
      }
    }
    
    // Apply metadata filtering if specified
    if (filters && filters.metadata && filters.metadata.length > 0) {
      all = all.filter(doc => {
        // Doc must match all provided metadata filters (AND logic between keys, OR logic within values)
        return filters.metadata.every(filter => {
          const docMeta = doc.metadata.find(m => m.key === filter.key);
          if (!docMeta) return false;
          // Check if any of the filter values match the doc's metadata values
          return filter.values.some(val => docMeta.values.includes(val));
        });
      });
    }

    // Sort combined by displayCount desc
    all.sort((a, b) => b.displayCount - a.displayCount);
    
    const totalCount = all.length;
    const startIdx = (page - 1) * perPage;
    const results = all.slice(startIdx, startIdx + perPage);
    
    res.json({
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      totalDisplayCount: all.reduce((sum, d) => sum + d.displayCount, 0),
      paging: {
        page,
        perPage,
        totalCount,
        lastPage: startIdx + perPage >= totalCount
      },
      results
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v2/documents/:id/topics/views-heatmap
router.post('/v2/documents/:id/topics/views-heatmap', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;
    
    const Document = require('../models/Document');
    const doc = await Document.findById(id).populate('topicIds', '_id title viewCount');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    const results = (doc.topicIds || []).map(t => ({
      id: t._id.toString(),
      title: t.title,
      displayCount: t.viewCount || 0,
      children: []
    }));
    
    // Map TOC hierarchy if it exists
    if (doc.tocTree && Array.isArray(doc.tocTree)) {
      // Create a map to quickly look up topic view counts
      const topicViews = {};
      results.forEach(r => { topicViews[r.id] = r.displayCount; });
      
      const buildHierarchy = (nodes) => {
        return nodes.map(n => {
           const idStr = n.topicId?.toString() || n.id;
           return {
             id: idStr,
             title: n.title,
             displayCount: topicViews[idStr] || 0,
             children: n.children ? buildHierarchy(n.children) : []
           };
        });
      };
      
      const hierarchalResults = buildHierarchy(doc.tocTree);
      
      res.json({
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date().toISOString(),
        documentInformation: {
          id: doc._id.toString(),
          title: doc.title,
          type: 'STRUCTURED_DOCUMENT',
          displayCount: doc.viewCount || 0,
          link: `/dashboard/docs/${doc._id}`,
          metadata: []
        },
        results: hierarchalResults
      });
      return;
    }

    results.sort((a, b) => b.displayCount - a.displayCount);
    
    res.json({
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      documentInformation: {
        id: doc._id.toString(),
        title: doc.title,
        type: 'STRUCTURED_DOCUMENT',
        displayCount: doc.viewCount || 0,
        link: `/dashboard/docs/${doc._id}`,
        metadata: []
      },
      results
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/v2/topics/views-top — Top topics by view count
router.post('/v2/topics/views-top', auth, analyticsEditor, async (req, res, next) => {
  try {
    const { startDate, endDate, paging, filters } = req.body;
    const page = paging?.page || 1;
    const perPage = paging?.perPage || 10;
    
    const Topic = require('../models/Topic');
    const Analytics = require('../models/Analytics');

    let userTopicCounts = null;
    if (filters?.userId) {
      const views = await Analytics.aggregate([
        { $match: { eventType: 'view', userId: new (require('mongoose').Types.ObjectId)(filters.userId) } },
        { $group: { _id: '$data.topicId', count: { $sum: 1 } } }
      ]);
      userTopicCounts = {};
      views.forEach(v => {
        if (v._id) userTopicCounts[v._id.toString()] = v.count;
      });
    }
    
    let topicsQuery = Topic.find({}).populate('documentId', 'title metadata originalFilename');
    const topics = await topicsQuery.lean();
    
    let results = topics.map(t => {
      let metaObj = {};
      const doc = t.documentId || {};
      if (doc.metadata && doc.metadata.customFields) {
         // Because we used .lean(), customFields is a plain object or map-like structure
         if (doc.metadata.customFields instanceof Map) {
           for (let [k, v] of doc.metadata.customFields.entries()) {
             metaObj[k] = v;
           }
         } else {
           metaObj = { ...doc.metadata.customFields };
         }
      }
      const tId = t._id.toString();
      const views = userTopicCounts ? (userTopicCounts[tId] || 0) : (t.viewCount || 0);
      return {
        id: tId,
        topicTitle: t.title || 'Untitled Topic',
        views,
        documentTitle: doc.title || doc.originalFilename || 'Unknown Document',
        documentType: 'BOOK_PLAIN',
        documentId: doc._id?.toString(),
        metadata: metaObj
      };
    });

    if (userTopicCounts) {
      results = results.filter(t => t.views > 0);
    }

    if (filters && filters.type && filters.type.length > 0) {
      const allowedTypes = [];
      if (filters.type.includes('books')) allowedTypes.push('BOOK_PLAIN');
      if (filters.type.includes('unstructuredDocuments')) allowedTypes.push('UNSTRUCTURED_DOCUMENT');
      
      if (allowedTypes.length > 0) {
        results = results.filter(t => allowedTypes.includes(t.documentType));
      }
    }

    if (filters && filters.metadata && filters.metadata.length > 0) {
      results = results.filter(t => {
        return filters.metadata.every(filter => {
           const val = t.metadata[filter.key];
           if (!val) return false;
           return filter.values.includes(val);
        });
      });
    }

    results.sort((a, b) => b.views - a.views);

    const totalCount = results.length;
    const startIdx = (page - 1) * perPage;
    const paginatedResults = results.slice(startIdx, startIdx + perPage);
      
    res.json({
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      totalDisplayCount: results.reduce((sum, t) => sum + t.views, 0),
      paging: {
        page,
        perPage,
        totalCount,
        lastPage: startIdx + perPage >= totalCount
      },
      results: paginatedResults
    });
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

    // Aggregate ratings grouped by topicId
    const aggregation = [
      { 
        $match: { 
          topicId: { $ne: null },
          createdAt: { $gte: start, $lt: end }
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
      }).select('sessionId timestamp').lean();

      const periodTimes = periods.map(p => ({
        s: new Date(p.periodStartDate).getTime(),
        e: new Date(p.periodEndDate).getTime()
      }));

      // Count distinct sessionIds per period
      const sessionSets = periods.map(() => new Set());

      for (const ev of events) {
        const sid = ev.sessionId || ev._id.toString(); // fallback to _id if no sessionId
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
