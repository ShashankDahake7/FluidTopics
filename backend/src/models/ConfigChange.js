const mongoose = require('mongoose');

const configChangeSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  author: { type: String, required: true },
  authorEmail: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: {} },
  after: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Cap at ~1 GB of BSON documents (roughly 500k entries at ~2KB average)
// We'll enforce the 1GB limit via a TTL or manual cleanup, but for now
// we keep the schema simple.

module.exports = mongoose.models.ConfigChange || mongoose.model('ConfigChange', configChangeSchema);
