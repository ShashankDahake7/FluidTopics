// Helpers for pulling arbitrary metadata key/value pairs out of parsed
// content. Two callers:
//   * htmlParser.js  → extractFromHtmlCheerio($) for <meta name=...>
//   * xmlParser.js   → extractFromDitaCheerio($) for <othermeta>, <prolog>
//
// Both helpers return a plain JS object: { [key]: [values...] }. The shape
// matches the eventual Topic.metadata.custom Map. Values are deduped per
// key but order is preserved.

const { RESERVED_KEYS } = require('../../models/MetadataKey');

// Built-in HTML <meta> names we already pull out as first-class fields and
// don't want polluting the registry. Lower-cased.
const HTML_BUILTIN_META = new Set([
  'description',
  'keywords',
  'author',
  'viewport',
  'charset',
  'content-type',
  'content-language',
  'language',
  'generator',
  'robots',
  'googlebot',
  'theme-color',
]);

// Built-in DITA <othermeta>/<prolog> children we already cover via
// dedicated topic fields. Lower-cased.
const DITA_BUILTIN_META = new Set([
  'author',
  'language',
  'audience',
  'critdates',
  'permissions',
  'metadata',
  'resourceid',
  'source',
  'publisher',
  'copyright',
]);

function pushValue(map, rawKey, rawValue) {
  if (!rawKey) return;
  const key = String(rawKey).trim();
  if (!key) return;
  // Drop anything that collides with a reserved Topic.metadata field — it
  // would shadow the typed field at projection time.
  if (RESERVED_KEYS.includes(key.toLowerCase())) return;

  const value = (rawValue == null ? '' : String(rawValue)).trim();
  if (!value) return;

  const existing = map[key] || [];
  if (!existing.includes(value)) {
    existing.push(value);
    map[key] = existing;
  }
}

// Walks <meta name="X" content="Y"> + <meta property="og:X" content="Y">
// and collects any custom key not already covered by the built-in fields.
function extractFromHtmlCheerio($) {
  const out = {};
  if (!$) return out;

  $('meta[name]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (!name) return;
    if (HTML_BUILTIN_META.has(String(name).trim().toLowerCase())) return;
    pushValue(out, name, content);
  });

  // OpenGraph / Twitter cards live on `property` instead of `name`.
  $('meta[property]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (!prop) return;
    pushValue(out, prop, content);
  });

  return out;
}

// Walks DITA prolog metadata. Two shapes:
//   <prolog>
//     <metadata>
//       <othermeta name="reference" content="AD1000"/>
//     </metadata>
//   </prolog>
// and the sibling form where othermeta lives directly under <prolog>.
// Also walks <bookmeta> for ditamaps.
function extractFromDitaCheerio($) {
  const out = {};
  if (!$) return out;

  $('othermeta').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (!name) return;
    if (DITA_BUILTIN_META.has(String(name).trim().toLowerCase())) return;
    pushValue(out, name, content);
  });

  // Direct children of <prolog>/<metadata>/<bookmeta> with @class or
  // unrecognised tag names. We treat the tag name itself as the key and
  // the inner text as the value — common in FrameMaker/FTML exports.
  $('prolog > *, prolog > metadata > *, bookmeta > *').each((_, el) => {
    const tag = (el.tagName || el.name || '').toLowerCase();
    if (!tag) return;
    if (tag === 'othermeta') return; // handled above
    if (tag === 'metadata') return;  // container — descended into above
    if (DITA_BUILTIN_META.has(tag)) return;

    const text = $(el).text().trim();
    if (!text) return;
    pushValue(out, tag, text);
  });

  return out;
}

// Convenience: copy a custom-metadata bag onto a topicData object that's
// about to be persisted. Mirrors the shape Topic.metadata.custom expects.
function mergeIntoTopic(topicData, customMap) {
  if (!topicData || !customMap || typeof customMap !== 'object') return topicData;
  topicData.metadata = topicData.metadata || {};
  // Plain object is fine — Mongoose coerces to Map at save time.
  topicData.metadata.custom = { ...(topicData.metadata.custom || {}), ...customMap };
  return topicData;
}

module.exports = {
  extractFromHtmlCheerio,
  extractFromDitaCheerio,
  mergeIntoTopic,
  HTML_BUILTIN_META,
  DITA_BUILTIN_META,
};
