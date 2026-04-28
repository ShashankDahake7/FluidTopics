// Pure, synchronous engine that applies a list of Enrich-and-Clean rules
// to a single topic's `metadata.custom` Map. No DB access, no async work.
//
// The engine's contract is intentionally simple:
//   - Accepts a topic (may be a Mongoose doc or a POJO with .metadata.custom).
//   - Mutates `topic.metadata.custom` in place (always coerced to a Map).
//   - Returns a small report ({ appliedCount, errors }) for telemetry; the
//     caller is responsible for re-running `recomputeTopicProjection` and
//     `expandIndexedValues` to refresh derived fields.
//
// Per-rule failures are isolated: if a single rule throws, the engine
// records the error and continues with the next rule rather than aborting
// the whole topic. This mirrors the per-topic try/catch in the existing
// reprocess workers.
//
// Vocabulary lookups for `enrich` rules go through the
// `vocabularyTermIndexes` map passed by the caller, keyed by
// vocabularyId-as-string. A missing index is treated as a no-op (the
// vocabulary may have been deleted between rule save and apply).

const RULE_HANDLERS = {
  enrich: applyEnrich,
  clean: applyClean,
  find_replace: applyFindReplace,
  regex_replace: applyRegexReplace,
  drop_key: applyDropKey,
  set_value: applySetValue,
  copy_from: applyCopyFrom,
};

// Coerce metadata.custom to a Map regardless of how it was loaded
// (Mongoose Map vs plain object from `.lean()`). The engine writes back
// a Map so downstream code can rely on Map semantics.
function ensureCustomMap(topic) {
  if (!topic.metadata) topic.metadata = {};
  let custom = topic.metadata.custom;
  if (custom instanceof Map) return custom;
  custom = new Map();
  if (topic.metadata.custom && typeof topic.metadata.custom === 'object') {
    for (const [k, v] of Object.entries(topic.metadata.custom)) {
      const arr = Array.isArray(v) ? v.slice() : v == null ? [] : [String(v)];
      custom.set(String(k).trim().toLowerCase(), arr);
    }
  }
  topic.metadata.custom = custom;
  return custom;
}

// Read the value list for a key, returning a defensive copy so callers
// can mutate freely.
function readValues(custom, key) {
  if (!custom) return [];
  const v = custom.get(key);
  if (!Array.isArray(v)) return v == null ? [] : [String(v)];
  return v.slice();
}

function writeValues(custom, key, values) {
  if (!Array.isArray(values) || values.length === 0) {
    custom.delete(key);
    return;
  }
  custom.set(key, values);
}

// Case-insensitive de-dup that preserves the first-seen casing — used by
// `clean` and as a final pass after `enrich` to keep value lists tidy.
function dedupCaseInsensitive(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (v == null) continue;
    const sv = String(v);
    const key = sv.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sv);
  }
  return out;
}

// ── Per-rule handlers ─────────────────────────────────────────────────────
// All handlers take `(custom, rule, ctx)` where ctx carries cross-rule
// state (vocabulary indexes today, more later). They mutate `custom` in
// place. They never throw — invalid configs from upstream validation
// should never reach them, but defensive guards keep the engine resilient
// in case rule schemas drift.

function applyEnrich(custom, rule, ctx) {
  const cfg = rule.config || {};
  const idx = ctx.vocabularyTermIndexes?.get(String(cfg.vocabularyId));
  if (!idx || idx.size === 0) return; // vocab deleted or empty — no-op

  const values = readValues(custom, rule.metadataKey);
  if (values.length === 0) return;

  const out = [];
  for (const v of values) {
    if (v == null) continue;
    const sv = String(v);
    const key = sv.trim().toLowerCase();
    const term = key ? idx.get(key) : null;
    if (term) {
      // Canonicalise to prefLabel + push every alt-label of the same term.
      if (term.prefLabel) out.push(term.prefLabel);
      if (Array.isArray(term.altLabels)) {
        for (const alt of term.altLabels) if (alt) out.push(alt);
      }
    } else {
      out.push(sv);
    }
  }
  writeValues(custom, rule.metadataKey, dedupCaseInsensitive(out));
}

function applyClean(custom, rule) {
  const values = readValues(custom, rule.metadataKey);
  if (values.length === 0) return;
  const trimmed = values
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter((v) => v.length > 0);
  writeValues(custom, rule.metadataKey, dedupCaseInsensitive(trimmed));
}

function applyFindReplace(custom, rule) {
  const cfg = rule.config || {};
  const find = cfg.find;
  const replace = cfg.replace;
  if (!find) return;
  const values = readValues(custom, rule.metadataKey);
  if (values.length === 0) return;

  const out = [];
  if (cfg.caseSensitive) {
    for (const v of values) {
      if (v == null) continue;
      out.push(String(v).split(find).join(replace));
    }
  } else {
    // Build a global, case-insensitive regex from the literal `find`.
    const pattern = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(pattern, 'gi');
    for (const v of values) {
      if (v == null) continue;
      out.push(String(v).replace(re, replace));
    }
  }
  // Drop empties produced by the substitution; preserve casing on dedup.
  writeValues(
    custom,
    rule.metadataKey,
    dedupCaseInsensitive(out.map((v) => v.trim()).filter(Boolean))
  );
}

function applyRegexReplace(custom, rule) {
  const cfg = rule.config || {};
  if (!cfg.pattern) return;
  let re;
  try {
    re = new RegExp(cfg.pattern, cfg.flags || 'g');
  } catch (_) {
    // Validator already prevents this at save-time; if a stored rule is
    // somehow invalid we treat it as a no-op rather than crash.
    return;
  }
  const values = readValues(custom, rule.metadataKey);
  if (values.length === 0) return;

  const out = [];
  for (const v of values) {
    if (v == null) continue;
    out.push(String(v).replace(re, cfg.replace == null ? '' : cfg.replace));
  }
  writeValues(
    custom,
    rule.metadataKey,
    dedupCaseInsensitive(out.map((v) => v.trim()).filter(Boolean))
  );
}

function applyDropKey(custom, rule) {
  custom.delete(rule.metadataKey);
}

function applySetValue(custom, rule) {
  const cfg = rule.config || {};
  if (!Array.isArray(cfg.values) || cfg.values.length === 0) return;
  // Take a fresh slice so a single rule object reused across many topics
  // doesn't accidentally share an array reference.
  writeValues(custom, rule.metadataKey, cfg.values.slice());
}

function applyCopyFrom(custom, rule) {
  const cfg = rule.config || {};
  const sourceKey = cfg.sourceKey;
  if (!sourceKey) return;
  const sourceValues = readValues(custom, sourceKey);
  if (sourceValues.length === 0) {
    if (cfg.mode === 'replace') custom.delete(rule.metadataKey);
    return;
  }
  if (cfg.mode === 'append') {
    const existing = readValues(custom, rule.metadataKey);
    writeValues(
      custom,
      rule.metadataKey,
      dedupCaseInsensitive(existing.concat(sourceValues))
    );
  } else {
    writeValues(custom, rule.metadataKey, sourceValues.slice());
  }
}

// ── Public entry point ────────────────────────────────────────────────────
//
// applyRulesToTopic(topic, rules, { vocabularyTermIndexes? })
//   - rules: array already filtered to the active set the caller wants
//     applied (engine doesn't re-check `enabled` / `scope`).
//   - rules are applied in the order given; the service layer is
//     responsible for sorting by (metadataKey, priority).
//
// Returns a tiny report so callers can roll up per-document or per-job
// telemetry without re-walking the rule list.
function applyRulesToTopic(topic, rules, ctx = {}) {
  const errors = [];
  let appliedCount = 0;
  if (!Array.isArray(rules) || rules.length === 0) {
    return { appliedCount, errors };
  }
  const custom = ensureCustomMap(topic);
  const context = {
    vocabularyTermIndexes: ctx.vocabularyTermIndexes || new Map(),
  };
  for (const rule of rules) {
    const handler = RULE_HANDLERS[rule.type];
    if (!handler) {
      errors.push({ ruleId: String(rule.id || ''), message: `Unknown rule type: ${rule.type}` });
      continue;
    }
    try {
      handler(custom, rule, context);
      appliedCount += 1;
    } catch (err) {
      errors.push({
        ruleId: String(rule.id || ''),
        type: rule.type,
        metadataKey: rule.metadataKey,
        message: err && err.message ? err.message : String(err),
      });
    }
  }
  return { appliedCount, errors };
}

module.exports = {
  applyRulesToTopic,
  // Exported for unit tests and the validation pass in enrichService.
  ensureCustomMap,
  dedupCaseInsensitive,
  RULE_HANDLERS,
};
