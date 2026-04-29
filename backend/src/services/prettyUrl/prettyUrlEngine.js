// Pretty URL engine — pure(ish) functions that parse a template string,
// resolve the metadata variables it references, and emit a normalized,
// slash-separated URL path.
//
// The engine itself does *not* read the database; callers feed it
// already-loaded documents/topics and a config object so it can be unit
// tested and reused by the read-side resolver, the ingestion tail, and
// the reprocess worker.
//
// Template grammar (as described in the docs):
//
//   /static/{$metadata_key}/more/{$another_key}
//
// Anything between a single pair of braces and prefixed by `$` is a
// metadata variable. The leading `/` is optional in user input — the
// engine adds one before normalization. Static path segments and
// metadata segments are slugified independently and joined with `/`,
// preserving the slash structure the admin typed.

const RESERVED_TO_FIELD = {
  // Map a few well-known reserved keys onto the document's first-class
  // fields. Anything not in this map falls through to metadata.custom
  // (lower-cased lookup).
  $title: ['title'],
  '$ft:title': ['title'],
  '$ft:prettyurl': ['prettyUrl'],
  '$document.ft:prettyurl': ['prettyUrl'],
  $author: ['metadata', 'author'],
  $product: ['metadata', 'product'],
  $language: ['language'],
  $originalfilename: ['originalFilename'],
};

// --- normalization helpers ---------------------------------------------------

function stripAccents(str) {
  // NFKD splits combining marks; we then drop anything in the diacritics
  // range. This is the same approach Fluid Topics uses for its own
  // canonicalisation.
  return String(str || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

// Slugify a single fragment (one path segment). We deliberately do *not*
// touch slashes here — the template is split on `/` first.
function slugifyFragment(raw, { lowercase, removeAccents }) {
  let s = String(raw == null ? '' : raw);
  if (removeAccents) s = stripAccents(s);
  if (lowercase) s = s.toLowerCase();
  // Replace anything that isn't an URL-safe character with `-`. We keep
  // letters, digits, and a small allowlist (.~_) that the docs say can
  // appear unchanged. Hyphens are collapsed and stripped from the edges.
  s = s.replace(/[^a-zA-Z0-9._~-]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

// Stitch a list of already-slugified fragments back into a path. Empty
// fragments are dropped entirely so a missing optional value collapses
// the surrounding slashes instead of leaving `/`/.
function joinPath(fragments) {
  const cleaned = fragments
    .map((f) => (f == null ? '' : String(f)))
    .filter((f) => f.length > 0);
  if (cleaned.length === 0) return '';
  return '/' + cleaned.join('/');
}

// --- template parsing --------------------------------------------------------

// Split a template string into an ordered list of segments where each
// segment is either { kind: 'literal', value } or { kind: 'var', key }.
// We split on `/` first so the slash structure of the template is
// preserved verbatim.
function parseTemplate(template) {
  const safe = String(template || '').trim();
  if (!safe) return [];
  // Strip a leading slash; we always re-add one in joinPath.
  const stripped = safe.replace(/^\/+/, '');
  const pathSegs = stripped.split('/');
  const segments = [];

  for (const seg of pathSegs) {
    if (!seg) continue;
    // A segment can mix literal text and variable refs:
    //   "docs-{$product}-{$version}"
    // We tokenise inside one segment and emit one composite "segment".
    const tokens = [];
    let i = 0;
    while (i < seg.length) {
      const open = seg.indexOf('{', i);
      if (open === -1) {
        tokens.push({ kind: 'literal', value: seg.slice(i) });
        break;
      }
      if (open > i) tokens.push({ kind: 'literal', value: seg.slice(i, open) });
      const close = seg.indexOf('}', open + 1);
      if (close === -1) {
        // Unbalanced — treat the remainder as literal.
        tokens.push({ kind: 'literal', value: seg.slice(open) });
        break;
      }
      const inner = seg.slice(open + 1, close).trim();
      // Variables are written `$key`; tolerate a missing `$` for
      // forgiveness.
      const key = inner.startsWith('$') ? inner : '$' + inner;
      tokens.push({ kind: 'var', key });
      i = close + 1;
    }
    segments.push(tokens);
  }
  return segments;
}

// Extract the list of variable keys referenced by a template (without
// the leading `$`). Used by the admin to suggest requirement rows.
function extractVarsFromTemplate(template) {
  const segs = parseTemplate(template);
  const set = new Set();
  for (const tokens of segs) {
    for (const t of tokens) {
      if (t.kind === 'var') {
        set.add(t.key.replace(/^\$/, ''));
      }
    }
  }
  return Array.from(set);
}

// --- value resolution --------------------------------------------------------

function readPath(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

// Pull the first useful string value for a variable key out of the
// document/topic metadata bag. Returns `null` when the key is missing.
function resolveVariable(key, { document, topic, source }) {
  // `source` indicates where to look first for document templates:
  //   'document' (default) → document.metadata.* / document.* / customMap
  //   'topic'              → first topic's metadata.custom + topic.title
  // For topic templates we always read off the topic.
  const lowerKey = key.toLowerCase();

  // Reserved fields short-circuit to first-class document/topic fields.
  if (RESERVED_TO_FIELD[lowerKey]) {
    const path = RESERVED_TO_FIELD[lowerKey];

    // When `source` is 'topic' (i.e. we're rendering a topic-scope
    // template), prefer topic-level values for fields that topics share
    // with documents — most importantly `title`. Without this, every
    // topic inside a document would inherit the document title.
    //
    // Variables that explicitly reference the document (prefixed with
    // "document.") always read from the document regardless of source.
    const isDocumentScoped = lowerKey.startsWith('$document.');

    if (!isDocumentScoped && (source === 'topic' || (!document && topic))) {
      // Topic-first: try topic, then document as fallback
      if (topic) {
        const fromTopic = readPath(topic, path);
        if (fromTopic != null && fromTopic !== '') return Array.isArray(fromTopic) ? fromTopic[0] : fromTopic;
      }
      const fromDoc = document ? readPath(document, path) : undefined;
      if (fromDoc != null && fromDoc !== '') return Array.isArray(fromDoc) ? fromDoc[0] : fromDoc;
    } else {
      // Document-first (default for doc-scope templates)
      const fromDoc = document ? readPath(document, path) : undefined;
      if (fromDoc != null && fromDoc !== '') return Array.isArray(fromDoc) ? fromDoc[0] : fromDoc;
      if (topic) {
        const fromTopic = readPath(topic, path);
        if (fromTopic != null && fromTopic !== '') return Array.isArray(fromTopic) ? fromTopic[0] : fromTopic;
      }
    }
    return null;
  }

  // Bare metadata key — read from the right bag depending on source.
  const bagOrder = [];
  if (source === 'topic' || (!document && topic)) {
    if (topic?.metadata?.custom) bagOrder.push(topic.metadata.custom);
    if (topic?.metadata) bagOrder.push(topic.metadata);
  } else {
    if (document?.metadata?.custom) bagOrder.push(document.metadata.custom);
    if (document?.metadata) bagOrder.push(document.metadata);
    if (document?.metadata?.customFields) bagOrder.push(document.metadata.customFields);
    // Document templates with topicSource=true on a requirement read off
    // the first topic; the service is expected to pass `source: 'topic'`
    // for that variable individually.
  }

  // Strip the leading `$` (templates use `$key` literals; lookup keys are bare).
  const bareKey = lowerKey.replace(/^\$/, '');

  for (const bag of bagOrder) {
    if (!bag) continue;
    const got = readFromBag(bag, bareKey);
    if (got != null && got !== '') return got;
  }
  return null;
}

// Read from a Mongo Map / plain object / Mongoose subdoc using a
// case-insensitive lookup. Returns the first non-empty stringifiable
// value (Map values are arrays of strings per our metadata.custom shape).
function readFromBag(bag, key) {
  if (!bag) return null;

  if (bag instanceof Map) {
    if (bag.has(key)) {
      const v = bag.get(key);
      return Array.isArray(v) ? v.find((x) => x != null && x !== '') ?? null : v;
    }
    for (const [k, v] of bag.entries()) {
      if (String(k).toLowerCase() === key) {
        return Array.isArray(v) ? v.find((x) => x != null && x !== '') ?? null : v;
      }
    }
    return null;
  }

  if (typeof bag === 'object') {
    if (Object.prototype.hasOwnProperty.call(bag, key)) {
      const v = bag[key];
      return Array.isArray(v) ? v.find((x) => x != null && x !== '') ?? null : v;
    }
    for (const k of Object.keys(bag)) {
      if (k.toLowerCase() === key) {
        const v = bag[k];
        return Array.isArray(v) ? v.find((x) => x != null && x !== '') ?? null : v;
      }
    }
  }
  return null;
}

// --- rendering ---------------------------------------------------------------

// Try a single template. Returns either { url, missingKeys: [] } or
// { url: null, missingKeys: [...] } when at least one *required*
// requirement could not be resolved.
function tryRender(template, { document, topic, requirements = [], config }) {
  const segs = parseTemplate(template.template || template);
  const norm = {
    lowercase: !!(config?.lowercase ?? true),
    removeAccents: !!(config?.removeAccents ?? true),
  };

  // Build a per-key source override map from the requirement rows so the
  // admin's "from topic" toggle is honoured during rendering.
  const sourceOverride = new Map();
  for (const r of requirements) {
    if (!r?.key) continue;
    sourceOverride.set(r.key.toLowerCase().replace(/^\$/, ''), r.topicSource ? 'topic' : 'document');
  }
  const requiredSet = new Set(
    requirements
      .filter((r) => r?.key && r.required !== false)
      .map((r) => r.key.toLowerCase().replace(/^\$/, ''))
  );

  const missingKeys = [];
  const renderedSegments = [];

  for (const tokens of segs) {
    const parts = [];
    for (const t of tokens) {
      if (t.kind === 'literal') {
        parts.push(slugifyFragment(t.value, norm));
        continue;
      }
      const bare = t.key.toLowerCase().replace(/^\$/, '');
      const src = sourceOverride.get(bare) || (topic ? 'topic' : 'document');
      const val = resolveVariable(t.key, { document, topic, source: src });
      if (val == null || val === '') {
        if (requiredSet.has(bare) || requirements.length === 0) {
          // No requirement rows at all → every variable is implicitly
          // required (matches the doc's "match the first template whose
          // metadata is all populated" rule). Otherwise honour the
          // `required` flag explicitly.
          missingKeys.push(bare);
        }
        parts.push('');
      } else {
        // If the resolved value is itself a URL path (contains slashes),
        // e.g. {document.ft:prettyUrl} resolving to "/docs/manual/foo",
        // we need to split it on '/' and add each segment separately so
        // the slash structure is preserved rather than collapsed to dashes.
        const strVal = String(val);
        if (bare.includes('prettyurl') && strVal.includes('/')) {
          const pathParts = strVal.replace(/^\/+/, '').split('/').filter(Boolean);
          // Push each segment of the prettyUrl as a separate rendered
          // segment (skipping the current one). We slugify each part
          // individually to keep the path structure intact.
          for (const pp of pathParts) {
            renderedSegments.push(slugifyFragment(pp, norm));
          }
          // Mark this segment's parts as empty so it collapses
          continue;
        }
        parts.push(slugifyFragment(val, norm));
      }
    }
    // If the segment produced *only* empty fragments because of a missing
    // optional variable, drop it entirely so adjacent slashes collapse.
    const joined = parts.filter((p) => p.length > 0).join('-');
    renderedSegments.push(joined);
  }

  if (missingKeys.length > 0) {
    return { url: null, missingKeys };
  }
  return { url: joinPath(renderedSegments), missingKeys: [] };
}

// Walk an ordered list of templates and return the URL produced by the
// first one whose requirements all resolve. Templates already pre-sorted
// by section + priority by the caller.
function renderForDocument(document, templates, config) {
  for (const tpl of templates) {
    const out = tryRender(tpl, { document, requirements: tpl.requirements || [], config });
    if (out.url != null) return { url: out.url, templateId: tpl._id };
  }
  return { url: '', templateId: null };
}

function renderForTopic(topic, document, templates, config) {
  for (const tpl of templates) {
    const out = tryRender(tpl, { topic, document, requirements: tpl.requirements || [], config });
    if (out.url != null) return { url: out.url, templateId: tpl._id };
  }
  return { url: '', templateId: null };
}

module.exports = {
  parseTemplate,
  extractVarsFromTemplate,
  slugifyFragment,
  joinPath,
  tryRender,
  renderForDocument,
  renderForTopic,
};
