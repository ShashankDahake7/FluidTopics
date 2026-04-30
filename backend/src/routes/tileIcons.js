const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const TileIcon = require('../models/TileIcon');
const config   = require('../config/env');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Storage ──────────────────────────────────────────────────────────────────
const ICON_DIR = path.resolve(config.upload.dir, 'tile-icons');
fs.mkdirSync(ICON_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ICON_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// Helper to validate tileType
const VALID_TYPES = ['template', 'document'];
function validateType(req, res) {
  if (!VALID_TYPES.includes(req.params.tileType)) {
    res.status(400).json({ error: 'tileType must be "template" or "document"' });
    return false;
  }
  return true;
}

// ── GET /api/tile-icons — list every custom icon (lightweight metadata) ──────
router.get('/', async (_req, res, next) => {
  try {
    const icons = await TileIcon.find().lean();
    res.json({
      icons: icons.map((i) => ({
        tileType: i.tileType,
        tileKey:  i.tileKey,
        url:      `/api/tile-icons/${i.tileType}/${i.tileKey}`,
      })),
    });
  } catch (err) { next(err); }
});

// ── GET /api/tile-icons/:tileType/:tileKey — serve image binary ─────────────
router.get('/:tileType/:tileKey', async (req, res, next) => {
  try {
    if (!validateType(req, res)) return;
    const icon = await TileIcon.findOne({
      tileType: req.params.tileType,
      tileKey:  req.params.tileKey,
    }).lean();
    if (!icon) return res.status(404).json({ error: 'No custom icon set' });

    const filePath = path.resolve(config.upload.dir, icon.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Icon file missing on disk' });

    res.setHeader('Content-Type', icon.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// ── POST /api/tile-icons/:tileType/:tileKey — upload or replace (superadmin) ─
router.post(
  '/:tileType/:tileKey',
  auth,
  requireRole('superadmin'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!validateType(req, res)) return;
      if (!req.file) return res.status(400).json({ error: 'file is required' });

      const { tileType, tileKey } = req.params;

      // Remove old file if replacing
      const existing = await TileIcon.findOne({ tileType, tileKey }).lean();
      if (existing) {
        try { fs.unlinkSync(path.resolve(config.upload.dir, existing.path)); } catch { /* noop */ }
      }

      const relPath = `tile-icons/${path.basename(req.file.path)}`;

      const icon = await TileIcon.findOneAndUpdate(
        { tileType, tileKey },
        {
          tileType,
          tileKey,
          filename:   req.file.originalname,
          mimeType:   req.file.mimetype,
          size:       req.file.size,
          path:       relPath,
          uploaderId: req.user._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.status(201).json({
        icon: {
          tileType: icon.tileType,
          tileKey:  icon.tileKey,
          url:      `/api/tile-icons/${icon.tileType}/${icon.tileKey}`,
        },
      });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/tile-icons/:tileType/:tileKey — remove (superadmin) ─────────
router.delete(
  '/:tileType/:tileKey',
  auth,
  requireRole('superadmin'),
  async (req, res, next) => {
    try {
      if (!validateType(req, res)) return;
      const icon = await TileIcon.findOneAndDelete({
        tileType: req.params.tileType,
        tileKey:  req.params.tileKey,
      });
      if (!icon) return res.status(404).json({ error: 'No custom icon to remove' });
      try { fs.unlinkSync(path.resolve(config.upload.dir, icon.path)); } catch { /* noop */ }
      res.json({ message: 'Icon removed' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
