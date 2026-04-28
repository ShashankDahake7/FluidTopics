const mongoose = require('mongoose');

/**
 * Tracks one run of the pretty-URL reprocess worker.
 *
 * The admin page polls the most recent job for live progress and
 * surfaces failures inline. We mirror the shape used by
 * MetadataReprocessJob so the frontend polling pattern is identical.
 */
const prettyUrlReprocessJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrettyUrlReprocessJob', prettyUrlReprocessJobSchema);
