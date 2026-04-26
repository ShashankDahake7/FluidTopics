const express = require('express');
const router = express.Router();
const Bookmark = require('../models/Bookmark');
const { auth: authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/bookmarks — List user bookmarks
 */
router.get('/', async (req, res, next) => {
  try {
    const { folder, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user.id };
    if (folder) query.folder = folder;

    const total = await Bookmark.countDocuments(query);
    const bookmarks = await Bookmark.find(query)
      .populate('topicId', 'title slug metadata viewCount hierarchy.level')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({
      bookmarks: bookmarks.map((b) => ({
        id: b._id,
        topic: b.topicId,
        note: b.note,
        folder: b.folder,
        createdAt: b.createdAt,
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookmarks/folders — Get user's bookmark folders
 */
router.get('/folders', async (req, res, next) => {
  try {
    const collections = await Bookmark.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      collections: collections.map((c) => ({
        name: c._id,
        count: c.count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/bookmarks — Add bookmark
 */
router.post('/', async (req, res, next) => {
  try {
    const { topicId, note, folder } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: 'topicId is required' });
    }

    const bookmark = await Bookmark.create({
      userId: req.user.id,
      topicId,
      note: note || '',
      folder: folder || 'default',
    });

    res.status(201).json({ message: 'Bookmarked', bookmark });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Already bookmarked' });
    }
    next(err);
  }
});

/**
 * DELETE /api/bookmarks/:topicId — Remove bookmark
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    // Allow deleting by either the bookmark's _id or by topicId (legacy clients)
    const result = await Bookmark.findOneAndDelete({
      userId: req.user.id,
      $or: [{ _id: id }, { topicId: id }],
    });

    if (!result) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookmarks/check/:topicId — Check if topic is bookmarked
 */
router.get('/check/:topicId', async (req, res, next) => {
  try {
    const exists = await Bookmark.exists({
      userId: req.user.id,
      topicId: req.params.topicId,
    });

    res.json({ isBookmarked: !!exists });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
