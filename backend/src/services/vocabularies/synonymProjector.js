// Pure projection helper used at ingest time and by the reprocess worker
// to expand `Topic.metadata.indexedValues` with synonyms from active
// vocabularies (`usedInSearch: true`).
//
// The synonym index is a `Map<lowerCaseLabel, Set<expansion>>` that maps
// every `prefLabel` and every `altLabel` of every term in every active
// vocab to the union of every other label of the same
// `(vocabularyId, termId, language)` triple. Lookups are case-insensitive
// to match the loose human-typed values that show up in custom metadata.
//
// The cache lives at module scope. The 30-second TTL is a defensive
// upper bound; `vocabularyService.bumpSynonymCache()` invalidates it
// eagerly whenever an admin saves anything that could affect search.
//
// Exported surface:
//   - getActiveSynonymIndexCached(): Promise<Map>
//   - bumpSynonymCache(): void
//   - expandIndexedValues(values, index): string[]
//   - buildSynonymIndexForRows(rows): Map  (used by the worker which loads
//     rows once at startup so it can avoid repeat DB hits per topic)
//   - getVocabularyTermIndexCached(vocabularyId): Promise<Map>
//     A *per-vocabulary* term index, keyed by lowercased label, mapping to
//     a single canonical term `{ termId, language, prefLabel, altLabels }`.
//     Used by the Enrich-and-Clean rule engine for `enrich` rules where
//     we need both the canonical prefLabel and the full alt-label list,
//     not just the union of synonym strings.

const Vocabulary = require('../../models/Vocabulary');
const VocabularyTerm = require('../../models/VocabularyTerm');

const CACHE_TTL_MS = 30 * 1000;
let cached = null;
let cachedAt = 0;
let inflight = null;
// Per-vocab term index cache keyed by vocabularyId-as-string. Same TTL
// + same bust trigger as the global synonym cache so saves on either
// side stay in sync.
const vocabTermIndexCache = new Map(); // id -> { index, at }
const vocabTermIndexInflight = new Map(); // id -> Promise

function bumpSynonymCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
  vocabTermIndexCache.clear();
  vocabTermIndexInflight.clear();
}

async function getActiveSynonymIndexCached() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const activeVocabs = await Vocabulary.find(
        { usedInSearch: true, status: 'ready' },
        '_id'
      ).lean();
      if (activeVocabs.length === 0) {
        cached = new Map();
        cachedAt = Date.now();
        return cached;
      }
      const ids = activeVocabs.map((v) => v._id);
      const rows = await VocabularyTerm.find(
        { vocabularyId: { $in: ids } },
        'vocabularyId termId language prefLabel altLabels'
      ).lean();
      const index = buildSynonymIndexForRows(rows);
      cached = index;
      cachedAt = Date.now();
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// Pure builder. Given a flat array of term rows, group by (vocab, term,
// language), then map every label in the group to the union of every
// other label in the same group. Idempotent re-application is fine: the
// result is keyed on lowercased labels and stores its expansions in a
// `Set` so duplicate inserts are no-ops.
function buildSynonymIndexForRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.vocabularyId}::${row.termId}::${row.language || '*'}`;
    if (!groups.has(key)) groups.set(key, []);
    if (row.prefLabel) groups.get(key).push(row.prefLabel);
    if (Array.isArray(row.altLabels)) {
      for (const alt of row.altLabels) {
        if (alt) groups.get(key).push(alt);
      }
    }
  }

  const index = new Map();
  for (const labels of groups.values()) {
    if (labels.length < 2) continue; // single-label group has nothing to expand
    for (let i = 0; i < labels.length; i += 1) {
      const key = String(labels[i]).trim().toLowerCase();
      if (!key) continue;
      let bucket = index.get(key);
      if (!bucket) {
        bucket = new Set();
        index.set(key, bucket);
      }
      for (let j = 0; j < labels.length; j += 1) {
        if (i === j) continue;
        const v = String(labels[j]).trim();
        if (v) bucket.add(v);
      }
    }
  }
  return index;
}

// Given the existing `[String]` of indexed values for a topic, return the
// union with every matching expansion. Idempotent: re-running the result
// through the same index is a no-op because the expansions are already
// present in the next pass's input.
function expandIndexedValues(values, index) {
  if (!Array.isArray(values) || values.length === 0) return values || [];
  if (!index || index.size === 0) return values;
  const out = new Set(values);
  for (const v of values) {
    if (v == null) continue;
    const key = String(v).trim().toLowerCase();
    if (!key) continue;
    const bucket = index.get(key);
    if (!bucket) continue;
    for (const expansion of bucket) out.add(expansion);
  }
  return Array.from(out);
}

// Per-vocabulary term index for the Enrich-and-Clean rule engine.
//
// Returns Map<lowercaseLabel, { termId, language, prefLabel, altLabels }>.
// Both the prefLabel and every altLabel of a term map to the same canonical
// record so a hit on any synonym yields the same enrichment.
//
// Multi-language note: labels collide across languages (e.g. "cloud" in
// `en` and `*`). We keep the first-loaded record for a given lowercase
// label, which biases towards rows that arrive earlier in the cursor.
// For the recall-favouring read path the order doesn't matter — both
// records carry the same prefLabel.
function buildVocabularyTermIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    if (!row || !row.prefLabel) continue;
    const term = {
      termId: row.termId,
      language: row.language || '*',
      prefLabel: row.prefLabel,
      altLabels: Array.isArray(row.altLabels) ? row.altLabels.slice() : [],
    };
    const labels = [row.prefLabel, ...(Array.isArray(row.altLabels) ? row.altLabels : [])];
    for (const label of labels) {
      if (!label) continue;
      const key = String(label).trim().toLowerCase();
      if (!key || index.has(key)) continue;
      index.set(key, term);
    }
  }
  return index;
}

async function getVocabularyTermIndexCached(vocabularyId) {
  if (!vocabularyId) return new Map();
  const id = String(vocabularyId);
  const now = Date.now();
  const hit = vocabTermIndexCache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.index;
  if (vocabTermIndexInflight.has(id)) return vocabTermIndexInflight.get(id);

  const promise = (async () => {
    try {
      const rows = await VocabularyTerm.find(
        { vocabularyId: id },
        'termId language prefLabel altLabels'
      ).lean();
      const index = buildVocabularyTermIndex(rows);
      vocabTermIndexCache.set(id, { index, at: Date.now() });
      return index;
    } finally {
      vocabTermIndexInflight.delete(id);
    }
  })();

  vocabTermIndexInflight.set(id, promise);
  return promise;
}

module.exports = {
  getActiveSynonymIndexCached,
  bumpSynonymCache,
  buildSynonymIndexForRows,
  expandIndexedValues,
  getVocabularyTermIndexCached,
  buildVocabularyTermIndex,
};
