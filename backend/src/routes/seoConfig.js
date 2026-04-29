const express = require('express');
const SeoConfig = require('../models/SeoConfig');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Only superadmins (or KHUB_ADMIN) can access
router.use(auth, requireRole('superadmin', 'admin'));

router.get('/', async (req, res, next) => {
  try {
    let config = await SeoConfig.findOne();
    if (!config) {
      config = await SeoConfig.create({
        crawlingAllowed: true,
        titleTags: [{ id: 'title-base', label: 'Title (topic or document)', metadata: 'ft:title', locked: true }]
      });
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const patch = req.body;
    let config = await SeoConfig.findOne();
    if (!config) {
      config = new SeoConfig(patch);
      await config.save();
    } else {
      Object.assign(config, patch);
      await config.save();
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
