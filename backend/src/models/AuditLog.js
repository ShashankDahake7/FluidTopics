const mongoose = require('mongoose');

// Append-only audit trail for user-management actions. Every mutating route in
// /api/admin/users/* writes a row; the Manage Users UI surfaces the trail in a
// drawer and `GET /api/admin/audit-log` returns paged results for sysadmins.
//
// `action` is a stable machine token (e.g. "user.lock", "user.delete",
// "users.bulk.assign-group") so dashboards can group on it without parsing the
// human-readable `summary` string. `context` is a free-form bag for
// per-action metadata — keep it small (no PII beyond what's already in
// `targetUserIds`).
const auditLogSchema = new mongoose.Schema(
  {
    actorId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorEmail:     { type: String, default: '' },
    actorRole:      { type: String, default: '' },
    impersonatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action:         { type: String, required: true, index: true },
    targetUserIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    context:        { type: mongoose.Schema.Types.Mixed, default: {} },
    summary:        { type: String, default: '' },
    ip:             { type: String, default: '' },
    userAgent:      { type: String, default: '' },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

module.exports =
  mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
