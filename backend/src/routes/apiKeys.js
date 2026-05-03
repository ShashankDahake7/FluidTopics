const express = require('express');
const ApiKey = require('../models/ApiKey');
const { auth, requireRole } = require('../middleware/auth');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotIntegrationSecurityFull } = require('../services/configHistorySnapshots');

const router = express.Router();

// All routes require admin auth
router.use(auth, requireRole('superadmin', 'admin'));

// GET /api/api-keys — list all API keys
router.get('/', async (req, res, next) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: 1 });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// POST /api/api-keys — create a new API key
router.post('/', async (req, res, next) => {
  try {
    const { name, description, roles, groups, ipRestrictions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      return res.status(400).json({ error: 'Only alphanumeric, dashes, and underscores are allowed.' });
    }
    const existing = await ApiKey.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'An API key with this name already exists.' });
    }

    const before = await snapshotIntegrationSecurityFull();
    const key = await ApiKey.create({
      name: name.trim(),
      description: description || '',
      roles: roles || [],
      groups: groups || [],
      ipRestrictions: ipRestrictions || '',
    });
    const after = await snapshotIntegrationSecurityFull();
    await logConfigChange({
      category: 'Integration security',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
});

// PUT /api/api-keys/:id — update an API key
router.put('/:id', async (req, res, next) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found.' });

    const before = await snapshotIntegrationSecurityFull();
    const { name, description, roles, groups, ipRestrictions } = req.body;
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Name is required.' });
      if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
        return res.status(400).json({ error: 'Only alphanumeric, dashes, and underscores are allowed.' });
      }
      const dup = await ApiKey.findOne({ name: name.trim(), _id: { $ne: key._id } });
      if (dup) return res.status(409).json({ error: 'Duplicate name.' });
      key.name = name.trim();
    }
    if (description !== undefined) key.description = description;
    if (roles !== undefined) key.roles = roles;
    if (groups !== undefined) key.groups = groups;
    if (ipRestrictions !== undefined) key.ipRestrictions = ipRestrictions;

    await key.save();
    const after = await snapshotIntegrationSecurityFull();
    await logConfigChange({
      category: 'Integration security',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json(key);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/api-keys/:id — delete an API key
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await snapshotIntegrationSecurityFull();
    const key = await ApiKey.findByIdAndDelete(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found.' });
    const after = await snapshotIntegrationSecurityFull();
    await logConfigChange({
      category: 'Integration security',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
