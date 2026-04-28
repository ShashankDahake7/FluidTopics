const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Feature roles (BRD Workflow 3) — fine-grained, capability-style flags. These
// are user-facing and may be assigned by default.
const FEATURE_PERMISSIONS = [
  'PRINT_USER',
  'RATING_USER',
  'FEEDBACK_USER',
  'GENERATIVE_AI_USER',
  'GENERATIVE_AI_EXPORT_USER',
  'AI_USER',
  'AI_EXPORT_USER',
  'PERSONAL_BOOK_USER',
  'PERSONAL_BOOK_SHARE_USER',
  'HTML_EXPORT_USER',
  'PDF_EXPORT_USER',
  'SAVED_SEARCH_USER',
  'COLLECTION_USER',
  'OFFLINE_USER',
  'ANALYTICS_USER',
  'BETA_USER',
  'DEBUG_USER',
  'BEHAVIOR_DATA_USER',
];

// Administrative roles — gate access to admin tooling. These are NEVER
// default-assigned and are tracked separately so we can audit them
// independently from feature roles.
const ADMINISTRATIVE_ROLES = [
  'USERS_ADMIN',
  'CONTENT_ADMIN',
  'CONTENT_PUBLISHER',
  'ANALYTICS_ADMIN',
  'KHUB_ADMIN',
  'PORTAL_ADMIN',
  'ENRICHMENT_ADMIN',
  'METADATA_ADMIN',
  'TRANSLATIONS_ADMIN',
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    // Coarse "tier" of an account. Kept separate from feature/admin role
    // arrays so existing role-gated routes (`requireRole('admin')`) continue
    // to work unchanged.
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'editor', 'viewer'],
      default: 'viewer',
    },
    // Realm — the identity provider that owns the user record. `internal`
    // means we own the password; the others are federated.
    realm: {
      type: String,
      enum: ['internal', 'sso', 'ldap', 'oidc'],
      default: 'internal',
      index: true,
    },
    // -------- Feature permissions (3-origin tracking) -----------------------
    // The "effective" set is the union of the three arrays below. Each array
    // tracks the *origin* of a permission so we can surface coloured dots in
    // the UI and audit changes meaningfully.
    permissions:        [{ type: String, enum: FEATURE_PERMISSIONS }], // legacy/effective union (back-compat)
    permissionsManual:  [{ type: String, enum: FEATURE_PERMISSIONS }], // added by an admin
    permissionsAuto:    [{ type: String, enum: FEATURE_PERMISSIONS }], // mapped from SSO/LDAP profile
    permissionsDefault: [{ type: String, enum: FEATURE_PERMISSIONS }], // resolved via DefaultRolesConfig
    // -------- Administrative roles (manual or auto only) --------------------
    adminRoles:        [{ type: String, enum: ADMINISTRATIVE_ROLES }],
    adminRolesManual:  [{ type: String, enum: ADMINISTRATIVE_ROLES }],
    adminRolesAuto:    [{ type: String, enum: ADMINISTRATIVE_ROLES }],
    avatar: {
      type: String,
      default: '',
    },
    // -------- Group memberships (origin tracked) ----------------------------
    // `groups` remains the effective list (union) so existing populate() calls
    // work unchanged; the parallel arrays let us colour-dot each chip.
    groups:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    groupsManual:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    groupsAuto:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    // -------- Free-form tags (origin tracked) -------------------------------
    tags:          [{ type: String, trim: true }],
    tagsManual:    [{ type: String, trim: true }],
    tagsAuto:      [{ type: String, trim: true }],
    // Email verification — false until the user clicks the link in the
    // verification email.
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },
    passwordResetToken:   { type: String, default: null, select: false },
    passwordResetExpires: { type: Date,   default: null, select: false },
    loginCount:    { type: Number, default: 0 },
    failedLogins:  { type: Number, default: 0 },
    // `lockedUntil` is the auto-cooldown after too many failed logins.
    lockedUntil:   { type: Date,   default: null },
    // `lockedManually` is the admin-toggled "Status: Locked" switch surfaced
    // in the user drawer. Distinct from `isActive` (legacy soft-delete) and
    // `lockedUntil` (transient brute-force cooldown). When true the user
    // cannot sign in, regardless of `isActive`.
    lockedManually:        { type: Boolean, default: false },
    lockedManuallyAt:      { type: Date, default: null },
    lockedManuallyByUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // External-identity links — populated when the user signs in via OIDC
    // (Google, Microsoft, …) so subsequent logins resolve to the same User.
    ssoProvider:   { type: String, default: null },
    ssoSubject:    { type: String, default: null },
    preferences: {
      products: [{ type: String }],
      interests: [{ type: String }],
      // User-set search filters
      documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
      releaseNotesOnly: { type: Boolean, default: false },
      priorityDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      priorityTopicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
      priorityReleaseNotes: { type: Boolean, default: false },
      language: { type: String, default: 'en' },
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      // Admin-set search presets — separate sub-doc so the user's own
      // preferences are never silently overwritten.
      adminSet: {
        documentIds:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
        topicIds:            [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
        releaseNotesOnly:    { type: Boolean, default: false },
        priorityDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
        priorityTopicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
        priorityReleaseNotes:{ type: Boolean, default: false },
        updatedAt:           { type: Date, default: null },
        updatedByUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      },
    },
    // Auto-learned from behavior
    behaviorProfile: {
      topTags: {
        type: Map,
        of: Number,
        default: {},
      },
      topProducts: {
        type: Map,
        of: Number,
        default: {},
      },
      totalViews: { type: Number, default: 0 },
      totalSearches: { type: Number, default: 0 },
      avgSessionDuration: { type: Number, default: 0 },
      lastActiveAt: { type: Date },
    },
    lastLogin: {
      type: Date,
    },
    // `lastActivityAt` covers both interactive logins and API/token usage.
    // Used in the Manage Users table to populate "Last activity".
    lastActivityAt: { type: Date, default: null, index: true },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Legal-terms acceptance tracking. The user is considered "up to date" when
    // `legalTerms.acceptedVersion === SiteConfig.legalTermsPolicyVersion`. The
    // gate prompts whenever legal terms are enabled and the version differs.
    legalTerms: {
      acceptedVersion: { type: Number, default: null },
      acceptedAt:      { type: Date,   default: null },
      declinedAt:      { type: Date,   default: null },
    },
    // Multi-factor authentication (TOTP) per the BRD: an admin can reset a
    // user's MFA from the Manage Users drawer. We don't ship the TOTP runtime
    // here, but we persist the bookkeeping needed to enforce it later: the
    // grace-period anchor, the secret, and the most recent reset event.
    mfa: {
      enrolled:       { type: Boolean, default: false },
      secret:         { type: String,  default: '' },          // base32, do not log
      enrolledAt:     { type: Date,    default: null },
      graceStartedAt: { type: Date,    default: null },
      resetRequested: { type: Boolean, default: false },
      resetTokenHash: { type: String,  default: '' },          // sha256(token)
      resetTokenExpiresAt: { type: Date, default: null },      // BRD: 24 h
      resetCount:     { type: Number,  default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// -----------------------------------------------------------------------------
// Pre-save hooks
// -----------------------------------------------------------------------------

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Recompute the effective union arrays whenever any origin array changes. Keeps
// `groups`/`tags`/`permissions`/`adminRoles` in lock-step with the *Manual /
// *Auto / *Default arrays so existing reads keep working.
function uniqStrings(arrs) {
  const out = [];
  const seen = new Set();
  for (const arr of arrs) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (v === undefined || v === null) continue;
      const k = String(v);
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
  }
  return out;
}

function uniqIds(arrs) {
  const out = [];
  const seen = new Set();
  for (const arr of arrs) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (!v) continue;
      const k = v.toString();
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
  }
  return out;
}

userSchema.pre('save', function (next) {
  if (
    this.isModified('groupsManual') || this.isModified('groupsAuto') ||
    this.isNew
  ) {
    this.groups = uniqIds([this.groupsManual, this.groupsAuto]);
  }
  if (
    this.isModified('tagsManual') || this.isModified('tagsAuto') ||
    this.isNew
  ) {
    this.tags = uniqStrings([this.tagsManual, this.tagsAuto]);
  }
  if (
    this.isModified('permissionsManual') || this.isModified('permissionsAuto') ||
    this.isModified('permissionsDefault') || this.isNew
  ) {
    this.permissions = uniqStrings([
      this.permissionsManual,
      this.permissionsAuto,
      this.permissionsDefault,
    ]);
  }
  if (
    this.isModified('adminRolesManual') || this.isModified('adminRolesAuto') ||
    this.isNew
  ) {
    this.adminRoles = uniqStrings([this.adminRolesManual, this.adminRolesAuto]);
  }
  next();
});

// -----------------------------------------------------------------------------
// Instance methods
// -----------------------------------------------------------------------------

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  return obj;
};

// Statics expose the canonical vocabularies so other modules don't repeat them.
userSchema.statics.FEATURE_PERMISSIONS  = FEATURE_PERMISSIONS;
userSchema.statics.ADMINISTRATIVE_ROLES = ADMINISTRATIVE_ROLES;

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
module.exports.FEATURE_PERMISSIONS  = FEATURE_PERMISSIONS;
module.exports.ADMINISTRATIVE_ROLES = ADMINISTRATIVE_ROLES;
