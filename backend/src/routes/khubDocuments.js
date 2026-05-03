const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const Feedback = require('../models/Feedback');
const config = require('../config/env');
const { auth, optionalAuth, requireTierOrAdminRoles } = require('../middleware/auth');
const { CONTENT_PIPELINE: AR_CONTENT } = require('../constants/adminRoles');

const contentEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_CONTENT);
const {
  filterDocumentsForUser,
  requireDocumentAccess,
} = require('../services/accessRules/accessRulesService');

const { putFile, getObjectStream, deleteFromAllBuckets } = require('../services/storage/s3Service');

const router = express.Router();

const upload = multer({
  dest: path.resolve(config.upload.dir, 'tmp'),
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
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, tag, language, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q)        filter.$text = { $search: q };
    if (tag)      filter['metadata.tags'] = tag;
    if (language) filter['metadata.language'] = language;
    const items = await UnstructuredDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-contentHtml -contentText -filePath')
      .lean();
    const visible = await filterDocumentsForUser(items, req.user);
    res.json({ total: visible.length, documents: visible.map(presentMeta) });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/search?q=
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ total: 0, documents: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const filter = { $or: [{ title: rx }, { contentText: rx }] };
    const items = await UnstructuredDocument.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('-contentHtml -contentText -filePath')
      .lean();
    const visible = await filterDocumentsForUser(items, req.user);
    res.json({ total: visible.length, documents: visible.map(presentMeta) });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/metadata
router.get('/:id/metadata', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id)
      .select('-contentHtml -contentText -filePath')
      .lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (!await requireDocumentAccess(req, res, d)) return;
    res.json(presentMeta(d));
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/content — raw HTML preview if rendered, else
// the original file from S3.
router.get('/:id/content', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (!await requireDocumentAccess(req, res, d)) return;

    // Bump view count, fire and forget.
    UnstructuredDocument.updateOne({ _id: d._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    if (d.contentHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(d.contentHtml);
    }
    if (d.filePath) {
      try {
        const stream = await getObjectStream({
          bucket: config.s3.extractedBucket,
          key: d.filePath,
        });

        res.setHeader('Content-Type', d.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${d.title}"`);
        return stream.pipe(res);
      } catch (err) {
        const status = err?.$metadata?.httpStatusCode || err?.statusCode;
        if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
          return res.status(404).json({ error: 'File missing in storage' });
        }
        throw err;
      }
    }
    res.status(404).json({ error: 'No content available' });
  } catch (err) { next(err); }
});

// GET /api/khub/documents/:id/content/text — plain-text view.
router.get('/:id/content/text', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findById(req.params.id).select('title description mimeType size metadata contentText').lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (!await requireDocumentAccess(req, res, d)) return;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(d.contentText || '');
  } catch (err) { next(err); }
});

// POST /api/khub/documents/:id/feedback — feedback on an unstructured doc.
router.post('/:id/feedback', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { rating, feedback } = req.body || {};
    const d = await UnstructuredDocument.findById(req.params.id).select('title description mimeType size metadata').lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (!await requireDocumentAccess(req, res, d)) return;
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

// POST /api/khub/documents — upload a new unstructured doc to S3.
router.post('/', auth, contentEditor, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const s3Key = `unstructured/${Date.now()}-${req.file.originalname}`;
    await putFile({
      bucket: config.s3.extractedBucket,
      key: s3Key,
      filePath: req.file.path,
      contentType: req.file.mimetype,
    });

    // Cleanup local temp file
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }

    const { title, description, language, product, version, author, tags } = req.body;
    const tagList = (tags || '').split(',').map((s) => s.trim()).filter(Boolean);
    const d = await UnstructuredDocument.create({
      title:       title || req.file.originalname,
      description: description || '',
      mimeType:    req.file.mimetype,
      size:        req.file.size,
      filePath:    s3Key,
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
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    next(err);
  }
});

// DELETE /api/khub/documents/:id
router.delete('/:id', auth, contentEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await UnstructuredDocument.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (d.filePath) {
      try {
        await deleteFromAllBuckets(d.filePath);
      } catch { /* noop */ }
    }
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
