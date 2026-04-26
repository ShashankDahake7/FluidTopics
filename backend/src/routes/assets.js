const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Asset = require('../models/Asset');
const config = require('../config/env');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ASSET_DIR = path.resolve(config.upload.dir, 'assets');
fs.mkdirSync(ASSET_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ASSET_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: config.upload.maxFileSize },
});

const present = (a) => ({
  _id:      String(a._id),
  filename: a.filename,
  title:    a.title || a.filename,
  mimeType: a.mimeType,
  size:     a.size,
  tags:     a.tags || [],
  url:      `/api/assets/${a._id}`,
  createdAt: a.createdAt,
});

// GET /api/assets — list (optional ?q= and ?tag=)
router.get('/', async (req, res, next) => {
  try {
    const { q, tag, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q)   filter.$or = [
      { filename: { $regex: q, $options: 'i' } },
      { title:    { $regex: q, $options: 'i' } },
    ];
    if (tag) filter.tags = tag;
    const total = await Asset.countDocuments(filter);
    const items = await Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    res.json({ total, assets: items.map(present) });
  } catch (err) { next(err); }
});

// GET /api/assets/:id — public read; serves the file inline so that an <img>
// tag can use the same URL without a separate /download endpoint.
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const a = await Asset.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });

    // ?metadata=1 returns the JSON description instead of the binary file.
    if (req.query.metadata === '1' || req.query.metadata === 'true') {
      return res.json({ asset: present(a) });
    }

    const filePath = path.resolve(config.upload.dir, a.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// POST /api/assets — admin upload.
router.post('/', auth, requireRole('admin', 'editor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const tags = (req.body.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
    const a = await Asset.create({
      title:    req.body.title || req.file.originalname,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size:     req.file.size,
      path:     `assets/${path.basename(req.file.path)}`,
      tags,
      uploaderId: req.user.id,
    });
    res.status(201).json({ asset: present(a.toObject()) });
  } catch (err) { next(err); }
});

// PATCH /api/assets/:id — admin metadata update.
router.patch('/:id', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const update = {};
    if (typeof req.body.title === 'string') update.title = req.body.title;
    if (Array.isArray(req.body.tags))       update.tags  = req.body.tags;
    const a = await Asset.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json({ asset: present(a.toObject()) });
  } catch (err) { next(err); }
});

// DELETE /api/assets/:id — admin only.
router.delete('/:id', auth, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const a = await Asset.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    try { fs.unlinkSync(path.resolve(config.upload.dir, a.path)); } catch { /* noop */ }
    res.json({ message: 'Asset deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
