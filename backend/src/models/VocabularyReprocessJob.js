const mongoose = require('mongoose');

// One row per "Reprocess" click on the Vocabularies admin page.
// reprocessVocabulariesWorker streams every Topic, recomputes
// `metadata.indexedValues` (now expanded with active vocabulary synonyms),
// and ticks `processed` / `errorCount` as it goes. The admin page polls
// `GET /api/vocabularies/jobs/:id` every second to render the progress
// strip — same shape as the metadata reprocess UX.
const vocabularyReprocessJobSchema = new mongoose.Schema(
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
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VocabularyReprocessJob', vocabularyReprocessJobSchema);
