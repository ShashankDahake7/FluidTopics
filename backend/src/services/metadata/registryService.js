// Registry / projection helpers shared by the ingestion tail and the
// reprocess worker.
//
//   upsertMetadataRegistry(topicIds)        — bumps MetadataKey rows for any
//                                               custom keys carried by the
//                                               topics the document just
//                                               saved.
//
//   reprojectTopicsForDocument(documentId)  — recomputes metadata.indexedValues
//                                               and metadata.dateValues on
//                                               every topic in a document
//                                               based on the *current*
//                                               registry. This is what makes
//                                               freshly-ingested content
//                                               immediately searchable under
//                                               the existing toggles, without
//                                               waiting for the admin to hit
//                                               "Save and reprocess".
//
//   recomputeTopicProjection(topic, registryByName) — pure helper used by
//                                               both the worker thread and
//                                               the ingestion tail so the
//                                               projection logic lives in
//                                               exactly one place.

const Topic = require('../../models/Topic');
const MetadataKey = require('../../models/MetadataKey');
const { normalizeDate } = require('./dateNormaliser');
// Vocabulary synonym expansion is best-effort: if loading the index fails
// we fall back to the un-expanded values rather than blocking the
// projection. Mirrors the Pretty URL pattern.
const {
  getActiveSynonymIndexCached,
  expandIndexedValues,
} = require('../vocabularies/synonymProjector');
// Enrich-and-Clean rules apply to `metadata.custom` BEFORE the projection
// step so the indexed/date derivation reads from the cleaned values.
// Loaded via `require()` lazily to avoid circular dependency churn — the
// service module pulls in vocabulary helpers, and we don't want this
// file to participate in that graph.
const { applyRulesToTopic } = require('../enrich/ruleEngine');
const enrichService = require('../enrich/enrichService');

// Cap on the per-key sample list shown in the "Values" column. Matches the
// figure quoted by the Fluid Topics docs.
const VALUES_SAMPLE_CAP = 10;

// Read every Topic.metadata.custom Map and aggregate the keys + a sample of
// their values. Then upsert into MetadataKey using a single bulkWrite.
async function upsertMetadataRegistry(topicIds) {
  if (!Array.isArray(topicIds) || topicIds.length === 0) return;

  const topics = await Topic.find({ _id: { $in: topicIds } }, 'metadata.custom').lean();

  // key (lowercase) -> { displayName, valuesSet }
  const aggregate = new Map();
  for (const t of topics) {
    const custom = t?.metadata?.custom;
    if (!custom) continue;
    // `lean()` materialises Mongo Maps as plain objects, so we just walk
    // entries either way.
    const entries = custom instanceof Map ? Array.from(custom.entries()) : Object.entries(custom);
    for (const [rawKey, rawValues] of entries) {
      if (MetadataKey.isReserved(rawKey)) continue;
      const key = String(rawKey).trim();
      if (!key) continue;
      const lower = key.toLowerCase();
      if (!aggregate.has(lower)) {
        aggregate.set(lower, { displayName: key, values: new Set() });
      }
      const slot = aggregate.get(lower);
      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      for (const v of values) {
        if (v == null) continue;
        const sv = String(v).trim();
        if (sv) slot.values.add(sv);
      }
    }
  }

  if (aggregate.size === 0) return;

  const now = new Date();
  const ops = [];
  for (const [lower, { displayName, values }] of aggregate.entries()) {
    const sample = Array.from(values).slice(0, VALUES_SAMPLE_CAP);
    ops.push({
      updateOne: {
        filter: { name: lower },
        // $setOnInsert keeps user-set toggles (isIndexed/isDate) intact
        // when a key reappears; we only push new sample values + bump the
        // last-seen marker.
        update: {
          $setOnInsert: {
            name: lower,
            displayName,
            isIndexed: false,
            isDate: false,
            manual: false,
            createdAt: now,
          },
          $set: { lastSeenAt: now, manual: false },
          // $addToSet + $slice keeps the sample bounded.
          $addToSet: { valuesSample: { $each: sample } },
          // valuesCount is best-effort — exact distinct counts would need
          // a second pass. We bump by the number of new samples added.
          $inc: { valuesCount: sample.length },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) {
    try {
      await MetadataKey.bulkWrite(ops, { ordered: false });
      // Trim oversized samples in a second tiny pass — Mongo doesn't
      // support $slice inside an upsert's $addToSet.
      await MetadataKey.updateMany(
        { name: { $in: Array.from(aggregate.keys()) } },
        [{ $set: { valuesSample: { $slice: ['$valuesSample', VALUES_SAMPLE_CAP] } } }]
      );
    } catch (err) {
      console.warn('upsertMetadataRegistry bulkWrite warning:', err.message);
    }
  }
}

// Pure projection: given a topic doc and the registry indexed by lowercased
// name, return the new { indexedValues, dateValues, invalidDateKeys }.
// Used by both the synchronous post-ingest projector and the worker.
function recomputeTopicProjection(topic, registryByName) {
  const indexedValues = [];
  const dateValues = {};
  const invalidDateKeys = [];

  const custom = topic?.metadata?.custom;
  if (!custom) return { indexedValues, dateValues, invalidDateKeys };

  const entries = custom instanceof Map
    ? Array.from(custom.entries())
    : Object.entries(custom);

  for (const [rawKey, rawValues] of entries) {
    const lower = String(rawKey).trim().toLowerCase();
    const reg = registryByName.get(lower);
    if (!reg) continue;
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];

    if (reg.isIndexed) {
      for (const v of values) {
        if (v == null) continue;
        const sv = String(v).trim();
        if (sv) indexedValues.push(sv);
      }
    }

    if (reg.isDate && values.length) {
      // Single-valued by convention; the docs talk about date metadata as
      // a scalar. If multiple values exist we take the first and flag the
      // rest as invalid for registry counting.
      const first = values.find((v) => v != null && String(v).trim());
      if (first) {
        const parsed = normalizeDate(first);
        if (parsed) {
          dateValues[lower] = parsed;
        } else {
          invalidDateKeys.push(lower);
        }
      }
    }
  }

  return { indexedValues, dateValues, invalidDateKeys };
}

// Snapshot Topic.metadata.custom into Topic.metadata.customRaw for every
// topic of a freshly-ingested document that doesn't already have a
// snapshot. Idempotent: existing snapshots stay intact so re-ingest
// (which we don't currently do, but might) doesn't clobber the original
// raw values that the corpus reprocess worker depends on.
async function snapshotCustomRawForDocument(documentId) {
  if (!documentId) return;
  await Topic.updateMany(
    { documentId, 'metadata.customRaw': { $exists: false } },
    [{ $set: { 'metadata.customRaw': '$metadata.custom' } }]
  );
}

// After ingest, recompute the projection for every topic of a document
// using the current registry. Called from ingestionService once topics are
// saved so new content respects existing toggles immediately.
//
// Optional `synonymIndex` argument lets long-running callers (e.g. the
// vocabulary reprocess worker) pass a pre-loaded index so we don't re-fetch
// it once per document. When omitted we look up the cached index and apply
// the expansion best-effort — failure to load just skips the expansion
// step rather than failing the whole reprojection.
//
// `opts.scope` controls whether Enrich-and-Clean rules apply:
//   'ingest'    (default) — every enabled rule applies, on top of the
//                            freshly-saved metadata.custom (which IS the
//                            raw snapshot at this point).
//   'reprocess'           — restore metadata.custom from metadata.customRaw
//                            first, then apply only enabled `scope: 'all'`
//                            rules. Used by the corpus reprocess workers.
async function reprojectTopicsForDocument(documentId, opts = {}) {
  if (!documentId) return { processed: 0, errorCount: 0 };
  const scope = opts.scope === 'reprocess' ? 'reprocess' : 'ingest';
  // Optional whitelist: when present, the cursor is narrowed to only the
  // listed topicIds so a single-topic edit (diff-ingest UPDATE) doesn't
  // pay the cost of re-projecting the entire document. Empty / absent =>
  // legacy "all topics under this doc" behaviour.
  const topicIdFilter = Array.isArray(opts.topicIds) && opts.topicIds.length
    ? { _id: { $in: opts.topicIds } }
    : null;

  const registryRows = await MetadataKey.find(
    {},
    'name isIndexed isDate'
  ).lean();
  const registryByName = new Map(
    registryRows.map((r) => [r.name, { isIndexed: !!r.isIndexed, isDate: !!r.isDate }])
  );

  let synonymIndex = opts.synonymIndex || null;
  if (!synonymIndex) {
    try {
      synonymIndex = await getActiveSynonymIndexCached();
    } catch (err) {
      console.warn('reprojectTopicsForDocument: synonym index load failed:', err.message);
      synonymIndex = null;
    }
  }

  // Pre-load the active rule set + the per-vocabulary indexes the engine
  // needs. Caller may pass a pre-loaded bundle (workers) to avoid the
  // double round-trip when we already have the data in memory.
  let activeRules = opts.activeRules || null;
  if (!activeRules) {
    try {
      activeRules = await enrichService.getActiveRulesCached({ scope });
    } catch (err) {
      console.warn('reprojectTopicsForDocument: enrich rule load failed:', err.message);
      activeRules = { rules: [], vocabularyTermIndexes: new Map() };
    }
  }

  let processed = 0;
  let errorCount = 0;
  // Pull both `custom` and `customRaw` so reprocess paths can restore
  // before applying rules. The query merges in the optional topicIds
  // filter when the caller wants a scoped re-projection.
  const cursor = Topic.find(
    { documentId, ...(topicIdFilter || {}) },
    'metadata.custom metadata.customRaw'
  ).cursor();

  for await (const topic of cursor) {
    try {
      // For corpus reprocess paths: restore from the raw snapshot before
      // re-applying rules. Legacy topics with no snapshot fall back to
      // their current `custom` (and we do NOT write a snapshot from
      // here — only the ingest tail owns that step).
      if (scope === 'reprocess') {
        const raw = topic?.metadata?.customRaw;
        if (raw && (raw instanceof Map ? raw.size > 0 : Object.keys(raw).length > 0)) {
          topic.metadata.custom = cloneCustomMap(raw);
        }
      }

      // Apply active rules in place. Failures inside individual rules
      // are reported but never stop the topic loop.
      if (activeRules && activeRules.rules.length > 0) {
        applyRulesToTopic(topic, activeRules.rules, {
          vocabularyTermIndexes: activeRules.vocabularyTermIndexes,
        });
      }

      const { indexedValues, dateValues } = recomputeTopicProjection(topic, registryByName);
      const expanded = synonymIndex && synonymIndex.size > 0
        ? expandIndexedValues(indexedValues, synonymIndex)
        : indexedValues;
      await Topic.updateOne(
        { _id: topic._id },
        {
          $set: {
            // Persist the (potentially mutated) custom map alongside the
            // derived projections so downstream readers see the cleaned
            // values too. Cast to a plain object for the $set call.
            'metadata.custom': customMapToObject(topic.metadata.custom),
            'metadata.indexedValues': expanded,
            'metadata.dateValues': dateValues,
          },
        }
      );
      processed += 1;
    } catch (err) {
      errorCount += 1;
      console.warn('reprojectTopicsForDocument topic error:', topic?._id?.toString?.(), err.message);
    }
  }

  return { processed, errorCount };
}

// Defensive copy of a Map<string,string[]> from a Mongoose Map / lean
// object into a fresh Map so the engine can mutate the working copy
// without touching the snapshot.
function cloneCustomMap(src) {
  const out = new Map();
  if (!src) return out;
  const entries = src instanceof Map ? src.entries() : Object.entries(src);
  for (const [k, v] of entries) {
    out.set(String(k), Array.isArray(v) ? v.slice() : (v == null ? [] : [String(v)]));
  }
  return out;
}

function customMapToObject(custom) {
  if (!custom) return {};
  if (custom instanceof Map) {
    const out = {};
    for (const [k, v] of custom.entries()) out[k] = Array.isArray(v) ? v : [String(v)];
    return out;
  }
  return custom;
}

module.exports = {
  upsertMetadataRegistry,
  snapshotCustomRawForDocument,
  reprojectTopicsForDocument,
  recomputeTopicProjection,
  VALUES_SAMPLE_CAP,
};
