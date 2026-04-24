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
topicSchema.index({ 'hierarchy.level': 1 });
topicSchema.index({ viewCount: -1 });
topicSchema.index({ title: 'text', 'content.text': 'text' });

module.exports = mongoose.model('Topic', topicSchema);
