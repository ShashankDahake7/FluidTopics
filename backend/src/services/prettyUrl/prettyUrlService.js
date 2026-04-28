// Pretty URL service — orchestrates the engine against the database.
//
// Responsibilities:
//   - Load (and cache) the *active* template set + global config.
//   - Render document- and topic-level URLs against that set.
//   - Persist the URLs back onto the documents/topics.
//
// The engine itself is pure; this layer is the only one that touches
// Mongoose models. It is shared by:
//   - The ingestion tail (one document at a time).
//   - The reprocess worker (every document in the corpus).
//   - The admin "preview" endpoint (single doc, draft templates).

const Document = require('../../models/Document');
const Topic = require('../../models/Topic');
const PrettyUrlTemplate = require('../../models/PrettyUrlTemplate');
const PrettyUrlConfig = require('../../models/PrettyUrlConfig');
const { renderForDocument, renderForTopic } = require('./prettyUrlEngine');

// Tiny in-process cache for the active template set + config. The admin
// activate/save flow calls invalidateCache() so the next regeneration
// picks up the new state without restarting the server.
let activeCache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function invalidateCache() {
  activeCache = null;
  cacheLoadedAt = 0;
}

async function loadActiveSet({ force = false } = {}) {
  const now = Date.now();
  if (!force && activeCache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return activeCache;
  }
  const [docTemplates, topicTemplates, cfg] = await Promise.all([
    PrettyUrlTemplate.find({ scope: 'document', state: 'active' })
      .sort({ priority: 1, createdAt: 1 })
      .lean(),
    PrettyUrlTemplate.find({ scope: 'topic', state: 'active' })
      .sort({ priority: 1, createdAt: 1 })
      .lean(),
    PrettyUrlConfig.getSingleton(),
  ]);
  activeCache = {
    docTemplates,
    topicTemplates,
    config: { lowercase: cfg.lowercase, removeAccents: cfg.removeAccents },
  };
  cacheLoadedAt = now;
  return activeCache;
}

// Sort topics into a stable hierarchy-aware order so URL generation is
// deterministic. We follow the children pointers depth-first; topics
// without a parent are roots, ordered by hierarchy.order then title.
function orderTopicsHierarchically(topics) {
  const byId = new Map(topics.map((t) => [String(t._id), t]));
  const childrenOf = new Map();
  for (const t of topics) {
    const parent = t.hierarchy?.parent ? String(t.hierarchy.parent) : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(t);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => {
      const ao = a.hierarchy?.order ?? 0;
      const bo = b.hierarchy?.order ?? 0;
      if (ao !== bo) return ao - bo;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }
  const ordered = [];
  const visit = (parentKey) => {
    const arr = childrenOf.get(parentKey) || [];
    for (const t of arr) {
      ordered.push(t);
      visit(String(t._id));
    }
  };
  visit(null);
  // Anything orphaned (e.g. dangling parent pointer) — append in title order.
  if (ordered.length < topics.length) {
    const seen = new Set(ordered.map((t) => String(t._id)));
    const leftovers = topics
      .filter((t) => !seen.has(String(t._id)))
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    ordered.push(...leftovers);
  }
  return ordered;
}

// De-duplicate URLs within a document. The docs allow two publications
// to share a URL globally, but two topics inside the same document
// rendering identically would be hostile to navigation, so we suffix
// collisions inside a doc with `-2`, `-3`, etc.
function deduplicateWithinDoc(entries) {
  const seen = new Map();
  for (const e of entries) {
    if (!e.url) continue;
    const count = (seen.get(e.url) || 0) + 1;
    seen.set(e.url, count);
    if (count > 1) {
      e.url = `${e.url}-${count}`;
    }
  }
  return entries;
}

/**
 * Recompute the prettyUrl for a single document and all of its topics.
 * Returns { documentId, documentUrl, topicUrlCount }.
 *
 * Safe to call from ingestion (one doc at a time) and from the worker
 * (in a streaming loop). Failures are surfaced to the caller, which
 * decides whether to log/swallow them.
 */
async function regenerateForDocument(documentId, { activeSet } = {}) {
  const set = activeSet || (await loadActiveSet());
  const doc = await Document.findById(documentId);
  if (!doc) return { documentId, documentUrl: '', topicUrlCount: 0, found: false };

  const topics = await Topic.find({ documentId })
    .select('_id title slug hierarchy metadata sourcePath documentId')
    .lean();

  const ordered = orderTopicsHierarchically(topics);

  // Document URL — prefer document scope; fall back to first topic if no
  // doc-level template matched.
  const docResult = renderForDocument(doc, set.docTemplates, set.config);

  // Topic URLs — render every topic against the topic-scope set, with
  // the document available for cross-references like $product that may
  // live on the doc rather than the topic.
  const topicResults = ordered.map((t) => ({
    topicId: t._id,
    url: renderForTopic(t, doc, set.topicTemplates, set.config).url,
  }));
  deduplicateWithinDoc(topicResults);

  // Persist. Single update for the doc; bulkWrite for topics so we do
  // one round-trip even on big publications.
  doc.prettyUrl = docResult.url || '';
  await doc.save();

  if (topicResults.length) {
    const ops = topicResults.map(({ topicId, url }) => ({
      updateOne: {
        filter: { _id: topicId },
        update: { $set: { prettyUrl: url || '' } },
      },
    }));
    await Topic.bulkWrite(ops, { ordered: false });
  }

  return {
    documentId: String(doc._id),
    documentUrl: doc.prettyUrl,
    topicUrlCount: topicResults.filter((t) => t.url).length,
  };
}

module.exports = {
  loadActiveSet,
  invalidateCache,
  orderTopicsHierarchically,
  regenerateForDocument,
};
