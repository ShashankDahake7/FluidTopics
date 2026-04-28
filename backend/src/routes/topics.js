const express = require('express');
const Topic = require('../models/Topic');
const Document = require('../models/Document');
const AccessRule = require('../models/AccessRule');
const AccessRulesConfig = require('../models/AccessRulesConfig');
const {
  userCanBypass,
  buildMetaBagForTopic,
  matchAllRequirements,
  ruleGrantsAccessToUser,
  defaultRuleAllows,
} = require('../services/accessRules/accessRulesService');
const { optionalAuth, auth } = require('../middleware/auth');
const { trackEvent } = require('../services/analytics/analyticsService');

const router = express.Router();

// Filters an array of topic plain-objects down to those the supplied user is
// allowed to read under the active access-rule set. The privileged-bypass
// short-circuits BRD: "ADMIN, KHUB_ADMIN, and CONTENT_PUBLISHER users can see
// all content".
async function filterTopicsForUser(topics, user) {
  if (!Array.isArray(topics) || topics.length === 0) return topics;
  if (userCanBypass(user)) return topics;

  const cfg = await AccessRulesConfig.getSingleton();
  const activeRules = await AccessRule.find({ status: 'Active', inactiveSet: false })
    .populate('groups', 'name').lean();

  // If no active rules and default rule allows everyone, skip evaluation.
  if (activeRules.length === 0 && defaultRuleAllows(cfg, user)) return topics;

  const docIds = Array.from(new Set(topics.map((t) => String(t.documentId)).filter(Boolean)));
  const docs = await Document.find({ _id: { $in: docIds } }).select('title originalFilename sourceFormat metadata').lean();
  const docById = new Map(docs.map((d) => [String(d._id), d]));

  return topics.filter((t) => {
    const doc = docById.get(String(t.documentId)) || null;
    const bag = buildMetaBagForTopic(t, doc);
    const matching = activeRules.filter((r) => matchAllRequirements(r, bag));
    if (matching.length === 0) return defaultRuleAllows(cfg, user);
    for (const r of matching) {
      if (r.authMode === 'auto') {
        const autoVals = bag[r.autoBindKey] || [];
        if (ruleGrantsAccessToUser({ ...r, _autoMatchedValues: autoVals }, user)) return true;
      } else if (ruleGrantsAccessToUser(r, user)) {
        return true;
      }
    }
    return false;
  });
}

// GET /api/topics — List topics with pagination & filtering
router.get('/', optionalAuth, async (req, res, next) => {
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

    // Apply access rules — privileged users bypass; everyone else gets only
    // topics whose document/topic metadata matches a granting rule (or whose
    // default rule grants access).
    const visible = await filterTopicsForUser(topics, req.user);

    res.json({
      topics:    visible,
      total,
      page:      parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      hidden:    topics.length - visible.length,
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

    if (!userCanBypass(req.user)) {
      const visible = await filterTopicsForUser(
        [topic.toObject ? topic.toObject() : topic], req.user
      );
      if (visible.length === 0) {
        return res.status(403).json({ error: 'Access denied by access rules.' });
      }
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

    if (!userCanBypass(req.user)) {
      const visible = await filterTopicsForUser(
        [topic.toObject ? topic.toObject() : topic], req.user
      );
      if (visible.length === 0) {
        return res.status(403).json({ error: 'Access denied by access rules.' });
      }
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
