const express = require('express');
const fs = require('fs');
const path = require('path');

const upload = require('../middleware/upload');
const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { CONTENT_PIPELINE: AR_CONTENT } = require('../constants/adminRoles');

const adminOrEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_CONTENT);
const config = require('../config/env');
const s3 = require('../services/storage/s3Service');
const DitaOtConfig = require('../models/DitaOtConfig');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotSourcesFull } = require('../services/configHistorySnapshots');

const router = express.Router();


// All DITA-OT archives live under this prefix in the existing raw bucket. We
// reuse the bucket so we don't need additional IAM/env wiring beyond what the
// publishing pipeline already requires.
const DITA_OT_PREFIX = 'dita-ot/';

// ── Helpers ────────────────────────────────────────────────────────────────
async function loadConfig() {
  // Upsert-on-read so the rest of the routes can assume a config doc exists.
  let cfg = await DitaOtConfig.findOne({ key: 'default' }).populate('archive.uploadedBy', 'name email');
  if (!cfg) {
    cfg = await DitaOtConfig.create({ key: 'default', isDefault: true });
  }
  return cfg;
}

function serialise(cfg) {
  if (!cfg) return null;
  if (typeof cfg.toObject === 'function') cfg = cfg.toObject();
  const archive = cfg.archive || {};
  const uploadedBy = archive.uploadedBy && typeof archive.uploadedBy === 'object'
    ? { id: String(archive.uploadedBy._id), name: archive.uploadedBy.name, email: archive.uploadedBy.email }
    : null;
  return {
    isDefault: !!cfg.isDefault,
    archive: archive.key
      ? {
          originalName: archive.originalName || '',
          sizeBytes:    archive.sizeBytes    || 0,
          uploadedAt:   archive.uploadedAt   || null,
          uploadedBy,
        }
      : null,
    transtype:  cfg.transtype  || '',
    parameters: (cfg.parameters || []).map((p) => ({ key: p.key, value: p.value || '' })),
    updatedAt: cfg.updatedAt,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/dita-ot/config — current config (always returns a row).
router.get('/config', auth, adminOrEditor, async (req, res, next) => {
  try {
    const cfg = await loadConfig();
    res.json({ config: serialise(cfg) });
  } catch (err) { next(err); }
});

// POST /api/dita-ot/config — multipart upload of a new DITA-OT archive (.zip).
// Replaces any previously uploaded archive (best-effort delete on success so
// we don't accumulate orphaned objects in S3).
router.post('/config', auth, adminOrEditor, upload.single('archive'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No archive uploaded (field name: archive)' });

    const before = await snapshotSourcesFull();

    const isZip = /\.zip$/i.test(req.file.originalname);
    if (!isZip) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      return res.status(400).json({ error: 'DITA-OT archive must be a .zip file' });
    }
    if (!config.s3.rawBucket) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      return res.status(500).json({ error: 'S3 raw bucket is not configured' });
    }

    const cfg = await loadConfig();
    const previousKey = cfg.archive?.key || '';

    // Stamp the key with the upload time so each archive is an immutable
    // object — the timestamp also disambiguates if two admins upload the
    // same filename in quick succession.
    const safeName = path.basename(req.file.originalname).replace(/[^A-Za-z0-9._-]/g, '_');
    const newKey = `${DITA_OT_PREFIX}${Date.now()}-${safeName}`;

    let etag = '';
    try {
      const result = await s3.putFile({
        bucket: config.s3.rawBucket,
        key: newKey,
        filePath: req.file.path,
        contentType: 'application/zip',
      });
      etag = result.etag;
    } catch (err) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      return next(err);
    } finally {
      // The local multer drop is no longer needed once it's in S3.
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    }

    cfg.archive = {
      bucket: config.s3.rawBucket,
      key: newKey,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      etag,
      uploadedBy: req.user?._id || null,
      uploadedAt: new Date(),
    };
    cfg.isDefault = false;
    await cfg.save();

    // Clean up the previous archive (if any). Best-effort — the new archive
    // is durable already, and a stale object is not a correctness bug.
    if (previousKey && previousKey !== newKey) {
      try {
        await s3.deleteOne({ bucket: config.s3.rawBucket, key: previousKey });
      } catch (err) {
        console.warn('dita-ot: failed to delete previous archive:', err.message);
      }
    }

    const reloaded = await loadConfig();
    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(201).json({ config: serialise(reloaded) });
  } catch (err) { next(err); }
});

// PATCH /api/dita-ot/config — JSON payload for the Advanced settings panel.
// We deliberately keep this separate from the upload endpoint so saving
// transtype/parameters never touches S3.
router.patch('/config', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotSourcesFull();
    const cfg = await loadConfig();
    const { transtype, parameters } = req.body || {};
    if (typeof transtype === 'string') cfg.transtype = transtype.trim();
    if (Array.isArray(parameters)) {
      cfg.parameters = parameters
        .filter((p) => p && typeof p === 'object' && p.key)
        .map((p) => ({ key: String(p.key).trim(), value: String(p.value || '') }))
        .filter((p) => p.key.length > 0);
    }
    await cfg.save();
    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ config: serialise(cfg) });
  } catch (err) { next(err); }
});

// GET /api/dita-ot/archive — presigned download URL for the current archive.
router.get('/archive', auth, adminOrEditor, async (req, res, next) => {
  try {
    const cfg = await loadConfig();
    if (!cfg.archive?.key) {
      return res.status(404).json({ error: 'No DITA-OT archive uploaded' });
    }
    const url = await s3.presignDownload({
      bucket: cfg.archive.bucket,
      key: cfg.archive.key,
      filename: cfg.archive.originalName || 'dita-ot.zip',
    });
    res.json({ url, originalName: cfg.archive.originalName });
  } catch (err) { next(err); }
});

// POST /api/dita-ot/reset — drop the uploaded archive and clear advanced
// settings. Equivalent to "go back to stock DITA-OT 3.5.4".
router.post('/reset', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotSourcesFull();
    const cfg = await loadConfig();
    const previousKey = cfg.archive?.key || '';
    const previousBucket = cfg.archive?.bucket || '';

    cfg.archive = {};
    cfg.isDefault = true;
    cfg.transtype = '';
    cfg.parameters = [];
    await cfg.save();

    if (previousKey && previousBucket) {
      try {
        await s3.deleteOne({ bucket: previousBucket, key: previousKey });
      } catch (err) {
        console.warn('dita-ot: failed to delete archive on reset:', err.message);
      }
    }

    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ config: serialise(cfg), message: 'Reset to default DITA-OT' });
  } catch (err) { next(err); }
});

module.exports = router;
