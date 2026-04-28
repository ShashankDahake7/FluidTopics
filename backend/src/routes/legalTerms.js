const express = require('express');
const { auth } = require('../middleware/auth');
const SiteConfig = require('../models/SiteConfig');
const User       = require('../models/User');
const Session    = require('../models/Session');
const Bookmark   = require('../models/Bookmark');
const SavedSearch  = require('../models/SavedSearch');
const PersonalBook = require('../models/PersonalBook');
const Collection   = require('../models/Collection');
const { writeAudit } = require('../services/users/auditService');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pickMessage(messages = [], requestedLocale, fallbackLocale) {
  const normalize = (l) => (l || '').toString().toLowerCase().split('-')[0];
  const want = normalize(requestedLocale);
  const fb   = normalize(fallbackLocale) || 'en';
  const byLocale = (loc) => messages.find((m) => normalize(m.locale) === loc);
  const direct  = want && byLocale(want);
  const fbMsg   = byLocale(fb) || messages[0] || null;
  const chosen  = direct || fbMsg;
  if (!chosen) {
    return { locale: fb, label: '', linksHtml: '', usedFallback: true };
  }
  return {
    locale: chosen.locale || fb,
    label: chosen.label || '',
    linksHtml: chosen.linksHtml || '',
    usedFallback: chosen !== direct,
  };
}

function userPreferredLocale(req) {
  if (req.user?.preferences?.language) return req.user.preferences.language;
  if (req.headers['accept-language']) return req.headers['accept-language'].split(',')[0];
  return null;
}

// -----------------------------------------------------------------------------
// GET /api/legal-terms/status — returns whether the signed-in user must accept
// the legal terms before continuing, plus the message in their preferred
// language (with fallback). Used by the LegalTermsGate component.
// -----------------------------------------------------------------------------
router.get('/status', auth, async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    const enabled = !!cfg.legalTermsEnabled;
    const version = cfg.legalTermsPolicyVersion || 0;
    const fallback = (cfg.defaultLocale || 'en').toLowerCase().split('-')[0];

    if (!enabled) {
      return res.json({ enabled: false, mustAccept: false, version });
    }

    // Don't gate impersonation sessions — the audit trail captures what the
    // admin does, and we don't want to corrupt the impersonated user's record.
    if (req.actor) {
      return res.json({ enabled: true, mustAccept: false, version, isImpersonating: true });
    }

    const accepted = req.user?.legalTerms?.acceptedVersion ?? null;
    const mustAccept = accepted !== version;
    const isUpdate   = mustAccept && accepted != null && accepted < version;

    const message = pickMessage(cfg.legalTermsMessages, userPreferredLocale(req), fallback);
    res.json({
      enabled: true,
      mustAccept,
      isUpdate,
      version,
      acceptedVersion: accepted,
      lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
      message,
      fallbackLocale: fallback,
    });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// POST /api/legal-terms/accept — record acceptance for the current version.
// -----------------------------------------------------------------------------
router.post('/accept', auth, async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    if (!cfg.legalTermsEnabled) {
      return res.json({ ok: true, accepted: false, reason: 'disabled' });
    }
    const version = cfg.legalTermsPolicyVersion || 0;

    req.user.legalTerms = {
      acceptedVersion: version,
      acceptedAt:      new Date(),
      declinedAt:      null,
    };
    await req.user.save();

    await writeAudit(req, {
      action: 'legal-terms.accept',
      targetUserIds: [req.user._id],
      summary: `Accepted legal terms v${version}`,
      context: { version, realm: req.user.realm },
    });

    res.json({ ok: true, accepted: true, version });
  } catch (err) { next(err); }
});

// -----------------------------------------------------------------------------
// POST /api/legal-terms/decline — handle a "Cancel" press on the prompt.
//
// Per the BRD:
//   - Internal-realm or self-signed-up users → account is deleted; they have
//     to be recreated.
//   - SSO/LDAP/OIDC users → their session is revoked; the next sign-in re-
//     prompts them.
// -----------------------------------------------------------------------------
router.post('/decline', auth, async (req, res, next) => {
  try {
    const cfg = await SiteConfig.getSingleton();
    if (!cfg.legalTermsEnabled) {
      return res.json({ ok: true, action: 'noop' });
    }

    const realm = req.user.realm || 'internal';
    const userId = req.user._id;
    const email  = req.user.email;
    const action = realm === 'internal' ? 'delete' : 'revoke';

    if (req.session) {
      req.session.revokedAt = new Date();
      await req.session.save();
    }

    if (action === 'delete') {
      await Promise.all([
        Bookmark.deleteMany({     userId }),
        SavedSearch.deleteMany({  userId }),
        PersonalBook.deleteMany({ userId }),
        Collection.deleteMany({   userId }),
        Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
      ]);
      await User.deleteOne({ _id: userId });
    } else {
      // For SSO/LDAP/OIDC realms the account remains; just mark the decline.
      req.user.legalTerms = {
        acceptedVersion: req.user.legalTerms?.acceptedVersion ?? null,
        acceptedAt:      req.user.legalTerms?.acceptedAt ?? null,
        declinedAt:      new Date(),
      };
      await req.user.save();
    }

    await writeAudit(req, {
      action: `legal-terms.decline.${action}`,
      targetUserIds: [userId],
      summary: action === 'delete'
        ? `Declined legal terms; deleted internal account ${email}`
        : `Declined legal terms; revoked session for ${email} (${realm})`,
      context: { version: cfg.legalTermsPolicyVersion || 0, realm },
    });

    res.json({ ok: true, action });
  } catch (err) { next(err); }
});

module.exports = router;
