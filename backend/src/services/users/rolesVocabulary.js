// Single source of truth for the role / permission catalogue presented in
// the Manage Users UI and validated by /api/admin/users routes.
//
// Two categories:
//   - Feature roles  → user-facing capabilities (e.g. PRINT_USER). Eligible
//                      for default assignment via DefaultRolesConfig.
//   - Administrative roles → access to admin tooling (e.g. USERS_ADMIN).
//                      Never default-eligible.

const FEATURE_ROLES = [
  // Unauthenticated bucket — eligible as defaults for anonymous sessions
  { id: 'PRINT_USER',                label: 'Print',                bucket: 'unauthenticated', defaultEligible: true },
  { id: 'RATING_USER',               label: 'Rate content',         bucket: 'unauthenticated', defaultEligible: true },
  { id: 'FEEDBACK_USER',             label: 'Send feedback',        bucket: 'unauthenticated', defaultEligible: true },
  { id: 'AI_USER',                   label: 'Use AI features',      bucket: 'unauthenticated', defaultEligible: true },
  { id: 'AI_EXPORT_USER',            label: 'Export AI',            bucket: 'unauthenticated', defaultEligible: true },
  // Aliased back-compat permissions — same surface, older identifiers.
  { id: 'GENERATIVE_AI_USER',        label: 'Use AI features (legacy)',  bucket: 'unauthenticated', defaultEligible: true,  alias: 'AI_USER' },
  { id: 'GENERATIVE_AI_EXPORT_USER', label: 'Export AI (legacy)',        bucket: 'unauthenticated', defaultEligible: true,  alias: 'AI_EXPORT_USER' },

  // Authenticated bucket — eligible as defaults for signed-in users
  { id: 'PERSONAL_BOOK_USER',        label: 'Personal books',       bucket: 'authenticated', defaultEligible: true },
  { id: 'PERSONAL_BOOK_SHARE_USER',  label: 'Share personal books', bucket: 'authenticated', defaultEligible: true },
  { id: 'HTML_EXPORT_USER',          label: 'HTML export',          bucket: 'authenticated', defaultEligible: true },
  { id: 'PDF_EXPORT_USER',           label: 'PDF export',           bucket: 'authenticated', defaultEligible: true },
  { id: 'SAVED_SEARCH_USER',         label: 'Save searches',        bucket: 'authenticated', defaultEligible: true },
  { id: 'COLLECTION_USER',           label: 'Collections',          bucket: 'authenticated', defaultEligible: true },
  { id: 'OFFLINE_USER',              label: 'Offline access',       bucket: 'authenticated', defaultEligible: true },
  { id: 'ANALYTICS_USER',            label: 'Analytics (no PII)',   bucket: 'authenticated', defaultEligible: true },
  { id: 'BETA_USER',                 label: 'Beta features',        bucket: 'authenticated', defaultEligible: true },
  { id: 'DEBUG_USER',                label: 'Debug tools',          bucket: 'authenticated', defaultEligible: true },
  { id: 'BEHAVIOR_DATA_USER',        label: 'Access behavior data', bucket: 'authenticated', defaultEligible: false },
];

const ADMINISTRATIVE_ROLES = [
  { id: 'USERS_ADMIN',        label: 'Manage users' },
  { id: 'CONTENT_ADMIN',      label: 'Manage content' },
  { id: 'CONTENT_PUBLISHER',  label: 'Content publisher (bypasses access rules)' },
  { id: 'KHUB_ADMIN',         label: 'Knowledge hub admin' },
  { id: 'PORTAL_ADMIN',       label: 'Portal designer admin' },
  { id: 'METADATA_ADMIN',     label: 'Metadata admin' },
  { id: 'ENRICHMENT_ADMIN',   label: 'Enrichment admin' },
  { id: 'ANALYTICS_ADMIN',    label: 'Analytics admin' },
  { id: 'TRANSLATIONS_ADMIN', label: 'Translations admin' },
];

const FEATURE_ROLE_IDS         = FEATURE_ROLES.map((r) => r.id);
const ADMINISTRATIVE_ROLE_IDS  = ADMINISTRATIVE_ROLES.map((r) => r.id);
const DEFAULT_ELIGIBLE_IDS     = FEATURE_ROLES.filter((r) => r.defaultEligible).map((r) => r.id);
const FEATURE_ROLE_BY_ID       = Object.fromEntries(FEATURE_ROLES.map((r) => [r.id, r]));
const ADMINISTRATIVE_ROLE_BY_ID= Object.fromEntries(ADMINISTRATIVE_ROLES.map((r) => [r.id, r]));

function isFeatureRole(id)         { return FEATURE_ROLE_BY_ID[id] !== undefined; }
function isAdministrativeRole(id)  { return ADMINISTRATIVE_ROLE_BY_ID[id] !== undefined; }
function isDefaultEligible(id)     { return !!FEATURE_ROLE_BY_ID[id]?.defaultEligible; }

// Filter an array down to known feature roles (drops unknown / aliased dupes).
function sanitizeFeatureRoles(arr = []) {
  const seen = new Set();
  const out = [];
  for (const id of arr) {
    if (typeof id !== 'string') continue;
    if (!isFeatureRole(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizeAdminRoles(arr = []) {
  const seen = new Set();
  const out = [];
  for (const id of arr) {
    if (typeof id !== 'string') continue;
    if (!isAdministrativeRole(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizeDefaultRoles(arr = [], bucket = null) {
  const seen = new Set();
  const out = [];
  for (const id of arr) {
    if (typeof id !== 'string') continue;
    if (!isFeatureRole(id))    continue;
    if (!isDefaultEligible(id))continue;
    if (bucket && FEATURE_ROLE_BY_ID[id].bucket !== bucket) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

module.exports = {
  FEATURE_ROLES,
  ADMINISTRATIVE_ROLES,
  FEATURE_ROLE_IDS,
  ADMINISTRATIVE_ROLE_IDS,
  DEFAULT_ELIGIBLE_IDS,
  FEATURE_ROLE_BY_ID,
  ADMINISTRATIVE_ROLE_BY_ID,
  isFeatureRole,
  isAdministrativeRole,
  isDefaultEligible,
  sanitizeFeatureRoles,
  sanitizeAdminRoles,
  sanitizeDefaultRoles,
};
