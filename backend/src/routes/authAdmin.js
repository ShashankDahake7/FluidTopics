const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const AuthSettings = require('../models/AuthSettings');
const AuthRealm    = require('../models/AuthRealm');
const User         = require('../models/User');
const Session      = require('../models/Session');
const { writeAudit, diffContext } = require('../services/users/auditService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotAuthentication } = require('../services/configHistorySnapshots');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorisation tiers (mirrors the BRD copy):
//   - General tab        : ADMIN | PORTAL_ADMIN
//   - Realms tab         : ADMIN only (PORTAL_ADMIN cannot mutate realms)
//
// `superadmin` is treated like `admin` everywhere, matching the rest of the
// admin surface.
// ---------------------------------------------------------------------------
function isAdminTier(req) {
  return req.user?.role === 'superadmin' || req.user?.role === 'admin';
}
function hasAdminRole(req, role) {
  const arr = Array.isArray(req.user?.adminRoles) ? req.user.adminRoles : [];
  return arr.includes(role);
}
function requirePortalOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (isAdminTier(req) || hasAdminRole(req, 'PORTAL_ADMIN')) return next();
  return res.status(403).json({ error: 'ADMIN or PORTAL_ADMIN role required.' });
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (isAdminTier(req)) return next();
  return res.status(403).json({ error: 'ADMIN role required.' });
}

// ---------------------------------------------------------------------------
// Sanitisers / projectors. Keep secrets out of API responses.
// ---------------------------------------------------------------------------
const SECRET_KEYS = ['oidcClientSecret', 'ldapBindPassword'];

function publicRealm(realm, { revealSecrets = false } = {}) {
  if (!realm) return null;
  const obj = realm.toObject ? realm.toObject() : realm;
  const cfg = { ...(obj.config || {}) };
  if (!revealSecrets) {
    SECRET_KEYS.forEach((k) => {
      if (cfg[k]) cfg[k] = '__redacted__';
    });
  }
  return {
    id:           String(obj._id),
    identifier:   obj.identifier,
    type:         obj.type,
    enabled:      !!obj.enabled,
    position:     obj.position ?? 0,
    config:       cfg,
    profileMapperScript: obj.profileMapperScript || '',
    mfaEnabled:   !!obj.mfaEnabled,
    migrateFromRealms: Array.isArray(obj.migrateFromRealms) ? obj.migrateFromRealms : [],
    createdAt:    obj.createdAt,
    updatedAt:    obj.updatedAt,
    createdByName:obj.createdByName || '',
    updatedByName:obj.updatedByName || '',
  };
}

function publicGeneral(s) {
  if (!s) return null;
  const obj = s.toObject ? s.toObject() : s;
  return {
    requireAuth:               !!obj.requireAuth,
    openSsoInCurrentWindow:    !!obj.openSsoInCurrentWindow,
    hideCredentialsFormIfSso:  !!obj.hideCredentialsFormIfSso,
    logoutRedirectUrl:         obj.logoutRedirectUrl || '',
    hideNativeLogout:          !!obj.hideNativeLogout,
    idleTimeoutEnabled:        !!obj.idleTimeoutEnabled,
    idleTimeoutMinutes:        Math.max(30, Number(obj.idleTimeoutMinutes) || 30),
    rememberMeDays:            Math.max(1, Number(obj.rememberMeDays) || 30),
    mfaGraceDays:              Math.max(0, Number(obj.mfaGraceDays) || 0),
    updatedAt:                 obj.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Type-aware config sanitiser. Strips unknown keys so a bad client cannot
// pollute the document, and applies per-type defaults / coercions.
// ---------------------------------------------------------------------------
function sanitizeConfig(type, raw = {}) {
  const out = {
    showLoginButton: raw.showLoginButton !== false,
    buttonImageUrl:  String(raw.buttonImageUrl || ''),
    buttonLabels:    Array.isArray(raw.buttonLabels)
      ? raw.buttonLabels
        .map((l) => ({ locale: String(l?.locale || '').trim(), label: String(l?.label || '') }))
        .filter((l) => l.locale)
      : [],
  };
  if (type === 'internal') {
    const reg = ['public', 'verified', 'closed'].includes(raw.registrationType)
      ? raw.registrationType
      : 'verified';
    out.registrationType    = reg;
    out.passwordPolicy      = raw.passwordPolicy === 'high' ? 'high' : 'low';
    out.allowedEmailDomains = Array.isArray(raw.allowedEmailDomains)
      ? raw.allowedEmailDomains.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
      : [];
  }
  if (type === 'ldap') {
    out.ldapUrl         = String(raw.ldapUrl || '');
    out.ldapBindDn      = String(raw.ldapBindDn || '');
    out.ldapBindPassword= String(raw.ldapBindPassword || '');
    out.ldapSearchBase  = String(raw.ldapSearchBase || '');
    out.ldapAuthMechanism = String(raw.ldapAuthMechanism || 'simple');
  }
  if (type === 'oidc') {
    out.oidcClientId     = String(raw.oidcClientId || '');
    out.oidcClientSecret = String(raw.oidcClientSecret || '');
    out.oidcDiscoveryUrl = String(raw.oidcDiscoveryUrl || '');
    out.oidcScopes       = Array.isArray(raw.oidcScopes)
      ? raw.oidcScopes.map((s) => String(s || '').trim()).filter(Boolean)
      : (typeof raw.oidcScopes === 'string'
        ? raw.oidcScopes.split(/\s+/).map((s) => s.trim()).filter(Boolean)
        : []);
    out.oidcSsoLogout    = !!raw.oidcSsoLogout;
  }
  if (type === 'saml') {
    out.samlIdpMetadataXml = String(raw.samlIdpMetadataXml || '');
    out.samlEntityId       = String(raw.samlEntityId || '');
    out.samlMaxAuthLifetimeSeconds = Math.max(60, Number(raw.samlMaxAuthLifetimeSeconds) || 7776000);
    out.samlIdpCerts       = Array.isArray(raw.samlIdpCerts)
      ? raw.samlIdpCerts.map((c) => ({
        cn:        String(c?.cn || ''),
        expiresAt: c?.expiresAt ? new Date(c.expiresAt) : null,
      }))
      : [];
  }
  if (type === 'jwt') {
    out.jwtIssuers = Array.isArray(raw.jwtIssuers)
      ? raw.jwtIssuers
        .map((i) => ({
          issuer:  String(i?.issuer || '').trim(),
          jwksUrl: String(i?.jwksUrl || '').trim(),
        }))
        .filter((i) => i.issuer || i.jwksUrl)
      : [];
    out.jwtRedirectionUrl = String(raw.jwtRedirectionUrl || '');
  }
  return out;
}

// ===========================================================================
// PUBLIC endpoints — used by the unauthenticated /login screen.
// ===========================================================================

// GET /api/auth/public/settings — login-time hints. Never includes secrets.
router.get('/public/settings', async (req, res, next) => {
  try {
    const cfg = await AuthSettings.getSingleton();
    const realmDocs = await AuthRealm.find({ enabled: true }).sort({ position: 1, createdAt: 1 });
    const realms = realmDocs.map((r) => {
      const o = r.toObject();
      return {
        id:         String(o._id),
        identifier: o.identifier,
        type:       o.type,
        showLoginButton: !!(o.config?.showLoginButton ?? true),
        buttonImageUrl:  o.config?.buttonImageUrl || '',
        buttonLabels:    Array.isArray(o.config?.buttonLabels) ? o.config.buttonLabels : [],
      };
    });
    const ssoTypes = new Set(['oidc', 'saml', 'jwt']);
    const ssoCount = realms.filter((r) => ssoTypes.has(r.type)).length;
    res.json({
      requireAuth:              !!cfg.requireAuth,
      openSsoInCurrentWindow:   !!cfg.openSsoInCurrentWindow,
      hideCredentialsFormIfSso: !!cfg.hideCredentialsFormIfSso && ssoCount > 0,
      logoutRedirectUrl:        cfg.logoutRedirectUrl || '',
      hideNativeLogout:         !!cfg.hideNativeLogout,
      realms,
    });
  } catch (err) { next(err); }
});

// ===========================================================================
// Everything below requires authentication.
// ===========================================================================
router.use(auth);

// ---------------------------------------------------------------------------
// General tab
// ---------------------------------------------------------------------------
router.get('/general', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await AuthSettings.getSingleton();
    res.json(publicGeneral(cfg));
  } catch (err) { next(err); }
});

router.put('/general', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await AuthSettings.getSingleton();
    const snapBefore = await snapshotAuthentication();
    const before = cfg.toObject();
    const body = req.body || {};

    if ('requireAuth' in body)              cfg.requireAuth              = !!body.requireAuth;
    if ('openSsoInCurrentWindow' in body)   cfg.openSsoInCurrentWindow   = !!body.openSsoInCurrentWindow;
    if ('hideCredentialsFormIfSso' in body) cfg.hideCredentialsFormIfSso = !!body.hideCredentialsFormIfSso;
    if ('logoutRedirectUrl' in body)        cfg.logoutRedirectUrl        = String(body.logoutRedirectUrl || '');
    if ('hideNativeLogout' in body)         cfg.hideNativeLogout         = !!body.hideNativeLogout;
    if ('idleTimeoutEnabled' in body)       cfg.idleTimeoutEnabled       = !!body.idleTimeoutEnabled;
    if ('idleTimeoutMinutes' in body) {
      const n = Number(body.idleTimeoutMinutes);
      if (!Number.isFinite(n) || n < 30) {
        return res.status(400).json({ error: 'idleTimeoutMinutes must be at least 30.' });
      }
      cfg.idleTimeoutMinutes = Math.floor(n);
    }
    if ('rememberMeDays' in body) {
      const n = Number(body.rememberMeDays);
      if (Number.isFinite(n) && n > 0) cfg.rememberMeDays = Math.floor(n);
    }
    if ('mfaGraceDays' in body) {
      const n = Number(body.mfaGraceDays);
      if (Number.isFinite(n) && n >= 0) cfg.mfaGraceDays = Math.floor(n);
    }
    await cfg.save();

    const after = cfg.toObject();
    await writeAudit(req, {
      action:  'auth.general.update',
      summary: 'Updated authentication general settings',
      context: diffContext(before, after, [
        'requireAuth', 'openSsoInCurrentWindow', 'hideCredentialsFormIfSso',
        'logoutRedirectUrl', 'hideNativeLogout', 'idleTimeoutEnabled',
        'idleTimeoutMinutes', 'rememberMeDays', 'mfaGraceDays',
      ]),
    });

    const snapAfter = await snapshotAuthentication();
    await logConfigChange({
      category: 'Authentication',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    res.json(publicGeneral(cfg));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Realms tab
// ---------------------------------------------------------------------------

// GET /api/admin/auth/realms — list, ordered by precedence.
router.get('/realms', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const realms = await AuthRealm.find({}).sort({ position: 1, createdAt: 1 });
    res.json({
      realms:    realms.map((r) => publicRealm(r)),
      // Counts of users per realm for the right-hand summary in the realms list.
      counts:    await usersPerRealm(realms.map((r) => r.identifier)),
    });
  } catch (err) { next(err); }
});

async function usersPerRealm(identifiers) {
  if (!Array.isArray(identifiers) || !identifiers.length) return {};
  const rows = await User.aggregate([
    { $match: { realm: { $in: identifiers } } },
    { $group: { _id: '$realm', n: { $sum: 1 } } },
  ]);
  const out = {};
  for (const r of rows) out[r._id] = r.n;
  return out;
}

// POST /api/admin/auth/realms — create.
router.post('/realms', requireAdmin, async (req, res, next) => {
  try {
    const snapBefore = await snapshotAuthentication();
    const { type, identifier } = req.body || {};
    if (!['internal', 'ldap', 'oidc', 'saml', 'jwt'].includes(type)) {
      return res.status(400).json({ error: 'Invalid realm type.' });
    }
    const trimmedId = String(identifier || '').trim();
    if (!trimmedId) {
      return res.status(400).json({ error: 'Realm identifier is required.' });
    }

    if (type === 'internal') {
      const exists = await AuthRealm.findOne({ type: 'internal' });
      if (exists) {
        return res.status(409).json({ error: 'Only one internal realm is allowed.' });
      }
    }
    if (type === 'jwt') {
      const exists = await AuthRealm.findOne({ type: 'jwt' });
      if (exists) {
        return res.status(409).json({ error: 'Only one JWT realm is allowed per portal.' });
      }
    }

    const dup = await AuthRealm.findOne({ identifier: trimmedId });
    if (dup) {
      return res.status(409).json({ error: 'A realm with this identifier already exists.' });
    }

    const last = await AuthRealm.findOne({}).sort({ position: -1 });
    const nextPos = last ? (last.position || 0) + 1 : 0;

    const realm = await AuthRealm.create({
      identifier: trimmedId,
      type,
      enabled: req.body.enabled !== false,
      position: nextPos,
      config: sanitizeConfig(type, req.body.config || {}),
      profileMapperScript: String(req.body.profileMapperScript || ''),
      mfaEnabled: !!req.body.mfaEnabled,
      migrateFromRealms: Array.isArray(req.body.migrateFromRealms)
        ? req.body.migrateFromRealms.map((s) => String(s || '').trim()).filter(Boolean)
        : [],
      createdBy:     req.user._id,
      createdByName: req.user.name || '',
      updatedBy:     req.user._id,
      updatedByName: req.user.name || '',
    });

    await writeAudit(req, {
      action:  'auth.realm.create',
      summary: `Created ${type.toUpperCase()} realm "${trimmedId}"`,
      context: { realmId: String(realm._id), type, identifier: trimmedId },
    });
    const snapAfter = await snapshotAuthentication();
    await logConfigChange({
      category: 'Authentication',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.status(201).json(publicRealm(realm));
  } catch (err) { next(err); }
});

// PUT /api/admin/auth/realms/order — replace the precedence order. Registered
// BEFORE the `/realms/:id` routes so Express does not interpret "order" as an
// ObjectId.
router.put('/realms/order', requireAdmin, async (req, res, next) => {
  try {
    const snapBefore = await snapshotAuthentication();
    const order = Array.isArray(req.body.order) ? req.body.order : null;
    if (!order) return res.status(400).json({ error: 'order array is required.' });

    const realms = await AuthRealm.find({});
    const byId = new Map(realms.map((r) => [String(r._id), r]));
    if (order.length !== realms.length || !order.every((id) => byId.has(String(id)))) {
      return res.status(400).json({ error: 'order must list every existing realm exactly once.' });
    }

    await Promise.all(order.map((id, idx) => {
      const r = byId.get(String(id));
      r.position = idx;
      return r.save();
    }));

    await writeAudit(req, {
      action:  'auth.realm.reorder',
      summary: `Reordered ${order.length} realm(s)`,
      context: { order: order.map(String) },
    });
    const snapAfter = await snapshotAuthentication();
    await logConfigChange({
      category: 'Authentication',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    const fresh = await AuthRealm.find({}).sort({ position: 1 });
    res.json({ realms: fresh.map((r) => publicRealm(r)) });
  } catch (err) { next(err); }
});

// PUT /api/admin/auth/realms/:id — update.
router.put('/realms/:id', requireAdmin, async (req, res, next) => {
  try {
    const snapBefore = await snapshotAuthentication();
    const realm = await AuthRealm.findById(req.params.id);
    if (!realm) return res.status(404).json({ error: 'Realm not found.' });

    // BRD: identifier is immutable after creation.
    if (req.body.identifier && req.body.identifier !== realm.identifier) {
      return res.status(400).json({ error: 'Realm identifier cannot be modified after creation.' });
    }

    const before = {
      enabled: realm.enabled,
      mfaEnabled: realm.mfaEnabled,
      migrateFromRealms: realm.migrateFromRealms,
      profileMapperScript: realm.profileMapperScript,
      config: realm.config,
    };

    if ('enabled' in req.body)             realm.enabled = !!req.body.enabled;
    if ('mfaEnabled' in req.body)          realm.mfaEnabled = !!req.body.mfaEnabled;
    if ('profileMapperScript' in req.body) realm.profileMapperScript = String(req.body.profileMapperScript || '');
    if (Array.isArray(req.body.migrateFromRealms)) {
      realm.migrateFromRealms = req.body.migrateFromRealms
        .map((s) => String(s || '').trim()).filter(Boolean);
    }
    if (req.body.config) {
      // Preserve secrets when the client sends back the redacted placeholder.
      const incoming = { ...req.body.config };
      SECRET_KEYS.forEach((k) => {
        if (incoming[k] === '__redacted__') incoming[k] = realm.config?.[k] || '';
      });
      realm.config = sanitizeConfig(realm.type, incoming);
    }
    realm.updatedBy     = req.user._id;
    realm.updatedByName = req.user.name || '';
    await realm.save();

    await writeAudit(req, {
      action:  'auth.realm.update',
      summary: `Updated ${realm.type.toUpperCase()} realm "${realm.identifier}"`,
      context: diffContext(before, {
        enabled: realm.enabled,
        mfaEnabled: realm.mfaEnabled,
        migrateFromRealms: realm.migrateFromRealms,
        profileMapperScript: realm.profileMapperScript,
        config: realm.config,
      }, ['enabled', 'mfaEnabled', 'migrateFromRealms', 'profileMapperScript', 'config']),
    });
    const snapAfter = await snapshotAuthentication();
    await logConfigChange({
      category: 'Authentication',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json(publicRealm(realm));
  } catch (err) { next(err); }
});

// DELETE /api/admin/auth/realms/:id — delete (and refuse if it's the last
// realm and authentication is mandatory).
router.delete('/realms/:id', requireAdmin, async (req, res, next) => {
  try {
    const snapBefore = await snapshotAuthentication();
    const realm = await AuthRealm.findById(req.params.id);
    if (!realm) return res.status(404).json({ error: 'Realm not found.' });

    const others = await AuthRealm.countDocuments({ _id: { $ne: realm._id } });
    if (others === 0) {
      const cfg = await AuthSettings.getSingleton();
      if (cfg.requireAuth) {
        return res.status(409).json({
          error: 'Cannot delete the last realm while mandatory authentication is on. Disable mandatory auth first or add another realm.',
        });
      }
    }
    await realm.deleteOne();

    await writeAudit(req, {
      action:  'auth.realm.delete',
      summary: `Deleted ${realm.type.toUpperCase()} realm "${realm.identifier}"`,
      context: { realmId: String(realm._id), type: realm.type, identifier: realm.identifier },
    });
    const snapAfter = await snapshotAuthentication();
    await logConfigChange({
      category: 'Authentication',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/admin/auth/realms/:id/reveal-secret — fetch a single secret value
// (so the admin UI can show it on demand without leaking it on every load).
router.post('/realms/:id/reveal-secret', requireAdmin, async (req, res, next) => {
  try {
    const { key } = req.body || {};
    if (!SECRET_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Unknown secret key.' });
    }
    const realm = await AuthRealm.findById(req.params.id);
    if (!realm) return res.status(404).json({ error: 'Realm not found.' });
    await writeAudit(req, {
      action: 'auth.realm.reveal-secret',
      summary: `Revealed ${key} for realm "${realm.identifier}"`,
      context: { realmId: String(realm._id), key },
    });
    res.json({ value: realm.config?.[key] || '' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// MFA reset for a single user (Manage Users → Authentication → Reset MFA).
// Per the BRD: emails the user a 24-hour, single-use reset link.
// ---------------------------------------------------------------------------
router.post('/users/:userId/reset-mfa', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');

    user.mfa = user.mfa || {};
    user.mfa.resetRequested = true;
    user.mfa.resetTokenHash = tokenHash;
    user.mfa.resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.mfa.resetCount = (user.mfa.resetCount || 0) + 1;
    await user.save();

    // Revoke any active sessions so the user has to re-enroll on next login.
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    // E-mail stub — production deployments wire up SES/SMTP here.
    // eslint-disable-next-line no-console
    console.log(`📧 [mfa-reset] to=${user.email} link=/mfa/reset?token=${raw}`);

    await writeAudit(req, {
      action:        'auth.mfa.reset',
      targetUserIds: [user._id],
      summary:       `Reset MFA for ${user.email}`,
      context:       { realm: user.realm },
    });

    // In non-production also surface the raw token so the flow can be exercised
    // end-to-end without a real mail server (matches the legal-terms contract).
    const body = { ok: true };
    if (process.env.NODE_ENV !== 'production') body.devToken = raw;
    res.json(body);
  } catch (err) { next(err); }
});

module.exports = router;
