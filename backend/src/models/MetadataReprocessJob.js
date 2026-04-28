const mongoose = require('mongoose');

// One row per "Save and reprocess" click on the Metadata configuration admin
// page. The reprocessMetadataWorker reads `registry`, streams every Topic,
// rebuilds `metadata.indexedValues` + `metadata.dateValues`, and ticks
// `processed` / `errorCount` as it goes. The admin page polls
// `GET /api/metadata-keys/jobs/:id` to render a progress strip.
//
// We deliberately keep this lean — no per-topic log here. Worker emits a
// single console line on per-topic errors and the aggregate count is enough
// for the UI. The full registry snapshot is stored so a job can be debugged
// even after the keys themselves are toggled again.
const metadataReprocessJobSchema = new mongoose.Schema(
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
    // Snapshot of the registry the worker was launched with — name, isIndexed,
    // isDate. Lets us reason about a finished job without a join later.
    registrySnapshot: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true },
            isIndexed: { type: Boolean, default: false },
            isDate: { type: Boolean, default: false },
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

module.exports = mongoose.model('MetadataReprocessJob', metadataReprocessJobSchema);
