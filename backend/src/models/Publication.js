const mongoose = require('mongoose');

// One row per uploaded publishing artifact (the .zip the user dropped into
// Knowledge Hub → Publish content). Tracks the full lifecycle from upload →
// extract → validate → published. The S3 layout is keyed by `_id` so the raw
// bucket and the extracted bucket always have a 1:1 mapping under
// `publications/<_id>/`.
//
//   raw       bucket  →  publications/<_id>/source.zip
//   extracted bucket  →  publications/<_id>/extracted/<original/path/inside/zip>
const fileEntrySchema = new mongoose.Schema(
  {
    path:        { type: String, required: true }, // path inside the original zip (POSIX)
    key:         { type: String, required: true }, // full S3 key in the extracted bucket
    size:        { type: Number, default: 0 },
    contentType: { type: String, default: '' },
    etag:        { type: String, default: '' },
  },
  { _id: false }
);

const publicationSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true },
    sizeBytes:        { type: Number, default: 0 },

    // Free-form label picked in the Publish-content dialog (Paligo, Confluence,
    // DITA…). Only used for reporting — has no behavioural effect server-side.
    sourceLabel: { type: String, default: '' },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Cross-reference to the parsed Document/Topic graph the existing portal
    // renders. Populated by the upload pipeline once ingestion of the zip
    // finishes. Lets the publishing drawer link straight to the rendered doc
    // and lets `deletePublication` clean both sides up in one go.
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },

    status: {
      type: String,
      enum: [
        'uploaded',     // .zip safely landed in raw bucket
        'extracting',   // worker thread unzipping → extracted bucket
        'extracted',    // extraction done, manifest persisted
        'validating',   // worker thread checking missing refs
        'validated',    // validation finished (may still have warnings)
        'failed',       // any phase threw a fatal error
      ],
      default: 'uploaded',
      index: true,
    },

    // Counters surfaced on the publishing list page so we never have to scan
    // the logs collection just to render a summary badge.
    counts: {
      info:  { type: Number, default: 0 },
      warn:  { type: Number, default: 0 },
      error: { type: Number, default: 0 },
    },

    raw: {
      bucket: { type: String, default: '' },
      key:    { type: String, default: '' },
      etag:   { type: String, default: '' },
    },

    extracted: {
      bucket:     { type: String, default: '' },
      prefix:     { type: String, default: '' }, // e.g. publications/<id>/extracted/
      fileCount:  { type: Number, default: 0 },
      totalBytes: { type: Number, default: 0 },
      manifest:   { type: [fileEntrySchema], default: [] },
    },

    validation: {
      checkedAt:               { type: Date,   default: null },
      missingTopicCount:       { type: Number, default: 0 },
      missingAttachmentCount:  { type: Number, default: 0 },
      brokenLinkCount:         { type: Number, default: 0 },
      summary:                 { type: String, default: '' },
    },

    // Phase timestamps so the UI can compute durations without doing arithmetic
    // against `updatedAt` (which moves on every counter bump).
    timings: {
      uploadedAt:    { type: Date, default: null },
      extractStart:  { type: Date, default: null },
      extractEnd:    { type: Date, default: null },
      validateStart: { type: Date, default: null },
      validateEnd:   { type: Date, default: null },
    },

    // Surfaces a fatal error to the UI for the "FAILED" badge in the drawer.
    lastError: {
      phase:     { type: String, default: '' },
      message:   { type: String, default: '' },
      occurredAt:{ type: Date,   default: null },
    },
  },
  { timestamps: true }
);

publicationSchema.index({ createdAt: -1 });
publicationSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Publication', publicationSchema);
