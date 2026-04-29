const express = require('express');
const OpenSearchConfig = require('../models/OpenSearchConfig');
const { search } = require('../services/search/searchService');

const router = express.Router();

router.get('/opensearch.xml', async (req, res, next) => {
  try {
    const config = await OpenSearchConfig.findOne();
    if (!config || !config.enabled) return res.status(404).send('OpenSearch not enabled');

    const origin = `${req.protocol}://${req.get('host')}`;
    let xml = config.xml || '';
    
    // Replace placeholders
    xml = xml.replace(/\$PORTAL_URL/g, req.get('host'));

    // If the name is set, inject it as ShortName if it's currently a placeholder or empty
    if (config.name) {
      xml = xml.replace(/<ShortName>.*?<\/ShortName>/, `<ShortName>${config.name}</ShortName>`);
    }

    res.type('application/opensearchdescription+xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

router.get('/api/opensearch', async (req, res, next) => {
  try {
    const config = await OpenSearchConfig.findOne();
    if (!config || !config.enabled) return res.status(404).send('OpenSearch not enabled');

    const origin = `${req.protocol}://${req.get('host')}`;
    const query = req.query.query || '';
    const limit = parseInt(req.query.limit, 10) || 10;

    const { items, total } = await search({
      term: query,
      limit,
      page: 1,
      user: null
    });

    res.type('application/atom+xml');
    
    const entries = items.map(item => {
      const url = `${origin}/r/${item.prettyUrl || item.slug || item.documentId || item._id}`;
      return `  <entry>
    <title><![CDATA[${item.title || item.documentTitle || 'Untitled'}]]></title>
    <link href="${url}"/>
    <id>${url}</id>
    <updated>${new Date().toISOString()}</updated>
    <summary><![CDATA[${(item.highlights && item.highlights.length > 0) ? item.highlights[0] : ''}]]></summary>
  </entry>`;
    });

    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <title>Search results for "${query}"</title>
  <link href="${origin}/api/opensearch?query=${encodeURIComponent(query)}"/>
  <updated>${new Date().toISOString()}</updated>
  <author>
    <name>${config.name || req.get('host')}</name>
  </author>
  <id>${origin}/api/opensearch</id>
  <opensearch:totalResults>${total}</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>${limit}</opensearch:itemsPerPage>
  <opensearch:Query role="request" searchTerms="${query}" startPage="1" />
${entries.join('\n')}
</feed>`;

    res.send(atom);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
