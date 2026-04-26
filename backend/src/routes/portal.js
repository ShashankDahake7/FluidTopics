const express  = require('express');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const { getElasticClient } = require('../config/elasticsearch');
const config   = require('../config/env');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Pull the signed-in user's saved Filter-results preferences. Returns null
// when the request is anonymous or the user hasn't saved any filters, so
// callers can short-circuit and skip the extra Mongo work.
const getUserFilters = (req) => {
  const u = req.user;
  if (!u) return null;
  const docIds   = (u.preferences?.documentIds || []).map(String);
  const topicIds = (u.preferences?.topicIds    || []).map(String);
  const releaseNotesOnly = !!u.preferences?.releaseNotesOnly;
  if (docIds.length === 0 && topicIds.length === 0 && !releaseNotesOnly) return null;
  return { docIds, topicIds, releaseNotesOnly };
};

// ---------------------------------------------------------------------------
// GET /api/portal/documents — public list of completed documents
// ---------------------------------------------------------------------------
router.get('/documents', optionalAuth, async (req, res, next) => {
  try {
    const filters = getUserFilters(req);
    const query = { status: 'completed' };

    if (filters) {
      const allowedDocIds = new Set(filters.docIds);
      // If the user picked specific topics but not their parent docs,
      // include those parents automatically so the doc can be opened.
      if (filters.topicIds.length) {
        const topicDocs = await Topic.find({ _id: { $in: filters.topicIds } })
          .select('documentId').lean();
        topicDocs.forEach((t) => t.documentId && allowedDocIds.add(String(t.documentId)));
      }
      // Release-Notes-only: limit docs whose tags include "Release Notes"
      if (filters.releaseNotesOnly) {
        const rnDocs = await Document.find({ status: 'completed', 'metadata.tags': 'Release Notes' })
          .select('_id').lean();
        rnDocs.forEach((d) => allowedDocIds.add(String(d._id)));
      }
      if (allowedDocIds.size === 0) {
        return res.json({ documents: [] });
      }
      query._id = { $in: Array.from(allowedDocIds) };
    }

    // Apply priority-document boost: boosted docs sort first, then the rest.
    const priorityDocIds = new Set((req.user?.preferences?.priorityDocumentIds || []).map(String));
    const docs = await Document.find(query)
      .sort({ createdAt: -1 })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication createdAt')
      .lean();

    if (priorityDocIds.size) {
      docs.sort((a, b) => {
        const ap = priorityDocIds.has(String(a._id)) ? 0 : 1;
        const bp = priorityDocIds.has(String(b._id)) ? 0 : 1;
        return ap - bp;
      });
    }

    res.json({
      documents: docs.map((d) => ({
        _id:           d._id,
        title:         d.publication?.portalTitle || d.title,
        format:        d.sourceFormat,
        topicCount:    d.topicIds?.length || 0,
        tags:          d.metadata?.tags || [],
        product:       d.metadata?.product || '',
        description:   d.metadata?.description || '',
        isPaligo:      d.isPaligoFormat || false,
        companyName:   d.publication?.companyName || '',
        logoPath:      d.publication?.logoPath || '',
        backgroundPath:d.publication?.backgroundPath || '',
        createdAt:     d.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id — single document + topic list
// ---------------------------------------------------------------------------
router.get('/documents/:id', optionalAuth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, status: 'completed' })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication tocTree createdAt')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });

    const topicQuery = { documentId: req.params.id };
    const filters = getUserFilters(req);
    // If the user picked specific topics, restrict the TOC to those — but
    // only when they overlap this document. Otherwise leave the full TOC.
    if (filters?.topicIds?.length) {
      const inThisDoc = filters.topicIds.length > 0;
      if (inThisDoc) topicQuery._id = { $in: filters.topicIds };
    }

    let topics = await Topic.find(topicQuery)
      .sort({ 'hierarchy.order': 1, createdAt: 1 })
      .select('title slug originId permalink hierarchy.level hierarchy.parent hierarchy.children hierarchy.order timeModified')
      .lean();

    // If the topic filter ended up matching nothing in this doc, fall back to
    // the full TOC so the doc isn't an empty page.
    if (filters?.topicIds?.length && topics.length === 0) {
      topics = await Topic.find({ documentId: req.params.id })
        .sort({ 'hierarchy.order': 1, createdAt: 1 })
        .select('title slug originId permalink hierarchy.level hierarchy.parent hierarchy.children hierarchy.order timeModified')
        .lean();
    }

    res.json({ document: doc, topics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/navigation/:documentId — full TOC tree
// ---------------------------------------------------------------------------
router.get('/navigation/:documentId', async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.documentId)
      .select('title isPaligoFormat tocTree publication')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });

    res.json({
      documentTitle: doc.publication?.portalTitle || doc.title,
      isPaligo:      doc.isPaligoFormat || false,
      publication:   doc.publication || {},
      tocTree:       doc.tocTree || null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id/by-permalink?permalink=shifts/create-a-shift.html
// Returns the topic matching a Paligo permalink
// ---------------------------------------------------------------------------
router.get('/documents/:id/by-permalink', async (req, res, next) => {
  try {
    const { permalink } = req.query;
    if (!permalink) return res.status(400).json({ error: 'permalink is required' });

    const topic = await Topic.findOne({
      documentId: req.params.id,
      permalink,
    }).lean();

    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id/search?q=foo
// Search topic titles AND body text within a single document.
// Returns IDs that the sidebar can use to filter the TOC.
// ---------------------------------------------------------------------------
router.get('/documents/:id/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    if (!q) return res.json({ total: 0, matches: [] });

    const filters = getUserFilters(req);
    const esFilter = [{ term: { documentId: String(req.params.id) } }];
    if (filters?.topicIds?.length) {
      esFilter.push({ terms: { topicId: filters.topicIds } });
    }
    if (filters?.releaseNotesOnly) {
      esFilter.push({ terms: { tags: ['Release Notes'] } });
    }

    const client = getElasticClient();

    let esResult;
    try {
      esResult = await client.search({
        index: config.elasticsearch.index,
        body: {
          query: {
            bool: {
              must: [{
                multi_match: {
                  query: q,
                  fields: ['title^3', 'content', 'tags^2'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              }],
              filter: esFilter,
            },
          },
          highlight: {
            fields: {
              title:   { number_of_fragments: 0 },
              content: { fragment_size: 180, number_of_fragments: 2 },
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          },
          size: limit,
        },
      });
    } catch (esErr) {
      // Fall through to Mongo if ES is unreachable
      console.warn('ES in-doc search failed, falling back to Mongo:', esErr.message);
    }

    if (esResult && esResult.hits) {
      const hits = esResult.hits.hits || [];
      const totalRaw = esResult.hits.total;
      const total = typeof totalRaw === 'object' ? (totalRaw?.value ?? 0) : (totalRaw ?? 0);

      // Look up parent ancestry for breadcrumbs (single batched query)
      const ids = hits.map((h) => h._id);
      const topics = ids.length
        ? await Topic.find({ _id: { $in: ids } })
            .select('_id title hierarchy.parent')
            .lean()
        : [];
      const allParentIds = topics
        .map((t) => t.hierarchy?.parent)
        .filter(Boolean);
      const parents = allParentIds.length
        ? await Topic.find({ _id: { $in: allParentIds } })
            .select('_id title hierarchy.parent')
            .lean()
        : [];
      const byId = new Map([...topics, ...parents].map((t) => [String(t._id), t]));
      const breadcrumb = (id) => {
        const path = [];
        let cur = byId.get(String(id));
        let safety = 6;
        while (cur && safety-- > 0) {
          if (cur.hierarchy?.parent) {
            const p = byId.get(String(cur.hierarchy.parent));
            if (!p) break;
            path.unshift(p.title);
            cur = p;
          } else break;
        }
        return path;
      };

      const matches = hits.map((h) => {
        const src = h._source || {};
        const hl  = h.highlight || {};
        const snippet = (hl.content && hl.content[0]) || '';
        const titleHtml = (hl.title && hl.title[0]) || src.title || '';
        return {
          _id: h._id,
          title: src.title || '',
          titleHtml,
          snippet,
          path: breadcrumb(h._id),
        };
      });

      return res.json({ total, matches });
    }

    // -------- Mongo fallback (regex on title + content.text) --------
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const mongoQuery = {
      documentId: req.params.id,
      $or: [{ title: rx }, { 'content.text': rx }],
    };
    if (filters?.topicIds?.length) {
      mongoQuery._id = { $in: filters.topicIds };
    }
    const topics = await Topic.find(mongoQuery)
      .select('_id title content.text hierarchy.parent')
      .limit(limit)
      .lean();

    const parentIds = topics.map((t) => t.hierarchy?.parent).filter(Boolean);
    const parents = parentIds.length
      ? await Topic.find({ _id: { $in: parentIds } })
          .select('_id title hierarchy.parent')
          .lean()
      : [];
    const byId = new Map([...topics, ...parents].map((t) => [String(t._id), t]));
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const highlight = (s) => escapeHtml(s).replace(new RegExp(escaped, 'ig'), (m) => `<mark>${m}</mark>`);
    const breadcrumb = (id) => {
      const path = [];
      let cur = byId.get(String(id));
      let safety = 6;
      while (cur && safety-- > 0) {
        if (cur.hierarchy?.parent) {
          const p = byId.get(String(cur.hierarchy.parent));
          if (!p) break;
          path.unshift(p.title);
          cur = p;
        } else break;
      }
      return path;
    };
    const makeSnippet = (text) => {
      if (!text) return '';
      const idx = text.search(rx);
      const start = Math.max(0, (idx >= 0 ? idx : 0) - 60);
      const end = Math.min(text.length, start + 200);
      return (start > 0 ? '…' : '') + highlight(text.slice(start, end)) + (end < text.length ? '…' : '');
    };

    res.json({
      total: topics.length,
      matches: topics.map((t) => ({
        _id: String(t._id),
        title: t.title,
        titleHtml: highlight(t.title),
        snippet: makeSnippet(t.content?.text),
        path: breadcrumb(t._id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/topics-index — flat list of every topic's id + title.
// Used by the search-preferences "Edit filters" panel to populate the
// FT:TITLE picker. Optional ?documentId= filter narrows to one document.
// ---------------------------------------------------------------------------
router.get('/topics-index', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.documentId) query.documentId = req.query.documentId;
    const topics = await Topic.find(query)
      .select('_id title documentId')
      .sort({ title: 1 })
      .limit(5000)
      .lean();
    res.json({
      topics: topics.map((t) => ({
        _id: String(t._id),
        title: t.title,
        documentId: String(t.documentId || ''),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/topics/:id — single topic content (public)
// ---------------------------------------------------------------------------
router.get('/topics/:id', optionalAuth, async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .select('title slug content.html documentId hierarchy metadata originId permalink timeModified accessLevel')
      .lean();

    if (!topic) return res.status(404).json({ error: 'Not found' });

    // Enforce access control
    if (topic.accessLevel === 'authenticated' && !req.user) {
      return res.status(401).json({ error: 'Authentication required to view this content' });
    }
    if (topic.accessLevel === 'admin' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
