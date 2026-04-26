const express = require('express');
const { search, suggest } = require('../services/search/searchService');
const { getSearchBoostParams } = require('../services/personalization/personalizationService');
const { generateAnswer } = require('../services/ai/groqService');
const { trackEvent } = require('../services/analytics/analyticsService');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

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
    if (language) filters.language = language;
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
