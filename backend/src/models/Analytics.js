const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['search', 'view', 'click', 'download', 'feedback', 'login', 'share', 'print', 'event'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionId: {
      type: String,
      default: '',
    },
    data: {
      query: { type: String, default: '' },
      topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        default: null,
      },
      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        default: null,
      },
      /** Unstructured / file viewer (Knowledge Hub file route). */
      unstructuredId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UnstructuredDocument',
        default: null,
      },
      /** True when the search is scoped to a single structured document (in-reader search). */
      inDocument: { type: Boolean, default: false },
      resultCount: { type: Number, default: 0 },
      clickPosition: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      feedback: { type: String, default: '' },
      /** Search filters (tags may be an array; language, product, etc.). */
      filters: { type: mongoose.Schema.Types.Mixed, default: {} },
      /**
       * `language` query param on `GET /api/search` (`all`, `*`, or a locale code).
       * Used to distinguish "search in all languages" from profile-default locale.
       */
      searchLanguageParam: { type: String, default: '' },
      /** Fluid Topics–style event name when eventType is 'event'. */
      ftEvent: { type: String, default: '' },
      /** Normalized pathname for `page.display` (Traffic → Page views). */
      path: { type: String, default: '' },
      /** Viewport for `page.display` (Traffic → Device types). */
      viewportWidth: { type: Number, default: null },
      viewportHeight: { type: Number, default: null },
      /** Bulk deletes / batch counts (defaults to 1 per row when absent). */
      count: { type: Number, default: null },
    },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    /** ISO 3166-1 alpha-2 from IP geolocation (Traffic → Countries). */
    countryCode: { type: String, default: '', index: true },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

analyticsSchema.index({ eventType: 1, timestamp: -1 });
analyticsSchema.index({ 'data.ftEvent': 1, timestamp: -1 });
analyticsSchema.index({ 'data.ftEvent': 1, 'data.path': 1, timestamp: -1 });
analyticsSchema.index({ 'data.query': 1 });
analyticsSchema.index({ userId: 1, timestamp: -1 });
analyticsSchema.index({ countryCode: 1, timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
