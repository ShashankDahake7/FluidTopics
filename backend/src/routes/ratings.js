const express = require('express');
const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Feature gate per the BRD: "Rating is only available to users who have the
// RATING_USER role." Reads remain anonymous-friendly so non-rating viewers
// still see the aggregate stars; only mutating endpoints are gated.
function requireRatingFeature(req, res, next) {
  const perms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (perms.includes('RATING_USER')) return next();
  // superadmin/admin tier always passes — they're inherently allowed to
  // rate, e.g. when curating sample content.
  if (req.user?.role === 'superadmin' || req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'RATING_USER role required to rate content.' });
}

// Build the aggregate-rating shape that the API returns. Optionally also
// returns the signed-in user's own rating so the UI can render the active state.
async function aggregate(filter, userId) {
  const match = { $match: filter };
  const [stats] = await Rating.aggregate([
    match,
    {
      $group: {
        _id: null,
        count:   { $sum: 1 },
        average: { $avg: '$value' },
        d1: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } },
        d2: { $sum: { $cond: [{ $eq: ['$value', 2] }, 1, 0] } },
        d3: { $sum: { $cond: [{ $eq: ['$value', 3] }, 1, 0] } },
        d4: { $sum: { $cond: [{ $eq: ['$value', 4] }, 1, 0] } },
        d5: { $sum: { $cond: [{ $eq: ['$value', 5] }, 1, 0] } },
      },
    },
  ]);

  let myRating = null;
  if (userId) {
    const mine = await Rating.findOne({ ...filter, userId }).lean();
    if (mine) myRating = { value: mine.value, comment: mine.comment };
  }

  if (!stats) return { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, myRating };
  return {
    count:   stats.count,
    average: Math.round(stats.average * 100) / 100,
    distribution: { 1: stats.d1, 2: stats.d2, 3: stats.d3, 4: stats.d4, 5: stats.d5 },
    myRating,
  };
}

// Reusable factory: builds three handlers (GET / POST / DELETE) for a given
// rating "kind" — topic, document, or unstructured document.
function makeRatingHandlers(kind) {
  const field = { topic: 'topicId', document: 'documentId', unstructured: 'unstructuredId' }[kind];

  const get = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
      const filter = { [field]: id };
      const data = await aggregate(filter, req.user?.id);
      res.json(data);
    } catch (err) { next(err); }
  };

  const upsert = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
      const value = parseInt(req.body?.value, 10);
      if (!Number.isFinite(value) || value < 1 || value > 5) {
        return res.status(400).json({ error: 'value must be an integer between 1 and 5' });
      }
      const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
      const filter = { userId: req.user.id, [field]: id };
      await Rating.findOneAndUpdate(
        filter,
        { ...filter, value, comment },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const data = await aggregate({ [field]: id }, req.user.id);
      res.status(201).json(data);
    } catch (err) { next(err); }
  };

  const remove = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
      await Rating.deleteOne({ userId: req.user.id, [field]: id });
      const data = await aggregate({ [field]: id }, req.user.id);
      res.json(data);
    } catch (err) { next(err); }
  };

  return { get, upsert, remove };
}

// Topic ratings — readable anonymously, write/delete requires auth + the
// RATING_USER feature role (gated by `requireRatingFeature`).
const topic = makeRatingHandlers('topic');
router.get('/topics/:id/rating',    optionalAuth, topic.get);
router.post('/topics/:id/rating',   auth, requireRatingFeature, topic.upsert);
router.delete('/topics/:id/rating', auth, requireRatingFeature, topic.remove);

// Document (map) ratings.
const doc = makeRatingHandlers('document');
router.get('/documents/:id/rating',    optionalAuth, doc.get);
router.post('/documents/:id/rating',   auth, requireRatingFeature, doc.upsert);
router.delete('/documents/:id/rating', auth, requireRatingFeature, doc.remove);

// Unstructured document ratings.
const un = makeRatingHandlers('unstructured');
router.get('/khub/documents/:id/rating',    optionalAuth, un.get);
router.post('/khub/documents/:id/rating',   auth, requireRatingFeature, un.upsert);
router.delete('/khub/documents/:id/rating', auth, requireRatingFeature, un.remove);

module.exports = router;
