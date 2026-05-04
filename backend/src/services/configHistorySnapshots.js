/**
 * Live configuration snapshots for Configuration history "Compare with current"
 * and for consistent before/after payloads in route handlers.
 */
const AccessRulesConfig = require('../models/AccessRulesConfig');
const AccessRule = require('../models/AccessRule');
const AuthSettings = require('../models/AuthSettings');
const AuthRealm = require('../models/AuthRealm');
const SeoConfig = require('../models/SeoConfig');
const OpenSearchConfig = require('../models/OpenSearchConfig');
const SecurityConfig = require('../models/SecurityConfig');
const EmailSettings = require('../models/EmailSettings');
const FeedbackSettings = require('../models/FeedbackSettings');
const AlertsConfig = require('../models/AlertsConfig');
const RatingRulesConfig = require('../models/RatingRulesConfig');
const DefaultRolesConfig = require('../models/DefaultRolesConfig');
const SiteConfig = require('../models/SiteConfig');
const MetadataKey = require('../models/MetadataKey');
const PrettyUrlTemplate = require('../models/PrettyUrlTemplate');
const PrettyUrlConfig = require('../models/PrettyUrlConfig');
const Source = require('../models/Source');
const Vocabulary = require('../models/Vocabulary');
const VocabularyConfig = require('../models/VocabularyConfig');
const ApiKey = require('../models/ApiKey');
const DitaOtConfig = require('../models/DitaOtConfig');
const TileIcon = require('../models/TileIcon');
const DesignerPage = require('../models/DesignerPage');
const { OriginPortal, ImportRecord } = require('../models/ImportConfig');

const SECRET_KEYS = ['oidcClientSecret', 'ldapBindPassword'];
const EMAIL_SECRET_KEYS = ['dkimPrivateKey', 'smtpPassword', 'sendgridApiKey'];

function redactRealmConfig(type, cfg) {
  const c = { ...(cfg || {}) };
  if (type !== 'ldap' && type !== 'oidc') return c;
  SECRET_KEYS.forEach((k) => {
    if (c[k]) c[k] = '__redacted__';
  });
  return c;
}

function publicRealmSnapshot(r) {
  if (!r) return null;
  const obj = r.toObject ? r.toObject() : r;
  const cfg = redactRealmConfig(obj.type, obj.config);
  return {
    id: String(obj._id),
    identifier: obj.identifier,
    type: obj.type,
    enabled: !!obj.enabled,
    position: obj.position ?? 0,
    config: cfg,
    profileMapperScript: obj.profileMapperScript || '',
    mfaEnabled: !!obj.mfaEnabled,
    migrateFromRealms: Array.isArray(obj.migrateFromRealms) ? obj.migrateFromRealms : [],
  };
}

async function snapshotAccessRules() {
  const cfg = await AccessRulesConfig.getSingleton();
  const rules = await AccessRule.find({}).populate('groups', 'name').sort({ createdAt: 1 }).lean();
  return {
    config: {
      mode: cfg.mode,
      defaultRule: cfg.defaultRule,
      legacyDefaultGroup: cfg.legacyDefaultGroup,
      topicLevelEnabled: cfg.topicLevelEnabled,
    },
    rules: rules.map((obj) => ({
      id: String(obj._id),
      name: obj.name || '',
      description: obj.description || '',
      requirements: obj.requirements || [],
      requirementsMode: obj.requirementsMode || 'any',
      authMode: obj.authMode || 'groups',
      groups: (obj.groups || []).map((g) =>
        typeof g === 'object' && g.name ? { id: String(g._id || g.id), name: g.name } : { id: String(g) }),
      autoBindKey: obj.autoBindKey || '',
      targetTopics: !!obj.targetTopics,
      status: obj.status || 'New',
      inactiveSet: !!obj.inactiveSet,
    })),
  };
}

async function snapshotAuthentication() {
  const general = await AuthSettings.getSingleton();
  const g = general.toObject ? general.toObject() : general;
  const realms = await AuthRealm.find({}).sort({ position: 1, createdAt: 1 });
  return {
    general: {
      requireAuth: !!g.requireAuth,
      openSsoInCurrentWindow: !!g.openSsoInCurrentWindow,
      hideCredentialsFormIfSso: !!g.hideCredentialsFormIfSso,
      logoutRedirectUrl: g.logoutRedirectUrl || '',
      hideNativeLogout: !!g.hideNativeLogout,
      idleTimeoutEnabled: !!g.idleTimeoutEnabled,
      idleTimeoutMinutes: Math.max(30, Number(g.idleTimeoutMinutes) || 30),
      rememberMeDays: Math.max(1, Number(g.rememberMeDays) || 30),
      mfaGraceDays: Math.max(0, Number(g.mfaGraceDays) || 0),
    },
    realms: realms.map((r) => publicRealmSnapshot(r)),
  };
}

async function snapshotWebSearchEngines() {
  let c = await SeoConfig.findOne();
  if (!c) return {};
  return c.toObject ? c.toObject() : c;
}

async function snapshotOpenSearch() {
  let c = await OpenSearchConfig.findOne();
  if (!c) return {};
  return c.toObject ? c.toObject() : c;
}

async function snapshotIntegrationSecurity() {
  let c = await SecurityConfig.findOne();
  if (!c) return {};
  return c.toObject ? c.toObject() : c;
}

/** Trusted origins + certificates (PEM redacted) + API keys — single BRD category. */
async function snapshotIntegrationSecurityFull() {
  const sec = await SecurityConfig.findOne();
  const obj = sec ? sec.toObject() : {};
  const certs = (obj.certificates || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    subject: c.subject,
    expires: c.expires,
    privateKeyPem: c.privateKeyPem ? '__redacted__' : '',
    chainPem: c.chainPem ? '__redacted__' : '',
  }));
  const keys = await snapshotApiKeys();
  return {
    trustedOrigins: obj.trustedOrigins || '',
    certificates: certs,
    apiKeys: keys.keys,
  };
}

function publicEmailSnapshot(cfg) {
  if (!cfg) return {};
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  const out = { ...obj };
  EMAIL_SECRET_KEYS.forEach((k) => {
    if (out[k]) out[k] = '__redacted__';
  });
  return out;
}

async function snapshotEmailNotifications() {
  const cfg = await EmailSettings.getSingleton();
  return publicEmailSnapshot(cfg);
}

async function snapshotFeedback() {
  const cfg = await FeedbackSettings.getSingleton();
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    recipients: obj.recipients || [],
    subjectMetadataKeys: obj.subjectMetadataKeys || [],
    bodyMetadataKeys: obj.bodyMetadataKeys || [],
    authenticatedEmailService: obj.authenticatedEmailService || 'ft',
    unauthenticatedEmailService: obj.unauthenticatedEmailService || 'user',
    confirmationEmailEnabled: !!obj.confirmationEmailEnabled,
    forbiddenAttachmentExtensions: obj.forbiddenAttachmentExtensions || [],
    maxAttachmentSizeMb: obj.maxAttachmentSizeMb || 5,
  };
}

async function snapshotAlerts() {
  const cfg = await AlertsConfig.getSingleton();
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    matchMode: obj.matchMode || 'any',
    recurrenceDays: Array.isArray(obj.recurrenceDays) ? obj.recurrenceDays : [],
    bodyMetadataKeys: Array.isArray(obj.bodyMetadataKeys) ? obj.bodyMetadataKeys : [],
  };
}

async function snapshotRating() {
  const cfg = await RatingRulesConfig.getSingleton();
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    rules: (obj.rules || []).map((r) => ({
      docType: r.docType,
      topicType: r.topicType,
      topicLevels: Array.isArray(r.topicLevels) ? r.topicLevels : [],
      metaReqs: Array.isArray(r.metaReqs)
        ? r.metaReqs.map((m) => ({ key: m.key, value: m.value }))
        : [],
    })),
  };
}

async function snapshotDefaultUserRoles() {
  const cfg = await DefaultRolesConfig.getSingleton();
  return {
    unauthenticated: cfg.unauthenticated || [],
    authenticated: cfg.authenticated || [],
  };
}

async function snapshotLanguages() {
  const cfg = await SiteConfig.getSingleton();
  return {
    defaultLocale: cfg.defaultLocale || 'en',
    enabledLocales: Array.isArray(cfg.enabledLocales) ? cfg.enabledLocales : [],
    searchInAllLanguagesEnabled: cfg.searchInAllLanguagesEnabled !== false,
  };
}

async function snapshotLegalTerms() {
  const cfg = await SiteConfig.getSingleton();
  return {
    enabled: !!cfg.legalTermsEnabled,
    messages: (cfg.legalTermsMessages || []).map((m) => ({
      locale: m.locale,
      label: m.label || '',
      linksHtml: m.linksHtml || '',
      validated: !!m.validated,
    })),
    policyVersion: cfg.legalTermsPolicyVersion || 0,
    lastPolicyUpdateAt: cfg.legalTermsLastPolicyUpdateAt || null,
  };
}

async function serialiseMetadataKeysList() {
  const rows = await MetadataKey.find({}).sort({ name: 1 }).lean();
  return rows.map((obj) => ({
    id: String(obj._id),
    name: obj.name,
    displayName: obj.displayName || obj.name,
    isIndexed: !!obj.isIndexed,
    isDate: !!obj.isDate,
    manual: !!obj.manual,
    valuesSample: obj.valuesSample || [],
    valuesCount: obj.valuesCount || 0,
  }));
}

async function snapshotPrettyUrl() {
  const [rows, cfg] = await Promise.all([
    PrettyUrlTemplate.find({}).sort({ scope: 1, state: 1, priority: 1, createdAt: 1 }).lean(),
    PrettyUrlConfig.getSingleton(),
  ]);
  const cobj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    templates: rows.map((row) => ({
      id: String(row._id),
      scope: row.scope,
      state: row.state,
      template: row.template || '',
      priority: row.priority || 0,
      requirements: (row.requirements || []).map((r) => ({
        key: r.key,
        required: r.required !== false,
        topicSource: !!r.topicSource,
      })),
    })),
    config: {
      removeAccents: !!cobj.removeAccents,
      lowercase: !!cobj.lowercase,
      pendingReprocess: !!cobj.pendingReprocess,
      lastActivatedAt: cobj.lastActivatedAt || null,
    },
  };
}

async function snapshotSources() {
  const sources = await Source.find({}).sort({ createdAt: -1 }).lean();
  return {
    sources: sources.map((s) => ({
      id: String(s._id),
      sourceId: s.sourceId,
      name: s.name,
      type: s.type,
      category: s.category || '',
      description: s.description || '',
      installationStatus: s.installationStatus || 'installed',
      permissions: s.permissions || {},
    })),
  };
}

async function snapshotSourcesFull() {
  const s = await snapshotSources();
  const ditaOt = await snapshotDitaOt();
  return { ...s, ditaOt };
}

async function snapshotVocabularies() {
  const rows = await Vocabulary.find({}).sort({ name: 1 }).lean();
  const cfgRow = await VocabularyConfig.findOne({ key: 'default' });
  const cfg = cfgRow ? (cfgRow.toObject ? cfgRow.toObject() : cfgRow) : {};
  return {
    items: rows.map((v) => ({
      id: String(v._id),
      name: v.name,
      displayName: v.displayName || v.name,
      usedInSearch: !!v.usedInSearch,
    })),
    config: {
      pendingReprocess: !!cfg.pendingReprocess,
      lastFullReprocessAt: cfg.lastFullReprocessAt || null,
    },
  };
}

async function snapshotEnrichAndClean() {
  const enrichService = require('./enrich/enrichService');
  return enrichService.listRules();
}

async function snapshotDitaOt() {
  let cfg = await DitaOtConfig.findOne({ key: 'default' });
  if (!cfg) return { isDefault: true, archive: null, transtype: '', parameters: [] };
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  const archive = obj.archive || {};
  return {
    isDefault: !!obj.isDefault,
    archive: archive.key
      ? {
        originalName: archive.originalName || '',
        sizeBytes: archive.sizeBytes || 0,
        uploadedAt: archive.uploadedAt || null,
      }
      : null,
    transtype: obj.transtype || '',
    parameters: (obj.parameters || []).map((p) => ({ key: p.key, value: p.value || '' })),
  };
}

async function snapshotApiKeys() {
  const keys = await ApiKey.find({}).sort({ createdAt: 1 }).lean();
  return {
    keys: keys.map((k) => ({
      id: String(k._id),
      name: k.name,
      description: k.description || '',
      roles: k.roles || [],
      groups: k.groups || [],
      ipRestrictions: k.ipRestrictions || '',
      secret: k.secret ? '__redacted__' : '',
      lastActivity: k.lastActivity || null,
    })),
  };
}

async function snapshotTileIcons() {
  const icons = await TileIcon.find({}, 'tileType tileKey filename mimeType size').lean();
  return { icons };
}

async function snapshotGeneralPortalParameters() {
  const portals = await OriginPortal.find({}).sort({ createdAt: -1 }).lean();
  const recentImports = await ImportRecord.find({}).sort({ createdAt: -1 }).limit(20).lean();
  return {
    originPortals: portals.map((p) => ({
      id: String(p._id),
      baseUrl: p.baseUrl,
      apiKey: p.apiKey ? '__redacted__' : '',
    })),
    recentImports: recentImports.map((r) => ({
      id: String(r._id),
      status: r.status,
      url: r.url,
      categories: r.categories || [],
    })),
  };
}

const DESIGN_EXCLUDED = {
  excludedFromConfigurationHistory: true,
  reason:
    'Changes made in the Design menus do not appear in Configuration history. '
    + 'Edit these areas from the portal designer if applicable.',
};

async function snapshotDesignerTypes(types) {
  const pages = await DesignerPage.find({ type: { $in: types } })
    .select('name type status locale updatedAt')
    .lean();
  return { ...DESIGN_EXCLUDED, pages };
}

/**
 * Returns a plain JSON snapshot of the current portal configuration for `category`
 * (BRD menu labels).
 */
async function getCurrentSnapshot(category) {
  switch (category) {
    case 'Access rules':
      return snapshotAccessRules();
    case 'Authentication':
      return snapshotAuthentication();
    case 'Web search engines':
      return snapshotWebSearchEngines();
    case 'OpenSearch':
      return snapshotOpenSearch();
    case 'Integration security':
      return snapshotIntegrationSecurityFull();
    case 'Email notifications':
      return snapshotEmailNotifications();
    case 'Feedback':
      return snapshotFeedback();
    case 'Alerts':
      return snapshotAlerts();
    case 'Rating':
      return snapshotRating();
    case 'Default user roles':
      return snapshotDefaultUserRoles();
    case 'Languages':
      return snapshotLanguages();
    case 'Legal terms':
      return snapshotLegalTerms();
    case 'Metadata configuration':
    case 'Metadata descriptors':
      return { keys: await serialiseMetadataKeysList() };
    case 'Index metadata':
      return {
        keys: await serialiseMetadataKeysList(),
        note: 'Atlas Search index wiring is managed in MongoDB Atlas; registry reflects metadata descriptors.',
      };
    case 'Pretty URL':
      return snapshotPrettyUrl();
    case 'Sources':
      return snapshotSourcesFull();
    case 'Enrich and Clean':
      return snapshotEnrichAndClean();
    case 'Vocabularies':
      return snapshotVocabularies();
    case 'General portal parameters':
      return snapshotGeneralPortalParameters();
    case 'Confidentiality':
      return { note: 'No separate confidentiality store in this deployment; related controls may appear under Integration security.' };
    case 'Homepage':
      return snapshotDesignerTypes(['homepage']);
    case 'Search page':
      return snapshotDesignerTypes(['search-results']);
    case 'Reader page':
      return snapshotDesignerTypes(['reader']);
    case 'Theme':
      return { ...DESIGN_EXCLUDED, ...(await snapshotTileIcons()) };
    case 'Content Styles':
    case 'Custom JavaScript':
    case 'Print templates':
    case 'Related links':
      return DESIGN_EXCLUDED;
    default:
      return { note: `No live snapshot mapping for category "${category}".` };
  }
}

module.exports = {
  getCurrentSnapshot,
  snapshotAccessRules,
  snapshotAuthentication,
  snapshotWebSearchEngines,
  snapshotOpenSearch,
  snapshotIntegrationSecurity,
  snapshotEmailNotifications,
  snapshotFeedback,
  snapshotAlerts,
  snapshotRating,
  snapshotDefaultUserRoles,
  snapshotLanguages,
  snapshotLegalTerms,
  snapshotPrettyUrl,
  snapshotSources,
  snapshotSourcesFull,
  snapshotIntegrationSecurityFull,
  snapshotVocabularies,
  snapshotEnrichAndClean,
  snapshotDitaOt,
  snapshotApiKeys,
  snapshotTileIcons,
  snapshotGeneralPortalParameters,
  serialiseMetadataKeysList,
};
