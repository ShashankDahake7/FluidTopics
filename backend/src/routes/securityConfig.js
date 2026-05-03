const express = require('express');
const SecurityConfig = require('../models/SecurityConfig');
const { auth, requireRole } = require('../middleware/auth');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotIntegrationSecurityFull } = require('../services/configHistorySnapshots');

const router = express.Router();

router.use(auth, requireRole('superadmin', 'admin'));

// GET  /api/security-config
router.get('/', async (req, res, next) => {
  try {
    let config = await SecurityConfig.findOne();
    if (!config) {
      config = await SecurityConfig.create({ trustedOrigins: '', certificates: [] });
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT  /api/security-config
router.put('/', async (req, res, next) => {
  try {
    const { trustedOrigins, certificates } = req.body;
    let config = await SecurityConfig.findOne();
    const before = await snapshotIntegrationSecurityFull();
    if (!config) {
      config = new SecurityConfig({ trustedOrigins, certificates });
    } else {
      if (trustedOrigins !== undefined) config.trustedOrigins = trustedOrigins;
      if (certificates !== undefined) config.certificates = certificates;
    }
    await config.save();
    const after = await snapshotIntegrationSecurityFull();
    await logConfigChange({
      category: 'Integration security',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
