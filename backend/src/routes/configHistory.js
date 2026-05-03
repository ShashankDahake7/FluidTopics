const express = require('express');
const ConfigChange = require('../models/ConfigChange');
const { auth, requireRole } = require('../middleware/auth');
const { portalFilter } = require('../services/configAudit');
const { getCurrentSnapshot } = require('../services/configHistorySnapshots');

const router = express.Router();
router.use(auth, requireRole('superadmin', 'admin'));

// GET /api/config-history/current?category=Access%20rules — live snapshot for "Compare with current"
router.get('/current', async (req, res, next) => {
  try {
    const category = req.query.category;
    if (!category) return res.status(400).json({ error: 'category query parameter is required' });
    const snapshot = await getCurrentSnapshot(category);
    res.json({ category, snapshot });
  } catch (err) { next(err); }
});

// GET /api/config-history?category=&page=1&limit=10
router.get('/', async (req, res, next) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const clauses = [portalFilter('default')];
    if (category) clauses.push({ category });
    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const total = await ConfigChange.countDocuments(filter);
    const lim = Math.max(1, parseInt(limit, 10) || 10);
    const items = await ConfigChange.find(filter)
      .sort({ createdAt: -1 })
      .skip((Math.max(1, parseInt(page, 10)) - 1) * lim)
      .limit(lim);

    res.json({
      items,
      total,
      page: parseInt(page, 10),
      totalPages: Math.max(1, Math.ceil(total / lim)),
    });
  } catch (err) { next(err); }
});

// GET /api/config-history/:id — single entry
router.get('/:id', async (req, res, next) => {
  try {
    if (req.params.id === 'current') return res.status(404).json({ error: 'Not found.' });
    const entry = await ConfigChange.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found.' });
    res.json(entry);
  } catch (err) { next(err); }
});

module.exports = router;
