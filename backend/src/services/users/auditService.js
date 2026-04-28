const AuditLog = require('../../models/AuditLog');

// One-stop helper for writing audit-trail rows from user-management endpoints.
// Designed to be fire-and-forget — failures are logged to console.error but
// never thrown back to the caller, so a write hiccup doesn't 500 a user
// mutation.
//
// Usage:
//   await writeAudit(req, {
//     action:        'user.update',
//     targetUserIds: [user._id],
//     summary:       `Updated user ${user.email}`,
//     context:       { changed: ['groups', 'roles'] },
//   });

async function writeAudit(req, {
  action,
  targetUserIds = [],
  context = {},
  summary = '',
}) {
  try {
    if (!action) return null;
    if (!req?.user?._id) return null; // never write anonymous rows

    const ids = (Array.isArray(targetUserIds) ? targetUserIds : [targetUserIds])
      .filter(Boolean)
      .map((v) => (v.toString ? v.toString() : v));

    return await AuditLog.create({
      actorId:        req.user._id,
      actorEmail:     req.user.email || '',
      actorRole:      req.user.role || '',
      impersonatorId: req.actor?._id || req.actor?.id || null,
      action,
      targetUserIds:  ids,
      context:        context && typeof context === 'object' ? context : {},
      summary:        String(summary || ''),
      ip:             req.ip || req.headers?.['x-forwarded-for'] || '',
      userAgent:      (req.headers?.['user-agent'] || '').slice(0, 500),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write log:', e.message);
    return null;
  }
}

// Convenience wrapper: builds a "diff context" from an array of changed keys.
function diffContext(before = {}, after = {}, keys = []) {
  const ctx = { changed: [] };
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    if (aStr !== bStr) {
      ctx.changed.push(k);
      ctx[k] = { before: a, after: b };
    }
  }
  return ctx;
}

module.exports = { writeAudit, diffContext };
