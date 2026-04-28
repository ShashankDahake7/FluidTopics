// Orchestration layer for the Enrich-and-Clean admin feature.
//
// Responsibilities:
//   - CRUD for individual rules (POST/PATCH/DELETE).
//   - Atomic batch replace (PUT) used by the page's Save button.
//   - In-memory cached active rule list, refreshed every 30 s and
//     bust-on-write so the ingest tail and the reprocess workers don't
//     re-query Mongo per topic.
//   - Pre-loading the per-vocabulary term indexes referenced by `enrich`
//     rules so the engine has everything it needs without DB access.
//   - Toggling `EnrichConfig.pendingReprocess` whenever an `all`-scope
//     rule is created/updated/deleted (including soft-disable).
//   - Cycle detection for `copy_from` rules so admins can't ship
//     "A copies from B; B copies from A" through the validator.
//
// We deliberately mirror the patterns used by
// `services/vocabularies/vocabularyService.js` and
// `services/metadata/registryService.js` so future readers can pattern-
// match across the three Knowledge Hub services without surprises.

const mongoose = require('mongoose');

const EnrichRule = require('../../models/EnrichRule');
const EnrichConfig = require('../../models/EnrichConfig');
const Vocabulary = require('../../models/Vocabulary');
const MetadataKey = require('../../models/MetadataKey');
const { validateRule, RULE_TYPES } = require('./ruleConfigSchemas');
const { getVocabularyTermIndexCached } = require('../vocabularies/synonymProjector');

const CACHE_TTL_MS = 30 * 1000;
let cachedRules = null;
let cachedAt = 0;
let inflight = null;

function bumpRuleCache() {
  cachedRules = null;
  cachedAt = 0;
  inflight = null;
}

// Tiny error helper that surfaces a numeric `status` so route handlers
// can re-emit it as the right HTTP code (mirrors vocabularyService).
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ── Serialisation ─────────────────────────────────────────────────────────
function serialiseRule(row) {
  if (!row) return null;
  const obj = row.toObject ? row.toObject() : row;
  return {
    id: String(obj._id),
    metadataKey: obj.metadataKey,
    type: obj.type,
    config: obj.config || {},
    priority: typeof obj.priority === 'number' ? obj.priority : 0,
    scope: obj.scope || 'new',
    enabled: obj.enabled !== false,
    createdBy: obj.createdBy ? String(obj.createdBy) : null,
    updatedBy: obj.updatedBy ? String(obj.updatedBy) : null,
    createdAt: obj.createdAt || null,
    updatedAt: obj.updatedAt || null,
  };
}

function serialiseConfig(cfg) {
  if (!cfg) {
    return { lastFullReprocessAt: null, lastFullReprocessByName: null, pendingReprocess: false };
  }
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  const by = obj.lastFullReprocessBy && typeof obj.lastFullReprocessBy === 'object'
    ? obj.lastFullReprocessBy
    : null;
  return {
    lastFullReprocessAt: obj.lastFullReprocessAt || null,
    lastFullReprocessByName: by?.name || by?.email || null,
    pendingReprocess: !!obj.pendingReprocess,
  };
}

// ── Active rules cache (used by reproject + workers) ──────────────────────
//
// `getActiveRulesCached({ scope })` returns an array of plain rule objects
// (already ordered by `(metadataKey, priority)`) plus a Map of
// per-vocabulary term indexes for every `enrich` rule referenced. The
// engine consumes both directly.
//
// `scope` controls which rules we hand back:
//   'ingest'    — every enabled rule, regardless of scope
//   'reprocess' — only enabled rules whose scope is 'all'
async function getActiveRulesCached({ scope = 'ingest' } = {}) {
  const now = Date.now();
  if (cachedRules && now - cachedAt < CACHE_TTL_MS) {
    return filterAndIndex(cachedRules, scope);
  }
  if (inflight) {
    const all = await inflight;
    return filterAndIndex(all, scope);
  }
  inflight = (async () => {
    try {
      const rows = await EnrichRule.find({ enabled: true })
        .sort({ metadataKey: 1, priority: 1, _id: 1 })
        .lean();
      cachedRules = rows;
      cachedAt = Date.now();
      return rows;
    } finally {
      inflight = null;
    }
  })();
  const all = await inflight;
  return filterAndIndex(all, scope);
}

async function filterAndIndex(allRules, scope) {
  const filtered = scope === 'reprocess'
    ? allRules.filter((r) => r.scope === 'all')
    : allRules.slice();
  const vocabIds = new Set();
  for (const r of filtered) {
    if (r.type === 'enrich' && r.config && r.config.vocabularyId) {
      vocabIds.add(String(r.config.vocabularyId));
    }
  }
  const vocabularyTermIndexes = new Map();
  for (const id of vocabIds) {
    try {
      const idx = await getVocabularyTermIndexCached(id);
      vocabularyTermIndexes.set(id, idx);
    } catch (err) {
      // A failure to load any one vocab is best-effort — the engine
      // treats a missing index as a no-op for that rule.
      console.warn('enrichService: vocabulary index load failed:', id, err.message);
    }
  }
  // Engine expects rules with stringified ids and the right field shape.
  const rules = filtered.map((r) => ({
    id: String(r._id),
    metadataKey: r.metadataKey,
    type: r.type,
    config: r.config || {},
    priority: r.priority,
    scope: r.scope,
  }));
  return { rules, vocabularyTermIndexes };
}

// ── CRUD primitives ───────────────────────────────────────────────────────
async function listRules() {
  const [rows, cfgRow] = await Promise.all([
    EnrichRule.find({}).sort({ metadataKey: 1, priority: 1, _id: 1 }).lean(),
    EnrichConfig.findOne({ key: 'default' }).populate('lastFullReprocessBy', 'name email'),
  ]);
  return {
    rules: rows.map(serialiseRule),
    config: serialiseConfig(cfgRow),
  };
}

// Cross-cutting check used by every write path: enrich rules require a
// real vocabulary; copy_from rules can't form cycles within the active
// rule set; metadataKey must match a known MetadataKey row OR be a known
// reserved key (we still permit unknown keys at create time so admins can
// stage a rule before content arrives, mirroring the metadata-key flow).
async function crossCheckRule(payload, otherRules = []) {
  if (payload.type === 'enrich') {
    const vocabId = payload.config?.vocabularyId;
    if (!mongoose.isValidObjectId(vocabId)) {
      throw httpError(400, 'enrich rules require a valid vocabularyId.');
    }
    const exists = await Vocabulary.exists({ _id: vocabId });
    if (!exists) {
      throw httpError(422, 'The selected vocabulary no longer exists.');
    }
  }
  if (payload.type === 'copy_from') {
    if (detectCopyFromCycle(payload, otherRules)) {
      throw httpError(400, 'copy_from rules form a cycle.');
    }
  }
}

// Walk the directed graph (target -> source) restricted to `copy_from`
// rules and look for a path that comes back to `payload.metadataKey`.
function detectCopyFromCycle(payload, otherRules) {
  const edges = new Map();
  const consider = otherRules.filter((r) => r.type === 'copy_from' && r.id !== payload.id);
  for (const r of consider) {
    if (!edges.has(r.metadataKey)) edges.set(r.metadataKey, new Set());
    edges.get(r.metadataKey).add(r.config?.sourceKey);
  }
  // Add the candidate edge.
  if (!edges.has(payload.metadataKey)) edges.set(payload.metadataKey, new Set());
  edges.get(payload.metadataKey).add(payload.config?.sourceKey);

  const start = payload.metadataKey;
  const stack = [start];
  const seen = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    const next = edges.get(node);
    if (!next) continue;
    for (const n of next) {
      if (n === start) return true;
      stack.push(n);
    }
  }
  return false;
}

// Decide whether a (single-rule) write should flip pendingReprocess.
// Hot-path: any rule write whose scope is or was 'all' is a potential
// trigger. We over-flip rather than miss flips — admins always have the
// option to ignore the dot.
function isPendingReprocessTrigger({ before, after }) {
  if (before && before.scope === 'all') return true;
  if (after && after.scope === 'all') return true;
  return false;
}

async function flipPendingReprocess() {
  await EnrichConfig.updateOne(
    { key: 'default' },
    { $set: { pendingReprocess: true } },
    { upsert: true }
  );
}

// Build the diff payload used by `replaceAllRules` to decide whether to
// flip the pendingReprocess flag for the batch.
function batchTouchesScopeAll(beforeRules, afterRules) {
  if (beforeRules.some((r) => r.scope === 'all')) {
    // Any pre-existing 'all'-scope rule could have been edited or deleted.
    // If the batch list differs in any meaningful way for any 'all' rule,
    // flip. Cheapest correct check: compare a serialised hash of the
    // 'all'-scope subset before vs after.
    const beforeKey = JSON.stringify(beforeRules.filter((r) => r.scope === 'all').map(canonRuleHashKey));
    const afterKey = JSON.stringify(afterRules.filter((r) => r.scope === 'all').map(canonRuleHashKey));
    if (beforeKey !== afterKey) return true;
  }
  if (afterRules.some((r) => r.scope === 'all' && !r._id)) {
    // New 'all'-scope rule introduced in this PUT.
    return true;
  }
  return false;
}

function canonRuleHashKey(r) {
  return [r.metadataKey, r.type, r.scope, !!r.enabled, r.priority || 0, JSON.stringify(r.config || {})];
}

// Resolve `metadataKey` against the registry — accepts the canonical
// lowercase name OR the displayName, returning the canonical lowercase.
// Throws 400 if neither matches and the key isn't a reserved built-in.
async function resolveMetadataKey(rawKey) {
  const trimmed = String(rawKey || '').trim();
  if (!trimmed) throw httpError(400, 'metadataKey is required.');
  const lower = trimmed.toLowerCase();
  if (MetadataKey.isReserved(lower)) {
    // Reserved keys are durable + always present, so allow rules
    // targeting them (e.g. clean rules on `tags`).
    return lower;
  }
  const exists = await MetadataKey.exists({ name: lower });
  if (!exists) {
    throw httpError(400, `Unknown metadataKey "${trimmed}". Create it on the Metadata configuration page first.`);
  }
  return lower;
}

// ── Write paths ───────────────────────────────────────────────────────────
async function createRule(payload, user) {
  const validated = validateRule(payload);
  if (!validated.ok) throw httpError(400, validated.error);
  const metadataKey = await resolveMetadataKey(validated.metadataKey);
  const allRules = await EnrichRule.find({}).lean();
  const others = allRules.map((r) => ({
    id: String(r._id),
    metadataKey: r.metadataKey,
    type: r.type,
    config: r.config || {},
  }));
  await crossCheckRule({
    metadataKey,
    type: validated.type,
    config: validated.value,
    id: null,
  }, others);

  const max = await EnrichRule.find({ metadataKey }).sort({ priority: -1 }).limit(1).lean();
  const priority = typeof payload.priority === 'number'
    ? payload.priority
    : (max[0]?.priority || 0) + 10;

  const created = await EnrichRule.create({
    metadataKey,
    type: validated.type,
    config: validated.value,
    priority,
    scope: payload.scope === 'all' ? 'all' : 'new',
    enabled: payload.enabled !== false,
    createdBy: user?._id || null,
    updatedBy: user?._id || null,
  });

  if (isPendingReprocessTrigger({ before: null, after: created.toObject() })) {
    await flipPendingReprocess();
  }
  bumpRuleCache();
  return serialiseRule(created);
}

async function updateRule(id, payload, user) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Rule not found.');
  }
  const existing = await EnrichRule.findById(id);
  if (!existing) throw httpError(404, 'Rule not found.');

  // Build the merged candidate so validators see the full picture.
  const candidate = {
    metadataKey: payload.metadataKey != null ? payload.metadataKey : existing.metadataKey,
    type: payload.type != null ? payload.type : existing.type,
    config: payload.config != null ? payload.config : existing.config,
    scope: payload.scope != null ? payload.scope : existing.scope,
    enabled: payload.enabled != null ? !!payload.enabled : existing.enabled,
    priority: payload.priority != null ? payload.priority : existing.priority,
  };

  const validated = validateRule(candidate);
  if (!validated.ok) throw httpError(400, validated.error);
  const metadataKey = await resolveMetadataKey(validated.metadataKey);

  const allRules = await EnrichRule.find({}).lean();
  const others = allRules
    .filter((r) => String(r._id) !== String(id))
    .map((r) => ({
      id: String(r._id),
      metadataKey: r.metadataKey,
      type: r.type,
      config: r.config || {},
    }));
  await crossCheckRule({
    metadataKey,
    type: validated.type,
    config: validated.value,
    id: String(id),
  }, others);

  const before = existing.toObject();
  existing.metadataKey = metadataKey;
  existing.type = validated.type;
  existing.config = validated.value;
  existing.scope = candidate.scope === 'all' ? 'all' : 'new';
  existing.enabled = !!candidate.enabled;
  if (typeof candidate.priority === 'number') existing.priority = candidate.priority;
  existing.updatedBy = user?._id || null;
  await existing.save();

  if (isPendingReprocessTrigger({ before, after: existing.toObject() })) {
    await flipPendingReprocess();
  }
  bumpRuleCache();
  return serialiseRule(existing);
}

async function deleteRule(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Rule not found.');
  }
  const row = await EnrichRule.findById(id);
  if (!row) throw httpError(404, 'Rule not found.');
  const wasAll = row.scope === 'all' && row.enabled !== false;
  await row.deleteOne();
  if (wasAll) await flipPendingReprocess();
  bumpRuleCache();
}

// Atomic batch replace: validates the full list (including cross-rule
// cycle detection) and only then writes. If validation fails the
// existing rules are untouched. Mongo doesn't have a transaction in this
// deployment (see vocabularyService for the same trade-off), so we
// implement the "atomic enough for an admin feature" pattern: snapshot
// before the destructive ops, restore on failure.
async function replaceAllRules(rulesPayload, user) {
  if (!Array.isArray(rulesPayload)) {
    throw httpError(400, 'Body must be an array of rules.');
  }

  const beforeRows = await EnrichRule.find({}).lean();

  // Validate every rule first so we never partially apply.
  const validated = [];
  for (let i = 0; i < rulesPayload.length; i += 1) {
    const raw = rulesPayload[i] || {};
    const v = validateRule({
      metadataKey: raw.metadataKey,
      type: raw.type,
      config: raw.config,
    });
    if (!v.ok) {
      throw httpError(400, `Rule #${i + 1}: ${v.error}`);
    }
    validated.push({
      _id: raw.id && mongoose.isValidObjectId(raw.id) ? raw.id : null,
      metadataKey: v.metadataKey,
      type: v.type,
      config: v.value,
      priority: typeof raw.priority === 'number' ? raw.priority : (i + 1) * 10,
      scope: raw.scope === 'all' ? 'all' : 'new',
      enabled: raw.enabled !== false,
    });
  }

  // Resolve every metadata key against the registry.
  for (const r of validated) {
    r.metadataKey = await resolveMetadataKey(r.metadataKey);
  }

  // Cross-cutting cycle + vocabulary checks.
  for (let i = 0; i < validated.length; i += 1) {
    const candidate = validated[i];
    const others = validated
      .filter((_, j) => j !== i)
      .map((r) => ({
        id: r._id ? String(r._id) : null,
        metadataKey: r.metadataKey,
        type: r.type,
        config: r.config,
      }));
    try {
      await crossCheckRule({
        id: candidate._id,
        metadataKey: candidate.metadataKey,
        type: candidate.type,
        config: candidate.config,
      }, others);
    } catch (err) {
      throw httpError(err.status || 400, `Rule #${i + 1}: ${err.message}`);
    }
  }

  // Apply: delete-all + insert-all. On insert failure restore from the
  // snapshot so the page state is preserved.
  await EnrichRule.deleteMany({});
  let inserted = [];
  try {
    inserted = await EnrichRule.insertMany(
      validated.map((r) => ({
        metadataKey: r.metadataKey,
        type: r.type,
        config: r.config,
        priority: r.priority,
        scope: r.scope,
        enabled: r.enabled,
        createdBy: user?._id || null,
        updatedBy: user?._id || null,
      })),
      { ordered: true }
    );
  } catch (err) {
    // Restore best-effort.
    if (beforeRows.length > 0) {
      try {
        await EnrichRule.insertMany(beforeRows.map((r) => {
          const { _id, ...rest } = r;
          return { _id, ...rest };
        }), { ordered: false });
      } catch (rollbackErr) {
        console.warn('enrichService: rollback after batch failure also failed:', rollbackErr.message);
      }
    }
    throw httpError(500, `Batch save failed: ${err.message}`);
  }

  if (batchTouchesScopeAll(
    beforeRows.map((r) => ({ ...r, _id: r._id })),
    inserted.map((r) => ({ ...r.toObject(), _id: undefined })) // _id omitted so 'new' detection works
  )) {
    await flipPendingReprocess();
  }
  bumpRuleCache();

  return inserted.map(serialiseRule);
}

module.exports = {
  RULE_TYPES,
  serialiseRule,
  serialiseConfig,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  replaceAllRules,
  getActiveRulesCached,
  bumpRuleCache,
};
