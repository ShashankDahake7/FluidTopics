// -----------------------------------------------------------------------------
// Access-rules engine — evaluates, in memory and against MongoDB queries, the
// rules defined under /admin/access-rules. Mirrors the BRD:
//
//   - "ADMIN, KHUB_ADMIN, and CONTENT_PUBLISHER users can see all content,
//      including documents for which Access rules have been configured."
//   - "If a document matches several rules, the less restrictive rule takes
//      precedence over the others."
//   - "Children topics inherit Access rules from their parent unless defined
//      otherwise."
//
// The evaluator works on the *Active* rule set (status === 'Active'). Pending
// changes (New/Modified/Deleted) only become visible after an admin clicks
// "Apply and reprocess".
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');
const AccessRule       = require('../../models/AccessRule');
const AccessRulesConfig = require('../../models/AccessRulesConfig');
const Group            = require('../../models/Group');
const Document         = require('../../models/Document');
const Topic            = require('../../models/Topic');

// Privileged tier roles & administrative roles that bypass every rule.
function userCanBypass(user) {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  const adminRoles = Array.isArray(user.adminRoles) ? user.adminRoles : [];
  const apiKeyRoles = Array.isArray(user.roles) ? user.roles : [];
  return [...adminRoles, ...apiKeyRoles].includes('KHUB_ADMIN')
    || [...adminRoles, ...apiKeyRoles].includes('CONTENT_PUBLISHER')
    || apiKeyRoles.includes('ADMIN');
}

function userGroupIdSet(user) {
  if (!user) return new Set();
  const ids = (user.groups || []).map((g) => (g?._id ? g._id.toString() : g.toString()));
  return new Set(ids);
}

function userGroupNameSet(user) {
  if (!user) return new Set();
  if (user.groupNames instanceof Set) return user.groupNames;
  const names = [];
  for (const g of user.groups || []) {
    if (g && typeof g === 'object' && g.name) names.push(g.name);
    if (typeof g === 'string' && !mongoose.isValidObjectId(g)) names.push(g);
  }
  return new Set(names);
}

async function hydrateAccessUser(user) {
  if (!user) return null;
  if (user.groupNames instanceof Set) return user;
  const hydrated = { ...(user.toObject ? user.toObject() : user) };
  const ids = [];
  const names = [];
  for (const g of hydrated.groups || []) {
    if (g && typeof g === 'object' && g.name) names.push(g.name);
    const raw = g?._id ? String(g._id) : String(g || '');
    if (mongoose.isValidObjectId(raw)) ids.push(raw);
    else if (raw) names.push(raw);
  }
  if (ids.length) {
    const groups = await Group.find({ _id: { $in: ids } }).select('name').lean();
    groups.forEach((g) => names.push(g.name));
  }
  hydrated.groupNames = new Set(names.filter(Boolean));
  return hydrated;
}

// --- Requirement matching --------------------------------------------------
// `metaBag` is a flat object: { key: [values] } gathered from a topic/document
// (Topic.metadata.custom + Topic.metadata.tags + ft:* synthetic keys).
function matchRequirement(req, metaBag) {
  const present = metaBag[req.key];
  if (!Array.isArray(present) || present.length === 0) return false;
  if (req.op === 'all') {
    return req.values.every((v) => present.includes(v));
  }
  if (req.op === 'equals') {
    return req.values.length === present.length
      && req.values.every((v) => present.includes(v));
  }
  // 'any' (default)
  return req.values.some((v) => present.includes(v));
}

function matchAllRequirements(rule, metaBag) {
  if (!rule.requirements?.length) return true; // unconstrained rule (e.g. default)
  if (rule.requirementsMode === 'all') {
    return rule.requirements.every((r) => matchRequirement(r, metaBag));
  }
  return rule.requirements.some((r) => matchRequirement(r, metaBag));
}

function ruleGrantsAccessToUser(rule, user) {
  if (rule.authMode === 'everyone')      return true;
  if (rule.authMode === 'authenticated') return !!user;
  if (rule.authMode === 'auto') {
    // Auto-bind: a synthesised group named after the metadata value. If the
    // user is in a Group whose `name` matches one of the metadata values for
    // the rule's autoBindKey, grant. Group resolution is left to the caller
    // who supplies user.groupNames as a Set.
    const autoVals = (rule._autoMatchedValues) || []; // populated by caller
    const userGroupNames = userGroupNameSet(user);
    return autoVals.some((v) => userGroupNames.has(v));
  }
  if (rule.authMode === 'groups') {
    const userGids = userGroupIdSet(user);
    if (!userGids.size) return false;
    return (rule.groups || []).some((gid) => userGids.has(
      (gid?._id ? gid._id.toString() : gid.toString())
    ));
  }
  return false;
}

function addValues(bag, key, values) {
  if (!key) return;
  const arr = Array.isArray(values) ? values : [values];
  const clean = arr
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v));
  if (clean.length) bag[key] = (bag[key] || []).concat(clean);
}

function addMapValues(bag, mapLike) {
  if (!mapLike) return;
  if (typeof mapLike.forEach === 'function') {
    mapLike.forEach((val, key) => addValues(bag, key, val));
    return;
  }
  if (typeof mapLike === 'object') {
    for (const [key, val] of Object.entries(mapLike)) addValues(bag, key, val);
  }
}

function buildMetaBagForDocument(document) {
  const bag = {};
  const d = document || {};
  const dMeta = d.metadata || {};

  addValues(bag, 'tags', dMeta.tags);
  addValues(bag, 'product', dMeta.product);
  addValues(bag, 'version', dMeta.version);
  addValues(bag, 'language', d.language || dMeta.language);
  addValues(bag, 'author', dMeta.author);
  addMapValues(bag, dMeta.customFields);

  // Synthesised "ft:" keys mirroring Fluid Topics' built-in metadata.
  addValues(bag, 'ft:publication_title', d.publication?.portalTitle || d.title);
  addValues(bag, 'ft:filename', d.originalFilename || d.title);
  addValues(bag, 'ft:sourceName', d.sourceFormat || d.mimeType);
  if (typeof d.isAttachment === 'boolean') addValues(bag, 'ft:isAttachment', d.isAttachment ? 'True' : 'False');

  return bag;
}

// Build a flat metaBag from a topic's metadata sub-doc + parent document.
function buildMetaBagForTopic(topic, document) {
  const bag = buildMetaBagForDocument(document);
  const t = topic || {};
  const tMeta = t.metadata || {};

  addValues(bag, 'tags', tMeta.tags);
  addValues(bag, 'product', tMeta.product);
  addValues(bag, 'version', tMeta.version);
  addValues(bag, 'language', tMeta.language);
  addValues(bag, 'author', tMeta.author);

  // Topic.metadata.custom is a Map<string, string[]>
  addMapValues(bag, tMeta.custom);
  addValues(bag, 'ft:title', t.title);
  addValues(bag, 'ft:slug', t.slug);
  addValues(bag, 'ft:originId', t.originId);
  addValues(bag, 'ft:permalink', t.permalink);

  return bag;
}

// Default rule resolver. Returns true if the *default* rule grants access to
// the supplied user.
function defaultRuleAllows(cfg, user) {
  const def = (cfg.mode === 'legacy' ? cfg.legacyDefaultGroup : cfg.defaultRule) || 'public';
  if (def === 'public')        return true;
  if (def === 'authenticated') return !!user;
  if (def === 'none')          return userCanBypass(user); // only privileged
  // Otherwise: a group id/name. Allow if user is in that group.
  const userGids = userGroupIdSet(user);
  if (mongoose.isValidObjectId(def) && userGids.has(def)) return true;
  if (userGroupNameSet(user).has(def)) return true;
  return false;
}

function ruleAppliesToDocuments(rule, cfg) {
  if (cfg.mode !== 'enhanced' || !cfg.topicLevelEnabled) return true;
  return !rule.targetTopics;
}

function ruleAppliesToTopics(rule, cfg) {
  return cfg.mode === 'enhanced' && cfg.topicLevelEnabled && !!rule.targetTopics;
}

function evaluateMatchingRules(rules, metaBag, user) {
  const matching = rules.filter((r) => matchAllRequirements(r, metaBag));
  if (!matching.length) return null;
  for (const r of matching) {
    if (r.authMode === 'auto') {
      const autoVals = metaBag[r.autoBindKey] || [];
      if (ruleGrantsAccessToUser({ ...r, _autoMatchedValues: autoVals }, user)) return true;
    } else if (ruleGrantsAccessToUser(r, user)) {
      return true;
    }
  }
  return false;
}

async function loadAccessContext(user, opts = {}) {
  const cfg = opts.cfg || (await AccessRulesConfig.getSingleton());
  const activeRules = opts.activeRules || (await AccessRule.find({
    status: 'Active',
    inactiveSet: false,
  }).populate('groups', 'name').lean());
  return {
    cfg,
    activeRules,
    user: await hydrateAccessUser(user),
  };
}

async function canUserAccessDocument(user, document, opts = {}) {
  if (userCanBypass(user)) return true;
  const ctx = opts.ctx || (await loadAccessContext(user, opts));
  const docRules = ctx.activeRules.filter((r) => ruleAppliesToDocuments(r, ctx.cfg));
  const decision = evaluateMatchingRules(docRules, buildMetaBagForDocument(document), ctx.user);
  return decision === null ? defaultRuleAllows(ctx.cfg, ctx.user) : decision;
}

async function topicRuleDecisionFromAncestors(topic, document, ctx, opts = {}) {
  const topicRules = ctx.activeRules.filter((r) => ruleAppliesToTopics(r, ctx.cfg));
  if (!topicRules.length) return null;

  let current = topic;
  const seen = new Set();
  for (let depth = 0; current && depth < 25; depth += 1) {
    const key = String(current._id || current.id || '');
    if (key && seen.has(key)) break;
    if (key) seen.add(key);
    const decision = evaluateMatchingRules(topicRules, buildMetaBagForTopic(current, document), ctx.user);
    if (decision !== null) return decision;

    const parentId = current.hierarchy?.parent;
    if (!parentId) break;
    const parentKey = String(parentId._id || parentId);
    if (opts.topicById && opts.topicById.has(parentKey)) {
      current = opts.topicById.get(parentKey);
    } else {
      current = await Topic.findById(parentKey).select('title slug metadata hierarchy documentId originId permalink').lean();
    }
  }
  return null;
}

// In-memory evaluation: returns true if the supplied user can read the supplied
// topic (and its parent document). Privileged users always pass.
async function canUserAccessTopic(user, topic, document, opts = {}) {
  if (userCanBypass(user)) return true;
  const ctx = opts.ctx || (await loadAccessContext(user, opts));
  const docAllowed = await canUserAccessDocument(ctx.user, document, { ctx });
  if (!docAllowed) return false;
  const topicDecision = await topicRuleDecisionFromAncestors(topic, document, ctx, opts);
  return topicDecision === null ? true : topicDecision;
}

async function filterTopicsForUser(topics, user, opts = {}) {
  if (!Array.isArray(topics) || topics.length === 0) return [];
  if (userCanBypass(user)) return topics;
  const ctx = opts.ctx || (await loadAccessContext(user, opts));
  const docIds = Array.from(new Set(topics.map((t) => String(t.documentId)).filter(Boolean)));
  const docs = opts.docById
    ? []
    : await Document.find({ _id: { $in: docIds } }).select('title originalFilename sourceFormat metadata publication language').lean();
  const docById = opts.docById || new Map(docs.map((d) => [String(d._id), d]));
  const topicById = opts.topicById || new Map(topics.map((t) => [String(t._id), t]));

  const visible = [];
  for (const topic of topics) {
    const doc = docById.get(String(topic.documentId));
    if (doc && await canUserAccessTopic(ctx.user, topic, doc, { ctx, topicById })) visible.push(topic);
  }
  return visible;
}

async function filterDocumentsForUser(documents, user, opts = {}) {
  if (!Array.isArray(documents) || documents.length === 0) return [];
  if (userCanBypass(user)) return documents;
  const ctx = opts.ctx || (await loadAccessContext(user, opts));
  const visible = [];
  for (const document of documents) {
    if (await canUserAccessDocument(ctx.user, document, { ctx })) visible.push(document);
  }
  return visible;
}

async function filterSearchHitsForUser(hits, user, opts = {}) {
  if (!Array.isArray(hits) || hits.length === 0) return [];
  if (userCanBypass(user)) return hits;
  const topicIds = hits.map((h) => h.topicId || h._id || h.id).filter(Boolean);
  const topics = await Topic.find({ _id: { $in: topicIds } })
    .select('title slug metadata hierarchy documentId originId permalink')
    .lean();
  const topicById = new Map(topics.map((t) => [String(t._id), t]));
  const visibleTopics = await filterTopicsForUser(topics, user, opts);
  const visibleIds = new Set(visibleTopics.map((t) => String(t._id)));
  return hits.filter((h) => {
    const id = String(h.topicId || h._id || h.id || '');
    return topicById.has(id) && visibleIds.has(id);
  });
}

async function requireDocumentAccess(req, res, document, opts = {}) {
  if (await canUserAccessDocument(req.user, document, opts)) return true;
  res.status(req.user ? 403 : 401).json({ error: 'Access denied by access rules.' });
  return false;
}

async function requireTopicAccess(req, res, topic, document, opts = {}) {
  if (await canUserAccessTopic(req.user, topic, document, opts)) return true;
  res.status(req.user ? 403 : 401).json({ error: 'Access denied by access rules.' });
  return false;
}

// Apply pending changes — mirrors "Apply and reprocess" in the BRD. Returns a
// summary of what changed.
async function applyReprocess(actor) {
  const now = new Date();
  const cfg = await AccessRulesConfig.getSingleton();

  // Promote the inactive draft set first (used during legacy → enhanced
  // migration). Drafts skip 'Processing' because they were never live.
  const draftToActivate = await AccessRule.find({ inactiveSet: true });
  for (const r of draftToActivate) {
    r.inactiveSet = false;
    r.status      = 'Active';
    r.lastReprocessAt = now;
    r.lastReprocessBy = actor?._id || null;
    r.lastReprocessByName = actor?.name || actor?.email || '';
    await r.save();
  }

  // Promote New/Modified through Processing → Active.
  const pending = await AccessRule.find({ status: { $in: ['New', 'Modified', 'Processing'] }, inactiveSet: false });
  for (const r of pending) {
    r.status            = 'Active';
    r.lastReprocessAt   = now;
    r.lastReprocessBy   = actor?._id || null;
    r.lastReprocessByName = actor?.name || actor?.email || '';
    await r.save();
  }
  // Purge soft-deleted rules.
  const purge = await AccessRule.deleteMany({ status: 'Deleted' });

  cfg.lastReprocessAt = now;
  cfg.lastReprocessBy = actor?._id || null;
  cfg.lastReprocessByName = actor?.name || actor?.email || '';
  await cfg.save();

  return {
    promoted: pending.length + draftToActivate.length,
    purged:   purge.deletedCount || 0,
    at:       now,
  };
}

// One-way switch from legacy → enhanced. Wipes legacy rules, flips the mode,
// then promotes any draft rules.
async function activateEnhanced(actor) {
  const cfg = await AccessRulesConfig.getSingleton();
  if (cfg.mode === 'enhanced') {
    return { alreadyEnhanced: true };
  }
  // Drop everything that was in the legacy set.
  await AccessRule.deleteMany({ inactiveSet: false });
  cfg.mode = 'enhanced';
  await cfg.save();
  const summary = await applyReprocess(actor);
  return { ...summary, switched: true };
}

module.exports = {
  userCanBypass,
  hydrateAccessUser,
  loadAccessContext,
  buildMetaBagForDocument,
  buildMetaBagForTopic,
  matchAllRequirements,
  ruleGrantsAccessToUser,
  defaultRuleAllows,
  canUserAccessDocument,
  canUserAccessTopic,
  filterDocumentsForUser,
  filterTopicsForUser,
  filterSearchHitsForUser,
  requireDocumentAccess,
  requireTopicAccess,
  applyReprocess,
  activateEnhanced,
};
