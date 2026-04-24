const mongoose = require('mongoose');

const designerPageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['homepage', 'search-results', 'reader', 'custom', 'header', 'shared', 'topic-template', 'link-preview'],
      default: 'custom',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    tree: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        id: 'root',
        type: 'root',
        props: {},
        style: { base: {} },
        children: [],
      }),
    },
    theme: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        name: 'Default',
        colors: {
          primary: '#4f46e5',
          secondary: '#6366f1',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          textSecondary: '#64748b',
          border: '#e2e8f0',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          lineHeight: '1.6',
        },
        spacing: {
          unit: '8px',
          borderRadius: '8px',
        },
      }),
    },
    locale: {
      type: String,
      default: 'en',
    },
    localizedLabels: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    footer: {
      type: String,
      default: '',
    },
    metadataCondition: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DesignerPage', designerPageSchema);
