const mongoose = require('mongoose');

const openSearchConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  name: { type: String, default: '' },
  xml: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.OpenSearchConfig || mongoose.model('OpenSearchConfig', openSearchConfigSchema);
