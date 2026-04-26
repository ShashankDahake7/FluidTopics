const express = require('express');
const { search, suggest } = require('../services/search/searchService');
const { getSearchBoostParams } = require('../services/personalization/personalizationService');
const { generateAnswer } = require('../services/ai/groqService');
const { trackEvent } = require('../services/analytics/analyticsService');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

async function resolveSearchLanguage(req, explicit) {
  if (explicit === '*' || explicit === 'all') return null;
  if (explicit) return explicit;
  if (!req.user) return null;
  const User = require('../models/User');
  const u = await User.findById(req.user.id).select('preferences.language').lean();
  return u?.preferences?.language || null;
}

// GET /api/search — Full-text search with facets
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      q: query,
      page = 1,
      limit = 20,
      sort = 'relevance',
      tags,
      product,
      version,
      language,
      titlesOnly,
    } = req.query;

    const filters = {};
    if (tags) filters.tags = tags.split(',');
    if (product) filters.product = product;
    if (version) filters.version = version;
    const effLang = await resolveSearchLanguage(req, language);
    if (effLang) filters.language = effLang;
    if (req.query.documentIds) filters.documentIds = req.query.documentIds.split(',').filter(Boolean);
    if (req.query.topicIds)    filters.topicIds    = req.query.topicIds.split(',').filter(Boolean);

    let boost = null;
    if (req.user && sort === 'relevance') {
      boost = await getSearchBoostParams(req.user._id);
    }

    const startTime = Date.now();
    const results = await search({
      query,
      filters,
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      boost,
      titlesOnly: titlesOnly === '1' || titlesOnly === 'true',
    });
    const responseTime = Date.now() - startTime;

    // Track search event
    trackEvent({
      eventType: 'search',
      userId: req.user?._id || null,
      data: {
        query: query || '',
        resultCount: results.total,
        responseTime,
        filters,
      },
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }).catch((e) => console.warn('Analytics tracking error:', e.message));

    res.json({
      ...results,
      responseTime,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/clustered — clustered hits across topics + documents + facets
// Returns the FT shape: { topics, documents, facets } so a single call powers
// a layout that mixes structured doc cards and topic hits side by side.
router.get('/clustered', optionalAuth, async (req, res, next) => {
  try {
    const { q: query = '', limit = 10, language } = req.query;
    const Document = require('../models/Document');
    const Topic = require('../models/Topic');

    const effLang = await resolveSearchLanguage(req, language);
    const filters = effLang ? { language: effLang } : {};

    // Reuse the ES search for topics so highlighting + facets stay consistent.
    const topicResults = await search({
      query,
      filters,
      page: 1,
      limit: parseInt(limit, 10) || 10,
      sort: 'relevance',
      boost: req.user ? await getSearchBoostParams(req.user._id) : null,
    });

    // Independently surface matching Documents (regex over title / description / tags).
    let documents = [];
    if (query.trim()) {
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      const docHits = await Document.find({
        status: 'completed',
        $or: [{ title: rx }, { 'metadata.description': rx }, { 'metadata.tags': rx }],
      })
        .limit(parseInt(limit, 10) || 10)
        .select('title metadata isPaligoFormat publication topicIds createdAt')
        .lean();
      documents = docHits.map((d) => ({
        _id: String(d._id),
        title: d.publication?.portalTitle || d.title,
        description: d.metadata?.description || '',
        tags: d.metadata?.tags || [],
        topicCount: d.topicIds?.length || 0,
        isPaligo: d.isPaligoFormat || false,
      }));
    }

    res.json({
      total: topicResults.total + documents.length,
      topics:    topicResults.hits,
      documents,
      facets:    topicResults.facets,
      responseTime: 0,
    });
  } catch (err) { next(err); }
});

// GET /api/search/semantic — keyword-augmented "more-like-this" search.
// True vector embeddings would replace this; for now we use ES `more_like_this`
// over title+content which gives a reasonable similarity signal without an
// embedding pipeline.
router.get('/semantic', optionalAuth, async (req, res, next) => {
  try {
    const { q: query = '', limit = 20 } = req.query;
    if (!query.trim()) return res.json({ total: 0, hits: [] });

    const { getElasticClient } = require('../config/elasticsearch');
    const cfg = require('../config/env');
    const client = getElasticClient();
    const result = await client.search({
      index: cfg.elasticsearch.index,
      body: {
        query: {
          more_like_this: {
            fields: ['title', 'content'],
            like: query,
            min_term_freq: 1,
            min_doc_freq: 1,
            max_query_terms: 25,
          },
        },
        highlight: {
          fields: { title: { number_of_fragments: 0 }, content: { fragment_size: 200, number_of_fragments: 2 } },
          pre_tags: ['<mark>'], post_tags: ['</mark>'],
        },
        size: parseInt(limit, 10) || 20,
      },
    });

    const hits = (result.hits.hits || []).map((h) => ({
      id: h._id, score: h._score, ...h._source, highlight: h.highlight || {},
    }));
    const totalRaw = result.hits.total;
    const total = typeof totalRaw === 'object' ? (totalRaw?.value ?? 0) : (totalRaw ?? 0);
    res.json({ total, hits });
  } catch (err) { next(err); }
});

// GET /api/search/semantic/clustered — semantic + clustered combo.
router.get('/semantic/clustered', optionalAuth, async (req, res, next) => {
  try {
    req.url = req.url.replace('/semantic/clustered', '/semantic');
    // Run semantic search, then fold into the clustered shape.
    const { getElasticClient } = require('../config/elasticsearch');
    const cfg = require('../config/env');
    const client = getElasticClient();
    const query = (req.query.q || '').toString().trim();
    if (!query) return res.json({ total: 0, topics: [], documents: [], facets: {} });

    const result = await client.search({
      index: cfg.elasticsearch.index,
      body: {
        query: {
          more_like_this: {
            fields: ['title', 'content'],
            like: query,
            min_term_freq: 1, min_doc_freq: 1, max_query_terms: 25,
          },
        },
        size: parseInt(req.query.limit, 10) || 10,
        aggs: { tags: { terms: { field: 'tags', size: 20 } } },
      },
    });

    const topicHits = (result.hits.hits || []).map((h) => ({ id: h._id, score: h._score, ...h._source }));
    const docIds = [...new Set(topicHits.map((t) => t.documentId).filter(Boolean))];
    const Document = require('../models/Document');
    const docs = await Document.find({ _id: { $in: docIds } })
      .select('title metadata publication topicIds').lean();

    res.json({
      total: topicHits.length + docs.length,
      topics: topicHits,
      documents: docs.map((d) => ({
        _id: String(d._id),
        title: d.publication?.portalTitle || d.title,
        description: d.metadata?.description || '',
      })),
      facets: { tags: (result.aggregations?.tags?.buckets || []).map((b) => ({ value: b.key, count: b.doc_count })) },
    });
  } catch (err) { next(err); }
});

// GET /api/search/opensearch.xml — OpenSearch description so browsers can
// register the portal as a search engine.
router.get('/opensearch.xml', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'application/opensearchdescription+xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Darwinbox Docs</ShortName>
  <Description>Search Darwinbox product documentation</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" template="${origin}/search?q={searchTerms}"/>
  <Url type="application/json" template="${origin}/api/search?q={searchTerms}"/>
</OpenSearchDescription>`);
});

// GET /api/search/suggest — Auto-complete suggestions
router.get('/suggest', async (req, res, next) => {
  try {
    const { q: prefix } = req.query;
    if (!prefix || prefix.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await suggest(prefix);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/ask — RAG (Retrieval-Augmented Generation) Ask AI
router.get('/ask', optionalAuth, async (req, res, next) => {
  try {
    const { q: query } = req.query;
    if (!query || query.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a valid question.' });
    }

    // 1. Get top 3 relevant topics to use as context
    let boost = null;
    if (req.user) boost = await getSearchBoostParams(req.user._id);

    const searchResults = await search({
      query,
      page: 1,
      limit: 3,
      sort: 'relevance',
      boost,
    });

    if (searchResults.hits.length === 0) {
      return res.json({ answer: 'I could not find any documentation relevant to your question.', sources: [] });
    }

    // 2. Prepare context for the AI
    const contexts = searchResults.hits.map(hit => ({
      title: hit.title,
      content: hit.content?.text || hit.content?.html?.replace(/<[^>]+>/g, '') || '', // strip html if needed
      id: hit.id,
    }));

    // 3. Generate answer using Groq
    const answer = await generateAnswer(query, contexts);

    res.json({
      answer,
      sources: contexts.map(c => ({ id: c.id, title: c.title }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
