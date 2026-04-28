const mongoose = require('mongoose');

// One document per authentication realm. Mirrors the BRD's five realm types
// (`internal | ldap | oidc | saml | jwt`) with type-specific configuration
// stored under the `config` sub-document. Order is determined by `position`
// (lower = higher precedence) so we can keep "drag-to-reorder" stable across
// concurrent edits.
//
// Identifier rules per the BRD: "It is not possible to modify a realm
// identifier after creating it." → the `identifier` field is immutable
// (enforced in the route layer; mongoose makes it `unique` here).
//
// Profile mappers JS lives in `profileMapperScript`; the runner that executes
// the script on login is intentionally out of scope for this PR — we persist
// + surface the script so the admin can iterate, with the engine a follow-up.
//
// MFA lives at the realm level (BRD: "ADMIN users can activate MFA at the
// realm level. […] When active, MFA applies to all users of a realm."). The
// portal-wide grace period is on AuthSettings.
const labelSchema = new mongoose.Schema(
  {
    locale: { type: String, required: true },
    label:  { type: String, default: '' },
  },
  { _id: false }
);

const jwtIssuerSchema = new mongoose.Schema(
  {
    issuer:  { type: String, default: '' },
    jwksUrl: { type: String, default: '' },
  },
  { _id: false }
);

const authRealmSchema = new mongoose.Schema(
  {
    identifier:    { type: String, required: true, trim: true, unique: true },
    type:          { type: String, enum: ['internal', 'ldap', 'oidc', 'saml', 'jwt'], required: true },
    enabled:       { type: Boolean, default: true },
    position:      { type: Number, default: 0 },

    // Per-type configuration. Free-form-ish but typed below to catch typos.
    config: {
      // Common login button
      showLoginButton: { type: Boolean, default: true },
      buttonImageUrl:  { type: String, default: '' },
      buttonLabels:    { type: [labelSchema], default: [] },

      // internal
      registrationType:   { type: String, enum: ['public', 'verified', 'closed'], default: 'verified' },
      passwordPolicy:     { type: String, enum: ['low', 'high'], default: 'low' },
      allowedEmailDomains:[{ type: String }],

      // ldap
      ldapUrl:        { type: String, default: '' },
      ldapBindDn:     { type: String, default: '' },
      ldapBindPassword:{ type: String, default: '' },
      ldapSearchBase: { type: String, default: '' },
      ldapAuthMechanism:{ type: String, default: 'simple' },

      // oidc
      oidcClientId:    { type: String, default: '' },
      oidcClientSecret:{ type: String, default: '' },
      oidcDiscoveryUrl:{ type: String, default: '' },
      oidcScopes:      [{ type: String }],
      oidcSsoLogout:   { type: Boolean, default: false },

      // saml
      samlIdpMetadataXml: { type: String, default: '' },
      samlEntityId:       { type: String, default: '' },
      samlIdpCerts:       [{ cn: String, expiresAt: Date }],
      samlMaxAuthLifetimeSeconds: { type: Number, default: 7776000 },

      // jwt
      jwtIssuers:        { type: [jwtIssuerSchema], default: [] },
      jwtRedirectionUrl: { type: String, default: '' },
    },

    // Profile mappers (JS source) — persisted but execution is a follow-up.
    profileMapperScript: { type: String, default: '' },

    // MFA at the realm level; portal-wide grace period lives on AuthSettings.
    mfaEnabled: { type: Boolean, default: false },

    // Migration: when set, on next successful login of a user with the same
    // email under any of these source realm identifiers, that user's account
    // (with assets) is re-attached to this realm. Migration runner is also a
    // follow-up; the configuration is what matters for the BRD here.
    migrateFromRealms: [{ type: String }],

    // Audit attribution.
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

authRealmSchema.index({ position: 1 });
authRealmSchema.index({ type: 1 });

module.exports = mongoose.models.AuthRealm || mongoose.model('AuthRealm', authRealmSchema);
