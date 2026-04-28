const mongoose = require('mongoose');

// Singleton (`key: 'default'`) holding portal-wide Enrich-and-Clean state:
//
//   - lastFullReprocessAt / lastFullReprocessBy — rendered in the footer
//     of the admin page so admins can tell when corpus rules were last
//     re-applied across every topic.
//   - pendingReprocess — flipped on whenever an `all`-scope rule is
//     created/updated/deleted (including soft-disable). Cleared by the
//     reprocess worker on completion. Drives the dot next to the
//     Reprocess button in the UI footer.
const enrichConfigSchema = new mongoose.Schema(
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

enrichConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create({ key: 'default' });
  }
  return doc;
};

module.exports = mongoose.model('EnrichConfig', enrichConfigSchema);
