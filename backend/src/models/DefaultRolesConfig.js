const mongoose = require('mongoose');

// Singleton config — the admin-curated default roles applied to anonymous
// (unauthenticated) sessions and to authenticated users who haven't been
// granted a more specific role manually.
//
// Each bucket is restricted to the subset of feature permissions the BRD
// permits as defaults; we don't enforce that here at the schema level (the
// route handler validates against rolesVocabulary), so admins can still
// curate the list as the catalogue evolves without requiring a code push.
const defaultRolesConfigSchema = new mongoose.Schema(
  {
    // Use a stable sentinel id so we can findOneAndUpdate with upsert
    // without ever spawning multiple rows.
    _id: { type: String, default: 'default-roles' },
    unauthenticated: [{ type: String }],
    authenticated:   [{ type: String }],
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, _id: false }
);

defaultRolesConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findById('default-roles');
  if (existing) return existing;
  return this.create({ _id: 'default-roles', unauthenticated: [], authenticated: [] });
};

module.exports =
  mongoose.models.DefaultRolesConfig ||
  mongoose.model('DefaultRolesConfig', defaultRolesConfigSchema);
