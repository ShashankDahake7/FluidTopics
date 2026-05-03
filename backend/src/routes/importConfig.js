const express = require('express');
const { OriginPortal, ImportRecord } = require('../models/ImportConfig');
const { auth, requireRole } = require('../middleware/auth');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotGeneralPortalParameters } = require('../services/configHistorySnapshots');

const router = express.Router();
router.use(auth, requireRole('superadmin', 'admin'));

// ── Origin Portals ────────────────────────────────────────────────────────

// GET /api/import-config/portals
router.get('/portals', async (req, res, next) => {
  try {
    const portals = await OriginPortal.find().sort({ createdAt: -1 });
    res.json(portals);
  } catch (err) { next(err); }
});

// POST /api/import-config/portals
router.post('/portals', async (req, res, next) => {
  try {
    const { baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) return res.status(400).json({ error: 'URL and API key are required.' });
    if (!/^https?:\/\//.test(baseUrl.trim())) {
      return res.status(400).json({ error: 'URL must start with https://' });
    }
    const before = await snapshotGeneralPortalParameters();
    const portal = await OriginPortal.create({
      baseUrl: baseUrl.trim(),
      apiKey,
      addedBy: req.user._id,
    });
    const after = await snapshotGeneralPortalParameters();
    await logConfigChange({
      category: 'General portal parameters',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(201).json(portal);
  } catch (err) { next(err); }
});

// DELETE /api/import-config/portals/:id
router.delete('/portals/:id', async (req, res, next) => {
  try {
    const before = await snapshotGeneralPortalParameters();
    await OriginPortal.findByIdAndDelete(req.params.id);
    // Also remove related imports
    await ImportRecord.deleteMany({ portalId: req.params.id });
    const after = await snapshotGeneralPortalParameters();
    await logConfigChange({
      category: 'General portal parameters',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Imports ───────────────────────────────────────────────────────────────

// GET /api/import-config/imports — last 20
router.get('/imports', async (req, res, next) => {
  try {
    const imports = await ImportRecord.find().sort({ createdAt: -1 }).limit(20);
    res.json(imports);
  } catch (err) { next(err); }
});

// POST /api/import-config/imports — start a new import from a portal
router.post('/imports', async (req, res, next) => {
  try {
    const { portalId } = req.body;
    const portal = await OriginPortal.findById(portalId);
    if (!portal) return res.status(404).json({ error: 'Origin portal not found.' });

    // Check no ongoing import
    const ongoing = await ImportRecord.findOne({ status: { $in: ['pending', 'retrieving', 'ready', 'applying'] } });
    if (ongoing) {
      return res.status(409).json({ error: 'An import is already in progress. Apply or discard it first.' });
    }

    const record = await ImportRecord.create({
      portalId: portal._id,
      url: portal.baseUrl,
      author: req.user.name || req.user.email || 'Admin',
      status: 'retrieving',
    });

    // Simulate retrieval (in a real system this would fetch from the origin portal)
    setTimeout(async () => {
      try {
        record.status = 'ready';
        await record.save();
      } catch { /* ignore */ }
    }, 2000);

    res.status(201).json(record);
  } catch (err) { next(err); }
});

// PUT /api/import-config/imports/:id/apply
router.put('/imports/:id/apply', async (req, res, next) => {
  try {
    const record = await ImportRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Import not found.' });
    if (record.status !== 'ready') {
      return res.status(400).json({ error: 'Import is not ready to apply.' });
    }

    record.status = 'applying';
    await record.save();

    // Simulate application
    setTimeout(async () => {
      try {
        record.status = 'done';
        await record.save();
      } catch { /* ignore */ }
    }, 2000);

    res.json(record);
  } catch (err) { next(err); }
});

// PUT /api/import-config/imports/:id/discard
router.put('/imports/:id/discard', async (req, res, next) => {
  try {
    const record = await ImportRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Import not found.' });

    record.status = 'failed';
    record.error = 'Discarded by user';
    await record.save();
    res.json(record);
  } catch (err) { next(err); }
});

module.exports = router;
