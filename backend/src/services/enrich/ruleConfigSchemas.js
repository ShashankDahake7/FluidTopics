// Per-type validators for the Enrich-and-Clean rule library.
//
// Each validator returns:
//   { ok: true, value: <normalised config> }
//   { ok: false, error: <human readable message> }
//
// They are pure (no DB), synchronous, and side-effect free. The service
// layer is responsible for any cross-cutting checks that need DB lookups
// (e.g. "does this vocabularyId actually exist?").

const RULE_TYPES = [
  'enrich',
  'clean',
  'find_replace',
  'regex_replace',
  'drop_key',
  'set_value',
  'copy_from',
];

function ok(value) { return { ok: true, value }; }
function fail(error) { return { ok: false, error }; }

function isObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function isString(v) { return typeof v === 'string'; }

function asTrimmedString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function isObjectIdString(v) {
  if (!isString(v)) return false;
  return /^[a-fA-F0-9]{24}$/.test(v);
}

// enrich — config: { vocabularyId: ObjectIdString }
//
// The service layer is responsible for proving the referenced vocabulary
// exists; we just shape-check here so totally-bogus payloads short-circuit
// before they hit Mongo.
function validateEnrich(raw) {
  const cfg = isObject(raw) ? raw : {};
  const vocabularyId = asTrimmedString(cfg.vocabularyId);
  if (!isObjectIdString(vocabularyId)) {
    return fail('enrich rules require a valid vocabularyId.');
  }
  return ok({ vocabularyId });
}

// clean — config: {} (no parameters)
//
// We tolerate (and discard) extra keys so a future config addition
// doesn't break stored rules.
function validateClean() {
  return ok({});
}

// find_replace — config: { find: string, replace: string, caseSensitive?: bool }
function validateFindReplace(raw) {
  const cfg = isObject(raw) ? raw : {};
  if (!isString(cfg.find) || cfg.find.length === 0) {
    return fail('find_replace rules require a non-empty `find` string.');
  }
  if (!isString(cfg.replace)) {
    return fail('find_replace rules require a `replace` string (use "" to drop matches).');
  }
  return ok({
    find: cfg.find,
    replace: cfg.replace,
    caseSensitive: !!cfg.caseSensitive,
  });
}

// regex_replace — config: { pattern: string, flags?: string, replace: string }
//
// We compile-test the regex here so save-time errors surface cleanly to
// the admin instead of failing every topic at apply-time. Note that we
// always force the `g` flag so callers don't have to remember it: every
// in-value occurrence should be replaced by default. Callers can still
// pass `i`, `m`, `s`, `u` for the usual flag knobs.
function validateRegexReplace(raw) {
  const cfg = isObject(raw) ? raw : {};
  if (!isString(cfg.pattern) || cfg.pattern.length === 0) {
    return fail('regex_replace rules require a non-empty `pattern`.');
  }
  if (!isString(cfg.replace)) {
    return fail('regex_replace rules require a `replace` string (use "" to drop matches).');
  }
  const flags = isString(cfg.flags) ? cfg.flags : '';
  // De-dup user-supplied flags and force the `g` flag.
  const flagSet = new Set(flags.split(''));
  for (const f of flagSet) {
    if (!'gimsuy'.includes(f)) {
      return fail(`regex_replace flag "${f}" is not supported.`);
    }
  }
  flagSet.add('g');
  const normalisedFlags = Array.from(flagSet).sort().join('');
  try {
    // Compile to surface SyntaxErrors at save time.
    void new RegExp(cfg.pattern, normalisedFlags);
  } catch (err) {
    return fail(`Invalid regex pattern: ${err.message}`);
  }
  return ok({
    pattern: cfg.pattern,
    flags: normalisedFlags,
    replace: cfg.replace,
  });
}

// drop_key — config: {} (the metadataKey on the rule itself is the target)
function validateDropKey() {
  return ok({});
}

// set_value — config: { values: [string] }
//
// At least one value is required (otherwise the rule is equivalent to
// drop_key, which is a clearer expression of intent).
function validateSetValue(raw) {
  const cfg = isObject(raw) ? raw : {};
  if (!Array.isArray(cfg.values) || cfg.values.length === 0) {
    return fail('set_value rules require a non-empty `values` array.');
  }
  const values = [];
  for (const v of cfg.values) {
    if (v == null) continue;
    const sv = asTrimmedString(v);
    if (sv) values.push(sv);
  }
  if (values.length === 0) {
    return fail('set_value rules require at least one non-empty value.');
  }
  return ok({ values });
}

// copy_from — config: { sourceKey: string, mode: 'replace'|'append' }
//
// `sourceKey` must differ from the rule's metadataKey to avoid the
// trivial cycle; the service layer also walks the rule graph to detect
// transitive cycles across multiple rules.
function validateCopyFrom(raw, { metadataKey } = {}) {
  const cfg = isObject(raw) ? raw : {};
  const sourceKey = asTrimmedString(cfg.sourceKey).toLowerCase();
  if (!sourceKey) {
    return fail('copy_from rules require a `sourceKey`.');
  }
  if (metadataKey && sourceKey === asTrimmedString(metadataKey).toLowerCase()) {
    return fail('copy_from cannot use the same key as both source and target.');
  }
  const mode = cfg.mode === 'append' ? 'append' : 'replace';
  return ok({ sourceKey, mode });
}

const VALIDATORS = {
  enrich: validateEnrich,
  clean: validateClean,
  find_replace: validateFindReplace,
  regex_replace: validateRegexReplace,
  drop_key: validateDropKey,
  set_value: validateSetValue,
  copy_from: validateCopyFrom,
};

// Single entry point used by the service layer. Returns:
//   { ok: true, value: <normalised config>, type, metadataKey }
//   { ok: false, error: <message> }
function validateRule({ type, config, metadataKey }) {
  if (!RULE_TYPES.includes(type)) {
    return fail(`Unsupported rule type "${type}".`);
  }
  const key = asTrimmedString(metadataKey).toLowerCase();
  if (!key) return fail('metadataKey is required.');
  const validator = VALIDATORS[type];
  const result = validator(config, { metadataKey: key });
  if (!result.ok) return result;
  return { ok: true, value: result.value, type, metadataKey: key };
}

module.exports = {
  RULE_TYPES,
  validateRule,
  validateEnrich,
  validateClean,
  validateFindReplace,
  validateRegexReplace,
  validateDropKey,
  validateSetValue,
  validateCopyFrom,
};
