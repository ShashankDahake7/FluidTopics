const express = require('express');
const Topic = require('../models/Topic');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const SiteConfig = require('../models/SiteConfig');

const router = express.Router();

// Map ISO codes to display names — extended on demand.
const NAMES = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  zh: '中文',
};

const present = (lang, count) => ({
  code: lang,
  name: NAMES[lang] || lang,
  count,
});

// GET /api/locales — every locale present anywhere in the corpus.
router.get('/', async (_req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const [topicAgg, unstructAgg] = await Promise.all([
      Topic.aggregate([
        { $group: { _id: { $ifNull: ['$metadata.language', 'en'] }, count: { $sum: 1 } } },
      ]),
      UnstructuredDocument.aggregate([
        { $group: { _id: { $ifNull: ['$metadata.language', 'en'] }, count: { $sum: 1 } } },
      ]),
    ]);

    const merged = new Map();
    [...topicAgg, ...unstructAgg].forEach((row) => {
      const code = row._id || 'en';
      merged.set(code, (merged.get(code) || 0) + row.count);
    });

    let locales = [...merged.entries()].map(([code, count]) => present(code, count));
    locales.sort((a, b) => b.count - a.count);
    const allow = (cfg.enabledLocales || []).filter(Boolean);
    if (allow.length) {
      const set = new Set(allow);
      locales = locales.filter((l) => set.has(l.code));
    }

    res.json({
      defaultLocale: cfg.defaultLocale || 'en',
      enabledLocales: allow,
      locales,
    });
  } catch (err) { next(err); }
});

// GET /api/locales/filtered — locales available within a filter scope (?tags=, ?documentId=, ?releaseNotes=1).
router.get('/filtered', async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const filter = {};
    if (req.query.documentId) filter.documentId = req.query.documentId;
    if (req.query.tags) {
      const tags = req.query.tags.split(',').filter(Boolean);
      if (tags.length) filter['metadata.tags'] = { $in: tags };
    }
    if (req.query.releaseNotes === '1' || req.query.releaseNotes === 'true') {
      filter['metadata.tags'] = filter['metadata.tags']
        ? { $in: [...(filter['metadata.tags'].$in || []), 'Release Notes'] }
        : 'Release Notes';
    }

    const agg = await Topic.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ['$metadata.language', 'en'] }, count: { $sum: 1 } } },
    ]);

    const locales = agg.map((r) => present(r._id || 'en', r.count));
    res.json({
      defaultLocale: cfg.defaultLocale || 'en',
      locales: locales.sort((a, b) => b.count - a.count),
    });
  } catch (err) { next(err); }
});

module.exports = router;
