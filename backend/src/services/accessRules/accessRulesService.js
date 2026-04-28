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

// Privileged tier roles & administrative roles that bypass every rule.
function userCanBypass(user) {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  const adminRoles = Array.isArray(user.adminRoles) ? user.adminRoles : [];
  return adminRoles.includes('KHUB_ADMIN') || adminRoles.includes('CONTENT_PUBLISHER');
}

function userGroupIdSet(user) {
  if (!user) return new Set();
  const ids = (user.groups || []).map((g) => (g?._id ? g._id.toString() : g.toString()));
  return new Set(ids);
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
    const userGroupNames = user?.groupNames instanceof Set ? user.groupNames : new Set();
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

// Build a flat metaBag from a topic's metadata sub-doc + parent document.
function buildMetaBagForTopic(topic, document) {
  const bag = {};
  const t = topic || {};
  const d = document || {};
  const tMeta = t.metadata || {};
  const dMeta = d.metadata || {};

  if (Array.isArray(tMeta.tags))    bag.tags = tMeta.tags.slice();
  if (Array.isArray(dMeta.tags)) {
    bag.tags = (bag.tags || []).concat(dMeta.tags);
  }
  if (tMeta.product)  bag.product  = [tMeta.product];
  if (tMeta.language) bag.language = [tMeta.language];
  if (tMeta.author)   bag.author   = [tMeta.author];
  if (dMeta.product)  bag.product  = (bag.product || []).concat([dMeta.product]);

  // Topic.metadata.custom is a Map<string, string[]>
  const custom = tMeta.custom;
  if (custom && typeof custom.forEach === 'function') {
    custom.forEach((vals, key) => {
      bag[key] = (bag[key] || []).concat(Array.isArray(vals) ? vals : [vals]);
    });
  } else if (custom && typeof custom === 'object') {
    for (const [k, v] of Object.entries(custom)) {
      bag[k] = (bag[k] || []).concat(Array.isArray(v) ? v : [v]);
    }
  }
  // Document.metadata.customFields is a Map<string, string>
  const cf = dMeta.customFields;
  if (cf && typeof cf.forEach === 'function') {
    cf.forEach((val, key) => {
      bag[key] = (bag[key] || []).concat([val]);
    });
  } else if (cf && typeof cf === 'object') {
    for (const [k, v] of Object.entries(cf)) {
      bag[k] = (bag[k] || []).concat([v]);
    }
  }

  // Synthesised "ft:" keys mirroring Fluid Topics' built-in metadata.
  if (d.title)            bag['ft:publication_title'] = [d.title];
  if (d.originalFilename) bag['ft:filename']          = [d.originalFilename];
  if (d.sourceFormat)     bag['ft:sourceName']        = [d.sourceFormat];
  if (typeof d.isAttachment === 'boolean') {
    bag['ft:isAttachment'] = [d.isAttachment ? 'True' : 'False'];
  }

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
  return false;
}

// In-memory evaluation: returns true if the supplied user can read the supplied
// topic (and its parent document). Privileged users always pass.
async function canUserAccessTopic(user, topic, document, opts = {}) {
  if (userCanBypass(user)) return true;
  const cfg = opts.cfg || (await AccessRulesConfig.getSingleton());
  const rules = opts.activeRules || (await AccessRule.find({
    status: 'Active',
    inactiveSet: false,
  }).populate('groups', 'name').lean());

  const metaBag = buildMetaBagForTopic(topic, document);
  const matching = rules.filter((r) => matchAllRequirements(r, metaBag));
  if (!matching.length) {
    return defaultRuleAllows(cfg, user);
  }
  // BRD: "If a document matches multiple rules, the less restrictive rule
  // takes precedence." → if ANY matching rule grants access, grant.
  for (const r of matching) {
    if (r.authMode === 'auto') {
      // Pre-compute the matching values for the auto key so the granter can
      // check user group membership by name.
      const autoVals = metaBag[r.autoBindKey] || [];
      const annotated = { ...r, _autoMatchedValues: autoVals };
      if (ruleGrantsAccessToUser(annotated, user)) return true;
    } else if (ruleGrantsAccessToUser(r, user)) {
      return true;
    }
  }
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
  buildMetaBagForTopic,
  matchAllRequirements,
  ruleGrantsAccessToUser,
  defaultRuleAllows,
  canUserAccessTopic,
  applyReprocess,
  activateEnhanced,
};
