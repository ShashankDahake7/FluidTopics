const mongoose = require('mongoose');

// One row per (vocabularyId, termId, language). For CSV imports a single
// canonical id may carry multiple language rows; for SKOS the same
// `skos:Concept` resource produces one term per `xml:lang` tag.
//
// Indexed for two access patterns:
//   1. The synonymProjector cache loads every term of every active vocab
//      grouped by (vocabularyId, termId, language) so we want the compound
//      index to drive that scan.
//   2. The future Enrich-and-Clean rule editor needs label autocomplete,
//      which the prefLabel + altLabels indexes cover.
const vocabularyTermSchema = new mongoose.Schema(
  {
    vocabularyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      required: true,
      index: true,
    },
    termId: { type: String, required: true, trim: true },
    // ISO 639-1 lower-case (`en`, `fr`, ...) or `'*'` for language-agnostic.
    language: { type: String, default: '*', trim: true, lowercase: true },
    prefLabel: { type: String, required: true, trim: true },
    altLabels: { type: [String], default: [] },
    // SKOS hierarchy: the broader (parent) term's id. Captured here so the
    // upcoming Enrich-and-Clean tagging rules can walk up a taxonomy.
    broader: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

vocabularyTermSchema.index({ vocabularyId: 1, termId: 1, language: 1 });
vocabularyTermSchema.index({ vocabularyId: 1, prefLabel: 1 });
vocabularyTermSchema.index({ vocabularyId: 1, altLabels: 1 });

module.exports = mongoose.model('VocabularyTerm', vocabularyTermSchema);
