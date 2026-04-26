const mongoose = require('mongoose');

// A reusable LLM configuration for translation jobs. Admins can register
// multiple profiles (different providers, models, system prompts, source/
// target language pairs) and the API selects one per request.
const translationProfileSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    provider:    { type: String, default: 'groq' },          // 'groq' | 'openai' | …
    model:       { type: String, default: 'llama-3.3-70b-versatile' },
    systemPrompt:{ type: String, default: 'You are a precise translator. Preserve formatting (Markdown, HTML, code blocks). Reply with the translated text only.' },
    temperature: { type: Number, default: 0.2, min: 0, max: 2 },
    sourceLanguages: [{ type: String }], // empty = any
    targetLanguages: [{ type: String }], // empty = any
    isDefault:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.TranslationProfile
  || mongoose.model('TranslationProfile', translationProfileSchema);
