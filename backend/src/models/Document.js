const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    sourceFormat: {
      type: String,
      enum: ['html', 'docx', 'markdown', 'xml', 'zip'],
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    version: {
      type: Number,
      default: 1,
    },
    language: {
      type: String,
      default: 'en',
    },
    metadata: {
      author: { type: String, default: '' },
      tags: [{ type: String }],
      description: { type: String, default: '' },
      product: { type: String, default: '' },
      customFields: {
        type: Map,
        of: String,
        default: {},
      },
    },
    topicIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
      },
    ],
    fileSize: {
      type: Number,
      default: 0,
    },
    ingestionLog: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String },
        level: {
          type: String,
          enum: ['info', 'warn', 'error'],
          default: 'info',
        },
      },
    ],
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Paligo-specific fields
    isPaligoFormat: {
      type: Boolean,
      default: false,
    },
    tocTree: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    publication: {
      publicationId:  { type: String, default: '' },
      companyName:    { type: String, default: '' },
      copyright:      { type: String, default: '' },
      logoPath:       { type: String, default: '' },
      backgroundPath: { type: String, default: '' },
      theme:          { type: String, default: '1' },
      contentTheme:   { type: String, default: '1' },
      portalTitle:    { type: String, default: '' },
      stickyHeader:   { type: Boolean, default: false },
    },
    // Auto-generated address-bar URL (the slash-separated path that follows
    // /r/ in the portal). Populated by the prettyUrlEngine after ingestion
    // and by the reprocess worker. Empty string means "no template matched
    // — fall back to /dashboard/docs/<_id>". The docs explicitly allow two
    // publications to share the same value, so the index is sparse and
    // non-unique.
    prettyUrl: { type: String, default: '', trim: true },

    // Pointer to the latest successful Publication that wrote into this
    // Document. The publish lock writes the in-flight Publication._id here
    // BEFORE diff-ingest runs (atomic findOneAndUpdate) and replaces it
    // with the same id once the merge completes — so a second concurrent
    // re-publish against the same target sees the lock and 409s.
    currentPublicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication',
      default: null,
      index: true,
    },

    // Append-only audit of every Publication that has ingested into this
    // Document. The drawer reads this in reverse-chrono order to render
    // the "Version chain" with per-version add/update/remove counts.
    versionHistory: [
      {
        publicationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Publication',
        },
        ingestedAt:    { type: Date, default: () => new Date() },
        topicsAdded:   { type: Number, default: 0 },
        topicsUpdated: { type: Number, default: 0 },
        topicsRemoved: { type: Number, default: 0 },
        topicsKept:    { type: Number, default: 0 },
        dedupeMode:    { type: String, default: 'fresh' },
        // Free-form summary string for the drawer — keeps the schema open
        // for future fields (e.g. failure reason) without a migration.
        note:          { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ status: 1 });
documentSchema.index({ 'metadata.tags': 1 });
documentSchema.index({ 'metadata.product': 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ prettyUrl: 1 }, { sparse: true });

module.exports = mongoose.model('Document', documentSchema);
