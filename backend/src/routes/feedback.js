const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Rating = require('../models/Rating');
const Topic = require('../models/Topic');
const FeedbackSettings = require('../models/FeedbackSettings');
const EmailSettings = require('../models/EmailSettings');
const DefaultRolesConfig = require('../models/DefaultRolesConfig');
const emailService = require('../services/email/emailService');
const { auth } = require('../middleware/auth');

// Optional auth: attach req.user if token is present, but don't reject anonymous submissions
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) return auth(req, res, next);
  next();
};

// ---------------------------------------------------------------------------
// Permission gating — "Only users who have the FEEDBACK_USER role can submit
// feedback." The role can come from the user's manual/auto/default arrays
// (authenticated case) or from the DefaultRolesConfig.unauthenticated bucket
// (anonymous case).
// ---------------------------------------------------------------------------
async function userHasFeedbackPermission(reqUser) {
  if (reqUser) {
    const perms = new Set([
      ...(Array.isArray(reqUser.permissions) ? reqUser.permissions : []),
      ...(Array.isArray(reqUser.permissionsManual) ? reqUser.permissionsManual : []),
      ...(Array.isArray(reqUser.permissionsAuto) ? reqUser.permissionsAuto : []),
      ...(Array.isArray(reqUser.permissionsDefault) ? reqUser.permissionsDefault : []),
    ]);
    if (perms.has('FEEDBACK_USER')) return true;
    // Defer to default roles too — the BRD allows assigning FEEDBACK_USER as
    // a default for authenticated users, in which case freshly-created users
    // may not yet have their own permissionsDefault populated.
    const defaults = await DefaultRolesConfig.getSingleton();
    return Array.isArray(defaults.authenticated) && defaults.authenticated.includes('FEEDBACK_USER');
  }
  const defaults = await DefaultRolesConfig.getSingleton();
  return Array.isArray(defaults.unauthenticated) && defaults.unauthenticated.includes('FEEDBACK_USER');
}

// ---------------------------------------------------------------------------
// Build the feedback email subject. Format is the FT default:
//   Feedback about "<topicTitle>" in "<bookTitle>" [v1] [v2] [...]
// where v1..vN come from the configured `subjectMetadataKeys` resolved
// against the topic's metadata (built-in + custom). Per the BRD the subject
// only ever uses *document-level* metadata; we read whatever Mongo has
// without trying to distinguish further (the registry tags both).
// ---------------------------------------------------------------------------
function lookupMetadataValue(topic, key) {
  if (!topic || !key) return '';
  const k = String(key).toLowerCase();
  const m = topic.metadata || {};
  if (k === 'title')                  return topic.title || '';
  if (k === 'author' || k === 'author_personname' || k === 'authorgroup_author_personname') return m.author || '';
  if (k === 'product')                return m.product || '';
  if (k === 'language')               return m.language || '';
  if (k === 'version')                return m.version || '';
  if (k === 'tags')                   return Array.isArray(m.tags) ? m.tags.join(', ') : '';
  if (k === 'description')            return m.description || '';
  if (k === 'keywords')               return Array.isArray(m.keywords) ? m.keywords.join(', ') : (m.keywords || '');
  // Custom keys live under metadata.custom (a Map or plain object depending
  // on how Mongoose hydrates the doc). Try both shapes.
  const custom = m.custom;
  if (!custom) return '';
  if (typeof custom.get === 'function') {
    const v = custom.get(key) ?? custom.get(k);
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : String(v);
  }
  const v = custom[key] ?? custom[k];
  if (Array.isArray(v)) return v.join(', ');
  return v == null ? '' : String(v);
}

function buildFeedbackSubject(topic, bookTitle, settings) {
  const topicTitle = topic?.title || 'topic';
  const base = bookTitle
    ? `Feedback about "${topicTitle}" in "${bookTitle}"`
    : `Feedback about "${topicTitle}"`;
  const tokens = (settings.subjectMetadataKeys || [])
    .map((k) => lookupMetadataValue(topic, k))
    .filter((v) => v && String(v).trim());
  if (!tokens.length) return base;
  return `${base} ${tokens.map((t) => `[${t}]`).join(' ')}`;
}

function buildFeedbackBodyHtml({ topic, bookTitle, comment, rating, reporterName, reporterEmail, settings }) {
  const safe = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const metaTags = (settings.bodyMetadataKeys || [])
    .map((k) => ({ key: k, value: lookupMetadataValue(topic, k) }))
    .filter((row) => row.value);

  const metaHtml = metaTags.length
    ? `<p style="font-size:13px;color:#475569;">
        ${metaTags.map((r) => `<strong>${safe(r.key)}:</strong> ${safe(r.value)}`).join(' &nbsp;|&nbsp; ')}
      </p>`
    : '';

  const ratingHtml = (rating != null && rating !== '')
    ? `<p><strong>Rating:</strong> ${safe(rating)} / 5</p>`
    : '';

  const commentHtml = comment
    ? `<p style="white-space:pre-wrap;">${safe(comment)}</p>`
    : '';

  const reporterHtml = reporterEmail
    ? `<p style="font-size:13px;color:#475569;">Reported by: ${safe(reporterName || reporterEmail)} &lt;${safe(reporterEmail)}&gt;</p>`
    : `<p style="font-size:13px;color:#475569;">Reported by: anonymous user</p>`;

  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;">
    <h2 style="margin:0 0 12px;">${safe(topic?.title || 'Topic feedback')}</h2>
    ${bookTitle ? `<p style="font-size:13px;color:#475569;">in ${safe(bookTitle)}</p>` : ''}
    ${metaHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;"/>
    ${ratingHtml}
    ${commentHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;"/>
    ${reporterHtml}
  </body></html>`;
}

function buildConfirmationHtml({ topic, bookTitle, reporterName }) {
  const safe = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;">
    <p>Hello ${safe(reporterName || 'there')},</p>
    <p>Thank you for your interest and feedback on ${safe(topic?.title || 'this topic')}${bookTitle ? ` in ${safe(bookTitle)}` : ''}.</p>
    <p>Here is a recap of your feedback. Our documentation team will review it shortly.</p>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// Attachment helpers
// ---------------------------------------------------------------------------
function extractExtension(filename) {
  if (!filename) return '';
  const e = path.extname(String(filename)).toLowerCase();
  return e.startsWith('.') ? e.slice(1) : e;
}

function checkAttachments(attachments, settings) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const forbidden = new Set((settings.forbiddenAttachmentExtensions || []).map((s) => String(s).toLowerCase()));
  let totalBytes = 0;
  for (const a of attachments) {
    if (!a || typeof a !== 'object') continue;
    const ext = extractExtension(a.filename || a.name || '');
    if (ext && forbidden.has(ext)) {
      return `Attachment "${a.filename || a.name}" has a forbidden extension (.${ext}).`;
    }
    const size = Number(a.size);
    if (Number.isFinite(size) && size > 0) totalBytes += size;
  }
  const maxBytes = (Number(settings.maxAttachmentSizeMb) || 5) * 1024 * 1024;
  if (totalBytes > maxBytes) {
    return `Total attachment size ${(totalBytes / (1024 * 1024)).toFixed(2)} MB exceeds the ${settings.maxAttachmentSizeMb} MB limit.`;
  }
  return null;
}

/**
 * POST /api/feedback — Submit topic feedback (rating and/or comment).
 *
 * In addition to persisting the feedback row, the route honours the
 * Feedback admin settings:
 *   - Permission gate: caller must hold FEEDBACK_USER (BRD requirement).
 *   - Recipient gate: refuses to send when no recipients are configured.
 *   - Email service:  authenticated/unauthenticated routing per the admin's
 *                     "Email service" radios. When set to "user" the route
 *                     responds with `{ mailto }` so the client can open the
 *                     user's local mail application.
 *   - Attachment validation against the forbidden-ext list and size cap.
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { topicId, rating, feedback, attachments } = req.body || {};
    if (!topicId) {
      return res.status(400).json({ error: 'topicId is required' });
    }
    const hasRating = rating != null && rating !== '';
    const hasFeedback = typeof feedback === 'string' && feedback.trim().length > 0;
    if (!hasRating && !hasFeedback) {
      return res.status(400).json({ error: 'Provide a rating or feedback text' });
    }

    if (!(await userHasFeedbackPermission(req.user))) {
      return res.status(403).json({ error: 'FEEDBACK_USER role is required to submit feedback.' });
    }

    const settings = await FeedbackSettings.getSingleton();

    const attachmentError = checkAttachments(attachments, settings);
    if (attachmentError) {
      return res.status(400).json({ error: attachmentError });
    }

    // Persist the feedback first so we never lose user input even if email
    // delivery hiccups downstream.
    const doc = await Feedback.create({
      topicId,
      userId: req.user?.id || null,
      rating: hasRating ? Number(rating) : null,
      feedback: hasFeedback ? feedback.trim() : '',
    });

    // Topic ratings analytics aggregates `Rating` documents (same collection as
    // POST /api/topics/:id/rating). The reader submits via /feedback only — sync
    // so stars/likes/dichotomous (normalized to 1–5) appear in analytics.
    if (hasRating && req.user?.id && mongoose.isValidObjectId(topicId)) {
      const val = Number(rating);
      if (Number.isFinite(val) && val >= 1 && val <= 5) {
        const uid = req.user._id || req.user.id;
        const tid = new mongoose.Types.ObjectId(topicId);
        try {
          await Rating.findOneAndUpdate(
            { userId: uid, topicId: tid },
            {
              userId: uid,
              topicId: tid,
              documentId: null,
              unstructuredId: null,
              value: val,
              comment: hasFeedback ? String(feedback).trim() : '',
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } catch (syncErr) {
          console.warn('[feedback] Rating sync for analytics failed:', syncErr.message);
        }
      }
    }

    // Recipients are required for the FT-managed delivery path. The mailto
    // fallback (Email service = "user") doesn't need them — we just hand the
    // browser a mailto: URL with the recipients pre-populated.
    const isAuth = !!req.user;
    const serviceMode = isAuth
      ? settings.authenticatedEmailService
      : settings.unauthenticatedEmailService;

    const topic = await Topic.findById(topicId)
      .populate({ path: 'documentId', select: 'title' })
      .lean()
      .catch(() => null);
    const bookTitle = topic?.documentId?.title || '';
    const subject = buildFeedbackSubject(topic, bookTitle, settings);

    if (serviceMode === 'user') {
      // Hand the client a pre-built mailto: link. Recipients are still
      // pulled from the admin's list so the client doesn't need to know
      // them. Body is short to keep within browser URL limits.
      const recipients = (settings.recipients || []).join(',');
      const lines = [];
      if (hasRating) lines.push(`Rating: ${rating}/5`);
      if (hasFeedback) lines.push(feedback.trim());
      if (req.user?.email) lines.push(`From: ${req.user.email}`);
      const mailto = `mailto:${encodeURIComponent(recipients)}`
        + `?subject=${encodeURIComponent(subject)}`
        + `&body=${encodeURIComponent(lines.join('\n\n'))}`;
      return res.status(202).json({
        message: 'Open your mail client to send this feedback.',
        feedback: doc,
        mailto,
        method: 'user-mail-client',
      });
    }

    // FT-managed delivery — recipients required.
    if (!Array.isArray(settings.recipients) || settings.recipients.length === 0) {
      return res.status(503).json({
        error: 'Feedback delivery is unavailable: no recipient email addresses are configured.',
        feedback: doc,
      });
    }

    if (!isAuth) {
      // Per the BRD the unauth FT path is only valid with SMTP relay. We
      // double-check here so admins who flip the Email method back to
      // internal/spfdkim don't silently break unauth feedback.
      const email = await EmailSettings.getSingleton();
      if (email.sendingMethod !== 'smtp') {
        return res.status(503).json({
          error: 'Anonymous feedback delivery requires the SMTP relay sending method in Email settings.',
          feedback: doc,
        });
      }
    }

    const reporterName = req.user?.name || 'Anonymous user';
    const reporterEmail = req.user?.email || '';

    try {
      const html = buildFeedbackBodyHtml({
        topic,
        bookTitle,
        comment: hasFeedback ? feedback.trim() : '',
        rating: hasRating ? rating : null,
        reporterName,
        reporterEmail,
        settings,
      });
      // Per the BRD: when FT sends, the Reply-To is the user's address (if
      // any) so documentation teams can reply directly.
      const replyTo = reporterEmail || undefined;
      await emailService.sendMail({
        to: settings.recipients.join(','),
        subject,
        html,
        headers: replyTo ? { 'Reply-To': replyTo } : {},
      });

      // Optional confirmation back to the authenticated user.
      if (isAuth && settings.confirmationEmailEnabled && reporterEmail) {
        try {
          await emailService.sendMail({
            to: reporterEmail,
            subject: `Recap: ${subject}`,
            html: buildConfirmationHtml({ topic, bookTitle, reporterName }),
          });
        } catch (e) {
          // Confirmation failures don't fail the user-facing request.
          // eslint-disable-next-line no-console
          console.warn('[feedback] confirmation email failed:', e.message);
        }
      }
    } catch (emailErr) {
      // Persist the feedback row but surface the delivery failure so the
      // user sees a meaningful error.
      // eslint-disable-next-line no-console
      console.warn('[feedback] delivery failed:', emailErr.message);
      return res.status(502).json({
        error: `Feedback was saved but email delivery failed: ${emailErr.message}`,
        feedback: doc,
      });
    }

    res.status(201).json({ message: 'Feedback received', feedback: doc, method: 'fluid-topics' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
