const mongoose = require('mongoose');

// One row per active sign-in. Stores a hashed refresh token so the raw value
// only lives in the cookie/header on the client. `revokedAt` is the kill
// switch: middleware refuses any access JWT whose session has been revoked.
const sessionSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    userAgent: { type: String, default: '' },
    ip:        { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    lastUsedAt:{ type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    // For impersonation flows — set when an admin issued the session on behalf
    // of another user, so audit logs can attribute the actions correctly.
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: false }
);

// TTL index — Mongo will delete revoked or expired rows automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
