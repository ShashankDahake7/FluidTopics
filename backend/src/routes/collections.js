const express = require('express');
const Collection = require('../models/Collection');
const { auth } = require('../middleware/auth');
const { trackFtEvent } = require('../services/analytics/analyticsService');
const { analyticsFromReq } = require('../utils/clientIp');

const router = express.Router();
router.use(auth);

const nameCollation = { locale: 'en', strength: 2 };

async function collectionNameTaken(userId, name, excludeCollectionId) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const q = { userId, name: trimmed };
  if (excludeCollectionId) q._id = { $ne: excludeCollectionId };
  return Collection.findOne(q).collation(nameCollation).lean();
}

// GET /api/collections — list this user's collections
router.get('/', async (req, res, next) => {
  try {
    const items = await Collection.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ collections: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/collections — create a manual or smart collection.
//   { kind: 'manual' } (default) — provide topicIds at create or add later
//   { kind: 'smart', query, filters } — results computed at read time
router.post('/', async (req, res, next) => {
  try {
    const { name, description = '', color = '#0f172a',
            kind = 'manual', query = '', filters = {}, topicIds = [] } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!['manual', 'smart'].includes(kind)) return res.status(400).json({ error: 'Invalid kind' });

    const trimmedName = name.trim();
    if (await collectionNameTaken(req.user.id, trimmedName)) {
      return res.status(400).json({ error: 'A collection with this name already exists' });
    }

    const collection = await Collection.create({
      userId: req.user.id,
      name: trimmedName,
      description: (description || '').trim(),
      color,
      kind,
      query:   kind === 'smart'  ? String(query).trim() : '',
      filters: kind === 'smart'  ? filters : {},
      topicIds: kind === 'manual' ? topicIds : [],
    });
    res.status(201).json({ collection });
  } catch (err) {
    next(err);
  }
});

// GET /api/collections/:id/contents — resolved topic list.
//   manual → returns the stored topicIds populated with title.
//   smart  → runs the saved query against ES and returns matching topics.
router.get('/:id/contents', async (req, res, next) => {
  try {
    const collection = await Collection.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!collection) return res.status(404).json({ error: 'Not found' });

    const Document = require('../models/Document');

    // Helper: enriches an array of topic-shaped objects with the parent
    // document's prettyUrl so the frontend can build a doc-level pretty
    // URL when a topic itself has no template match. We resolve all
    // unique documentIds in one batch.
    const enrichWithParentPrettyUrl = async (topics) => {
      const docIds = [...new Set(
        topics.map((tt) => tt.documentId && String(tt.documentId)).filter(Boolean)
      )];
      if (!docIds.length) return topics;
      const docs = await Document.find({ _id: { $in: docIds } }).select('_id prettyUrl').lean();
      const map = Object.fromEntries(docs.map((d) => [String(d._id), d.prettyUrl || '']));
      return topics.map((tt) => ({
        ...tt,
        documentPrettyUrl: tt.documentId ? map[String(tt.documentId)] || '' : '',
      }));
    };

    if (collection.kind === 'smart') {
      const { search } = require('../services/search/searchService');
      const results = await search({
        query:   collection.query || '',
        filters: collection.filters || {},
        page:    1,
        limit:   100,
        sort:    'relevance',
      });
      const topics = (results.hits || []).map((h) => ({
        _id:         h.topicId || h.id,
        title:       h.title,
        documentId:  h.documentId || null,
        prettyUrl:   h.prettyUrl || '',
      }));
      return res.json({
        collection,
        topics: await enrichWithParentPrettyUrl(topics),
        total: results.total,
      });
    }

    const Topic = require('../models/Topic');
    const topics = await Topic.find({ _id: { $in: collection.topicIds || [] } })
      .select('_id title slug documentId prettyUrl').lean();
    res.json({ collection, topics: await enrichWithParentPrettyUrl(topics), total: topics.length });
  } catch (err) { next(err); }
});

// POST /api/collections/:id/topics — add to a manual collection.
router.post('/:id/topics', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.topicIds) ? req.body.topicIds : [];
    const c = await Collection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, kind: 'manual' },
      { $addToSet: { topicIds: { $each: ids } } },
      { new: true }
    );
    if (!c) return res.status(404).json({ error: 'Not found or not a manual collection' });
    res.json({ collection: c });
  } catch (err) { next(err); }
});

// DELETE /api/collections/:id/topics/:topicId — remove from a manual collection.
router.delete('/:id/topics/:topicId', async (req, res, next) => {
  try {
    const c = await Collection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, kind: 'manual' },
      { $pull: { topicIds: req.params.topicId } },
      { new: true }
    );
    if (!c) return res.status(404).json({ error: 'Not found or not a manual collection' });
    res.json({ collection: c });
  } catch (err) { next(err); }
});

// PATCH /api/collections/:id — rename / update
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, description, color, query, filters } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim();
    if (typeof description === 'string') update.description = description.trim();
    if (typeof color === 'string') update.color = color;
    if (typeof query === 'string') update.query = query.trim();
    if (filters && typeof filters === 'object') update.filters = filters;
    if (typeof update.name === 'string' && update.name) {
      if (await collectionNameTaken(req.user.id, update.name, req.params.id)) {
        return res.status(400).json({ error: 'A collection with this name already exists' });
      }
    }
    const c = await Collection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    );
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json({ collection: c });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/collections/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const c = await Collection.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!c) return res.status(404).json({ error: 'Not found' });
    trackFtEvent({
      userId: req.user.id,
      ftEvent: 'collection.delete',
      userAgent: req.headers['user-agent'],
      ...analyticsFromReq(req),
    }).catch(() => {});
    res.json({ message: 'Collection deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
