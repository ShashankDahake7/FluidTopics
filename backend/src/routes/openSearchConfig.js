const express = require('express');
const OpenSearchConfig = require('../models/OpenSearchConfig');
const { auth, requireRole } = require('../middleware/auth');
const { logConfigChange } = require('../services/configAudit');

const router = express.Router();

router.use(auth, requireRole('superadmin', 'admin'));

router.get('/', async (req, res, next) => {
  try {
    let config = await OpenSearchConfig.findOne();
    if (!config) {
      config = await OpenSearchConfig.create({
        enabled: false,
        name: '',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
    <ShortName>$PORTAL_URL</ShortName>
    <Description>This example must be edited in order to reflect your own engine</Description>
    <Url type="text/html" rel="results" template="https://$PORTAL_URL/search/all?query={searchTerms}"/>
    <Url type="application/atom+xml" rel="results" template="https://$PORTAL_URL/api/opensearch?query={searchTerms}&amp;limit={count?}&amp;startIndex={startIndex?}&amp;content-lang={language?}"/>
    <Query role="example" searchTerms="how" />
</OpenSearchDescription>`
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
    let config = await OpenSearchConfig.findOne();
    const before = config ? config.toObject() : {};
    if (!config) {
      config = new OpenSearchConfig(patch);
      await config.save();
    } else {
      Object.assign(config, patch);
      await config.save();
    }
    await logConfigChange({
      category: 'OpenSearch',
      author: req.user.name || req.user.email,
      authorEmail: req.user.email,
      before,
      after: config.toObject(),
    });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
