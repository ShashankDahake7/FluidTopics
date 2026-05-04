const express = require('express');
const SiteConfig = require('../models/SiteConfig');
const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotLanguages } = require('../services/configHistorySnapshots');
const { TRANSLATIONS: AR_TR } = require('../constants/adminRoles');

const translationsAdmin = requireTierOrAdminRoles(['admin'], AR_TR);

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
      searchInAllLanguagesEnabled: cfg.searchInAllLanguagesEnabled !== false,
    });
  } catch (err) { next(err); }
});

/**
 * PUT /api/languages/default — admin sets portal default (and optional locale allow-list).
 */
router.put('/default', auth, translationsAdmin, async (req, res, next) => {
  try {
    const { defaultLocale, enabledLocales, searchInAllLanguagesEnabled } = req.body || {};
    const cfg = await SiteConfig.getSingleton();
    const snapBefore = await snapshotLanguages();
    if (defaultLocale !== undefined && defaultLocale !== null) {
      cfg.defaultLocale = normalizeLocale(String(defaultLocale)) || 'en';
    }
    if (Array.isArray(enabledLocales)) {
      cfg.enabledLocales = [...new Set(enabledLocales.map((x) => normalizeLocale(String(x))))];
    }
    if (typeof searchInAllLanguagesEnabled === 'boolean') {
      cfg.searchInAllLanguagesEnabled = searchInAllLanguagesEnabled;
    }
    await cfg.save();
    const snapAfter = await snapshotLanguages();
    await logConfigChange({
      category: 'Languages',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json({
      defaultLocale: cfg.defaultLocale,
      enabledLocales: cfg.enabledLocales || [],
      searchInAllLanguagesEnabled: cfg.searchInAllLanguagesEnabled !== false,
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
