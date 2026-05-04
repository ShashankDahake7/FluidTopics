const express = require('express');
const { search, suggest, semanticSearch } = require('../services/search/searchService');
const { getSearchBoostParams } = require('../services/personalization/personalizationService');
const { generateAnswer } = require('../services/ai/groqService');
const { trackEvent } = require('../services/analytics/analyticsService');
const { clientSessionIdFromReq } = require('../utils/clientSessionId');
const { analyticsFromReq } = require('../utils/clientIp');
const { isSuspiciousSearchQuery } = require('../utils/searchQuerySafety');
const { optionalAuth } = require('../middleware/auth');
const UnstructuredDocument = require('../models/UnstructuredDocument');
const AccessRule = require('../models/AccessRule');
const AccessRulesConfig = require('../models/AccessRulesConfig');
const {
  userCanBypass,
  buildMetaBagForTopic,
  matchAllRequirements,
  ruleGrantsAccessToUser,
  defaultRuleAllows,
  filterSearchHitsForUser: filterHitsByAccessRules,
  filterDocumentsForUser,
} = require('../services/accessRules/accessRulesService');

const router = express.Router();

// Drops search hits whose backing topic is hidden by access rules. Operates on
// the result.hits[] array shape produced by services/search/searchService.
async function filterSearchHitsForUser(hits, user) {
  return filterHitsByAccessRules(hits, user);
}

async function resolveSearchLanguage(req, explicit) {
  if (explicit === '*' || explicit === 'all') return null;
  if (explicit) return explicit;
  if (!req.user) return null;
  const User = require('../models/User');
  const u = await User.findById(req.user.id).select('preferences.language').lean();
  return u?.preferences?.language || null;
}

/** Stored on analytics events to distinguish "search in all languages" from implicit profile locale. */
function normalizeSearchLanguageParam(language) {
  if (language == null || language === '') return '';
  const s = String(language).trim();
  const lower = s.toLowerCase();
  if (lower === 'all') return 'all';
  if (s === '*' || lower === '*') return '*';
  return s;
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

    // Apply access rules — privileged users (ADMIN, KHUB_ADMIN,
    // CONTENT_PUBLISHER) bypass; everyone else loses hits whose backing topic
    // is rule-gated.
    if (Array.isArray(results.hits) && results.hits.length) {
      const visible = await filterSearchHitsForUser(results.hits, req.user);
      if (visible.length !== results.hits.length) {
        results.hidden = (results.hits.length - visible.length);
        results.total  = Math.max(0, (results.total || 0) - results.hidden);
        results.hits   = visible;
      }
    }

    let unstructuredHits = results.unstructuredHits || [];
    if (unstructuredHits.length) {
      const ids = unstructuredHits.map((h) => h.unstructuredId).filter(Boolean);
      const uDocs = await UnstructuredDocument.find({ _id: { $in: ids } }).lean();
      const visibleU = await filterDocumentsForUser(uDocs, req.user);
      const allow = new Set(visibleU.map((d) => String(d._id)));
      const before = unstructuredHits.length;
      unstructuredHits = unstructuredHits.filter((h) => allow.has(h.unstructuredId));
      const uHidden = before - unstructuredHits.length;
      if (uHidden) {
        results.unstructuredHidden = uHidden;
        results.unstructuredTotal = Math.max(0, (results.unstructuredTotal || 0) - uHidden);
      }
    }
    results.unstructuredHits = unstructuredHits;

    const topicTotalForDisplay = results.total || 0;
    results.total = topicTotalForDisplay + (results.unstructuredTotal || 0);

    if (Array.isArray(results.hits) && results.hits.length) {
      const Document = require('../models/Document');
      const docIds = [...new Set(results.hits.map((h) => h.documentId).filter(Boolean))];
      if (docIds.length) {
        const docs = await Document.find({ _id: { $in: docIds } })
          .select('_id prettyUrl').lean();
        const map = Object.fromEntries(docs.map((d) => [String(d._id), d.prettyUrl || '']));
        results.hits = results.hits.map((h) => ({
          ...h,
          documentPrettyUrl: h.documentId ? map[String(h.documentId)] || '' : '',
        }));
      }
    }

    // Track search event (suspicious / injection-like queries are not recorded — FT behavior)
    if (!isSuspiciousSearchQuery(query || '')) {
      trackEvent({
        eventType: 'search',
        userId: req.user?._id || null,
        sessionId: clientSessionIdFromReq(req),
        data: {
          query: query || '',
          resultCount: results.total,
          responseTime,
          filters,
          searchLanguageParam: normalizeSearchLanguageParam(language),
        },
        userAgent: req.headers['user-agent'],
        ...analyticsFromReq(req),
      }).catch((e) => console.warn('Analytics tracking error:', e.message));
    }

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
        .select('title metadata isPaligoFormat publication topicIds createdAt prettyUrl')
        .lean();
      const visibleDocs = await filterDocumentsForUser(docHits, req.user);
      documents = visibleDocs.map((d) => ({
        _id: String(d._id),
        title: d.publication?.portalTitle || d.title,
        description: d.metadata?.description || '',
        tags: d.metadata?.tags || [],
        topicCount: d.topicIds?.length || 0,
        isPaligo: d.isPaligoFormat || false,
        prettyUrl: d.prettyUrl || '',
      }));
    }

    // Filter and enrich topic hits with their parent doc prettyUrl (mirrors /search).
    let enrichedTopics = await filterSearchHitsForUser(topicResults.hits, req.user);
    if (Array.isArray(enrichedTopics) && enrichedTopics.length) {
      const docIds = [...new Set(enrichedTopics.map((h) => h.documentId).filter(Boolean))];
      if (docIds.length) {
        const docs = await Document.find({ _id: { $in: docIds } })
          .select('_id prettyUrl').lean();
        const map = Object.fromEntries(docs.map((d) => [String(d._id), d.prettyUrl || '']));
        enrichedTopics = enrichedTopics.map((h) => ({
          ...h,
          documentPrettyUrl: h.documentId ? map[String(h.documentId)] || '' : '',
        }));
      }
    }

    res.json({
      total: enrichedTopics.length + documents.length,
      topics:    enrichedTopics,
      documents,
      facets:    topicResults.facets,
      responseTime: 0,
    });
  } catch (err) { next(err); }
});

// GET /api/search/semantic — Atlas Search `moreLikeThis` over title +
// content.text. A real embedding-based vector search would replace this; for
// now MLT gives a reasonable similarity signal without an embedding pipeline.
router.get('/semantic', optionalAuth, async (req, res, next) => {
  try {
    const { q: query = '', limit = 20 } = req.query;
    if (!query.trim()) return res.json({ total: 0, hits: [] });

    const { hits } = await semanticSearch({
      query: query.trim(),
      limit: parseInt(limit, 10) || 20,
    });
    const visible = await filterSearchHitsForUser(hits, req.user);
    res.json({ total: visible.length, hits: visible });
  } catch (err) { next(err); }
});

// GET /api/search/semantic/clustered — semantic + clustered combo.
router.get('/semantic/clustered', optionalAuth, async (req, res, next) => {
  try {
    const query = (req.query.q || '').toString().trim();
    if (!query) return res.json({ total: 0, topics: [], documents: [], facets: {} });

    const { hits, facets } = await semanticSearch({
      query,
      limit: parseInt(req.query.limit, 10) || 10,
    });
    const visibleHits = await filterSearchHitsForUser(hits, req.user);

    const docIds = [...new Set(visibleHits.map((t) => t.documentId).filter(Boolean))];
    const Document = require('../models/Document');
    const docs = docIds.length
      ? await Document.find({ _id: { $in: docIds } })
          .select('title metadata publication topicIds sourceFormat originalFilename').lean()
      : [];
    const visibleDocs = await filterDocumentsForUser(docs, req.user);

    res.json({
      total: visibleHits.length + visibleDocs.length,
      topics: visibleHits,
      documents: visibleDocs.map((d) => ({
        _id: String(d._id),
        title: d.publication?.portalTitle || d.title,
        description: d.metadata?.description || '',
      })),
      facets,
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
router.get('/suggest', optionalAuth, async (req, res, next) => {
  try {
    const { q: prefix } = req.query;
    if (!prefix || prefix.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await suggest(prefix);
    const topicSuggestions = suggestions.filter((s) => s.id && s.kind !== 'template');
    const visibleTopicSuggestions = await filterSearchHitsForUser(
      topicSuggestions.map((s) => ({ ...s, _id: s.id })),
      req.user
    );
    const visibleIds = new Set(visibleTopicSuggestions.map((s) => String(s.id || s._id)));
    res.json({
      suggestions: suggestions.filter((s) => s.kind === 'template' || !s.id || visibleIds.has(String(s.id))),
    });
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

    const visibleHits = await filterSearchHitsForUser(searchResults.hits || [], req.user);
    if (visibleHits.length === 0) {
      return res.json({ answer: 'I could not find any documentation relevant to your question.', sources: [] });
    }

    // 2. Prepare context for the AI
    const contexts = visibleHits.slice(0, 3).map(hit => ({
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
