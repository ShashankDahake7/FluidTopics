const mongoose = require('mongoose');
const Topic = require('../../models/Topic');

const SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || 'default';
const AUTOCOMPLETE_INDEX = process.env.ATLAS_AUTOCOMPLETE_INDEX || 'autocomplete_title';

const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
};
const toObjectIds = (ids) =>
  (ids || []).map(toObjectId).filter(Boolean);

// Atlas Search returns highlights as:
//   [{ path: 'title', score, texts: [{ value, type: 'hit'|'text' }] }, ...]
// The frontend / RAG code expects the legacy ES shape:
//   { title: ['<mark>foo</mark> bar'], content: ['…snippet…', '…snippet…'] }
// Convert here so callers don't change.
const toLegacyHighlight = (raw, query) => {
  const out = {};
  if (!Array.isArray(raw)) return out;
  for (const h of raw) {
    const fragment = (h.texts || [])
      .map((t) => (t.type === 'hit' ? `<mark>${t.value}</mark>` : t.value))
      .join('');
    // Normalize content.text → content for parity with the old ES output.
    const key = h.path === 'content.text' ? 'content' : h.path;
    if (!out[key]) out[key] = [];
    out[key].push(fragment);
  }
  return out;
};

// Build the `compound` operator that powers /api/search.
// `must` = required match (drives recall + score), `filter` = hard filters
// (no score impact, drops non-matches), `should` = optional clauses that only
// add score when they match — this is how we replicate ES function_score.
const buildCompound = ({ query, filters, boost, titlesOnly, sort }) => {
  const compound = { must: [], filter: [], should: [] };
  const q = (query || '').trim();

  if (q) {
    if (titlesOnly) {
      compound.must.push({
        text: {
          query: q,
          path: 'title',
          fuzzy: { maxEdits: 1 },
          score: { boost: { value: 3 } },
        },
      });
    } else {
      compound.must.push({
        compound: {
          should: [
            { text: { query: q, path: 'title',          fuzzy: { maxEdits: 1 }, score: { boost: { value: 3 } } } },
            { text: { query: q, path: 'content.text',   fuzzy: { maxEdits: 1 } } },
            { text: { query: q, path: 'metadata.tags',                            score: { boost: { value: 2 } } } },
          ],
          minimumShouldMatch: 1,
        },
      });
    }
  } else {
    // Empty query → match-all. Atlas has no match_all op, but `exists` on _id
    // is true for every document.
    compound.must.push({ exists: { path: '_id' } });
  }

  // ---- hard filters ----
  if (filters.tags?.length) {
    compound.filter.push({ in: { path: 'metadata.tags', value: filters.tags } });
  }
  if (filters.product) {
    compound.filter.push({ equals: { path: 'metadata.product', value: filters.product } });
  }
  if (filters.version) {
    compound.filter.push({ equals: { path: 'metadata.version', value: filters.version } });
  }
  if (filters.language) {
    compound.filter.push({ equals: { path: 'metadata.language', value: filters.language } });
  }
  if (Array.isArray(filters.documentIds) && filters.documentIds.length) {
    const ids = toObjectIds(filters.documentIds);
    if (ids.length) compound.filter.push({ in: { path: 'documentId', value: ids } });
  }
  if (Array.isArray(filters.topicIds) && filters.topicIds.length) {
    const ids = toObjectIds(filters.topicIds);
    if (ids.length) compound.filter.push({ in: { path: '_id', value: ids } });
  }

  // ---- personalization boosts (only on relevance sort) ----
  if (boost && sort === 'relevance') {
    if (boost.tags?.length) {
      compound.should.push({
        in: { path: 'metadata.tags', value: boost.tags },
        score: { constant: { value: 1.5 } },
      });
    }
    if (boost.products?.length) {
      compound.should.push({
        in: { path: 'metadata.product', value: boost.products },
        score: { constant: { value: 2.0 } },
      });
    }
    if (boost.documentIds?.length) {
      const ids = toObjectIds(boost.documentIds);
      if (ids.length) compound.should.push({
        in: { path: 'documentId', value: ids },
        score: { constant: { value: 3.0 } },
      });
    }
    if (boost.topicIds?.length) {
      const ids = toObjectIds(boost.topicIds);
      if (ids.length) compound.should.push({
        in: { path: '_id', value: ids },
        score: { constant: { value: 5.0 } },
      });
    }
    if (boost.releaseNotes) {
      compound.should.push({
        in: { path: 'metadata.tags', value: ['Release Notes'] },
        score: { constant: { value: 2.5 } },
      });
    }
  }

  return compound;
};

// Project a Topic into the legacy ES `_source` shape so existing route /
// frontend code keeps working unchanged.
const PROJECTION = {
  id: { $toString: '$_id' },
  score: { $meta: 'searchScore' },
  highlightRaw: { $meta: 'searchHighlights' },
  title: 1,
  slug: 1,
  documentId: { $toString: '$documentId' },
  topicId: { $toString: '$_id' },
  // Keep `content` as the nested object (RAG endpoint reads `content.text`)
  // and also expose flat fields the frontend expects.
  content: { text: '$content.text' },
  tags: '$metadata.tags',
  product: '$metadata.product',
  version: '$metadata.version',
  language: '$metadata.language',
  author: '$metadata.author',
  hierarchyLevel: '$hierarchy.level',
  viewCount: 1,
  createdAt: 1,
  updatedAt: 1,
};

const search = async ({ query, filters = {}, page = 1, limit = 20, sort = 'relevance', boost = null, titlesOnly = false }) => {
  const compound = buildCompound({ query, filters, boost, titlesOnly, sort });

  const $search = {
    index: SEARCH_INDEX,
    compound,
    highlight: { path: ['title', 'content.text'] },
    count: { type: 'total' },
  };
  if (sort === 'date')  $search.sort = { updatedAt: -1 };
  if (sort === 'views') $search.sort = { viewCount: -1 };

  const from = (page - 1) * limit;

  // Run hits + facets/count in parallel. Splitting the meta call keeps the
  // hits pipeline lean (no facet collector overhead for every query).
  const [hits, meta] = await Promise.all([
    Topic.aggregate([
      { $search },
      { $skip: from },
      { $limit: limit },
      { $project: PROJECTION },
    ]),
    Topic.aggregate([
      { $searchMeta: {
          index: SEARCH_INDEX,
          facet: {
            operator: { compound },
            facets: {
              tags:      { type: 'string', path: 'metadata.tags',     numBuckets: 20 },
              products:  { type: 'string', path: 'metadata.product',  numBuckets: 10 },
              versions:  { type: 'string', path: 'metadata.version',  numBuckets: 10 },
              languages: { type: 'string', path: 'metadata.language', numBuckets: 10 },
            },
          },
          count: { type: 'total' },
      } },
    ]),
  ]);

  const metaDoc = meta?.[0] || {};
  const total = metaDoc.count?.total ?? metaDoc.count?.lowerBound ?? 0;
  const facetsRaw = metaDoc.facet || {};
  const bucketsToFacet = (b = []) => b.map((x) => ({ value: x._id, count: x.count }));

  const formattedHits = hits.map((h) => {
    const { highlightRaw, ...rest } = h;
    return {
      ...rest,
      highlight: toLegacyHighlight(highlightRaw, query),
    };
  });

  return {
    hits: formattedHits,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    facets: {
      tags:      bucketsToFacet(facetsRaw.tags?.buckets),
      products:  bucketsToFacet(facetsRaw.products?.buckets),
      versions:  bucketsToFacet(facetsRaw.versions?.buckets),
      languages: bucketsToFacet(facetsRaw.languages?.buckets),
    },
  };
};

// Auto-complete via a dedicated Atlas Search autocomplete index on `title`.
const suggest = async (prefix) => {
  const results = await Topic.aggregate([
    { $search: {
        index: AUTOCOMPLETE_INDEX,
        autocomplete: {
          query: prefix,
          path: 'title',
          fuzzy: { maxEdits: 1 },
        },
    } },
    { $limit: 8 },
    { $project: {
        _id: 0,
        id: { $toString: '$_id' },
        text: '$title',
        score: { $meta: 'searchScore' },
    } },
  ]);
  return results;
};

// "More like this" replacement for the /api/search/semantic endpoint.
// Uses Atlas Search `moreLikeThis` against title + content.text.
const semanticSearch = async ({ query, limit = 20 }) => {
  const $search = {
    index: SEARCH_INDEX,
    moreLikeThis: {
      like: [{ title: query, 'content.text': query }],
    },
    highlight: { path: ['title', 'content.text'] },
    count: { type: 'total' },
  };

  const [hits, meta] = await Promise.all([
    Topic.aggregate([
      { $search },
      { $limit: limit },
      { $project: PROJECTION },
    ]),
    Topic.aggregate([
      { $searchMeta: {
          index: SEARCH_INDEX,
          facet: {
            operator: { moreLikeThis: { like: [{ title: query, 'content.text': query }] } },
            facets: {
              tags: { type: 'string', path: 'metadata.tags', numBuckets: 20 },
            },
          },
          count: { type: 'total' },
      } },
    ]),
  ]);

  const metaDoc = meta?.[0] || {};
  const total = metaDoc.count?.total ?? metaDoc.count?.lowerBound ?? 0;
  const formattedHits = hits.map((h) => {
    const { highlightRaw, ...rest } = h;
    return { ...rest, highlight: toLegacyHighlight(highlightRaw, query) };
  });

  return {
    hits: formattedHits,
    total,
    facets: {
      tags: (metaDoc.facet?.tags?.buckets || []).map((b) => ({ value: b._id, count: b.count })),
    },
  };
};

// In-document search (powers /api/portal/documents/:id/search). Same shape
// as the old ES call but returns plain {_id, title, titleHtml, snippet}.
const inDocumentSearch = async ({ query, documentId, topicIds = null, releaseNotesOnly = false, limit = 50 }) => {
  const docId = toObjectId(documentId);
  if (!docId) return { total: 0, hits: [] };

  const compound = {
    must: [{
      compound: {
        should: [
          { text: { query, path: 'title',        fuzzy: { maxEdits: 1 }, score: { boost: { value: 3 } } } },
          { text: { query, path: 'content.text', fuzzy: { maxEdits: 1 } } },
          { text: { query, path: 'metadata.tags',                          score: { boost: { value: 2 } } } },
        ],
        minimumShouldMatch: 1,
      },
    }],
    filter: [{ equals: { path: 'documentId', value: docId } }],
  };

  if (Array.isArray(topicIds) && topicIds.length) {
    const ids = toObjectIds(topicIds);
    if (ids.length) compound.filter.push({ in: { path: '_id', value: ids } });
  }
  if (releaseNotesOnly) {
    compound.filter.push({ in: { path: 'metadata.tags', value: ['Release Notes'] } });
  }

  const hits = await Topic.aggregate([
    { $search: {
        index: SEARCH_INDEX,
        compound,
        highlight: { path: ['title', 'content.text'] },
    } },
    { $limit: limit },
    { $project: {
        _id: 1,
        title: 1,
        score: { $meta: 'searchScore' },
        highlightRaw: { $meta: 'searchHighlights' },
    } },
  ]);

  return {
    total: hits.length,
    hits: hits.map((h) => ({
      _id: String(h._id),
      title: h.title,
      score: h.score,
      highlight: toLegacyHighlight(h.highlightRaw, query),
    })),
  };
};

module.exports = { search, suggest, semanticSearch, inDocumentSearch };
