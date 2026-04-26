const express = require('express');
const { auth } = require('../middleware/auth');
const TranslationProfile = require('../models/TranslationProfile');
const { translateText } = require('../services/ai/groqService');

const router = express.Router();

async function resolveProfile(name) {
  if (name) {
    const p = await TranslationProfile.findOne({ name: String(name) }).lean();
    if (p) return p;
  }
  let def = await TranslationProfile.findOne({ isDefault: true }).lean();
  if (!def) def = await TranslationProfile.findOne().sort({ createdAt: 1 }).lean();
  return def;
}

/**
 * POST /api/ai/translate — translate arbitrary text (uses default TranslationProfile when present).
 */
router.post('/translate', auth, async (req, res, next) => {
  try {
    const { text, sourceLocale, targetLocale, profile } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    const prof = await resolveProfile(profile);
    const systemPrompt = prof?.systemPrompt
      || 'You are a precise translator. Preserve formatting (Markdown, HTML, code blocks). Reply with the translated text only.';
    const translated = await translateText({
      text: text.slice(0, 12000),
      sourceLocale: sourceLocale || 'auto',
      targetLocale: targetLocale || 'en',
      systemPrompt,
      model: prof?.model,
      temperature: prof?.temperature,
    });
    if (!translated && !process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Translation service not configured (GROQ_API_KEY).' });
    }
    res.json({
      translatedText: translated,
      sourceLocale: sourceLocale || null,
      targetLocale: targetLocale || 'en',
      profileUsed: prof?.name || null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
