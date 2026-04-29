const express = require('express');
const SeoConfig = require('../models/SeoConfig');
const Topic = require('../models/Topic');
const Document = require('../models/Document');

const router = express.Router();

router.get('/robots.txt', async (req, res, next) => {
  try {
    const config = await SeoConfig.findOne();
    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('text/plain');

    if (!config || !config.crawlingAllowed) {
      return res.send(`User-agent: *\nDisallow: /\n`);
    }

    let txt = `User-agent: *
Disallow: /
Allow: /$
Allow: /home
Allow: /r/*
Allow: /v/u/*
Allow: /go/*
Allow: /access/sources/*/*
Allow: /reader/*/root
Allow: /reader/*/*
Allow: /viewer/document/*
Allow: /p/*
Allow: /api/khub/documents/*/content
Allow: /sitemap.xml
Allow: /sitemap/home.xml
Allow: /sitemap/pages.xml
Allow: /sitemap/structured/*.xml
Allow: /sitemap/unstructured/*.xml
Allow: /favicon.ico
Sitemap: ${origin}/sitemap.xml
`;

    if (config.customRobotsFile) {
      txt += `\n${config.customRobotsFile}\n`;
    }

    res.send(txt);
  } catch (err) {
    next(err);
  }
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const config = await SeoConfig.findOne();
    if (!config || !config.crawlingAllowed) return res.status(404).send('Not Found');

    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('application/xml');
    
    // We will just generate one massive sitemap for now, as it's easier, or return sitemap index
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${origin}/sitemap/pages.xml</loc>
  </sitemap>
</sitemapindex>`);
  } catch (err) {
    next(err);
  }
});

router.get('/sitemap/pages.xml', async (req, res, next) => {
  try {
    const config = await SeoConfig.findOne();
    if (!config || !config.crawlingAllowed) return res.status(404).send('Not Found');

    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('application/xml');

    const topics = await Topic.find({ status: 'published' }).limit(1000).lean();

    let urls = topics.map(t => {
      const url = `${origin}/r/${t.prettyUrl || t.slug || t._id}`;
      return `  <url>\n    <loc>${url}</loc>\n  </url>`;
    });

    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
  } catch (err) {
    next(err);
  }
});

// Serve verification files
router.get('/:file', async (req, res, next) => {
  try {
    const config = await SeoConfig.findOne();
    if (!config) return next();

    // Google verification
    if (config.googleFile && req.params.file === config.googleFile) {
      return res.type('text/html').send(`google-site-verification: ${config.googleFile}`);
    }

    // Bing verification
    if (config.bingFile && req.params.file === config.bingFile) {
      return res.type('application/xml').send(`<?xml version="1.0"?>\n<users>\n  <user>bing</user>\n</users>`);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Middleware for intercepting SPA requests for crawlers
const CRAWLERS = [
  'bot', 'AdsBot-Google', 'AhrefsBot', 'anthropic', 'Applebot', 'BecomeBot', 
  'bingbot', 'BingPreview', 'Claude', 'cohere-ai', 'crawler', 'facebookexternalhit', 
  'Feedfetcher', 'Gemini', 'Google Web Preview', 'Google-Agent', 'Googlebot', 
  'GPTBot', 'MistralAI', 'Perplexity', 'Slurp', 'spider', 'YandexBot'
];

router.use(async (req, res, next) => {
  const ua = req.get('User-Agent') || '';
  const isBot = CRAWLERS.some(c => ua.toLowerCase().includes(c.toLowerCase()));
  
  if (isBot && req.method === 'GET') {
    // If it's a reader or viewer route
    if (req.path.startsWith('/r/')) {
      const config = await SeoConfig.findOne();
      if (!config || !config.crawlingAllowed) {
        return res.status(403).send('Crawling disallowed');
      }

      const idOrSlug = req.path.split('/')[2];
      const topic = await Topic.findOne({
        $or: [{ _id: idOrSlug.length === 24 ? idOrSlug : null }, { slug: idOrSlug }, { prettyUrl: idOrSlug }]
      }).lean();

      if (!topic) return res.status(404).send('Not found');

      const origin = `${req.protocol}://${req.get('host')}`;
      const canonical = `${origin}${req.path}`;
      const desc = topic.metadata && topic.metadata['ft:description'] ? topic.metadata['ft:description'] : (topic.htmlBody || '').substring(0, 320).replace(/<[^>]+>/g, '');

      // Build Title
      let titleStr = topic.title || '';
      if (config.titleTags && config.titleTags.length > 0) {
        const parts = [];
        for (const tag of config.titleTags) {
          if (tag.metadata === 'ft:title') {
            parts.push(topic.title);
          } else if (topic.metadata && topic.metadata[tag.metadata]) {
            parts.push(topic.metadata[tag.metadata]);
          }
        }
        if (parts.length > 0) titleStr = parts.join(' - ');
      }

      // Build Robots Meta
      let robotsFlags = { ...(config.defaultRobots || {}) };
      if (config.customRules && config.customRules.length > 0 && topic.metadata) {
        for (const rule of config.customRules) {
          if (!rule.metadataKey || !rule.metadataValues) continue;
          const topicVal = String(topic.metadata[rule.metadataKey] || '').toLowerCase();
          const values = rule.metadataValues.split(',').map(v => v.trim().toLowerCase());
          if (values.includes(topicVal)) {
            robotsFlags = { ...robotsFlags, ...rule.flags };
          }
        }
      }
      const activeFlags = [];
      if (robotsFlags.noindex) activeFlags.push('noindex');
      if (robotsFlags.nofollow) activeFlags.push('nofollow');
      if (robotsFlags.noarchive) activeFlags.push('noarchive');
      const robotsMeta = activeFlags.length > 0 ? `\n  <meta name="robots" content="${activeFlags.join(', ')}">` : '';

      return res.send(`<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <title>${titleStr}</title>
  <link rel="canonical" href="${canonical}">
  <meta name="description" content="${desc}">${robotsMeta}
</head>
<body>
  ${topic.htmlBody || ''}
</body>
</html>`);
    }
  }
  next();
});

module.exports = router;
