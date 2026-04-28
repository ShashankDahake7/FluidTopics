const mongoose = require('mongoose');

// Header document for a single vocabulary uploaded by an admin from the
// Knowledge Hub → Vocabularies page. The actual term graph lives in
// VocabularyTerm rows so a 50k-term taxonomy doesn't bloat the header.
//
// `name` is always lowercased + trimmed so case-insensitive uniqueness can
// be enforced cheaply with a unique index. `displayName` keeps the original
// casing for the table.
//
// `s3*` fields point at the original uploaded file kept verbatim under
// `vocabularies/<vocabId>/<filename>` so admins can re-download exactly what
// they sent us. The parsed terms in VocabularyTerm are the authoritative
// source for runtime expansion; the S3 file is purely the audit copy.
const vocabularySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    format: {
      type: String,
      enum: ['csv', 'skos'],
      required: true,
    },
    sourceFilename: { type: String, default: '' },
    s3Bucket: { type: String, default: '' },
    s3Key: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    checksum: { type: String, default: '' },
    // Languages discovered while parsing the file. `'*'` denotes a
    // language-agnostic term (CSV row with empty language, or SKOS
    // prefLabel without an `xml:lang` tag).
    languages: { type: [String], default: [] },
    // When true, `synonymProjector` injects this vocabulary's synonyms into
    // every topic's `metadata.indexedValues` at ingest / reprocess time.
    usedInSearch: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['ready', 'parsing', 'failed'],
      default: 'ready',
    },
    parseError: { type: String, default: '' },
    termCount: { type: Number, default: 0, min: 0 },
    // Drives the dot in the admin table — flipped on whenever the vocab is
    // created/updated/deleted with `usedInSearch: true`, cleared by the
    // reprocess worker on completion.
    updatedSinceReprocess: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vocabulary', vocabularySchema);
