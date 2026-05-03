const mongoose = require('mongoose');

const configChangeSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  author: { type: String, required: true },
  authorEmail: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: {} },
  after: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** Single-tenant default portal; reserved for multi-portal expansions. */
  portalId: { type: String, default: 'default', index: true },
}, { timestamps: true });

// Storage capped at ~1 GB per portal in logConfigChange → enforcePortalHistoryLimit

module.exports = mongoose.models.ConfigChange || mongoose.model('ConfigChange', configChangeSchema);
