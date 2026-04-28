const mongoose = require('mongoose');
const RatingRulesConfig = require('../../models/RatingRulesConfig');
const Document = require('../../models/Document');
const Topic = require('../../models/Topic');

// ---------------------------------------------------------------------------
// Build a flat key/value lookup over a Document's metadata (or a Topic's
// inherited Document metadata). The shape on disk is heterogeneous — top-
// level scalars, an `author/product/description` cluster, a `tags` array,
// and a free-form `customFields` Map — so we normalise everything to a flat
// {key: value, …} bag the rule engine can sample.
//
// Also surfaces a few derived FT-style keys (`ft:locale`, `title`,
// `publicationDate`, etc.) so admins can target rules using the same names
// they see in the metadata catalogue / drawer.
// ---------------------------------------------------------------------------
function flattenDocumentMetadata(doc) {
  if (!doc) return {};
  const m = doc.metadata || {};
  const out = {};

  // Top-level shorthand keys.
  if (doc.title) out.title = String(doc.title);
  if (doc.language) out['ft:locale'] = String(doc.language);
  if (doc.sourceFormat) out['ft:document_type'] = String(doc.sourceFormat);
  if (doc.createdAt) out.publicationDate = new Date(doc.createdAt).toISOString().slice(0, 10);

  // metadata.{author,product,description}
  if (m.author) out.author_personname = String(m.author);
  if (m.product) out.product = String(m.product);
  if (m.description) out.description = String(m.description);

  // metadata.tags — multi-valued; expose joined and per-value variants so
  // a rule for `tags = release-notes` matches when the tag is present.
  if (Array.isArray(m.tags) && m.tags.length) {
    out.tags = m.tags.map(String).join(',');
  }

  // metadata.customFields — Map; copy verbatim, with the original casing.
  if (m.customFields) {
    const map = m.customFields instanceof Map ? Object.fromEntries(m.customFields) : m.customFields;
    for (const [k, v] of Object.entries(map || {})) {
      if (v === undefined || v === null) continue;
      out[k] = String(v);
    }
  }

  return out;
}

// Tags are multi-valued; treat the empty-string requirement as "tag is
// absent or empty" and any other value as "this tag exists in the array".
function tagsMatch(metadata, requirement) {
  const present = String(metadata.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (requirement === '') return present.length === 0;
  return present.includes(requirement);
}

function ruleMatches(rule, metadata) {
  const reqs = Array.isArray(rule.metaReqs) ? rule.metaReqs : [];
  if (reqs.length === 0) return true; // catch-all rule

  for (const r of reqs) {
    const key = String(r.key || '').trim();
    if (!key) continue;
    const wanted = r.value === undefined || r.value === null ? '' : String(r.value);
    const got = metadata[key];

    if (key === 'tags' || key === 'metadata.tags') {
      if (!tagsMatch(metadata, wanted)) return false;
      continue;
    }

    // Empty-string requirement → key must be missing/empty.
    if (wanted === '') {
      if (got !== undefined && got !== '' && got !== null) return false;
      continue;
    }

    if (got === undefined || got === null) return false;
    if (String(got) !== wanted) return false;
  }
  return true;
}

// Walk the ordered rule list and return the first matching rule. Falls back
// to the *last* rule when nothing matches, mirroring the FT semantics: the
// admin is expected to keep a catch-all (no metadata requirements) at the
// bottom of the list.
async function resolveRuleForDocument(documentId) {
  const cfg = await RatingRulesConfig.getSingleton();
  const rules = (cfg.rules || []).map((r) => r.toObject ? r.toObject() : r);
  if (rules.length === 0) {
    return { rule: null, ruleIndex: -1, fallback: true, metadata: {} };
  }

  let metadata = {};
  if (mongoose.isValidObjectId(documentId)) {
    const doc = await Document.findById(documentId).lean();
    metadata = flattenDocumentMetadata(doc);
  }

  for (let i = 0; i < rules.length; i += 1) {
    if (ruleMatches(rules[i], metadata)) {
      return { rule: rules[i], ruleIndex: i, fallback: false, metadata };
    }
  }
  // None matched — return the last entry as the catch-all default.
  return { rule: rules[rules.length - 1], ruleIndex: rules.length - 1, fallback: true, metadata };
}

// Topic-level resolution looks up the parent document then runs document
// resolution. We surface the topicLevels separately so the caller can
// figure out which zone applies for the current depth.
async function resolveRuleForTopic(topicId) {
  if (!mongoose.isValidObjectId(topicId)) {
    return resolveRuleForDocument(null);
  }
  const topic = await Topic.findById(topicId).select('documentId').lean();
  return resolveRuleForDocument(topic?.documentId || null);
}

// Given a topic's depth (1-based: depth=1 is the root topic) and the
// resolved rule, return the rating type that should be used at that depth.
// Implements the "Rate together" inheritance rule: each level walks
// upwards until it finds a "Rate individually" anchor.
function topicRatingForDepth(rule, depth) {
  if (!rule || rule.topicType === 'No rating') return { type: 'No rating', zoneDepth: 0 };
  const levels = Array.isArray(rule.topicLevels) ? rule.topicLevels : [];
  if (levels.length === 0) return { type: rule.topicType, zoneDepth: 1 };
  // Last entry sticks for "and after" semantics.
  let zone = depth;
  for (let i = Math.min(depth - 1, levels.length - 1); i >= 0; i -= 1) {
    const setting = levels[i] || 'Rate together';
    if (setting === 'Do not rate') return { type: 'No rating', zoneDepth: i + 1 };
    if (setting === 'Rate individually') { zone = i + 1; return { type: rule.topicType, zoneDepth: zone }; }
    // Rate together — keep walking up.
    zone = i + 1;
  }
  return { type: rule.topicType, zoneDepth: zone };
}

module.exports = {
  flattenDocumentMetadata,
  ruleMatches,
  resolveRuleForDocument,
  resolveRuleForTopic,
  topicRatingForDepth,
};
