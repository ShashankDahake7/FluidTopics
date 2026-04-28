const mongoose = require('mongoose');

/**
 * A single pretty-URL template row as it appears in the admin UI.
 *
 * The admin page exposes four sections; each row's `(scope, state)`
 * uniquely identifies which section it lives in:
 *
 *   document / active   → "Active rules — Documents"
 *   document / draft    → "Draft rules — Documents"
 *   topic    / active   → "Active rules — Topics"
 *   topic    / draft    → "Draft rules — Topics"
 *
 * `priority` is the row's display order within its section (lower wins).
 * The engine walks the active sections in order and picks the first row
 * whose requirements are all satisfied — so reordering is the user-facing
 * way to change which template "wins" for a given document.
 *
 * `requirements[]` enumerates the metadata fragments referenced by the
 * template plus any guard-rail requirements the user adds in the
 * "edit requirements" drawer.  Each entry has a `topicSource` flag that
 * matters only for document templates: when checked, the engine resolves
 * the value from the document's first topic instead of the document's
 * own metadata bag.
 */
const requirementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    required: { type: Boolean, default: true },
    topicSource: { type: Boolean, default: false },
  },
  { _id: false }
);

const prettyUrlTemplateSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['document', 'topic'],
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: ['active', 'draft'],
      required: true,
      index: true,
    },
    template: { type: String, required: true, trim: true },
    requirements: { type: [requirementSchema], default: [] },
    priority: { type: Number, default: 0, index: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

prettyUrlTemplateSchema.index({ scope: 1, state: 1, priority: 1 });

module.exports = mongoose.model('PrettyUrlTemplate', prettyUrlTemplateSchema);
