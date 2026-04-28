// Stable-identity derivation for topics across publications.
//
// `stableId` is the merge key diff-ingest uses to decide whether a
// candidate topic from a freshly-parsed zip corresponds to an existing
// Topic._id under the same Document. Keep an existing _id around and
// every downstream artifact keyed by it (bookmarks, ratings, view
// counts, prettyUrl, customRaw snapshots, Atlas Search entries) survives
// the re-publish.
//
// Per-format strategy:
//
//   Paligo:   reuse the parser-emitted `originId` directly. It's already
//             a stable per-source identifier baked into the export.
//   Generic:  sha1(documentId + ':' + sourcePath). The path inside the
//             zip is the closest analogue to a stable identifier for
//             HTML / DOCX / Markdown / XML exports.
//   Fallback: sha1(documentId + ':title:' + slug). For single-file
//             ingest where sourcePath is empty (and for ad-hoc HTML
//             where the title is the only stable-ish thing).
//
// Edge case explicitly accepted: renaming a file inside a generic zip
// looks like DELETE + INSERT (its old _id is gone). Paligo is immune
// because the originId is the file-independent identifier.

const crypto = require('crypto');

function sha1Hex(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

// Compute the stable id for a topic candidate. `documentId` is REQUIRED
// — different documents must never collide on the same stableId, even
// when they happen to ship a file at the same path.
function computeStableId({ documentId, sourcePath, originId, title, slug } = {}) {
  if (!documentId) return '';
  const docId = String(documentId);
  if (originId) {
    const id = String(originId).trim();
    if (id) return `paligo:${id}`;
  }
  if (sourcePath && String(sourcePath).trim()) {
    return `path:${sha1Hex(`${docId}:${String(sourcePath).trim()}`)}`;
  }
  // Final fallback — only the title/slug pair is stable. This is good
  // enough for single-file ingest where two re-uploads of an updated
  // file should still merge.
  if (slug && String(slug).trim()) {
    return `slug:${sha1Hex(`${docId}:slug:${String(slug).trim()}`)}`;
  }
  if (title && String(title).trim()) {
    return `title:${sha1Hex(`${docId}:title:${String(title).trim()}`)}`;
  }
  return '';
}

// Canonical content hash for a topic candidate. Deliberately leaves out
// any auto-generated fields (the topic _id, prettyUrl, viewCount, etc.)
// so the hash only changes when the source content actually changed.
//
// Order of object keys matters here — Object.keys order is stable for
// non-numeric string keys in modern V8, so two callers passing the same
// data in the same shape produce the same hash.
function computeTopicContentHash({ html, text, custom, hierarchy } = {}) {
  const customStable = stableiseCustom(custom);
  const orderKey = Number.isFinite(hierarchy?.order) ? hierarchy.order : 0;
  const levelKey = Number.isFinite(hierarchy?.level) ? hierarchy.level : 1;
  const payload = JSON.stringify({
    html: String(html || ''),
    text: String(text || ''),
    custom: customStable,
    order: orderKey,
    level: levelKey,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Map<string,string[]> / plain object → sorted [k, v[]] pairs so the
// content hash doesn't flip on incidental key ordering differences from
// upstream parsers.
function stableiseCustom(custom) {
  if (!custom) return [];
  const entries = custom instanceof Map
    ? Array.from(custom.entries())
    : Object.entries(custom);
  return entries
    .map(([k, v]) => {
      const values = Array.isArray(v)
        ? v.map((x) => String(x))
        : (v == null ? [] : [String(v)]);
      values.sort();
      return [String(k), values];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
}

module.exports = {
  computeStableId,
  computeTopicContentHash,
};
