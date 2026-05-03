const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const { auth } = require('../middleware/auth');
const EmailSettings = require('../models/EmailSettings');
const emailService = require('../services/email/emailService');
const { writeAudit, diffContext } = require('../services/users/auditService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotEmailNotifications } = require('../services/configHistorySnapshots');

const { putFile, deleteOne } = require('../services/storage/s3Service');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorisation. Per the BRD: "In the Email administration interface, ADMIN
// and PORTAL_ADMIN users can preview the existing templates [and] configure
// the [Reply-To, Logo, Email sending method]." All endpoints in this router
// share the same gating.
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

router.use(auth);

// ---------------------------------------------------------------------------
// Sanitisers — secrets never leave the backend.
// ---------------------------------------------------------------------------
const SECRET_KEYS = ['dkimPrivateKey', 'smtpPassword', 'sendgridApiKey'];
const REDACTED = '__redacted__';

function publicSettings(s) {
  if (!s) return null;
  const obj = s.toObject ? s.toObject() : s;
  return {
    replyToAddress:    obj.replyToAddress || '',
    logoUrl:           obj.logoUrl || '',
    sendingMethod:     obj.sendingMethod || 'internal',

    dkimFromAddress:   obj.dkimFromAddress || '',
    dkimPrivateKey:    obj.dkimPrivateKey ? REDACTED : '',
    dkimSelector:      obj.dkimSelector || '',
    dkimDnsValid:      !!obj.dkimDnsValid,
    dkimDnsCheckedAt:  obj.dkimDnsCheckedAt,
    dkimDnsLastError:  obj.dkimDnsLastError || '',

    smtpFromAddress:   obj.smtpFromAddress || '',
    smtpHost:          obj.smtpHost || '',
    smtpPort:          obj.smtpPort || 25,
    smtpTransport:     obj.smtpTransport || 'SMTP',
    smtpUser:          obj.smtpUser || '',
    smtpPassword:      obj.smtpPassword ? REDACTED : '',

    sendgridApiKey:    obj.sendgridApiKey ? REDACTED : '',
    sendgridFromAddress: obj.sendgridFromAddress || '',

    lastTestSentTo:    obj.lastTestSentTo || '',
    lastTestSentAt:    obj.lastTestSentAt,
    lastTestError:     obj.lastTestError || '',
    updatedAt:         obj.updatedAt,
  };
}

const logoUpload = multer({
  dest: path.resolve(config.upload.dir, 'tmp'),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
    const ALLOWED_IMAGE_MIME = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ]);
    if (ALLOWED_IMAGE_EXT.has(ext) || ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, GIF, WEBP or SVG images are accepted.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

function emailLogoPublicUrl(s3Key) {
  // Use the portal media proxy to serve from S3
  return `/api/portal/media/${s3Key}`;
}

function safeRemove(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// GET /api/admin/email — read sanitised settings.
// ---------------------------------------------------------------------------
router.get('/', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await EmailSettings.getSingleton();
    res.json({ settings: publicSettings(cfg) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/email — update settings. Performs server-side validation
// matching the BRD ("If any of the provided information is not valid, it is
// impossible to save the configuration."). Secrets are only overwritten when
// the client sends a non-redacted value.
// ---------------------------------------------------------------------------
router.put('/', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await EmailSettings.getSingleton();
    const body = req.body || {};

    const snapBefore = await snapshotEmailNotifications();
    const before = publicSettings(cfg);

    // Common fields
    if (body.replyToAddress !== undefined) {
      const v = String(body.replyToAddress || '').trim();
      if (v && !emailService.isLikelyEmail(v)) {
        return res.status(400).json({ error: 'Reply-To must be a valid email address.' });
      }
      cfg.replyToAddress = v;
    }
    if (body.logoUrl !== undefined) {
      cfg.logoUrl = String(body.logoUrl || '');
    }
    if (body.sendingMethod !== undefined) {
      if (!['internal', 'spfdkim', 'smtp', 'sendgrid'].includes(body.sendingMethod)) {
        return res.status(400).json({ error: 'Invalid sending method.' });
      }
      cfg.sendingMethod = body.sendingMethod;
    }

    // SPF + DKIM block
    if (body.dkimFromAddress !== undefined) {
      const v = String(body.dkimFromAddress || '').trim();
      if (v && !emailService.isLikelyEmail(v)) {
        return res.status(400).json({ error: 'DKIM From address must be a valid email.' });
      }
      cfg.dkimFromAddress = v;
    }
    if (body.dkimPrivateKey !== undefined && body.dkimPrivateKey !== REDACTED) {
      const v = String(body.dkimPrivateKey || '');
      if (v && !emailService.looksLikePemPrivateKey(v)) {
        return res.status(400).json({ error: 'DKIM private key must be a PEM-encoded private key.' });
      }
      cfg.dkimPrivateKey = v;
      // Wipe the previous DNS-check result; the new key needs re-validation.
      cfg.dkimDnsValid = false;
      cfg.dkimDnsCheckedAt = null;
    }
    if (body.dkimSelector !== undefined) {
      const v = String(body.dkimSelector || '').trim();
      if (v && !/^[a-zA-Z0-9._-]+$/.test(v)) {
        return res.status(400).json({ error: 'DKIM selector must contain only letters, digits, dots, dashes or underscores.' });
      }
      cfg.dkimSelector = v;
      cfg.dkimDnsValid = false;
      cfg.dkimDnsCheckedAt = null;
    }

    // SMTP relay block
    if (body.smtpFromAddress !== undefined) {
      const v = String(body.smtpFromAddress || '').trim();
      if (v && !emailService.isLikelyEmail(v)) {
        return res.status(400).json({ error: 'SMTP From address must be a valid email.' });
      }
      cfg.smtpFromAddress = v;
    }
    if (body.smtpHost !== undefined) {
      cfg.smtpHost = String(body.smtpHost || '').trim();
    }
    if (body.smtpPort !== undefined) {
      const n = Number(body.smtpPort);
      if (!Number.isInteger(n) || n <= 0 || n > 65535) {
        return res.status(400).json({ error: 'SMTP port must be an integer between 1 and 65535.' });
      }
      cfg.smtpPort = n;
    }
    if (body.smtpTransport !== undefined) {
      if (!['SMTP', 'SMTPS', 'SMTP_TLS'].includes(body.smtpTransport)) {
        return res.status(400).json({ error: 'Invalid SMTP transport strategy.' });
      }
      cfg.smtpTransport = body.smtpTransport;
    }
    if (body.smtpUser !== undefined) {
      cfg.smtpUser = String(body.smtpUser || '');
    }
    if (body.smtpPassword !== undefined && body.smtpPassword !== REDACTED) {
      cfg.smtpPassword = String(body.smtpPassword || '');
    }

    // SendGrid block
    if (body.sendgridApiKey !== undefined && body.sendgridApiKey !== REDACTED) {
      cfg.sendgridApiKey = String(body.sendgridApiKey || '');
    }
    if (body.sendgridFromAddress !== undefined) {
      const v = String(body.sendgridFromAddress || '').trim();
      if (v && !emailService.isLikelyEmail(v)) {
        return res.status(400).json({ error: 'SendGrid From address must be a valid email.' });
      }
      cfg.sendgridFromAddress = v;
    }

    // Per-method save-time validations.
    if (cfg.sendingMethod === 'spfdkim') {
      if (!emailService.isLikelyEmail(cfg.dkimFromAddress)) {
        return res.status(400).json({ error: 'A valid From address is required to save DKIM configuration.' });
      }
      if (!cfg.dkimPrivateKey || !emailService.looksLikePemPrivateKey(cfg.dkimPrivateKey)) {
        return res.status(400).json({ error: 'A PEM-encoded DKIM private key is required.' });
      }
      if (!cfg.dkimSelector) {
        return res.status(400).json({ error: 'A DKIM selector is required.' });
      }
    }
    if (cfg.sendingMethod === 'smtp') {
      if (!emailService.isLikelyEmail(cfg.smtpFromAddress)) {
        return res.status(400).json({ error: 'A valid From address is required to save SMTP configuration.' });
      }
      if (!cfg.smtpHost) return res.status(400).json({ error: 'SMTP host is required.' });
      if (!cfg.smtpPort) return res.status(400).json({ error: 'SMTP port is required.' });
      if (!cfg.smtpUser || !cfg.smtpPassword) {
        return res.status(400).json({ error: 'SMTP username and password are required.' });
      }
    }
    if (cfg.sendingMethod === 'sendgrid') {
      // API key may come from env var; only require it explicitly if neither is set.
      const effectiveKey = cfg.sendgridApiKey || (require('../../config/env').sendgrid?.apiKey || '');
      if (!effectiveKey) {
        return res.status(400).json({ error: 'SendGrid API key is required (set in settings or SENDGRID_API_KEY env var).' });
      }
      const fromAddr = cfg.sendgridFromAddress || (require('../../config/env').sendgrid?.defaultFrom || '');
      if (!emailService.isLikelyEmail(fromAddr)) {
        return res.status(400).json({ error: 'A valid SendGrid From address is required.' });
      }
    }

    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();

    const after = publicSettings(cfg);
    await writeAudit(req, {
      action:  'email-settings.update',
      summary: `Updated email settings (method=${cfg.sendingMethod})`,
      context: diffContext(before, after, [
        'replyToAddress', 'logoUrl', 'sendingMethod',
        'dkimFromAddress', 'dkimSelector',
        'smtpFromAddress', 'smtpHost', 'smtpPort', 'smtpTransport', 'smtpUser',
        'sendgridFromAddress',
      ]),
    });

    const snapAfter = await snapshotEmailNotifications();
    await logConfigChange({
      category: 'Email notifications',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    res.json({ settings: after });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/email/logo — upload a new email-header logo to S3.
// ---------------------------------------------------------------------------
router.post('/logo', requirePortalOrAdmin, logoUpload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const snapBefore = await snapshotEmailNotifications();
    const cfg = await EmailSettings.getSingleton();

    // Previous logo cleanup from S3
    const previousUrl = cfg.logoUrl || '';
    if (previousUrl.includes('/api/portal/media/')) {
      const previousKey = previousUrl.split('/api/portal/media/').pop();
      if (previousKey) {
        try { await deleteOne({ bucket: config.s3.extractedBucket, key: previousKey }); } catch { /* ignore */ }
      }
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const s3Key = `portal-assets/email-logo-${uuidv4()}${ext}`;

    await putFile({
      bucket: config.s3.extractedBucket,
      key: s3Key,
      filePath: req.file.path,
      contentType: req.file.mimetype,
    });

    // Cleanup local temp file
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }

    cfg.logoUrl = emailLogoPublicUrl(s3Key);
    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();

    await writeAudit(req, {
      action:  'email-settings.logo.upload',
      summary: `Uploaded email logo (${req.file.originalname})`,
      context: { s3Key, originalName: req.file.originalname },
    });

    const snapAfter = await snapshotEmailNotifications();
    await logConfigChange({
      category: 'Email notifications',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    res.json({ settings: publicSettings(cfg) });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/email/logo — clear the email-header logo.
// ---------------------------------------------------------------------------
router.delete('/logo', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const snapBefore = await snapshotEmailNotifications();
    const cfg = await EmailSettings.getSingleton();
    const previousFilename = (cfg.logoUrl || '').split('/').pop();
    if (previousFilename && previousFilename.startsWith('email-logo-')) {
      safeRemove(path.join(ASSET_ROOT, previousFilename));
    }
    cfg.logoUrl = '';
    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();

    await writeAudit(req, {
      action:  'email-settings.logo.delete',
      summary: 'Removed email logo',
    });

    const snapAfter = await snapshotEmailNotifications();
    await logConfigChange({
      category: 'Email notifications',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json({ settings: publicSettings(cfg) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/email/check-dns — verify that the SPF + DKIM records the
// admin promised to set up actually exist in DNS. Required by the BRD before
// a custom From address can be saved on the SPF+DKIM path. Honours an
// optional draft override so the admin can re-check before they Save.
// ---------------------------------------------------------------------------
router.post('/check-dns', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await EmailSettings.getSingleton();
    const fromAddress = (req.body?.dkimFromAddress || cfg.dkimFromAddress || '').trim();
    const dkimSelector = (req.body?.dkimSelector || cfg.dkimSelector || '').trim();

    const result = await emailService.checkSpfAndDkim({ fromAddress, dkimSelector });
    const ok = result.spf.ok && result.dkim.ok;

    cfg.dkimDnsValid = ok;
    cfg.dkimDnsCheckedAt = new Date();
    cfg.dkimDnsLastError = ok ? '' : (result.spf.error || result.dkim.error || 'DNS check failed.');
    await cfg.save();

    await writeAudit(req, {
      action:  'email-settings.dns.check',
      summary: `DNS check ${ok ? 'passed' : 'failed'} for ${fromAddress || '(no address)'}`,
      context: { ok, spf: result.spf, dkim: result.dkim },
    });

    res.json({ ok, ...result, settings: publicSettings(cfg) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/email/test — fires a real (or stubbed, for the internal
// method) test email. Body: { email }. Records success/failure on the
// settings row so the UI can echo "last test" status.
// ---------------------------------------------------------------------------
router.post('/test', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const to = String(req.body?.email || '').trim();
    if (!emailService.isLikelyEmail(to)) {
      return res.status(400).json({ error: 'Provide a valid recipient email address.' });
    }
    const cfg = await EmailSettings.getSingleton();

    if (cfg.sendingMethod === 'spfdkim' && !cfg.dkimDnsValid) {
      return res.status(400).json({ error: 'DNS configuration must be checked and valid before sending a test.' });
    }

    const subject = '[Fluid Topics] Test email';
    const html = `
      <p>Hello,</p>
      <p>This is a test email from your Fluid Topics portal — the configuration is working.</p>
      <p>Method: <strong>${cfg.sendingMethod}</strong></p>
      <p>Sent at ${new Date().toISOString()}</p>
    `;
    try {
      const info = await emailService.sendMail({ to, subject, html }, cfg);
      cfg.lastTestSentTo = to;
      cfg.lastTestSentAt = new Date();
      cfg.lastTestError  = '';
      await cfg.save();

      await writeAudit(req, {
        action:  'email-settings.test',
        summary: `Sent test email to ${to}`,
        context: { method: cfg.sendingMethod, messageId: info.messageId },
      });
      res.json({ ok: true, info, settings: publicSettings(cfg) });
    } catch (err) {
      cfg.lastTestError = err.message || String(err);
      cfg.lastTestSentAt = new Date();
      cfg.lastTestSentTo = to;
      await cfg.save();
      await writeAudit(req, {
        action:  'email-settings.test',
        summary: `Test email to ${to} FAILED`,
        context: { method: cfg.sendingMethod, error: cfg.lastTestError },
      });
      return res.status(502).json({ error: `Test email failed: ${cfg.lastTestError}`, settings: publicSettings(cfg) });
    }
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/email/templates — names of the previewable templates. The
// content lives in the frontend (lib/emailPreviews.js) but the list is
// surfaced here so future template additions stay backwards-compatible.
// ---------------------------------------------------------------------------
router.get('/templates', requirePortalOrAdmin, (req, res) => {
  res.json({
    templates: [
      'User activation',
      'Change password',
      'Update password',
      'Alert',
      'Reset MFA confirmation',
    ],
  });
});

module.exports = router;
