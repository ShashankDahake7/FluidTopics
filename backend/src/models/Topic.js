const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    content: {
      html: { type: String, default: '' },
      text: { type: String, default: '' },
    },
    hierarchy: {
      level: { type: Number, default: 1 },
      parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        default: null,
      },
      children: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Topic',
        },
      ],
      order: { type: Number, default: 0 },
    },
    metadata: {
      tags: [{ type: String }],
      version: { type: String, default: '1.0' },
      product: { type: String, default: '' },
      language: { type: String, default: 'en' },
      author: { type: String, default: '' },
      aiSummary: { type: String, default: '' },
      // Arbitrary key→values bag used by the Metadata configuration admin
      // page. Populated from <othermeta>/<meta> by the parsers; never
      // exposed directly in search — see metadata.indexedValues for that.
      // Mutated in place by the Enrich-and-Clean rule engine — see
      // metadata.customRaw below for the original snapshot.
      custom: { type: Map, of: [String], default: () => new Map() },
      // Snapshot of `metadata.custom` taken at the end of ingest, BEFORE
      // any Enrich-and-Clean rule fires. Lets the corpus reprocess worker
      // start every topic from a clean baseline so deleting / disabling
      // a rule actually un-applies it. Optional and additive: legacy
      // topics with no snapshot fall back to using their current
      // `metadata.custom` as the baseline.
      customRaw: { type: Map, of: [String], default: undefined },
      // Flat projection of values for keys whose MetadataKey.isIndexed is
      // true. This is the field Atlas Search reads from; the reprocess
      // worker rebuilds it whenever the registry changes.
      indexedValues: { type: [String], default: [] },
      // Parsed dates for keys flagged MetadataKey.isDate. Stored as Date
      // (BSON) so range queries work; null entries are unparseable values
      // (the registry tracks the count separately).
      dateValues: { type: Map, of: Date, default: () => new Map() },
    },
    media: [
      {
        type: {
          type: String,
          enum: ['image', 'table', 'video', 'code'],
        },
        url: { type: String },
        alt: { type: String, default: '' },
        caption: { type: String, default: '' },
      },
    ],
    relatedTopics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
      },
    ],
    sourcePath: {
      type: String,
      default: '',
    },
    // Paligo-specific fields (populated when ingesting Paligo HTML ZIP)
    originId: {
      type: String,
      default: '',
      index: true,
    },
    permalink: {
      type: String,
      default: '',
    },
    // Auto-generated pretty URL — see Document.prettyUrl for semantics.
    // Populated alongside the parent document's prettyUrl by the engine
    // and the reprocess worker. May be empty when no template matched.
    prettyUrl: { type: String, default: '', trim: true },

    // Cross-version merge key. Diff-ingest looks up an existing topic by
    // {documentId, stableId} (compound index below) so unchanged topics
    // keep their _id across publications — and with it bookmarks,
    // ratings, view counts, prettyUrl, customRaw snapshots, etc.
    //
    // Per-format derivation (see ingestion/stableIdentity.js):
    //   - Paligo:   reuse the existing originId.
    //   - Generic:  sha1(documentId + ':' + sourcePath).
    //   - Fallback: sha1(documentId + ':title:' + slug) when sourcePath
    //               is empty (single-file ingest, ad-hoc HTML).
    stableId: { type: String, default: '', index: true },

    // sha256 of the canonical, JSON-serialised view of the topic that
    // matters to downstream renderers (html, text, customRaw, hierarchy
    // order). Diff-ingest skips the UPDATE write when this matches the
    // candidate's hash — so an identical re-publish is a true no-op even
    // when the surrounding zip changed.
    contentHash: { type: String, default: '' },

    // Provenance pointers for the drawer's "introduced in V1, last
    // touched in V3" UX. Set on INSERT (firstSeenInPublication) and on
    // every UPDATE (lastUpdatedInPublication).
    firstSeenInPublication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication',
      default: null,
    },
    lastUpdatedInPublication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication',
      default: null,
    },
    timeModified: {
      type: Date,
      default: null,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'authenticated', 'admin'],
      default: 'public',
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

topicSchema.index({ 'metadata.tags': 1 });
topicSchema.index({ 'metadata.product': 1 });
topicSchema.index({ 'metadata.indexedValues': 1 });
topicSchema.index({ 'hierarchy.level': 1 });
topicSchema.index({ viewCount: -1 });
topicSchema.index({ title: 'text', 'content.text': 'text' });
// Pretty URL resolution. The compound index supports the common case
// where the same path resolves both as a doc-level prettyUrl and as a
// topic prettyUrl scoped to that doc; the bare index lets the read-side
// resolver scan globally when only a path is known.
topicSchema.index({ prettyUrl: 1 }, { sparse: true });
topicSchema.index({ documentId: 1, prettyUrl: 1 }, { sparse: true });
// Diff-ingest merge key. Compound index lets us O(1) look up an existing
// topic for the in-flight Publication's target Document. Sparse so legacy
// rows that pre-date stableId don't bloat the index.
topicSchema.index({ documentId: 1, stableId: 1 }, { sparse: true });

module.exports = mongoose.model('Topic', topicSchema);
