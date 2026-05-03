const express  = require('express');
const multer   = require('multer');
const TileIcon = require('../models/TileIcon');
const { auth, requireRole } = require('../middleware/auth');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotTileIcons } = require('../services/configHistorySnapshots');

const router = express.Router();

// ── Storage ──────────────────────────────────────────────────────────────────
// Use memory storage — the file buffer goes straight into MongoDB, no disk
// writes needed. This keeps icons available to every user on every instance.
const upload = multer({
  storage: multer.memoryStorage(),
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
    // Only fetch metadata fields, exclude the heavy `data` buffer
    const icons = await TileIcon.find({}, 'tileType tileKey').lean();
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
    });
    if (!icon || !icon.data) return res.status(404).json({ error: 'No custom icon set' });

    res.setHeader('Content-Type', icon.mimeType);
    res.setHeader('Content-Length', icon.data.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(icon.data);
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

      const before = await snapshotTileIcons();

      const icon = await TileIcon.findOneAndUpdate(
        { tileType, tileKey },
        {
          tileType,
          tileKey,
          filename:   req.file.originalname,
          mimeType:   req.file.mimetype,
          size:       req.file.size,
          data:       req.file.buffer,
          uploaderId: req.user._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const after = await snapshotTileIcons();
      await logConfigChange({
        category: 'Theme',
        ...authorFromRequest(req),
        before,
        after,
      });

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
      const before = await snapshotTileIcons();

      const icon = await TileIcon.findOneAndDelete({
        tileType: req.params.tileType,
        tileKey:  req.params.tileKey,
      });
      if (!icon) return res.status(404).json({ error: 'No custom icon to remove' });

      const after = await snapshotTileIcons();
      await logConfigChange({
        category: 'Theme',
        ...authorFromRequest(req),
        before,
        after,
      });
      res.json({ message: 'Icon removed' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
