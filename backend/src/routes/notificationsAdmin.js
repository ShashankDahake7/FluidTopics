const express = require('express');
const mongoose = require('mongoose');

const { auth, optionalAuth } = require('../middleware/auth');
const RatingRulesConfig = require('../models/RatingRulesConfig');
const AlertsConfig = require('../models/AlertsConfig');
const MetadataKey = require('../models/MetadataKey');
const ratingRulesService = require('../services/ratings/ratingRules');
const { writeAudit, diffContext } = require('../services/users/auditService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorisation. The BRD spec for both pages is identical: "ADMIN and
// PORTAL_ADMIN users". We honour the existing tier ladder (superadmin/admin)
// plus the explicit PORTAL_ADMIN administrative-role escape hatch the user
// management module already supports.
// ---------------------------------------------------------------------------
function isAdminTier(req) {
  return req.user?.role === 'superadmin' || req.user?.role === 'admin';
}
function hasAdminRole(req, role) {
  const arr = Array.isArray(req.user?.adminRoles) ? req.user.adminRoles : [];
  return arr.includes(role);
}
function requirePortalOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (isAdminTier(req) || hasAdminRole(req, 'PORTAL_ADMIN')) return next();
  return res.status(403).json({ error: 'ADMIN or PORTAL_ADMIN role required.' });
}

// ---------------------------------------------------------------------------
// Shared metadata vocabulary. Mirrors the keys the frontend dropdowns use, so
// what the admin sees in the typeahead matches what they can validate
// against here. Custom MetadataKey rows are merged in for tenant-specific
// fields the parser has discovered.
// ---------------------------------------------------------------------------
const BUILTIN_METADATA_KEYS = [
  'author_personname', 'authorgroup_author_personname', 'copyright',
  'Created_by', 'creationDate', 'data_origin_id', 'ft:alertTimestamp',
  'ft:attachmentsSize', 'ft:baseId', 'ft:clusterId', 'ft:container',
  'ft:contentSize', 'ft:document_type', 'ft:editorialType', 'ft:filename',
  'ft:isArticle', 'ft:isAttachment', 'ft:isBook', 'ft:isHtmlPackage',
  'ft:isPublication', 'ft:isSynchronousAttachment', 'ft:isUnstructured',
  'ft:khubVersion', 'ft:lastEdition', 'ft:lastPublication',
  'ft:lastTechChange', 'ft:lastTechChangeTimestamp', 'ft:locale',
  'ft:mimeType', 'ft:openMode', 'ft:originId', 'ft:prettyUrl',
  'ft:publication_title', 'ft:publicationId', 'ft:publishStatus',
  'ft:publishUploadId', 'ft:searchableFromInt', 'ft:sourceCategory',
  'ft:sourceId', 'ft:sourceName', 'ft:sourceType', 'ft:structure',
  'ft:title', 'ft:tocPosition', 'ft:topicTitle', 'ft:wordCount',
  'generator', 'Key', 'Module', 'Name', 'paligo:resourceTitle',
  'paligo:resourceTitleLabel', 'publicationDate', 'Release_Notes',
  'subtitle', 'Taxonomy', 'title',
];

async function listMetadataKeys() {
  let custom = [];
  try {
    const rows = await MetadataKey.find({}, 'name displayName').lean();
    custom = rows.map((r) => r.displayName || r.name).filter(Boolean);
  } catch { /* MetadataKey collection optional */ }

  const seen = new Set();
  const merged = [];
  for (const k of [...BUILTIN_METADATA_KEYS, ...custom]) {
    const key = String(k || '').trim();
    if (!key) continue;
    const lk = key.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    merged.push(key);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// RATING — sanitisers + serialisers
// ---------------------------------------------------------------------------
const RATING_TYPES = RatingRulesConfig.RATING_TYPES;
const TOPIC_LEVEL_VALUES = ['Rate together', 'Rate individually', 'Do not rate'];

function sanitizeRule(input, idx) {
  if (!input || typeof input !== 'object') {
    throw new Error(`Rule #${idx + 1} must be an object.`);
  }
  const docType = String(input.docType || 'Stars');
  const topicType = String(input.topicType || 'Stars');
  if (!RATING_TYPES.includes(docType)) {
    throw new Error(`Rule #${idx + 1}: invalid document rating type "${docType}".`);
  }
  if (!RATING_TYPES.includes(topicType)) {
    throw new Error(`Rule #${idx + 1}: invalid topic rating type "${topicType}".`);
  }

  let topicLevels = Array.isArray(input.topicLevels) ? input.topicLevels.slice(0, 4) : [];
  topicLevels = topicLevels.map((v) => String(v || '').trim()).filter(Boolean);
  for (const v of topicLevels) {
    if (!TOPIC_LEVEL_VALUES.includes(v)) {
      throw new Error(`Rule #${idx + 1}: invalid topic level "${v}".`);
    }
  }
  // Level 1 cannot be "Rate together" — there's no parent zone to inherit
  // from. Match the drawer's rule.
  if (topicLevels[0] === 'Rate together') topicLevels[0] = 'Rate individually';
  // No-rating topic types collapse the per-level config (the drawer hides
  // the zone editor in that branch).
  if (topicType === 'No rating') topicLevels = [];

  const rawReqs = Array.isArray(input.metaReqs) ? input.metaReqs : [];
  const metaReqs = rawReqs
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const key = String(r.key || '').trim();
      if (!key) return null;
      const value = r.value === undefined || r.value === null ? '' : String(r.value);
      return { key, value };
    })
    .filter(Boolean);

  return { docType, topicType, topicLevels, metaReqs };
}

function publicRatingConfig(cfg) {
  if (!cfg) return null;
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    rules: (obj.rules || []).map((r) => ({
      docType:     r.docType,
      topicType:   r.topicType,
      topicLevels: Array.isArray(r.topicLevels) ? r.topicLevels : [],
      metaReqs:    Array.isArray(r.metaReqs)
        ? r.metaReqs.map((m) => ({ key: m.key, value: m.value }))
        : [],
    })),
    updatedAt: obj.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// ALERTS — sanitisers + serialisers
// ---------------------------------------------------------------------------
function sanitizeMetadataKeys(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error('Metadata keys must be an array of strings.');
  }
  const out = [];
  const seen = new Set();
  for (const v of input) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (s.length > 200) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function sanitizeRecurrenceDays(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error('Recurrence days must be an array of weekday names.');
  }
  // Sort canonical Mon→Sun so the audit diff is order-independent.
  const order = AlertsConfig.DAYS;
  const seen = new Set();
  for (const v of input) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (!order.includes(s)) {
      throw new Error(`"${s}" is not a valid weekday name.`);
    }
    seen.add(s);
  }
  return order.filter((d) => seen.has(d));
}

function publicAlertsConfig(cfg) {
  if (!cfg) return null;
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  return {
    matchMode:         obj.matchMode || 'any',
    recurrenceDays:    Array.isArray(obj.recurrenceDays) ? obj.recurrenceDays : [],
    bodyMetadataKeys:  Array.isArray(obj.bodyMetadataKeys) ? obj.bodyMetadataKeys : [],
    updatedAt:         obj.updatedAt,
  };
}

// ===========================================================================
// PUBLIC ENDPOINTS — used by the user-facing rating widget so it can render
// the right control (stars / like / yes-no) for the document being read.
// ===========================================================================

router.get('/portal/rating-rules/applicable', optionalAuth, async (req, res, next) => {
  try {
    const { documentId, topicId, topicDepth } = req.query;
    let resolved;
    if (topicId && mongoose.isValidObjectId(topicId)) {
      resolved = await ratingRulesService.resolveRuleForTopic(topicId);
    } else if (documentId && mongoose.isValidObjectId(documentId)) {
      resolved = await ratingRulesService.resolveRuleForDocument(documentId);
    } else {
      // No id supplied — return the catch-all (last) rule so the caller
      // still gets the widget's default look.
      resolved = await ratingRulesService.resolveRuleForDocument(null);
    }

    const depth = Number.parseInt(topicDepth, 10) || 1;
    const topicForDepth = resolved.rule
      ? ratingRulesService.topicRatingForDepth(resolved.rule, depth)
      : { type: 'No rating', zoneDepth: 0 };

    // Surface the user's RATING_USER capability in the same payload so the
    // frontend can hide the widget without an additional round-trip.
    const userPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const canRate = userPermissions.includes('RATING_USER');

    res.json({
      documentRatingType: resolved.rule ? resolved.rule.docType : 'No rating',
      topicRatingType:    topicForDepth.type,
      topicZoneDepth:     topicForDepth.zoneDepth,
      ruleIndex:          resolved.ruleIndex,
      fallback:           resolved.fallback,
      canRate,
    });
  } catch (err) { next(err); }
});

// All admin routes require auth + the portal/admin gate.
router.use('/admin/notifications', auth);

// ===========================================================================
// RATING ADMIN
// ===========================================================================

router.get('/admin/notifications/rating', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await RatingRulesConfig.getSingleton();
    const settings = publicRatingConfig(cfg);
    const metadataKeys = await listMetadataKeys();
    res.json({
      settings,
      catalogue: {
        ratingTypes: RATING_TYPES,
        topicLevels: TOPIC_LEVEL_VALUES,
        metadataKeys,
      },
    });
  } catch (err) { next(err); }
});

router.put('/admin/notifications/rating', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.rules)) {
      return res.status(400).json({ error: 'rules must be an array.' });
    }
    if (body.rules.length === 0) {
      return res.status(400).json({ error: 'At least one rule is required.' });
    }
    if (body.rules.length > 50) {
      return res.status(400).json({ error: 'Too many rules (max 50).' });
    }

    let sanitized;
    try {
      sanitized = body.rules.map((r, i) => sanitizeRule(r, i));
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const cfg = await RatingRulesConfig.getSingleton();
    const before = publicRatingConfig(cfg);
    cfg.rules = sanitized;
    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();
    const after = publicRatingConfig(cfg);

    await writeAudit(req, {
      action:  'rating-rules.update',
      summary: `Updated rating rules (${after.rules.length} rule${after.rules.length === 1 ? '' : 's'})`,
      context: diffContext(before, after, ['rules']),
    });

    res.json({ settings: after });
  } catch (err) { next(err); }
});

// ===========================================================================
// ALERTS ADMIN
// ===========================================================================

router.get('/admin/notifications/alerts', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await AlertsConfig.getSingleton();
    const metadataKeys = await listMetadataKeys();
    res.json({
      settings:  publicAlertsConfig(cfg),
      catalogue: {
        days:         AlertsConfig.DAYS,
        matchModes:   AlertsConfig.MATCH_MODES,
        metadataKeys,
      },
    });
  } catch (err) { next(err); }
});

router.put('/admin/notifications/alerts', requirePortalOrAdmin, async (req, res, next) => {
  try {
    const cfg = await AlertsConfig.getSingleton();
    const before = publicAlertsConfig(cfg);
    const body = req.body || {};

    if (body.matchMode !== undefined) {
      if (!AlertsConfig.MATCH_MODES.includes(body.matchMode)) {
        return res.status(400).json({ error: 'matchMode must be "any" or "all".' });
      }
      cfg.matchMode = body.matchMode;
    }

    if (body.recurrenceDays !== undefined) {
      try {
        cfg.recurrenceDays = sanitizeRecurrenceDays(body.recurrenceDays);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    if (body.bodyMetadataKeys !== undefined) {
      try {
        cfg.bodyMetadataKeys = sanitizeMetadataKeys(body.bodyMetadataKeys);
      } catch (e) {
        return res.status(400).json({ error: `Body metadata: ${e.message}` });
      }
    }

    cfg.updatedByEmail = req.user?.email || '';
    await cfg.save();
    const after = publicAlertsConfig(cfg);

    await writeAudit(req, {
      action:  'alerts-config.update',
      summary: 'Updated alerts settings',
      context: diffContext(before, after, ['matchMode', 'recurrenceDays', 'bodyMetadataKeys']),
    });

    res.json({ settings: after });
  } catch (err) { next(err); }
});

module.exports = router;
