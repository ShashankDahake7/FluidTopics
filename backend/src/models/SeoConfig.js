const mongoose = require('mongoose');

const seoConfigSchema = new mongoose.Schema({
  crawlingAllowed: { type: Boolean, default: true },
  titleTags: [{
    id: String,
    label: String,
    metadata: String,
    locked: Boolean
  }],
  defaultRobots: {
    noindex: { type: Boolean, default: false },
    nofollow: { type: Boolean, default: false },
    noarchive: { type: Boolean, default: false }
  },
  customRules: [{
    id: String,
    metadataKey: String,
    metadataValues: String,
    flags: {
      noindex: { type: Boolean, default: false },
      nofollow: { type: Boolean, default: false },
      noarchive: { type: Boolean, default: false }
    }
  }],
  customRobotsFile: { type: String, default: '' },
  bingFile: { type: String, default: '' },
  googleFile: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.SeoConfig || mongoose.model('SeoConfig', seoConfigSchema);
