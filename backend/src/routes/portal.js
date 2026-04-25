const express  = require('express');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/portal/documents — public list of completed documents
// ---------------------------------------------------------------------------
router.get('/documents', async (req, res, next) => {
  try {
    const docs = await Document.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication createdAt')
      .lean();

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
router.get('/documents/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, status: 'completed' })
      .select('title sourceFormat metadata topicIds isPaligoFormat publication tocTree createdAt')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });

    const topics = await Topic.find({ documentId: req.params.id })
      .sort({ 'hierarchy.order': 1, createdAt: 1 })
      .select('title slug originId permalink hierarchy.level hierarchy.parent hierarchy.children hierarchy.order timeModified')
      .lean();

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
