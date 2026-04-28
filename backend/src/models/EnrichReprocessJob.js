const mongoose = require('mongoose');

// One row per "Reprocess" click on the Enrich-and-Clean admin page.
// `reprocessEnrichCleanWorker` reads the active rule set, streams every
// Topic, restores `metadata.custom` from `metadata.customRaw`, re-applies
// the `all`-scope rules, recomputes projections, and ticks `processed` /
// `errorCount` as it goes. The admin page polls
// `GET /api/enrich-rules/jobs/:id` to render a progress strip.
//
// Same lean shape as MetadataReprocessJob and VocabularyReprocessJob — a
// single rule snapshot is captured on launch so a finished job can still
// be reasoned about even after the rules themselves are edited.
const enrichReprocessJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    total: {
      type: Number,
      default: 0,
    },
    processed: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    // Snapshot of the rule list the worker was launched with — id, type,
    // metadataKey, scope. Excludes config to keep the job row small;
    // ruleEngine debug logs already include the runtime config.
    ruleSnapshot: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true },
            metadataKey: { type: String, required: true },
            type: { type: String, required: true },
            scope: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnrichReprocessJob', enrichReprocessJobSchema);
