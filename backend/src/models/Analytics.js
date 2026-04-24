const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['search', 'view', 'click', 'download', 'feedback', 'login'],
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
      resultCount: { type: Number, default: 0 },
      clickPosition: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      feedback: { type: String, default: '' },
      filters: { type: Map, of: String, default: {} },
    },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
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
analyticsSchema.index({ 'data.query': 1 });
analyticsSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
