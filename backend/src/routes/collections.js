const express = require('express');
const Collection = require('../models/Collection');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

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

// POST /api/collections — create a collection
router.post('/', async (req, res, next) => {
  try {
    const { name, description = '', color = '#0f172a' } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const collection = await Collection.create({
      userId: req.user.id,
      name: name.trim(),
      description: (description || '').trim(),
      color,
    });
    res.status(201).json({ collection });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/collections/:id — rename / update
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, description, color } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim();
    if (typeof description === 'string') update.description = description.trim();
    if (typeof color === 'string') update.color = color;
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
    res.json({ message: 'Collection deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
