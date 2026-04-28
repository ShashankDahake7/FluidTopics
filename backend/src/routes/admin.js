const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const User     = require('../models/User');
const config = require('../config/env');
const SiteConfig = require('../models/SiteConfig');

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const [docCount, topicCount, userCount, recentDocs] = await Promise.all([
      Document.countDocuments(),
      Topic.countDocuments(),
      User.countDocuments(),
      Document.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title status sourceFormat topicIds createdAt')
        .lean(),
    ]);

    const docsByStatus = await Document.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      documents: docCount,
      topics:    topicCount,
      users:     userCount,
      recentDocuments: recentDocs.map((d) => ({
        ...d,
        topicCount: d.topicIds?.length || 0,
      })),
      documentsByStatus: Object.fromEntries(docsByStatus.map((d) => [d._id, d.count])),
    });
  } catch (error) {
    next(error);
  }
});

// User CRUD lives in routes/adminUsers.js (mounted at /api/admin in index.js).
// The impersonate endpoint stays here because it depends on the auth/Session
// machinery rather than the user-management plumbing.

// POST /api/admin/users/:id/impersonate — issue a short-lived access token
// that authenticates as the target user but carries the admin's id in the
// `actor` claim, so audit / activity attribution can attach to the real
// human behind the request.
router.post('/users/:id/impersonate', auth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const Session = require('../models/Session');
    const crypto = require('crypto');

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }
    const target = await User.findById(req.params.id);
    if (!target || !target.isActive) {
      return res.status(404).json({ error: 'Target user not found or deactivated' });
    }
    if (target.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient permissions to impersonate this account.' });
    }

    // Short-lived (1h) impersonation session. We persist a Session row so
    // logout / revocation works the same way as a normal login.
    const refresh = crypto.randomBytes(32).toString('hex');
    const session = await Session.create({
      userId:    target._id,
      actorId:   req.user._id,
      refreshTokenHash: crypto.createHash('sha256').update(refresh).digest('hex'),
      userAgent: (req.headers['user-agent'] || '').slice(0, 250),
      ip:        req.ip || '',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });
    const token = jwt.sign(
      { id: target._id, sid: session._id, actor: req.user._id },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    res.json({ token, refreshToken: refresh, impersonating: { _id: target._id, email: target.email } });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/reindex — no-op under MongoDB Atlas Search.
// Atlas Search keeps its index in sync with the topics collection via change
// streams, so there is nothing to rebuild. Kept as an endpoint for backward
// compatibility with any UI / scripts that hit it; returns the current topic
// count so callers can confirm the collection is healthy. To force a rebuild,
// drop and recreate the Atlas Search index in the Atlas UI.
router.post('/reindex', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const total = await Topic.countDocuments();
    res.json({
      message: 'Atlas Search auto-syncs; no rebuild needed. Recreate the search index in Atlas if you need a hard rebuild.',
      total,
      processed: total,
    });
  } catch (error) {
    next(error);
  }
});

const TranslationProfile = require('../models/TranslationProfile');

// GET /api/admin/translation-profiles — list AI translation profiles
router.get('/translation-profiles', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const profiles = await TranslationProfile.find().sort({ name: 1 }).lean();
    res.json({ profiles });
  } catch (e) { next(e); }
});

// POST /api/admin/translation-profiles — create profile (optionally set as default)
router.post('/translation-profiles', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || typeof body.name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const p = await TranslationProfile.create({
      name: body.name.trim(),
      description: body.description || '',
      provider: body.provider || 'groq',
      model: body.model,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      sourceLanguages: body.sourceLanguages,
      targetLanguages: body.targetLanguages,
      isDefault: !!body.isDefault,
    });
    if (body.isDefault) {
      await TranslationProfile.updateMany({ _id: { $ne: p._id } }, { $set: { isDefault: false } });
    }
    res.status(201).json(p);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// Legal terms (Fluid Topics–style admin)
// ---------------------------------------------------------------------------

// `superadmin` / `admin` tier OR holders of the `PORTAL_ADMIN` administrative
// role may edit the portal's legal terms. `editor` retains read-only access so
// the existing legal-terms page stays browseable.
function requireLegalTermsAdmin({ allowEditor = false } = {}) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();
    if (allowEditor && req.user.role === 'editor')                   return next();
    if ((req.user.adminRoles || []).includes('PORTAL_ADMIN'))        return next();
    return res.status(403).json({ error: 'Insufficient permissions.' });
  };
}

let writeAuditLT = () => {};
try { writeAuditLT = require('../services/users/auditService').writeAudit; }
catch { /* audit helper optional in some test envs */ }

function normalizeLegalMessages(raw, defaultLocale) {
  const fb = (defaultLocale || 'en').toLowerCase().split('-')[0];
  let list = Array.isArray(raw) ? raw.map((m) => ({
    locale: String(m.locale || '').toLowerCase().split('-')[0] || fb,
    label: typeof m.label === 'string' ? m.label : '',
    linksHtml: typeof m.linksHtml === 'string' ? m.linksHtml : '',
    validated: !!m.validated,
  })) : [];
  if (!list.some((m) => m.locale === fb)) {
    list = [{ locale: fb, label: '', linksHtml: '', validated: false }, ...list];
  }
  const seen = new Set();
  list = list.filter((m) => {
    if (seen.has(m.locale)) return false;
    seen.add(m.locale);
    return true;
  });
  list.sort((a, b) => (a.locale === fb ? -1 : b.locale === fb ? 1 : a.locale.localeCompare(b.locale)));
  return { list, fallbackLocale: fb };
}

router.get('/legal-terms', auth, requireLegalTermsAdmin({ allowEditor: true }), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const defaultLocale = (cfg.defaultLocale || 'en').toLowerCase().split('-')[0];
    const { list, fallbackLocale } = normalizeLegalMessages(cfg.legalTermsMessages, defaultLocale);
    res.json({
      defaultLocale: fallbackLocale,
      enabled: !!cfg.legalTermsEnabled,
      messages: list,
      policyVersion: cfg.legalTermsPolicyVersion || 0,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
    });
  } catch (e) {
    next(e);
  }
});

router.put('/legal-terms', auth, requireLegalTermsAdmin(), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const defaultLocale = (cfg.defaultLocale || 'en').toLowerCase().split('-')[0];
    const enabled = !!req.body?.enabled;
    const { list } = normalizeLegalMessages(req.body?.messages, defaultLocale);

    if (enabled) {
      const fb = list.find((m) => m.locale === defaultLocale);
      if (!fb || !fb.label?.trim() || !fb.linksHtml?.trim()) {
        return res.status(400).json({
          error: 'You cannot save an invalid configuration. Fallback language message is mandatory.',
        });
      }
      if (!fb.validated) {
        return res.status(400).json({
          error: 'You cannot save an invalid configuration: Fallback language message must be validated.',
        });
      }
    }

    const before = {
      enabled: !!cfg.legalTermsEnabled,
      messages: (cfg.legalTermsMessages || []).map((m) => ({ ...(m.toObject ? m.toObject() : m) })),
    };

    cfg.legalTermsEnabled = enabled;
    cfg.legalTermsMessages = list;
    await cfg.save();

    try {
      await writeAuditLT(req, {
        action: 'legal-terms.update',
        summary: `Legal terms ${enabled ? 'enabled' : 'disabled'} (v${cfg.legalTermsPolicyVersion || 0})`,
        context: {
          version: cfg.legalTermsPolicyVersion || 0,
          before,
          after: { enabled, messages: list },
        },
      });
    } catch { /* fire-and-forget */ }

    res.json({
      defaultLocale,
      enabled: cfg.legalTermsEnabled,
      messages: cfg.legalTermsMessages,
      policyVersion: cfg.legalTermsPolicyVersion || 0,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/legal-terms/new-version', auth, requireLegalTermsAdmin(), async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    if (!cfg.legalTermsEnabled) {
      return res.status(400).json({ error: 'Enable legal terms before creating a new version.' });
    }
    const previousVersion = cfg.legalTermsPolicyVersion || 0;
    cfg.legalTermsPolicyVersion = previousVersion + 1;
    cfg.legalTermsLastPolicyUpdateAt = new Date();
    await cfg.save();

    try {
      await writeAuditLT(req, {
        action: 'legal-terms.new-version',
        summary: `Bumped legal terms policy v${previousVersion} -> v${cfg.legalTermsPolicyVersion}; all users will be re-prompted`,
        context: {
          previousVersion,
          newVersion: cfg.legalTermsPolicyVersion,
        },
      });
    } catch { /* fire-and-forget */ }

    res.json({
      policyVersion: cfg.legalTermsPolicyVersion,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
