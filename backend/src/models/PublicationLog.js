const mongoose = require('mongoose');

// One row per log entry emitted during a publication's lifecycle. Both worker
// threads (extract + validate) post structured messages here via the
// orchestrator; rendering the right-hand drawer is just a paginated query on
// this collection scoped to a `publicationId`.
//
// `code` is intentionally a short stable string (not free text) so the UI can
// later filter / colour-code without parsing `message`. New codes should be
// added here as the workers grow.
const PUBLICATION_LOG_CODES = [
  'upload_received',
  'upload_complete',
  'extract_started',
  'extract_progress',
  'extract_entry_skipped',
  'extract_entry_too_large',
  'extract_complete',
  'extract_failed',
  'validate_started',
  'validate_progress',
  'topic_file_not_found',
  'attachment_not_in_zip',
  'asset_not_in_zip',
  'broken_link',
  'unresolved_xref',
  'unresolved_conref',
  'unresolved_keyref',
  'no_parseable_content',
  'validate_complete',
  'validate_failed',
  'publish_started',
  'publish_complete',
  'publish_failed',
  'publish_skipped',
  'unknown',
];

const publicationLogSchema = new mongoose.Schema(
  {
    publicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication',
      required: true,
      index: true,
    },
    phase: {
      type: String,
      enum: ['upload', 'extract', 'validate', 'publish'],
      required: true,
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },
    code: {
      type: String,
      enum: PUBLICATION_LOG_CODES,
      default: 'unknown',
    },
    message: { type: String, default: '' },
    // Mixed for cheap forward-compatibility — payloads here typically carry
    // the offending file path, the unresolved href, the parent topic, etc.
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

publicationLogSchema.index({ publicationId: 1, timestamp: 1 });
publicationLogSchema.index({ publicationId: 1, level: 1, timestamp: 1 });

module.exports = mongoose.model('PublicationLog', publicationLogSchema);
module.exports.PUBLICATION_LOG_CODES = PUBLICATION_LOG_CODES;
