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
    // Per-file content hash. Lets the extract worker dedupe repeated bytes
    // across publications via the ExtractedFileBlob CAS index — and makes
    // each manifest entry self-describing for the read-side helpers in
    // s3Service that resolve attachments by hash, not by pubId+relPath.
    contentHash: { type: String, default: '' },
  },
  { _id: false }
);

// One entry per ingest pass that landed against a target Document. The
// Publication.replaces chain is the chronological order; this audit array is
// what the drawer's "Version chain" section renders (V3 ← V2 ← V1) with
// per-version add/update/remove counters.
const versionHistoryEntrySchema = new mongoose.Schema(
  {
    publicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication' },
    ingestedAt:    { type: Date, default: () => new Date() },
    topicsAdded:   { type: Number, default: 0 },
    topicsUpdated: { type: Number, default: 0 },
    topicsRemoved: { type: Number, default: 0 },
    topicsKept:    { type: Number, default: 0 },
    dedupeMode:    { type: String, default: 'fresh' },
  },
  { _id: false }
);

const publicationSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true },
    sizeBytes:        { type: Number, default: 0 },

    // Canonical reference to the configured Source the upload was attributed
    // to. The Publish-content modal sends `Source.sourceId` (the canonical
    // string id) over the wire and the publication service resolves it to
    // this ObjectId. Nullable for legacy rows that pre-date the Source model.
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
      index: true,
    },

    // Denormalised display copy of `Source.name` at the time of upload. We
    // keep this around so a renamed/deleted Source doesn't blank out the
    // history table, and so the legacy free-form label still survives for
    // rows that pre-date the Source model.
    sourceLabel: { type: String, default: '' },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Cross-reference to the parsed Document/Topic graph the existing portal
    // renders. Populated by the upload pipeline once ingestion of the zip
    // finishes. Lets the publishing drawer link straight to the rendered doc
    // and lets `deletePublication` clean both sides up in one go.
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },

    // sha256 of the raw zip bytes, computed in a streaming pass during
    // upload. Drives the four cache layers below:
    //   - Two Publications with the same hash share their raw S3 object
    //     (raw/<hash[0..1]>/<hash>.zip).
    //   - The extract worker can short-circuit straight to manifest-copy
    //     when a previous validated row exists (`reused-zip` dedupeMode).
    //   - ValidationCache is keyed by this value.
    //   - Diff ingest can detect "every byte identical" without reparsing.
    contentHash: { type: String, default: '', index: true },

    // Pointer to the Publication whose Document this re-publish should
    // merge into. Set by the upload modal's "Publish as new version of"
    // dropdown. Null = create a brand-new Document on ingest (legacy /
    // first-time behaviour).
    replaces: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication',
      default: null,
      index: true,
    },

    // What the pipeline reused on this run, surfaced as a status pill in
    // the drawer. Lifecycle:
    //   'fresh'              — first time we've seen this contentHash, no
    //                          replaces target (new Document).
    //   'reused-zip'         — contentHash matched a prior validated row;
    //                          we copied its manifest + validation summary
    //                          and skipped the extract + validate workers
    //                          entirely.
    //   'reused-validation'  — extract had to run (e.g. raw S3 GC), but
    //                          the ValidationCache hit short-circuited
    //                          validate.
    //   'reused-document'    — `replaces` was set, so ingest merged into
    //                          the existing Document via diff (Topic._id
    //                          continuity preserved).
    dedupeMode: {
      type: String,
      enum: ['fresh', 'reused-zip', 'reused-validation', 'reused-document'],
      default: 'fresh',
    },

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
