const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const Attachment = require('../models/Attachment');
const config   = require('../config/env');
const { inDocumentSearch } = require('../services/search/searchService');
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
// GET /api/portal/by-pretty-url?path=foo/bar — resolve a pretty URL.
//
// Used by the /r/[...path] frontend route to find the document (and
// optionally the topic) addressed by a pretty URL. Returns:
//   { kind: 'document', document, topic? }   — matched a document URL
//   { kind: 'topic',    document, topic   }  — matched a topic URL
//   404 when nothing matches.
//
// We try document.prettyUrl first because the docs say document templates
// have priority over topic templates. The lookup is case-insensitive on
// the path itself but exact on the stored value (the engine already
// normalises everything before persisting).
// ---------------------------------------------------------------------------
router.get('/by-pretty-url', optionalAuth, async (req, res, next) => {
  try {
    const raw = String(req.query.path || '').trim();
    if (!raw) return res.status(400).json({ error: 'path query parameter is required' });
    // Tolerate leading/trailing slashes from the client; everything we
    // store starts with a single leading slash.
    const stripped = raw.replace(/^\/+|\/+$/g, '');
    if (!stripped) return res.status(400).json({ error: 'path query parameter is required' });
    const candidate = '/' + stripped;

    // 1) Document-level match wins.
    const doc = await Document.findOne({ prettyUrl: candidate, status: 'completed' })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication tocTree createdAt prettyUrl')
      .lean();
    if (doc) {
      return res.json({ kind: 'document', document: doc, topic: null });
    }

    // 2) Topic-level match. We pull the parent doc too so the page can
    // render the standard reader (TOC + selected topic).
    const topic = await Topic.findOne({ prettyUrl: candidate })
      .select('_id title slug documentId prettyUrl')
      .lean();
    if (topic) {
      const parent = await Document.findOne({ _id: topic.documentId, status: 'completed' })
        .select('title sourceFormat metadata topicIds isPaligoFormat publication tocTree createdAt prettyUrl')
        .lean();
      if (parent) {
        return res.json({ kind: 'topic', document: parent, topic });
      }
    }

    return res.status(404).json({ error: 'No content matches that URL' });
  } catch (err) { next(err); }
});

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
      .select('title sourceFormat metadata topicIds isPaligoFormat publication createdAt prettyUrl')
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
        prettyUrl:     d.prettyUrl || '',
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/search?q= — search scoped to documents.
// MUST come before /documents/:id so the literal "search" segment isn't
// captured by the dynamic id.
// ---------------------------------------------------------------------------
router.get('/documents/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ total: 0, documents: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');

    const matchingByMeta = await Document.find({
      status: 'completed',
      $or: [
        { title: rx },
        { 'metadata.description': rx },
        { 'metadata.tags': rx },
      ],
    }).select('_id').lean();
    const matchingByTopic = await Topic.aggregate([
      { $match: { $or: [{ title: rx }, { 'content.text': rx }] } },
      { $group: { _id: '$documentId' } },
    ]);
    const ids = new Set([
      ...matchingByMeta.map((d) => String(d._id)),
      ...matchingByTopic.map((d) => String(d._id)),
    ]);
    if (ids.size === 0) return res.json({ total: 0, documents: [] });

    const docs = await Document.find({ _id: { $in: [...ids] }, status: 'completed' })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication createdAt')
      .lean();
    res.json({
      total: docs.length,
      documents: docs.map((d) => ({
        _id: String(d._id),
        title: d.publication?.portalTitle || d.title,
        format: d.sourceFormat,
        topicCount: d.topicIds?.length || 0,
        tags: d.metadata?.tags || [],
        product: d.metadata?.product || '',
        description: d.metadata?.description || '',
        isPaligo: d.isPaligoFormat || false,
        companyName: d.publication?.companyName || '',
        createdAt: d.createdAt,
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id — single document + topic list
// ---------------------------------------------------------------------------
router.get('/documents/:id', optionalAuth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, status: 'completed' })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication tocTree createdAt prettyUrl')
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
      .select('title slug originId permalink prettyUrl hierarchy.level hierarchy.parent hierarchy.children hierarchy.order timeModified metadata.author')
      .lean();

    // If the topic filter ended up matching nothing in this doc, fall back to
    // the full TOC so the doc isn't an empty page.
    if (filters?.topicIds?.length && topics.length === 0) {
      topics = await Topic.find({ documentId: req.params.id })
        .sort({ 'hierarchy.order': 1, createdAt: 1 })
        .select('title slug originId permalink prettyUrl hierarchy.level hierarchy.parent hierarchy.children hierarchy.order timeModified metadata.author')
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
// GET /api/portal/documents/:id/toc — standalone TOC (lighter than .../documents/:id)
// ---------------------------------------------------------------------------
router.get('/documents/:id/toc', optionalAuth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, status: 'completed' })
      .select('isPaligoFormat tocTree')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (doc.isPaligoFormat && doc.tocTree?.length) {
      return res.json({ tocTree: doc.tocTree });
    }

    // Build a flat→tree TOC from the topic list when no Paligo tree exists.
    const filters = getUserFilters(req);
    const topicQuery = { documentId: req.params.id };
    if (filters?.topicIds?.length) topicQuery._id = { $in: filters.topicIds };
    const topics = await Topic.find(topicQuery)
      .sort({ 'hierarchy.order': 1, createdAt: 1 })
      .select('title slug hierarchy.parent hierarchy.order')
      .lean();

    const byId = new Map();
    topics.forEach((t) => byId.set(String(t._id), { _id: String(t._id), title: t.title, slug: t.slug, children: [] }));
    const roots = [];
    topics.forEach((t) => {
      const parent = t.hierarchy?.parent ? byId.get(String(t.hierarchy.parent)) : null;
      const node = byId.get(String(t._id));
      (parent ? parent.children : roots).push(node);
    });
    res.json({ tocTree: roots });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id/pagination?topicId= — prev/next pointers
// ---------------------------------------------------------------------------
router.get('/documents/:id/pagination', async (req, res, next) => {
  try {
    const topics = await Topic.find({ documentId: req.params.id })
      .sort({ 'hierarchy.order': 1, createdAt: 1 })
      .select('_id title slug')
      .lean();
    if (topics.length === 0) return res.status(404).json({ error: 'No topics' });

    const targetId = req.query.topicId ? String(req.query.topicId) : String(topics[0]._id);
    const idx = topics.findIndex((t) => String(t._id) === targetId);
    if (idx < 0) return res.status(404).json({ error: 'Topic not in document' });

    const compact = (t) => t ? { _id: String(t._id), title: t.title, slug: t.slug } : null;
    res.json({
      first:    compact(topics[0]),
      last:     compact(topics[topics.length - 1]),
      previous: compact(topics[idx - 1]),
      current:  compact(topics[idx]),
      next:     compact(topics[idx + 1]),
      position: idx + 1,
      total:    topics.length,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/portal/documents/:id/resources — list attachments registered as
// resources of this document (images, css, data files, etc.).
// GET /api/portal/documents/:id/resources/:rid/metadata
// GET /api/portal/documents/:id/resources/:rid/content
// GET /api/portal/documents/:id/resources/:rid/image?width=
// ---------------------------------------------------------------------------
router.get('/documents/:id/resources', async (req, res, next) => {
  try {
    const items = await Attachment.find({ documentId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      resources: items.map((a) => ({
        _id: String(a._id),
        filename: a.filename,
        title: a.title || a.filename,
        mimeType: a.mimeType,
        size: a.size,
        contentUrl:  `/api/portal/documents/${req.params.id}/resources/${a._id}/content`,
        metadataUrl: `/api/portal/documents/${req.params.id}/resources/${a._id}/metadata`,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/documents/:id/resources/:rid/metadata', async (req, res, next) => {
  try {
    const a = await Attachment.findOne({ _id: req.params.rid, documentId: req.params.id }).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json({
      _id: String(a._id),
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      title: a.title || a.filename,
      createdAt: a.createdAt,
    });
  } catch (err) { next(err); }
});

router.get('/documents/:id/resources/:rid/content', async (req, res, next) => {
  try {
    const a = await Attachment.findOne({ _id: req.params.rid, documentId: req.params.id }).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    const filePath = path.resolve(config.upload.dir, a.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// ?width=… resizes (via Sharp if installed; otherwise falls back to original).
router.get('/documents/:id/resources/:rid/image', async (req, res, next) => {
  try {
    const a = await Attachment.findOne({ _id: req.params.rid, documentId: req.params.id }).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (!/^image\//.test(a.mimeType)) return res.status(400).json({ error: 'Not an image resource' });

    const filePath = path.resolve(config.upload.dir, a.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

    const width = parseInt(req.query.width, 10);
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (Number.isFinite(width) && width > 0) {
      try {
        const sharp = require('sharp'); // optional dep
        const buf = await sharp(filePath).resize({ width }).toBuffer();
        return res.send(buf);
      } catch {
        // sharp not installed — silently serve the original
      }
    }
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/portal/maps/:mapId/topics/:topicId
// GET /api/portal/maps/:mapId/topics/:topicId/content
// FT-style endpoints that resolve a topic in the context of a specific map.
// ---------------------------------------------------------------------------
router.get('/maps/:mapId/topics/:topicId', optionalAuth, async (req, res, next) => {
  try {
    const topic = await Topic.findOne({
      _id: req.params.topicId,
      documentId: req.params.mapId,
    })
      .select('-content.html')
      .lean();
    if (!topic) return res.status(404).json({ error: 'Topic not in this map' });
    res.json({ topic });
  } catch (err) { next(err); }
});

router.get('/maps/:mapId/topics/:topicId/content', optionalAuth, async (req, res, next) => {
  try {
    const topic = await Topic.findOne({
      _id: req.params.topicId,
      documentId: req.params.mapId,
    }).select('content.html').lean();
    if (!topic) return res.status(404).json({ error: 'Topic not in this map' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(topic.content?.html || '');
  } catch (err) { next(err); }
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

    let atlasResult;
    try {
      atlasResult = await inDocumentSearch({
        query: q,
        documentId: req.params.id,
        topicIds: filters?.topicIds || null,
        releaseNotesOnly: !!filters?.releaseNotesOnly,
        limit,
      });
    } catch (err) {
      // Atlas Search unavailable / index missing → fall through to Mongo regex.
      console.warn('Atlas Search in-doc search failed, falling back to Mongo:', err.message);
    }

    if (atlasResult && atlasResult.hits.length) {
      const hits = atlasResult.hits;

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
        const hl = h.highlight || {};
        const snippet = (hl.content && hl.content[0]) || '';
        const titleHtml = (hl.title && hl.title[0]) || h.title || '';
        return {
          _id: h._id,
          title: h.title || '',
          titleHtml,
          snippet,
          path: breadcrumb(h._id),
        };
      });

      return res.json({ total: atlasResult.total, matches });
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
      .select('title slug content.html documentId hierarchy metadata originId permalink prettyUrl timeModified accessLevel updatedAt')
      .lean();

    if (!topic) return res.status(404).json({ error: 'Not found' });

    // Enforce access control
    if (topic.accessLevel === 'authenticated' && !req.user) {
      return res.status(401).json({ error: 'Authentication required to view this content' });
    }
    if (topic.accessLevel === 'admin' && !['admin', 'superadmin'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/media/* — Proxy media from S3.
// Allows serving images/media stored in the CAS S3 bucket (extracted/)
// without local disk storage or presigned URLs in the DB.
// ---------------------------------------------------------------------------
router.get('/media/*', async (req, res, next) => {
  try {
    const { getObjectStream } = require('../services/storage/s3Service');
    const mime = require('mime-types');

    // The wildcard '*' is captured in req.params[0]
    const key = req.params[0];
    if (!key || key.includes('..')) {
      return res.status(400).send('Invalid media key');
    }

    // Try to stream from S3.
    try {
      const stream = await getObjectStream({
        bucket: config.s3.extractedBucket,
        key: key,
      });

      const contentType = mime.lookup(key) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      // Cache media for 30 days — these are content-addressed (CAS), so
      // the same key never changes its content.
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');

      stream.pipe(res);
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode || err?.statusCode;
      if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
        return res.status(404).send('Media not found');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
