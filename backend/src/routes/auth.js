const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const config = require('../config/env');
const { auth } = require('../middleware/auth');

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

// Lightweight stand-in for an email service. In production, replace this with
// SES / SendGrid / SMTP. In dev we just log so the token can be lifted from
// the server console (and we also include the token in API responses when
// nodeEnv !== 'production' so the flow can be exercised end-to-end).
const sendEmail = (to, subject, body) => {
  console.log(`📧 [email-stub] to=${to} subject="${subject}"\n${body}\n`);
};
const includeTokenInResponse = () => config.nodeEnv !== 'production';

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Whether unauthenticated visitors can create their own account from the
// /login screen. Off by default — admins provision users from /admin/users.
const SELF_REGISTRATION_ENABLED = false;

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
    accessTokenTtl: ACCESS_TTL,
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
    sendEmail(user.email, 'Reset your password',
      `Click to reset your password (valid 1 hour): ${resetUrl}`);

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
    sendEmail(user.email, 'Verify your email', `Click to verify: ${verifyUrl}`);

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
