const express = require('express');
const SiteConfig = require('../models/SiteConfig');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ISO / BCP-47-ish codes we accept in SiteConfig + User.preferences.language
const DISPLAY = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  zh: '中文',
};

const normalizeLocale = (code) => {
  if (!code || typeof code !== 'string') return 'en';
  const c = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
  return c || 'en';
};

/**
 * GET /api/languages/default — system default locale + optional allow-list.
 */
router.get('/default', async (_req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    res.json({
      defaultLocale: cfg.defaultLocale || 'en',
      enabledLocales: Array.isArray(cfg.enabledLocales) ? cfg.enabledLocales : [],
    });
  } catch (err) { next(err); }
});

/**
 * PUT /api/languages/default — admin sets portal default (and optional locale allow-list).
 */
router.put('/default', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { defaultLocale, enabledLocales } = req.body || {};
    const cfg = await SiteConfig.getSingleton();
    if (defaultLocale !== undefined && defaultLocale !== null) {
      cfg.defaultLocale = normalizeLocale(String(defaultLocale)) || 'en';
    }
    if (Array.isArray(enabledLocales)) {
      cfg.enabledLocales = [...new Set(enabledLocales.map((x) => normalizeLocale(String(x))))];
    }
    await cfg.save();
    res.json({
      defaultLocale: cfg.defaultLocale,
      enabledLocales: cfg.enabledLocales || [],
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/languages/:locale — FT-style single-locale descriptor for clients.
 */
router.get('/:locale', async (req, res, next) => {
  try {
    const code = normalizeLocale(req.params.locale);
    res.json({
      locale: code,
      displayName: DISPLAY[code] || code,
      direction: 'ltr',
      isRtl: false,
      dateFormat: 'YYYY-MM-DD',
      numberFormat: 'en-US',
    });
  } catch (err) { next(err); }
});

module.exports = router;
