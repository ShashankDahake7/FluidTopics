const mongoose = require('mongoose');

// Singleton holding the Rating administration interface (Notifications →
// Rating). Two independently-saved knobs:
//
//   - `rules`   — ordered list. Each rule names the rating widget to use
//                 (Stars / Like / Dichotomous / No rating) for documents and
//                 for topics, plus an optional metadata-requirement filter
//                 that narrows the rule to a subset of content. Resolution
//                 walks the list top-to-bottom and stops at the first match,
//                 so admins can express "Stars for anything tagged release-
//                 notes, Like for everything else" by ordering rules.
//
//   - `topicLevels` are 1..4 entries, one per depth, with the special
//                   "Rate together" / "Rate individually" / "Do not rate"
//                   semantics surfaced in the Configure rule drawer.
//
// The collection is restricted to a single document (the `'rating-rules'`
// sentinel id) — getSingleton() upserts on first read, so the API can always
// reach a definite shape without bootstrap migrations.
const TYPES = ['Stars', 'Like', 'Dichotomous', 'No rating'];

const metaRequirementSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, trim: true },
    // Empty string is a legal selection (the "-- Empty value --" option in
    // the drawer); use null to mean "any value" if we ever surface that.
    value: { type: String, default: '' },
  },
  { _id: false }
);

const ruleSchema = new mongoose.Schema(
  {
    docType:     { type: String, enum: TYPES, default: 'Stars' },
    topicType:   { type: String, enum: TYPES, default: 'Stars' },
    // Topic-level zone configuration. Length 0..4 — empty means "no per-level
    // override; treat the topic rating as a single zone".
    topicLevels: {
      type: [String],
      default: ['Rate together'],
      validate: {
        validator: (arr) =>
          !arr ||
          arr.every((v) => ['Rate together', 'Rate individually', 'Do not rate'].includes(v)),
        message: 'Invalid topicLevels entry.',
      },
    },
    metaReqs: { type: [metaRequirementSchema], default: [] },
  },
  { _id: false, timestamps: false }
);

const ratingRulesConfigSchema = new mongoose.Schema(
  {
    _id:    { type: String, default: 'rating-rules' },
    rules:  { type: [ruleSchema], default: () => ([
      // Default rule mirrors the Fluid Topics out-of-the-box behaviour:
      // 5-star rating on every document, with a single zone covering all
      // topic levels.
      {
        docType:     'Stars',
        topicType:   'Stars',
        topicLevels: ['Rate together'],
        metaReqs:    [],
      },
    ]) },
    updatedByEmail: { type: String, default: '' },
  },
  { _id: false, timestamps: true }
);

ratingRulesConfigSchema.statics.getSingleton = async function () {
  let cfg = await this.findById('rating-rules');
  if (!cfg) cfg = await this.create({ _id: 'rating-rules' });
  return cfg;
};

// Exposed for route validation / frontend dropdown sync.
ratingRulesConfigSchema.statics.RATING_TYPES = TYPES;

module.exports = mongoose.models.RatingRulesConfig
  || mongoose.model('RatingRulesConfig', ratingRulesConfigSchema);
module.exports.RATING_TYPES = TYPES;
