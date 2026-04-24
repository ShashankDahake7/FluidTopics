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
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ status: 1 });
documentSchema.index({ 'metadata.tags': 1 });
documentSchema.index({ 'metadata.product': 1 });
documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
