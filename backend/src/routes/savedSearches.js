const express = require('express');
const mongoose = require('mongoose');
const SavedSearch = require('../models/SavedSearch');
const { auth } = require('../middleware/auth');
const { trackFtEvent } = require('../services/analytics/analyticsService');
const { analyticsFromReq } = require('../utils/clientIp');

const router = express.Router();
router.use(auth);

// GET /api/saved-searches — list this user's saved searches.
router.get('/', async (req, res, next) => {
  try {
    const items = await SavedSearch.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ savedSearches: items });
  } catch (err) { next(err); }
});

// POST /api/saved-searches — create one.
router.post('/', async (req, res, next) => {
  try {
    const { name, query, filters, notify } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const item = await SavedSearch.create({
      userId:  req.user.id,
      name:    name.trim(),
      query:   (query || '').trim(),
      filters: filters || {},
      notify:  !!notify,
    });
    res.status(201).json({ savedSearch: item });
  } catch (err) { next(err); }
});

// GET /api/saved-searches/:id — fetch one.
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const item = await SavedSearch.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ savedSearch: item });
  } catch (err) { next(err); }
});

// PATCH /api/saved-searches/:id — update name / query / filters / notify.
router.patch('/:id', async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.name === 'string') update.name = req.body.name.trim();
    if (typeof req.body.query === 'string') update.query = req.body.query.trim();
    if (req.body.filters && typeof req.body.filters === 'object') update.filters = req.body.filters;
    if (typeof req.body.notify === 'boolean') update.notify = req.body.notify;
    const item = await SavedSearch.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ savedSearch: item });
  } catch (err) { next(err); }
});

// DELETE /api/saved-searches — clear all
router.delete('/', async (req, res, next) => {
  try {
    const n = await SavedSearch.countDocuments({ userId: req.user.id });
    await SavedSearch.deleteMany({ userId: req.user.id });
    if (n > 0) {
      trackFtEvent({
        userId: req.user.id,
        ftEvent: 'saved_search.delete',
        data: { count: n },
        userAgent: req.headers['user-agent'],
        ...analyticsFromReq(req),
      }).catch(() => {});
    }
    res.json({ message: 'All saved searches deleted' });
  } catch (err) { next(err); }
});

// DELETE /api/saved-searches/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await SavedSearch.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!item) return res.status(404).json({ error: 'Not found' });
    trackFtEvent({
      userId: req.user.id,
      ftEvent: 'saved_search.delete',
      userAgent: req.headers['user-agent'],
      ...analyticsFromReq(req),
    }).catch(() => {});
    res.json({ message: 'Saved search deleted' });
  } catch (err) { next(err); }
});

// POST /api/saved-searches/:id/run — record a run + return the search params
// the client should re-execute (lightweight: client calls /api/search itself).
router.post('/:id/run', async (req, res, next) => {
  try {
    const item = await SavedSearch.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { lastRunAt: new Date() }, $inc: { runCount: 1 } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ savedSearch: item });
  } catch (err) { next(err); }
});

module.exports = router;
