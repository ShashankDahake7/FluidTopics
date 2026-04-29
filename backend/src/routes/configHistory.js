const express = require('express');
const ConfigChange = require('../models/ConfigChange');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(auth, requireRole('superadmin', 'admin'));

// GET /api/config-history?category=&page=1&limit=10
router.get('/', async (req, res, next) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (category) filter.category = category;

    const total = await ConfigChange.countDocuments(filter);
    const items = await ConfigChange.find(filter)
      .sort({ createdAt: -1 })
      .skip((Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10));

    res.json({
      items,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) { next(err); }
});

// GET /api/config-history/:id — single entry
router.get('/:id', async (req, res, next) => {
  try {
    const entry = await ConfigChange.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found.' });
    res.json(entry);
  } catch (err) { next(err); }
});

module.exports = router;
