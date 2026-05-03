const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const AccessRule        = require('../models/AccessRule');
const AccessRulesConfig = require('../models/AccessRulesConfig');
const Group             = require('../models/Group');
const Topic             = require('../models/Topic');
const Document          = require('../models/Document');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const MetadataKey       = require('../models/MetadataKey');
const { writeAudit, diffContext } = require('../services/users/auditService');
const {
  applyReprocess,
  activateEnhanced,
} = require('../services/accessRules/accessRulesService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotAccessRules } = require('../services/configHistorySnapshots');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorisation — superadmin/admin tier OR KHUB_ADMIN administrative role.
// CONTENT_PUBLISHER does not get write access (it only bypasses rules at read
// time per the BRD).
// ---------------------------------------------------------------------------
function requireKhubAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();
  const adminRoles = Array.isArray(req.user.adminRoles) ? req.user.adminRoles : [];
  if (adminRoles.includes('KHUB_ADMIN')) return next();
  return res.status(403).json({ error: 'KHUB_ADMIN role required.' });
}

router.use(auth, requireKhubAdmin);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function actorMeta(req) {
  return {
    id:    req.user?._id || null,
    name:  req.user?.name || '',
    email: req.user?.email || '',
  };
}

function sanitizeRequirements(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((r) => ({
      key:    String(r?.key || '').trim(),
      op:     ['any', 'all', 'equals'].includes(r?.op) ? r.op : 'any',
      values: Array.isArray(r?.values)
        ? r.values.map((v) => String(v ?? '').trim()).filter(Boolean)
        : [],
    }))
    .filter((r) => r.key && r.values.length);
}

function publicRule(rule) {
  if (!rule) return rule;
  const obj = rule.toObject ? rule.toObject() : rule;
  return {
    id:                 String(obj._id),
    name:               obj.name || '',
    description:        obj.description || '',
    requirements:       obj.requirements || [],
    requirementsMode:   obj.requirementsMode || 'any',
    authMode:           obj.authMode || 'groups',
    groups:             (obj.groups || []).map((g) =>
      typeof g === 'object' && g.name ? { id: String(g._id || g.id), name: g.name } : { id: String(g) }),
    autoBindKey:        obj.autoBindKey || '',
    targetTopics:       !!obj.targetTopics,
    status:             obj.status || 'New',
    inactiveSet:        !!obj.inactiveSet,
    createdAt:          obj.createdAt,
    updatedAt:          obj.updatedAt,
    author:             { name: obj.createdByName || '', email: obj.createdByEmail || '' },
    lastUpdatedBy:      { name: obj.updatedByName || '', email: obj.updatedByEmail || '' },
    lastReprocessAt:    obj.lastReprocessAt || null,
    lastReprocessBy:    obj.lastReprocessByName || '',
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/access-rules — full snapshot used by the admin page.
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const cfg = await AccessRulesConfig.getSingleton();
    const rules = await AccessRule.find({}).populate('groups', 'name').sort({ createdAt: 1 }).lean();
    res.json({
      config: {
        mode:                cfg.mode,
        defaultRule:         cfg.defaultRule,
        legacyDefaultGroup:  cfg.legacyDefaultGroup,
        topicLevelEnabled:   cfg.topicLevelEnabled,
        lastReprocessAt:     cfg.lastReprocessAt,
        lastReprocessBy:     cfg.lastReprocessByName,
      },
      rules: rules.map(publicRule),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/access-rules/config — toggle mode-agnostic config (default
// rule, topic-level switch). Mode flips happen via dedicated endpoints.
// ---------------------------------------------------------------------------
router.put('/config', async (req, res, next) => {
  try {
    const cfg = await AccessRulesConfig.getSingleton();
    const snapBefore = await snapshotAccessRules();
    const before = {
      defaultRule:        cfg.defaultRule,
      legacyDefaultGroup: cfg.legacyDefaultGroup,
      topicLevelEnabled:  cfg.topicLevelEnabled,
    };
    const body = req.body || {};
    if (typeof body.defaultRule === 'string')        cfg.defaultRule        = body.defaultRule;
    if (typeof body.legacyDefaultGroup === 'string') cfg.legacyDefaultGroup = body.legacyDefaultGroup;
    if (typeof body.topicLevelEnabled === 'boolean') cfg.topicLevelEnabled  = body.topicLevelEnabled;
    await cfg.save();

    await writeAudit(req, {
      action: 'access-rules.config.update',
      summary: 'Updated access-rules config',
      context: diffContext(before, {
        defaultRule:        cfg.defaultRule,
        legacyDefaultGroup: cfg.legacyDefaultGroup,
        topicLevelEnabled:  cfg.topicLevelEnabled,
      }, ['defaultRule', 'legacyDefaultGroup', 'topicLevelEnabled']),
    });

    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    res.json({ ok: true, config: cfg });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/access-rules/rules — create a new rule (status: New). When
// the system is still in legacy mode the rule is parked in `inactiveSet` so
// admins can stage their replacement set before flipping the switch.
// ---------------------------------------------------------------------------
router.post('/rules', async (req, res, next) => {
  try {
    const cfg = await AccessRulesConfig.getSingleton();
    const body = req.body || {};
    const actor = actorMeta(req);
    const snapBefore = await snapshotAccessRules();

    const rule = await AccessRule.create({
      name:             String(body.name || '').trim(),
      description:      String(body.description || '').trim(),
      requirements:     sanitizeRequirements(body.requirements),
      requirementsMode: ['all', 'any'].includes(body.requirementsMode) ? body.requirementsMode : 'any',
      authMode:         ['everyone', 'authenticated', 'groups', 'auto'].includes(body.authMode) ? body.authMode : 'groups',
      groups:           Array.isArray(body.groups) ? body.groups.filter((id) => mongoose.isValidObjectId(id)) : [],
      autoBindKey:      String(body.autoBindKey || '').trim(),
      targetTopics:     !!body.targetTopics,
      status:           'New',
      inactiveSet:      cfg.mode === 'legacy' && body.draftSet === true,
      createdBy:        actor.id, createdByName: actor.name, createdByEmail: actor.email,
      updatedBy:        actor.id, updatedByName: actor.name, updatedByEmail: actor.email,
    });

    await writeAudit(req, {
      action: 'access-rules.rule.create',
      summary: `Created access rule "${rule.name || rule._id}"`,
      context: { ruleId: String(rule._id), inactiveSet: rule.inactiveSet },
    });

    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    const populated = await rule.populate('groups', 'name');
    res.status(201).json(publicRule(populated));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/access-rules/rules/:id — update; status → Modified unless the
// rule was still in the inactive draft set.
// ---------------------------------------------------------------------------
router.put('/rules/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid rule id.' });
    }
    const rule = await AccessRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found.' });

    const snapBefore = await snapshotAccessRules();
    const before = rule.toObject();
    const body = req.body || {};
    const actor = actorMeta(req);

    if (typeof body.name === 'string')        rule.name        = body.name.trim();
    if (typeof body.description === 'string') rule.description = body.description.trim();
    if (Array.isArray(body.requirements))     rule.requirements = sanitizeRequirements(body.requirements);
    if (['all', 'any'].includes(body.requirementsMode))     rule.requirementsMode = body.requirementsMode;
    if (['everyone', 'authenticated', 'groups', 'auto'].includes(body.authMode)) rule.authMode = body.authMode;
    if (Array.isArray(body.groups))           rule.groups = body.groups.filter((id) => mongoose.isValidObjectId(id));
    if (typeof body.autoBindKey === 'string') rule.autoBindKey = body.autoBindKey.trim();
    if (typeof body.targetTopics === 'boolean') rule.targetTopics = body.targetTopics;

    if (!rule.inactiveSet) {
      rule.status = rule.status === 'New' ? 'New' : 'Modified';
    }
    rule.updatedBy      = actor.id;
    rule.updatedByName  = actor.name;
    rule.updatedByEmail = actor.email;
    await rule.save();

    await writeAudit(req, {
      action: 'access-rules.rule.update',
      summary: `Updated access rule "${rule.name || rule._id}"`,
      context: diffContext(before, rule.toObject(),
        ['name', 'description', 'requirements', 'requirementsMode', 'authMode', 'groups', 'autoBindKey', 'targetTopics']),
    });

    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    const populated = await rule.populate('groups', 'name');
    res.json(publicRule(populated));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/access-rules/rules/:id — soft-delete (status → Deleted)
// when the rule is part of the live set; hard-delete drafts.
// ---------------------------------------------------------------------------
router.delete('/rules/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid rule id.' });
    }
    const rule = await AccessRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found.' });

    const snapBefore = await snapshotAccessRules();
    const summary = `Deleted access rule "${rule.name || rule._id}"`;
    if (rule.inactiveSet || rule.status === 'New') {
      await rule.deleteOne();
    } else {
      rule.status = 'Deleted';
      await rule.save();
    }

    await writeAudit(req, {
      action: 'access-rules.rule.delete',
      summary,
      context: { ruleId: String(rule._id) },
    });

    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/access-rules/reprocess — promote pending changes to Active
// and purge tombstoned rules. Returns a summary the UI can render in the
// footer "Last reprocess by …" panel.
// ---------------------------------------------------------------------------
router.post('/reprocess', async (req, res, next) => {
  try {
    const snapBefore = await snapshotAccessRules();
    const summary = await applyReprocess(req.user);
    await writeAudit(req, {
      action: 'access-rules.reprocess',
      summary: `Reprocessed access rules — promoted ${summary.promoted}, purged ${summary.purged}`,
      context: summary,
    });
    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json({ ok: true, ...summary });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/admin/access-rules/activate-enhanced — one-way switch from legacy
// to enhanced mode. Wipes legacy rules per the BRD ("Once enhanced Access
// rules are active, Fluid Topics deletes all the previous rules.").
// ---------------------------------------------------------------------------
router.post('/activate-enhanced', async (req, res, next) => {
  try {
    const snapBefore = await snapshotAccessRules();
    const result = await activateEnhanced(req.user);
    await writeAudit(req, {
      action: 'access-rules.activate-enhanced',
      summary: result.alreadyEnhanced
        ? 'Activate enhanced — already enhanced (no-op)'
        : 'Switched to enhanced access rules; legacy rules deleted',
      context: result,
    });
    const snapAfter = await snapshotAccessRules();
    await logConfigChange({
      category: 'Access rules',
      ...authorFromRequest(req),
      before: snapBefore,
      after: snapAfter,
    });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/access-rules/metadata-keys — distinct metadata keys gathered
// from the topic corpus, used by the rule editor's autocomplete.
// ---------------------------------------------------------------------------
router.get('/metadata-keys', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const topicKeys = await Topic.aggregate([
      { $project: { keys: { $objectToArray: { $ifNull: ['$metadata.custom', {}] } }, tags: '$metadata.tags' } },
      { $project: { keys: '$keys.k', tags: 1 } },
      { $unwind: { path: '$keys', preserveNullAndEmptyArrays: true } },
    ]).allowDiskUse(true);
    const documentKeys = await Document.aggregate([
      { $project: { keys: { $objectToArray: { $ifNull: ['$metadata.customFields', {}] } } } },
      { $project: { keys: '$keys.k' } },
      { $unwind: { path: '$keys', preserveNullAndEmptyArrays: true } },
    ]).allowDiskUse(true);

    const set = new Set([
      'tags', 'product', 'version', 'language', 'author',
      'ft:publication_title', 'ft:filename', 'ft:sourceName', 'ft:isAttachment',
    ]);
    const registryKeys = await MetadataKey.find({}).select('name displayName').lean();
    for (const row of registryKeys) {
      if (row.displayName) set.add(row.displayName);
      else if (row.name) set.add(row.name);
    }
    for (const row of [...topicKeys, ...documentKeys]) {
      if (row.keys) set.add(row.keys);
    }
    res.json({ keys: Array.from(set).sort() });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/access-rules/metadata-values?key=... — distinct values for a
// given metadata key.
// ---------------------------------------------------------------------------
router.get('/metadata-values', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const key = String(req.query.key || '').trim();
    if (!key) return res.json({ values: [] });

    let values = [];
    if (key === 'tags') {
      values = [
        ...(await Topic.distinct('metadata.tags')),
        ...(await Document.distinct('metadata.tags')),
        ...(await UnstructuredDocument.distinct('metadata.tags')),
      ];
    } else if (['product', 'version', 'language', 'author'].includes(key)) {
      values = [
        ...(await Topic.distinct(`metadata.${key}`)),
        ...(await Document.distinct(key === 'language' ? 'language' : `metadata.${key}`)),
        ...(await UnstructuredDocument.distinct(`metadata.${key}`)),
      ];
    } else if (key === 'ft:publication_title') {
      values = [
        ...(await Document.distinct('title')),
        ...(await UnstructuredDocument.distinct('title')),
      ];
    } else if (key === 'ft:filename') {
      values = await Document.distinct('originalFilename');
    } else if (key === 'ft:sourceName') {
      values = [
        ...(await Document.distinct('sourceFormat')),
        ...(await UnstructuredDocument.distinct('mimeType')),
      ];
    } else if (key === 'ft:isAttachment') {
      values = ['True', 'False'];
    } else {
      const registry = await MetadataKey.findOne({
        name: key.toLowerCase(),
      }).select('valuesSample').lean();
      const topicValues = await Topic.aggregate([
        { $project: { v: { $ifNull: [{ $getField: { field: key, input: '$metadata.custom' } }, []] } } },
        { $unwind: '$v' },
        { $group: { _id: '$v' } },
      ]).allowDiskUse(true);
      const documentValues = await Document.aggregate([
        { $project: { v: { $ifNull: [{ $getField: { field: key, input: '$metadata.customFields' } }, null] } } },
        { $match: { v: { $ne: null } } },
        { $group: { _id: '$v' } },
      ]).allowDiskUse(true);
      values = [
        ...((registry?.valuesSample || [])),
        ...topicValues.map((d) => d._id),
        ...documentValues.map((d) => d._id),
      ].filter((v) => v != null);
    }
    res.json({
      key,
      values: Array.from(new Set(values.map((v) => String(v)).filter(Boolean))).sort(),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/admin/access-rules/groups — surface the user-group catalogue under
// this router so KHUB_ADMIN-only users can populate the rule editor without
// requiring admin tier on /api/groups.
// ---------------------------------------------------------------------------
router.get('/groups', async (req, res, next) => {
  try {
    const groups = await Group.find({}).sort({ name: 1 }).select('name description').lean();
    res.json({ groups });
  } catch (err) { next(err); }
});

module.exports = router;
