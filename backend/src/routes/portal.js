const express = require('express');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');

const router = express.Router();

// GET /api/portal/documents — public list of completed documents
router.get('/documents', async (req, res, next) => {
  try {
    const docs = await Document.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .select('title sourceFormat metadata topicIds fileSize createdAt')
      .lean();

    res.json({
      documents: docs.map((d) => ({
        _id:        d._id,
        title:      d.title,
        format:     d.sourceFormat,
        topicCount: d.topicIds?.length || 0,
        tags:       d.metadata?.tags || [],
        product:    d.metadata?.product || '',
        description:d.metadata?.description || '',
        createdAt:  d.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/portal/documents/:id — single document + shallow topic tree
router.get('/documents/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, status: 'completed' })
      .select('title sourceFormat metadata topicIds createdAt')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });

    // All topics for this document, sorted by hierarchy
    const topics = await Topic.find({ documentId: req.params.id })
      .sort({ 'hierarchy.order': 1, createdAt: 1 })
      .select('title slug hierarchy.level hierarchy.parent hierarchy.children hierarchy.order')
      .lean();

    res.json({ document: doc, topics });
  } catch (err) {
    next(err);
  }
});

// GET /api/portal/topics/:id — single topic content (public)
router.get('/topics/:id', async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .select('title slug content.html documentId hierarchy metadata')
      .lean();

    if (!topic) return res.status(404).json({ error: 'Not found' });

    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
