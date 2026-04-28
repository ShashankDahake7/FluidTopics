const mongoose = require('mongoose');

// Cache for validation results, keyed by the raw zip's sha256 hash.
//
// The validate worker re-scans the entire extracted manifest looking for
// missing topics, broken links, unresolved xrefs etc. That work is purely
// a function of the extracted bytes — so two Publications uploading the
// exact same zip should produce identical summaries. We persist the
// summary on success and short-circuit straight to it on the next match.
//
// Any missing-topic / broken-link counts surfaced through this cache are
// indistinguishable from a freshly-computed run, so the rest of the
// pipeline (drawer, ingest gate) treats them the same. Failures are NOT
// cached — a failed validation always re-runs.
const validationCacheSchema = new mongoose.Schema(
  {
    // sha256 hex of the raw zip bytes. Same value the Publication stores
    // as `contentHash`.
    _id: { type: String, required: true },

    // Mirrors the worker's `summary` message exactly so the caller can
    // hand-fill the Publication.validation object without any massaging.
    summary: {
      missingTopicCount:      { type: Number, default: 0 },
      missingAttachmentCount: { type: Number, default: 0 },
      brokenLinkCount:        { type: Number, default: 0 },
      unresolvedXrefCount:    { type: Number, default: 0 },
      hasParseableContent:    { type: Boolean, default: true },
    },

    validatedAt: { type: Date, default: () => new Date() },
    // For ops dashboards — not used in the pipeline.
    hitCount:    { type: Number, default: 0 },
  },
  { _id: false, timestamps: false }
);

validationCacheSchema.index({ validatedAt: 1 });

module.exports = mongoose.model('ValidationCache', validationCacheSchema);
