const express = require('express');
const Topic = require('../models/Topic');
const { optionalAuth, auth } = require('../middleware/auth');
const { trackEvent } = require('../services/analytics/analyticsService');

const router = express.Router();

// GET /api/topics — List topics with pagination & filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      product,
      tags,
      level,
      documentId,
      language,
    } = req.query;

    const filter = {};
    if (product) filter['metadata.product'] = product;
    if (tags) filter['metadata.tags'] = { $in: tags.split(',') };
    if (level) filter['hierarchy.level'] = parseInt(level);
    if (documentId) filter.documentId = documentId;
    if (language) filter['metadata.language'] = language;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [topics, total] = await Promise.all([
      Topic.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('title slug metadata hierarchy.level viewCount createdAt documentId')
        .lean(),
      Topic.countDocuments(filter),
    ]);

    res.json({
      topics,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/popular — Most viewed topics
router.get('/popular', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topics = await Topic.find()
      .sort({ viewCount: -1 })
      .limit(limit)
      .select('title slug metadata viewCount hierarchy.level')
      .lean();

    res.json({ topics });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/recent — Recently updated topics
router.get('/recent', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topics = await Topic.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('title slug metadata viewCount hierarchy.level updatedAt')
      .lean();

    res.json({ topics });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/tree — Topic tree for navigation
router.get('/tree', async (req, res, next) => {
  try {
    const { documentId } = req.query;
    const filter = { 'hierarchy.level': 1 };
    if (documentId) filter.documentId = documentId;

    const rootTopics = await Topic.find(filter)
      .sort({ 'hierarchy.order': 1 })
      .select('title slug hierarchy documentId')
      .populate({
        path: 'hierarchy.children',
        select: 'title slug hierarchy',
        populate: {
          path: 'hierarchy.children',
          select: 'title slug hierarchy',
        },
      })
      .lean();

    res.json({ tree: rootTopics });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/by-slug/:slug — Get topic by slug
router.get('/by-slug/:slug', optionalAuth, async (req, res, next) => {
  try {
    const topic = await Topic.findOne({ slug: req.params.slug })
      .populate('hierarchy.parent', 'title slug')
      .populate('hierarchy.children', 'title slug')
      .populate('relatedTopics', 'title slug metadata.tags');

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Increment view count
    topic.viewCount = (topic.viewCount || 0) + 1;
    await topic.save();

    // Track view
    trackEvent({
      eventType: 'view',
      userId: req.user?._id || null,
      data: { topicId: topic._id },
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }).catch(() => {});

    res.json({ topic });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/:id — Get single topic by ID
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate('hierarchy.parent', 'title slug')
      .populate('hierarchy.children', 'title slug')
      .populate('relatedTopics', 'title slug metadata.tags');

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Increment view count
    topic.viewCount = (topic.viewCount || 0) + 1;
    await topic.save();

    // Track view
    trackEvent({
      eventType: 'view',
      userId: req.user?._id || null,
      data: { topicId: topic._id },
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }).catch(() => {});

    res.json({ topic });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/:id/related — Get related topics
router.get('/:id/related', async (req, res, next) => {
  try {
    const { getRecommendations } = require('../services/recommendation/recommendationService');
    const limit = parseInt(req.query.limit) || 5;
    const recommendations = await getRecommendations(req.params.id, limit);
    res.json({ related: recommendations });
  } catch (error) {
    next(error);
  }
});

// POST /api/topics/:id/translate — AI translate topic body (does not persist; client may save separately).
router.post('/:id/translate', auth, async (req, res, next) => {
  try {
    const TranslationProfile = require('../models/TranslationProfile');
    const { translateText } = require('../services/ai/groqService');
    const { targetLocale = 'en', sourceLocale, profile } = req.body || {};

    const topic = await Topic.findById(req.params.id).select('title slug content metadata');
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const raw = topic.content?.html || topic.content?.text || '';
    if (!raw.trim()) return res.status(400).json({ error: 'Topic has no translatable content' });

    let prof = null;
    if (profile) prof = await TranslationProfile.findOne({ name: String(profile) }).lean();
    if (!prof) prof = await TranslationProfile.findOne({ isDefault: true }).lean();
    if (!prof) prof = await TranslationProfile.findOne().sort({ createdAt: 1 }).lean();

    const translated = await translateText({
      text: raw.slice(0, 12000),
      sourceLocale: sourceLocale || topic.metadata?.language || 'en',
      targetLocale,
      systemPrompt: prof?.systemPrompt,
      model: prof?.model,
      temperature: prof?.temperature,
    });

    if (!translated && !process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Translation service not configured (GROQ_API_KEY).' });
    }

    res.json({
      translatedText: translated,
      topicId: String(topic._id),
      slug: topic.slug,
      title: topic.title,
      sourceLocale: sourceLocale || topic.metadata?.language || 'en',
      targetLocale,
      profileUsed: prof?.name || null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
