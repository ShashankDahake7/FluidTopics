const mongoose = require('mongoose');

/**
 * Singleton settings row for the Pretty URL feature.
 *
 * The doc names two normalization knobs that apply across every template:
 *   - removeAccents: strip diacritics during slugification.
 *   - lowercase:     lowercase every fragment.
 *
 * The admin UI also exposes a "you have unsaved drafts / changes need a
 * reprocess to take effect" banner. We track that with `pendingReprocess`
 * here so multiple admins viewing the page see the same state and so the
 * banner survives a server restart.
 *
 * `pendingReprocess` is set to true by any mutation that the engine would
 * answer differently after applying — adding/editing/deleting/reordering
 * a template, or flipping the normalization toggles. It is cleared by
 * the reprocess worker when it finishes successfully.
 */
const prettyUrlConfigSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'global', unique: true },
    removeAccents: { type: Boolean, default: true },
    lowercase: { type: Boolean, default: true },
    pendingReprocess: { type: Boolean, default: false },
    lastActivatedAt: { type: Date, default: null },
    lastActivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

prettyUrlConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ singletonKey: 'global' });
  if (!doc) {
    doc = await this.create({ singletonKey: 'global' });
  }
  return doc;
};

module.exports = mongoose.model('PrettyUrlConfig', prettyUrlConfigSchema);
