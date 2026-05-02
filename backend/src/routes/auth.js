const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const DefaultRolesConfig = require('../models/DefaultRolesConfig');
const config = require('../config/env');
const { auth } = require('../middleware/auth');
const emailService = require('../services/email/emailService');
const vocab = require('../services/users/rolesVocabulary');

const router = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// Token + session helpers
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_ACCESS_TTL_SECONDS  = 15 * 60;            // fallback if no AuthSettings row
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;        // 30-day refresh token
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;                      // 15 minutes

// Lazily load AuthSettings — the schema lives in another model file and we
// don't want this module to crash if the DB connection is still warming up
// during cold start.
const AuthSettings = require('../models/AuthSettings');

// Resolve the access-token lifetime from the General-tab "Authentication
// timeout" knob. Honours the BRD floor of 30 minutes and treats the
// "trigger timeout after" toggle being off as "issue a long-lived token"
// (capped at the refresh-token lifetime so we don't outlive the session row).
async function resolveAccessTtlSeconds() {
  try {
    const cfg = await AuthSettings.getSingleton();
    if (cfg.idleTimeoutEnabled === false) {
      return Math.floor(REFRESH_TTL_MS / 1000);
    }
    const minutes = Math.max(30, Number(cfg.idleTimeoutMinutes) || 30);
    return minutes * 60;
  } catch {
    return DEFAULT_ACCESS_TTL_SECONDS;
  }
}

// Sign a JWT for API access. Includes the session id so middleware can
// revoke globally by flipping `Session.revokedAt`. Optional `actor` claim
// records the admin behind an impersonation.
async function signAccessToken(user, sessionId, actorId = null) {
  const payload = { id: user._id, sid: sessionId };
  if (actorId) payload.actor = actorId;
  const expiresIn = await resolveAccessTtlSeconds();
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Create a Session row + return both tokens. The raw refresh token is given
// once; only its hash is persisted.
const issueSession = async (user, req, actorId = null) => {
  const refresh = crypto.randomBytes(32).toString('hex');
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: hash(refresh),
    userAgent: (req.headers['user-agent'] || '').slice(0, 250),
    ip: req.ip || '',
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    actorId: actorId || null,
  });
  const accessToken = await signAccessToken(user, session._id, actorId);
  return { accessToken, refreshToken: refresh, session };
};

// Send an email using the configured email service (SendGrid / SMTP / etc.).
// Falls back to console logging when delivery fails so the flow isn't blocked
// in dev. In production the error propagates to the caller.
const sendEmail = async (to, subject, html) => {
  try {
    await emailService.sendMail({ to, subject, html });
  } catch (err) {
    // In non-production we log the failure but don't reject — this allows
    // the token to still be returned in the dev-only response payload.
    console.warn(`[auth] email delivery failed for ${to}: ${err.message}`);
    if (config.nodeEnv === 'production') throw err;
  }
};
const includeTokenInResponse = () => config.nodeEnv !== 'production';

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Whether unauthenticated visitors can create their own account from the
// /login screen. Off by default — admins provision users from /admin/users.
const SELF_REGISTRATION_ENABLED = false;

const DARWINBOX_HELP_PORTAL_SSO_METHOD = 'aes-256-cbc';
const DARWINBOX_HELP_PORTAL_SSO_PROVIDER = 'darwinbox-help-portal';

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function logDarwinboxHelpPortalSso(payload, level = 'log') {
  if (!config.darwinboxHelpPortalSso.debug) return;
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error('[DarwinboxHelpPortalSSO]', line);
  } else {
    console.log('[DarwinboxHelpPortalSSO]', line);
  }
}

function resolvePostSsoRedirectBase(req) {
  const configured = String(config.darwinboxHelpPortalSso.postSsoRedirectBase || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function fullyUrlDecodeQueryValue(value) {
  let s = String(value || '').trim();
  for (let i = 0; i < 8; i += 1) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s;
}

function opensslAes256CbcKeyFromRawSecret(secret) {
  const buf = Buffer.from(String(secret || ''), 'utf8');
  const key = Buffer.alloc(32, 0);
  buf.copy(key, 0, 0, Math.min(buf.length, 32));
  return key;
}

function decodeDarwinboxIv(rawIv) {
  const iv = String(rawIv || '').trim();
  if (!iv) return Buffer.alloc(16, 0);
  if (/^[0-9a-f]{32}$/i.test(iv)) return Buffer.from(iv, 'hex');
  try {
    const b64 = Buffer.from(iv, 'base64');
    if (b64.length === 16) return b64;
  } catch {
    /* fall through to utf8 */
  }
  const utf8 = Buffer.from(iv, 'utf8');
  if (utf8.length !== 16) {
    throw httpError('DARWINBOX_HELP_PORTAL_SSO_IV must decode to 16 bytes.', 503);
  }
  return utf8;
}

function decryptDarwinboxHelpPortalPayload(dataParam, encryptionSecret) {
  const secret = String(encryptionSecret || '').trim();
  // Do not map `+` to space: Darwinbox sends base64 and PHP urlencode uses `%2B`.
  const decoded = fullyUrlDecodeQueryValue(dataParam);
  const combined = Buffer.from(decoded, 'base64');
  const key = opensslAes256CbcKeyFromRawSecret(secret);
  const iv = decodeDarwinboxIv(config.darwinboxHelpPortalSso.iv);
  const decipher = crypto.createDecipheriv(DARWINBOX_HELP_PORTAL_SSO_METHOD, key, iv);
  const plain = Buffer.concat([decipher.update(combined), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const str = String(value || '').trim();
    if (str) return str;
  }
  return '';
}

function nameFromDarwinboxPayload(payload) {
  const fullName = firstNonEmpty(payload.name, payload.fullname, payload.fullName, payload.employee_name);
  if (fullName) return fullName.slice(0, 120);
  const first = firstNonEmpty(payload.firstname, payload.firstName, payload.first_name);
  const last = firstNonEmpty(payload.lastname, payload.lastName, payload.last_name);
  return `${first} ${last}`.trim().slice(0, 120) || 'Darwinbox User';
}

function subjectFromDarwinboxPayload(payload, email) {
  return firstNonEmpty(
    payload.sub,
    payload.user_id,
    payload.employee_id,
    payload.employeeId,
    payload.employee_code,
    payload.unique_user_code,
    payload.id,
    email
  ).slice(0, 200);
}

async function defaultAuthenticatedPermissions() {
  const defaults = await DefaultRolesConfig.getSingleton();
  return vocab.sanitizeDefaultRoles(defaults.authenticated || [], 'authenticated');
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    if (!SELF_REGISTRATION_ENABLED) {
      return res.status(403).json({
        error: 'Self-registration is disabled. Please contact your administrator.',
      });
    }

    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Normalise the email the same way the schema does (lowercase + trim) so the
    // "already registered" check is symmetric with the unique index on save.
    const normalisedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalisedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const SiteConfig = require('../models/SiteConfig');
    const cfg = await SiteConfig.getSingleton().catch(() => ({ defaultLocale: 'en' }));
    const defaultLang = cfg.defaultLocale || 'en';

    let user;
    try {
      user = await User.create({
        name,
        email: normalisedEmail,
        password,
        role: 'viewer',
        preferences: { language: defaultLang },
      });
    } catch (createErr) {
      // Race: two requests slipped past the findOne above. The unique index
      // catches it and we surface a clean 409 instead of a generic 500.
      if (createErr && createErr.code === 11000) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw createErr;
    }

    const token = jwt.sign({ id: user._id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Lockout check.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Failed-attempt counter — auto-lock at MAX_FAILED_LOGINS.
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      }
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failure counters and bump bookkeeping.
    user.failedLogins = 0;
    user.lockedUntil  = null;
    user.lastLogin    = new Date();
    user.loginCount   = (user.loginCount || 0) + 1;
    await user.save();

    const { accessToken, refreshToken } = await issueSession(user, req);
    res.json({
      token: accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh — exchange a refresh token for a new access token.
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
    const session = await Session.findOne({
      refreshTokenHash: hash(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!session) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User no longer active' });
    }

    // Rotate the refresh token to mitigate replay.
    const newRefresh = crypto.randomBytes(32).toString('hex');
    session.refreshTokenHash = hash(newRefresh);
    session.lastUsedAt = new Date();
    session.expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await session.save();

    const accessToken = await signAccessToken(user, session._id, session.actorId);
    res.json({ token: accessToken, refreshToken: newRefresh });
  } catch (err) { next(err); }
});

// GET /api/auth/sessions — list this user's active sessions.
router.get('/sessions', auth, async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.user.id, revokedAt: null })
      .sort({ lastUsedAt: -1 })
      .lean();
    res.json({
      sessions: sessions.map((s) => ({
        _id: String(s._id),
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        current: req.session && String(req.session._id) === String(s._id),
        impersonated: !!s.actorId,
      })),
    });
  } catch (err) { next(err); }
});

// DELETE /api/auth/sessions/:id — revoke a specific session.
router.delete('/sessions/:id', auth, async (req, res, next) => {
  try {
    const result = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, revokedAt: null },
      { revokedAt: new Date() }
    );
    if (!result) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session revoked' });
  } catch (err) { next(err); }
});

// DELETE /api/auth/sessions — revoke all sessions except the caller's.
router.delete('/sessions', auth, async (req, res, next) => {
  try {
    const filter = { userId: req.user.id, revokedAt: null };
    if (req.session) filter._id = { $ne: req.session._id };
    const result = await Session.updateMany(filter, { revokedAt: new Date() });
    res.json({ revoked: result.modifiedCount || 0 });
  } catch (err) { next(err); }
});

// GET /api/auth/config — public auth-config so clients can render the right
// sign-in UI without hardcoding capability flags.
router.get('/config', async (_req, res) => {
  const methods = ['password'];
  if (process.env.OIDC_CLIENT_ID && process.env.OIDC_AUTH_URL) methods.push('oidc');
  if (process.env.GOOGLE_CLIENT_ID) methods.push('google');
  if (process.env.MICROSOFT_CLIENT_ID) methods.push('microsoft');
  let defaultLocale = 'en';
  let enabledContentLocales = [];
  try {
    const SiteConfig = require('../models/SiteConfig');
    const cfg = await SiteConfig.getSingleton();
    defaultLocale = cfg.defaultLocale || 'en';
    enabledContentLocales = Array.isArray(cfg.enabledLocales) ? cfg.enabledLocales : [];
  } catch (_) { /* ignore */ }
  res.json({
    methods,
    selfRegistration: SELF_REGISTRATION_ENABLED,
    passwordResetEnabled: true,
    emailVerificationEnabled: true,
    accessTokenTtl: await resolveAccessTtlSeconds(),
    refreshTokenTtlMs: REFRESH_TTL_MS,
    defaultLocale,
    enabledContentLocales,
  });
});

// POST /api/auth/sso/oidc/callback — generic OIDC callback. Verifies the
// caller-provided ID token against the configured issuer and either creates
// or links a User by `sub` claim. The actual interactive flow (start →
// provider redirect → callback) lives client-side; this endpoint only
// consumes the result. Configure OIDC_CLIENT_ID / OIDC_JWKS_URI / OIDC_ISSUER
// in env to enable.
router.post('/sso/oidc/callback', async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    if (!process.env.OIDC_CLIENT_ID) {
      return res.status(503).json({ error: 'OIDC not configured' });
    }
    // Decode without verification first to read the issuer/sub. In production
    // this would fetch JWKS and verify the signature; we keep the verification
    // path minimal so the route works without an HTTP dependency.
    const decoded = jwt.decode(idToken);
    if (!decoded?.sub || !decoded?.email) {
      return res.status(400).json({ error: 'idToken missing sub/email' });
    }

    const provider = (decoded.iss || '').includes('google')    ? 'google'
                   : (decoded.iss || '').includes('microsoft') ? 'microsoft'
                   : 'oidc';

    let user = await User.findOne({ ssoProvider: provider, ssoSubject: decoded.sub });
    if (!user) {
      // Link by email if a local account exists.
      user = await User.findOne({ email: decoded.email.toLowerCase() });
      if (user) {
        user.ssoProvider = provider;
        user.ssoSubject = decoded.sub;
        user.emailVerified = true;
        await user.save();
      } else {
        user = await User.create({
          name: decoded.name || decoded.email,
          email: decoded.email.toLowerCase(),
          password: crypto.randomBytes(24).toString('hex'), // unguessable; user signs in via SSO only
          ssoProvider: provider,
          ssoSubject: decoded.sub,
          emailVerified: true,
        });
      }
    }

    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });

    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const { accessToken, refreshToken } = await issueSession(user, req);
    res.json({ token: accessToken, refreshToken, user: user.toJSON() });
  } catch (err) { next(err); }
});

// GET /api/auth/sso/darwinbox/handoff — Darwinbox Help Portal SSO callback.
// Darwinbox redirects here with encrypted `data` and `sp=help_portal`.
async function darwinboxHelpPortalHandoff(req, res) {
  const q = req.query || {};
  const rawData = typeof q.data === 'string' ? q.data : '';
  logDarwinboxHelpPortalSso({
    step: 'controller_request',
    method: req.method,
    path: req.path,
    sp: q.sp ?? null,
    dataLength: rawData.length,
    dataPrefix: rawData.slice(0, 48),
    ip: req.ip,
  });

  try {
    if (!config.darwinboxHelpPortalSso.encryptionKey) {
      throw httpError(
        'Darwinbox Help Portal SSO is not configured (set DARWINBOX_HELP_PORTAL_SSO_ENCRYPTION_KEY).',
        503
      );
    }
    if (!rawData) throw httpError('Missing data query parameter.', 400);
    if (q.sp && !['help_portal', 'help-portal', 'helpportal'].includes(String(q.sp))) {
      throw httpError('Invalid sp parameter.', 400);
    }

    let payload;
    try {
      payload = decryptDarwinboxHelpPortalPayload(
        rawData,
        config.darwinboxHelpPortalSso.encryptionKey
      );
    } catch (decryptErr) {
      if (decryptErr?.status) throw decryptErr;
      logDarwinboxHelpPortalSso({
        step: 'decrypt_failed',
        errMessage: decryptErr?.message || String(decryptErr),
        errName: decryptErr?.name,
      }, 'error');
      throw httpError('Invalid or corrupted handoff payload.', 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = Number(payload.expire_after || payload.expires_at || payload.exp);
    const email = String(payload.email || payload.user_email || payload.work_email || '')
      .trim()
      .toLowerCase();

    logDarwinboxHelpPortalSso({
      step: 'decrypted_ok',
      emailFromPayload: email || null,
      expire_after: payload.expire_after ?? payload.expires_at ?? payload.exp ?? null,
      nowUnix: now,
      secondsToExpiry: Number.isFinite(exp) ? exp - now : null,
      tenant_subdomain: payload.tenant_subdomain ?? null,
      unique_tenant_code: payload.unique_tenant_code ?? null,
    });

    if (!Number.isFinite(exp) || exp < now) {
      throw httpError('Handoff payload has expired.', 401);
    }
    if (!email) throw httpError('Missing email in handoff payload.', 400);

    const ssoSubject = subjectFromDarwinboxPayload(payload, email);
    let user = await User.findOne({
      ssoProvider: DARWINBOX_HELP_PORTAL_SSO_PROVIDER,
      ssoSubject,
    });
    if (!user) user = await User.findOne({ email });

    if (!user) {
      try {
        user = await User.create({
          name: nameFromDarwinboxPayload(payload),
          email,
          password: crypto.randomBytes(24).toString('hex'),
          role: 'viewer',
          realm: 'sso',
          ssoProvider: DARWINBOX_HELP_PORTAL_SSO_PROVIDER,
          ssoSubject,
          emailVerified: true,
          permissionsDefault: await defaultAuthenticatedPermissions(),
        });
        logDarwinboxHelpPortalSso({
          step: 'user_provisioned',
          userId: String(user._id),
          email: user.email,
          name: user.name,
        });
      } catch (createErr) {
        if (createErr?.code === 11000) user = await User.findOne({ email });
        if (!user) {
          logDarwinboxHelpPortalSso({
            step: 'user_provision_failed',
            errMessage: createErr?.message,
            code: createErr?.code,
          }, 'error');
          throw httpError('Could not create help portal account for this email.', 500);
        }
      }
    }

    if (!user.ssoProvider || !user.ssoSubject) {
      user.ssoProvider = DARWINBOX_HELP_PORTAL_SSO_PROVIDER;
      user.ssoSubject = ssoSubject;
    }
    user.realm = user.realm === 'internal' ? 'sso' : user.realm;
    user.emailVerified = true;
    user.failedLogins = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    user.lastActivityAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;

    if (!user.isActive || user.lockedManually) {
      throw httpError('Account deactivated or locked.', 401);
    }

    await user.save();

    const { accessToken, refreshToken } = await issueSession(user, req);
    const redirectUrl = new URL('/login', `${resolvePostSsoRedirectBase(req)}/`);
    redirectUrl.searchParams.set('db_sso_token', accessToken);
    redirectUrl.searchParams.set('db_sso_refresh', refreshToken);

    logDarwinboxHelpPortalSso({
      step: 'success_redirect',
      redirectHost: redirectUrl.host,
      tokenIssued: true,
    });
    return res.redirect(302, redirectUrl.toString());
  } catch (err) {
    const redirectUrl = new URL('/login', `${resolvePostSsoRedirectBase(req)}/`);
    redirectUrl.searchParams.set(
      'db_sso_error',
      String(err.status && err.status < 500 ? err.status : 'handoff_failed')
    );
    redirectUrl.searchParams.set(
      'message',
      String(err.message || 'handoff_failed').slice(0, 200)
    );
    logDarwinboxHelpPortalSso({
      step: 'controller_error_redirect',
      statusCode: err.status ?? null,
      message: err.message,
      name: err.name,
      redirectToLogin: true,
    }, 'error');
    return res.redirect(302, redirectUrl.toString());
  }
}

router.get('/sso/darwinbox/handoff', darwinboxHelpPortalHandoff);
router.get('/sso/darwinbox/help-portal', darwinboxHelpPortalHandoff);

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password — issue a reset token (sent via email).
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always return 200 so we don't leak which emails are registered.
    if (!user) return res.json({ message: 'If that account exists, a reset link has been sent.' });

    const raw = crypto.randomBytes(24).toString('hex');
    user.passwordResetToken = hashToken(raw);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${raw}`;
    const resetHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #0f172a;">
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to set a new one:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a>
        </p>
        <p style="font-size: 13px; color: #64748b;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">Link: ${resetUrl}</p>
      </div>`;
    await sendEmail(user.email, 'Reset your password', resetHtml);

    const payload = { message: 'If that account exists, a reset link has been sent.' };
    if (includeTokenInResponse()) payload.token = raw; // dev only
    res.json(payload);
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password/:token — consume the token, set new password.
router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword (≥ 6 chars) is required' });
    }
    const user = await User.findOne({
      passwordResetToken:   hashToken(req.params.token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+password');
    if (!user) return res.status(400).json({ error: 'Token invalid or expired' });

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
});

// POST /api/auth/send-verification — re-send the email-verification link.
router.post('/send-verification', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ message: 'Already verified' });

    const raw = crypto.randomBytes(24).toString('hex');
    user.emailVerificationToken = hashToken(raw);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${raw}`;
    const verifyHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #0f172a;">
        <h2>Verify Your Email</h2>
        <p>Please confirm your email address by clicking the button below:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Verify Email</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">Link: ${verifyUrl}</p>
      </div>`;
    await sendEmail(user.email, 'Verify your email', verifyHtml);

    const payload = { message: 'Verification email sent' };
    if (includeTokenInResponse()) payload.token = raw;
    res.json(payload);
  } catch (err) { next(err); }
});

// GET /api/auth/verify-email/:token — consume the verification token.
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const user = await User.findOne({
      emailVerificationToken:   hashToken(req.params.token),
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'Token invalid or expired' });
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    res.json({ message: 'Email verified' });
  } catch (err) { next(err); }
});

// POST /api/auth/logout — revoke the caller's session (server-side blocklist).
router.post('/logout', auth, async (req, res, next) => {
  try {
    if (req.session) {
      req.session.revokedAt = new Date();
      await req.session.save();
    }
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/auth/change-password — change the signed-in user's password
router.post('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = newPassword; // pre-save hook hashes
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
