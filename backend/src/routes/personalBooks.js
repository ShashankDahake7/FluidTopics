const express = require('express');
const mongoose = require('mongoose');
const PersonalBook = require('../models/PersonalBook');
const { auth, optionalAuth } = require('../middleware/auth');
const { trackFtEvent } = require('../services/analytics/analyticsService');
const { analyticsFromReq } = require('../utils/clientIp');

const router = express.Router();

// List + read endpoints support optionalAuth so public books can be browsed
// without signing in. Mutations always require auth.

// GET /api/personal-books — list my books, plus any public ones.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = req.user
      ? { $or: [{ userId: req.user.id }, { visibility: 'public' }] }
      : { visibility: 'public' };
    const items = await PersonalBook.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ books: items });
  } catch (err) { next(err); }
});

// GET /api/personal-books/:id — single book + populated topic titles.
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const book = await PersonalBook.findById(req.params.id)
      .populate('topicIds', 'title slug')
      .lean();
    if (!book) return res.status(404).json({ error: 'Not found' });
    if (book.visibility !== 'public' && (!req.user || String(book.userId) !== String(req.user.id))) {
      return res.status(403).json({ error: 'Private book' });
    }
    res.json({ book });
  } catch (err) { next(err); }
});

// POST /api/personal-books — create.
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, description, coverColor, topicIds, visibility } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    const tidList = Array.isArray(topicIds) ? topicIds : [];
    const book = await PersonalBook.create({
      userId: req.user.id,
      title: title.trim(),
      description: (description || '').trim(),
      coverColor: coverColor || '#1d4ed8',
      topicIds: tidList,
      visibility: ['private', 'public'].includes(visibility) ? visibility : 'private',
    });
    if (tidList.length > 0) {
      trackFtEvent({
        userId: req.user.id,
        ftEvent: 'personal_topic.create',
        data: { count: tidList.length },
        userAgent: req.headers['user-agent'],
        ...analyticsFromReq(req),
      }).catch(() => {});
    }
    res.status(201).json({ book });
  } catch (err) { next(err); }
});

// PATCH /api/personal-books/:id — rename, reorder topics, change visibility, etc.
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.title === 'string') update.title = req.body.title.trim();
    if (typeof req.body.description === 'string') update.description = req.body.description.trim();
    if (typeof req.body.coverColor === 'string') update.coverColor = req.body.coverColor;
    if (Array.isArray(req.body.topicIds))    update.topicIds = req.body.topicIds;
    if (['private', 'public'].includes(req.body.visibility)) update.visibility = req.body.visibility;
    const book = await PersonalBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    if (Array.isArray(req.body.topicIds)) {
      trackFtEvent({
        userId: req.user.id,
        ftEvent: 'personal_topic.update',
        userAgent: req.headers['user-agent'],
        ...analyticsFromReq(req),
      }).catch(() => {});
    }
    res.json({ book });
  } catch (err) { next(err); }
});

// POST /api/personal-books/:id/topics — append topics.
router.post('/:id/topics', auth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.topicIds) ? req.body.topicIds : [];
    const book = await PersonalBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $addToSet: { topicIds: { $each: ids } } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    if (ids.length > 0) {
      trackFtEvent({
        userId: req.user.id,
        ftEvent: 'personal_topic.create',
        data: { count: ids.length },
        userAgent: req.headers['user-agent'],
        ...analyticsFromReq(req),
      }).catch(() => {});
    }
    res.json({ book });
  } catch (err) { next(err); }
});

// DELETE /api/personal-books/:id/topics/:topicId — remove one.
router.delete('/:id/topics/:topicId', auth, async (req, res, next) => {
  try {
    const book = await PersonalBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $pull: { topicIds: req.params.topicId } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    trackFtEvent({
      userId: req.user.id,
      ftEvent: 'personal_topic.delete',
      userAgent: req.headers['user-agent'],
      ...analyticsFromReq(req),
    }).catch(() => {});
    res.json({ book });
  } catch (err) { next(err); }
});

// DELETE /api/personal-books/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const book = await PersonalBook.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!book) return res.status(404).json({ error: 'Not found' });
    trackFtEvent({
      userId: req.user.id,
      ftEvent: 'personal_book.delete',
      userAgent: req.headers['user-agent'],
      ...analyticsFromReq(req),
    }).catch(() => {});
    res.json({ message: 'Book deleted' });
  } catch (err) { next(err); }
});

// POST /api/personal-books/:id/exports — record a generated export. Real PDF
// rendering is left to a future job; the route lets clients log that an
// export happened so listings can show "last exported" badges.
router.post('/:id/exports', auth, async (req, res, next) => {
  try {
    const { format = 'pdf', url = '' } = req.body || {};
    if (!['pdf', 'html'].includes(format)) return res.status(400).json({ error: 'Invalid format' });
    const book = await PersonalBook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $push: { exports: { format, url, generatedAt: new Date() } } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json({ book });
  } catch (err) { next(err); }
});

module.exports = router;
