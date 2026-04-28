const express = require('express');
const { auth } = require('../middleware/auth');
const FeedbackSettings = require('../models/FeedbackSettings');
const EmailSettings = require('../models/EmailSettings');
const MetadataKey = require('../models/MetadataKey');
const emailService = require('../services/email/emailService');
const { writeAudit, diffContext } = require('../services/users/auditService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorisation. Per the BRD: "Selecting Feedback in the Notifications
// section [...] displays the Feedback administration interface, where ADMIN
// and PORTAL_ADMIN users can configure and preview the template of the
// feedback email." Same gate as the Email admin router.
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
// Built-in metadata vocabulary surfaced in the "Add metadata" dropdown. The
// per-tenant `MetadataKey` registry adds onto this for any custom keys the
// admin has registered (see GET /metadata-keys below).
// ---------------------------------------------------------------------------
const BUILTIN_METADATA_KEYS = [
  'title',
  'author_personname',
  'authorgroup_author_personname',
  'publicationDate',
  'ft:lastPublication',
  'ft:publication_title',
  'ft:topic_id',
  'ft:source_id',
  'product',
  'audience',
  'language',
  'version',
  'tags',
  'description',
  'keywords',
];

// ---------------------------------------------------------------------------
// Sanitisers — keep arrays normalised and reject malformed entries early so
// the public feedback emit pipeline can trust the shape it reads from Mongo.
// ---------------------------------------------------------------------------
function sanitizeRecipients(input) {
  // Accept either a comma-separated string (UI default) or an explicit array.
  let raw = [];
  if (Array.isArray(input)) raw = input;
  else if (typeof input === 'string') raw = input.split(/[,;\n]+/);
  else if (input == null) raw = [];
  else throw new Error('Recipients must be a comma-separated list of email addresses.');

  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const v = String(item || '').trim();
    if (!v) continue;
    if (!emailService.isLikelyEmail(v)) {
      throw new Error(`"${v}" is not a valid email address.`);
    }
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function sanitizeMetadataKeys(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error('Metadata keys must be an array of strings.');
  }
  const out = [];
  const seen = new Set();
  for (const v of input) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (s.length > 200) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// "Regardless of how the administrator enters the extension name (for example,
// .exe, EXE, exe, eXe, or another similar format), Fluid Topics recognizes
// that it must block files with this extension." → strip leading dots, lower-
// case, dedupe.
function sanitizeForbiddenExtensions(input) {
  let raw = [];
  if (Array.isArray(input)) raw = input;
  else if (typeof input === 'string') raw = input.split(/[,;\s]+/);
  else if (input == null) raw = [];
  else throw new Error('Forbidden extensions must be a comma-separated string or array.');

  const out = [];
  const seen = new Set();
  for (const item of raw) {
    let v = String(item || '').trim();
    if (!v) continue;
    while (v.startsWith('.')) v = v.slice(1);
    v = v.toLowerCase();
    if (!v) continue;
    if (!/^[a-z0-9._+-]+$/.test(v)) {
      throw new Error(`"${item}" is not a valid file extension.`);
    }
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function publicSettings(s) {
  if (!s) return null;
  const obj = s.toObject ? s.toObject() : s;
  return {
    recipients:                    obj.recipients || [],
    subjectMetadataKeys:           obj.subjectMetadataKeys || [],
    bodyMetadataKeys:              obj.bodyMetadataKeys || [],
    authenticatedEmailService:     obj.authenticatedEmailService || 'ft',
    unauthenticatedEmailService:   obj.unauthenticatedEmailService || 'user',
    confirmationEmailEnabled:      !!obj.confirmationEmailEnabled,
    forbiddenAttachmentExtensions: obj.forbiddenAttachmentExtensions || [],
    maxAttachmentSizeMb:           obj.maxAttachmentSizeMb || 5,
    updatedAt:                     obj.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/feedback — load the current settings.
// ---------------------------------------------------------------------------
router.get('/', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await FeedbackSettings.getSingleton();
    res.json({ settings: publicSettings(cfg) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/feedback — update settings. Each field is optional; only
// fields present on the body are touched. Validation matches the BRD's
// "Without an email address set in the Recipients field, Fluid Topics cannot
// send feedback emails" + the attachment-size 1..23MB cap.
// ---------------------------------------------------------------------------
router.put('/', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await FeedbackSettings.getSingleton();
    const body = req.body || {};
    const before = publicSettings(cfg);

    if (body.recipients !== undefined) {
      try {
        cfg.recipients = sanitizeRecipients(body.recipients);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    if (body.subjectMetadataKeys !== undefined) {
      try {
        cfg.subjectMetadataKeys = sanitizeMetadataKeys(body.subjectMetadataKeys);
      } catch (e) {
        return res.status(400).json({ error: `Subject metadata: ${e.message}` });
      }
    }

    if (body.bodyMetadataKeys !== undefined) {
      try {
        cfg.bodyMetadataKeys = sanitizeMetadataKeys(body.bodyMetadataKeys);
      } catch (e) {
        return res.status(400).json({ error: `Body metadata: ${e.message}` });
      }
    }

    if (body.authenticatedEmailService !== undefined) {
      if (!['ft', 'user'].includes(body.authenticatedEmailService)) {
        return res.status(400).json({ error: 'Invalid authenticatedEmailService.' });
      }
      cfg.authenticatedEmailService = body.authenticatedEmailService;
    }

    if (body.unauthenticatedEmailService !== undefined) {
      if (!['ft', 'user'].includes(body.unauthenticatedEmailService)) {
        return res.status(400).json({ error: 'Invalid unauthenticatedEmailService.' });
      }
      // BRD: "Fluid Topics server sends feedback emails to unauthenticated
      // users. This is only available with SMTP relay." Block the toggle if
      // the Email admin hasn't picked the SMTP method yet.
      if (body.unauthenticatedEmailService === 'ft') {
        const email = await EmailSettings.getSingleton();
        if (email.sendingMethod !== 'smtp') {
          return res.status(400).json({
            error: 'SMTP relay must be configured in the Email administration interface before Fluid Topics can send feedback emails for unauthenticated users.',
          });
        }
      }
      cfg.unauthenticatedEmailService = body.unauthenticatedEmailService;
    }

    if (body.confirmationEmailEnabled !== undefined) {
      cfg.confirmationEmailEnabled = !!body.confirmationEmailEnabled;
    }

    if (body.forbiddenAttachmentExtensions !== undefined) {
      try {
        cfg.forbiddenAttachmentExtensions = sanitizeForbiddenExtensions(
          body.forbiddenAttachmentExtensions,
        );
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    if (body.maxAttachmentSizeMb !== undefined) {
      const n = Number(body.maxAttachmentSizeMb);
      if (!Number.isFinite(n) || n < 1 || n > 23) {
        return res.status(400).json({ error: 'Maximum attachment size must be between 1MB and 23MB.' });
      }
      cfg.maxAttachmentSizeMb = Math.round(n * 100) / 100;
    }

    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();

    const after = publicSettings(cfg);
    await writeAudit(req, {
      action: 'feedback-settings.update',
      summary: `Updated feedback settings (${after.recipients.length} recipient${after.recipients.length === 1 ? '' : 's'})`,
      context: diffContext(before, after, [
        'recipients',
        'subjectMetadataKeys',
        'bodyMetadataKeys',
        'authenticatedEmailService',
        'unauthenticatedEmailService',
        'confirmationEmailEnabled',
        'forbiddenAttachmentExtensions',
        'maxAttachmentSizeMb',
      ]),
    });

    res.json({ settings: after });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/feedback/templates — names of the four previewable templates.
// Same shape as `/api/admin/email/templates` so the frontend can share its
// preview-drawer plumbing.
// ---------------------------------------------------------------------------
router.get('/templates', requirePortalOrAdmin, (req, res) => {
  res.json({
    templates: [
      'Topic feedback (sent to admin)',
      'Topic feedback confirmation (sent to user)',
      'Document feedback (sent to admin)',
      'Document feedback confirmation (sent to user)',
    ],
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/feedback/metadata-keys — vocabulary for the "Add metadata"
// dropdowns on the Feedback admin page. Combines:
//   - the built-in FT/document metadata fields (always available), and
//   - any per-tenant manual or auto-discovered MetadataKey rows.
// We never error if MetadataKey can't be queried — the built-ins alone are
// enough to keep the admin UI usable.
// ---------------------------------------------------------------------------
router.get('/metadata-keys', requirePortalOrAdmin, async (req, res, next) => {
  try {
    let custom = [];
    try {
      const rows = await MetadataKey.find({}, 'name displayName').lean();
      custom = rows.map((r) => r.displayName || r.name).filter(Boolean);
    } catch { /* ignore — built-ins are still useful */ }

    const seen = new Set();
    const merged = [];
    for (const k of [...BUILTIN_METADATA_KEYS, ...custom]) {
      const key = String(k || '').trim();
      if (!key) continue;
      const lk = key.toLowerCase();
      if (seen.has(lk)) continue;
      seen.add(lk);
      merged.push(key);
    }
    res.json({ keys: merged });
  } catch (err) { next(err); }
});

module.exports = router;
