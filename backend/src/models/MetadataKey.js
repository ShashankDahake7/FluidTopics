const mongoose = require('mongoose');

// Registry of every metadata key the Knowledge Hub knows about. Rows are
// either created automatically when a new key shows up during ingestion, or
// manually via the Metadata configuration admin page (`manual: true`).
//
// `name` is always stored lowercase + trimmed so we can do case-insensitive
// uniqueness in MongoDB without a collation. `displayName` carries the
// original casing for the UI.
//
// The `valuesSample` array is capped at 10 entries (per the docs) and is
// used purely to render the "Values" column on the admin table — search and
// reprojection always read from each Topic's full `metadata.custom` map.
const metadataKeySchema = new mongoose.Schema(
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
    isIndexed: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDate: {
      type: Boolean,
      default: false,
      index: true,
    },
    manual: {
      type: Boolean,
      default: false,
    },
    // Up to 10 representative values for the admin "Values" column. The
    // ingestion pipeline tops this up via $addToSet + $slice so we never
    // unbounded-grow it.
    valuesSample: {
      type: [String],
      default: [],
    },
    // Distinct value count seen across the corpus. The "Edit / Delete only
    // when 0" rule from the docs reads from here.
    valuesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Count of topic-values that failed date parsing under the current
    // `isDate` flag. Surfaced in the UI as "N invalid dates"; reset to 0
    // every time the reprocess worker runs.
    invalidDateCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Reserved key names — built-in Topic.metadata fields. The ingest pipeline
// silently drops any custom metadata that collides with these (so the
// registry never proposes flipping them). Date toggle is also blocked for
// these per the docs ("not possible to declare built-in metadata as date").
const RESERVED_KEYS = ['tags', 'version', 'product', 'language', 'author', 'aisummary', 'description', 'keywords', 'title'];

metadataKeySchema.statics.isReserved = function (rawName) {
  if (!rawName) return true;
  return RESERVED_KEYS.includes(String(rawName).trim().toLowerCase());
};

module.exports = mongoose.model('MetadataKey', metadataKeySchema);
module.exports.RESERVED_KEYS = RESERVED_KEYS;
