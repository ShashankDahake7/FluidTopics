const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const Feedback = require('../models/Feedback');
const config = require('../config/env');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.resolve(config.upload.dir, 'unstructured');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: config.upload.maxFileSize },
});

const presentMeta = (d) => ({
  _id:         String(d._id),
  title:       d.title,
  description: d.description,
  mimeType:    d.mimeType,
  size:        d.size,
  metadata:    d.metadata,
  viewCount:   d.viewCount,
  createdAt:   d.createdAt,
  updatedAt:   d.updatedAt,
});

// GET /api/khub/documents — list (?q=, ?tag=, ?language=)
router.get('/', async (req, res, next) => {
  try {
    const { q, tag, language, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q)        filter.$text = { $search: q };
    if (tag)      filter['metadata.tags'] = tag;
    if (language) filter['metadata.language'] = language;
    const total = await UnstructuredDocument.countDocuments(filter);
    const items = await UnstructuredDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-contentHtml -contentText -filePath')
      .lean();
    res.json({ total, documents: items.map(presentMeta) });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/search?q=
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ total: 0, documents: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const filter = { $or: [{ title: rx }, { contentText: rx }] };
    const total = await UnstructuredDocument.countDocuments(filter);
    const items = await UnstructuredDocument.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('-contentHtml -contentText -filePath')
      .lean();
    res.json({ total, documents: items.map(presentMeta) });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/metadata
router.get('/:id/metadata', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id)
      .select('-contentHtml -contentText -filePath')
      .lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(presentMeta(d));
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/content — raw HTML preview if rendered, else
// the original file.
router.get('/:id/content', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });

    // Bump view count, fire and forget.
    UnstructuredDocument.updateOne({ _id: d._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    if (d.contentHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(d.contentHtml);
    }
    if (d.filePath) {
      const filePath = path.resolve(config.upload.dir, d.filePath);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', d.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${d.title}"`);
        return fs.createReadStream(filePath).pipe(res);
      }
    }
    res.status(404).json({ error: 'No content available' });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/content/text — plain-text view.
router.get('/:id/content/text', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id).select('contentText').lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(d.contentText || '');
  } catch (err) { next(err); }
});

// POST /api/khub/documents/:id/feedback — feedback on an unstructured doc.
router.post('/:id/feedback', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { rating, feedback } = req.body || {};
    const text = typeof feedback === 'string' ? feedback.trim() : '';
    const fb = await Feedback.create({
      topicId: null,
      userId: req.user?.id || null,
      rating: rating != null ? Number(rating) : null,
      feedback: text,
    });
    res.status(201).json({ message: 'Feedback received', feedback: fb });
  } catch (err) { next(err); }
});

// POST /api/khub/documents — upload a new unstructured doc.
router.post('/', auth, requireRole('admin', 'editor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const { title, description, language, product, version, author, tags } = req.body;
    const tagList = (tags || '').split(',').map((s) => s.trim()).filter(Boolean);
    const d = await UnstructuredDocument.create({
      title:       title || req.file.originalname,
      description: description || '',
      mimeType:    req.file.mimetype,
      size:        req.file.size,
      filePath:    `unstructured/${path.basename(req.file.path)}`,
      contentText: '',
      contentHtml: '',
      metadata: {
        tags: tagList,
        product:  product  || '',
        version:  version  || '',
        language: language || 'en',
        author:   author   || '',
      },
      uploaderId: req.user.id,
    });
    res.status(201).json({ document: presentMeta(d.toObject()) });
  } catch (err) { next(err); }
});

// DELETE /api/khub/documents/:id
router.delete('/:id', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (d.filePath) {
      try { fs.unlinkSync(path.resolve(config.upload.dir, d.filePath)); } catch { /* noop */ }
    }
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
