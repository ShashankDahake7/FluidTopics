const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Attachment = require('../models/Attachment');
const config = require('../config/env');
const { auth, requireRole } = require('../middleware/auth');

const { putFile, getObjectStream, deleteOne } = require('../services/storage/s3Service');

const router = express.Router();

const upload = multer({
  dest: path.resolve(config.upload.dir, 'tmp'),
  limits: { fileSize: config.upload.maxFileSize },
});

const presentRow = (a) => ({
  _id: String(a._id),
  documentId: a.documentId ? String(a.documentId) : null,
  unstructuredId: a.unstructuredId ? String(a.unstructuredId) : null,
  originId: a.originId,
  filename: a.filename,
  title: a.title || a.filename,
  mimeType: a.mimeType,
  size: a.size,
  downloadUrl: `/api/attachments/${a._id}/download`,
  createdAt: a.createdAt,
});

// GET /api/attachments — global list of every attachment in the system.
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, q } = req.query;
    const filter = {};
    if (q) filter.$or = [
      { filename: { $regex: q, $options: 'i' } },
      { title:    { $regex: q, $options: 'i' } },
    ];
    const total = await Attachment.countDocuments(filter);
    const items = await Attachment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    res.json({ total, attachments: items.map(presentRow) });
  } catch (err) { next(err); }
});

// GET /api/portal/documents/:id/attachments — attachments belonging to a document.
router.get('/by-document/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const items = await Attachment.find({ documentId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ attachments: items.map(presentRow) });
  } catch (err) { next(err); }
});

// GET /api/portal/khub/documents/:id/attachments — same, but for unstructured docs.
router.get('/by-unstructured/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const items = await Attachment.find({ unstructuredId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ attachments: items.map(presentRow) });
  } catch (err) { next(err); }
});

// GET /api/attachments/:id — metadata.
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const a = await Attachment.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json({ attachment: presentRow(a) });
  } catch (err) { next(err); }
});

// GET /api/attachments/:id/download — binary download from S3.
router.get('/:id/download', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const a = await Attachment.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });

    try {
      const stream = await getObjectStream({
        bucket: config.s3.extractedBucket,
        key: a.path,
      });

      res.setHeader('Content-Type', a.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${a.filename}"`);
      stream.pipe(res);
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode || err?.statusCode;
      if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'File missing in storage' });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// POST /api/attachments — admin upload to S3.
router.post('/', auth, requireRole('admin', 'editor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const s3Key = `attachments/${Date.now()}-${req.file.originalname}`;
    await putFile({
      bucket: config.s3.extractedBucket,
      key: s3Key,
      filePath: req.file.path,
      contentType: req.file.mimetype,
    });

    // Cleanup local temp file
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }

    const a = await Attachment.create({
      documentId:     req.body.documentId     || null,
      unstructuredId: req.body.unstructuredId || null,
      originId:       req.body.originId || '',
      title:          req.body.title || req.file.originalname,
      filename:       req.file.originalname,
      mimeType:       req.file.mimetype,
      size:           req.file.size,
      path:           s3Key,
    });
    res.status(201).json({ attachment: presentRow(a.toObject()) });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    next(err);
  }
});

// DELETE /api/attachments/:id — admin only.
router.delete('/:id', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const a = await Attachment.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });

    // Delete from S3
    try {
      await deleteOne({ bucket: config.s3.extractedBucket, key: a.path });
    } catch { /* noop */ }

    res.json({ message: 'Attachment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
