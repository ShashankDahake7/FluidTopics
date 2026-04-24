const mongoose = require('mongoose');

const readingHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
    duration: {
      type: Number, // seconds spent on page
      default: 0,
    },
    scrollDepth: {
      type: Number, // 0-100 percentage
      default: 0,
    },
    visitCount: {
      type: Number,
      default: 1,
    },
    lastVisitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

readingHistorySchema.index({ userId: 1, topicId: 1 }, { unique: true });
readingHistorySchema.index({ userId: 1, lastVisitedAt: -1 });

module.exports = mongoose.model('ReadingHistory', readingHistorySchema);
