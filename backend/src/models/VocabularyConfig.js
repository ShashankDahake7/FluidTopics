const mongoose = require('mongoose');

// Singleton row (`key: 'default'`) holding portal-wide Vocabulary state:
//
//   - lastFullReprocessAt / lastFullReprocessBy — rendered in the page
//     footer ("Last full reprocess by Prem GARUDADRI · 04/29/2025, 5:00 PM").
//   - pendingReprocess — flipped on whenever a vocabulary with usedInSearch
//     true is created/updated/deleted, cleared by the reprocess worker on
//     completion. Drives the badge / footer hint.
const vocabularyConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
    },
    lastFullReprocessAt: { type: Date, default: null },
    lastFullReprocessBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pendingReprocess: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vocabularyConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create({ key: 'default' });
  }
  return doc;
};

module.exports = mongoose.model('VocabularyConfig', vocabularyConfigSchema);
