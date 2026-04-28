const mongoose = require('mongoose');

// One rule from the Enrich-and-Clean admin page. Rules are grouped by
// `metadataKey` and applied in `priority` order (ascending). Each row
// captures one verb in the FT-style rule library — see ruleConfigSchemas
// for the per-type config shape.
//
//   metadataKey: lowercased canonical name (matches MetadataKey.name).
//   type:        one of the seven verbs we support.
//   config:      free-form, validated by ruleConfigSchemas before save.
//   priority:    ascending = applies first. Auto-assigned to (max + 10) on
//                create so insertion order is preserved without forcing
//                callers to reason about gaps.
//   scope:       'new'  - apply at ingest only; reverted at corpus reprocess
//                         because reprocess restarts from metadata.customRaw.
//                'all'  - apply at ingest AND at every reprocess. Creating
//                         or editing flips EnrichConfig.pendingReprocess.
//   enabled:     soft-disable lever; disabled rules stay in the table but
//                are excluded from the active set used by the engine.
const enrichRuleSchema = new mongoose.Schema(
  {
    metadataKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'enrich',
        'clean',
        'find_replace',
        'regex_replace',
        'drop_key',
        'set_value',
        'copy_from',
      ],
      required: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    scope: {
      type: String,
      enum: ['new', 'all'],
      default: 'new',
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
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

// Compound indexes to support the two hottest read patterns:
//  - the engine groups rules by metadataKey and walks them in priority
//    order, so { metadataKey: 1, priority: 1 } is the natural cover.
//  - the active-rule loader filters on { enabled: true, scope } and reads
//    every match, so { scope: 1, enabled: 1 } keeps that scan small.
enrichRuleSchema.index({ metadataKey: 1, priority: 1 });
enrichRuleSchema.index({ scope: 1, enabled: 1 });

module.exports = mongoose.model('EnrichRule', enrichRuleSchema);
