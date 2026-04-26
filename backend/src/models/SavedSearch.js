const mongoose = require('mongoose');

// First-class saved-search records — replaces the analytics-derived "recent
// searches" view. Owned by the user; carries a name + query + filters JSON
// so the user can re-run the search verbatim.
const savedSearchSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:    { type: String, required: true, trim: true, maxlength: 120 },
    query:   { type: String, default: '', trim: true },
    filters: {
      tags:        [{ type: String }],
      product:     { type: String, default: '' },
      version:     { type: String, default: '' },
      language:    { type: String, default: '' },
      titlesOnly:  { type: Boolean, default: false },
      documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    },
    notify:    { type: Boolean, default: false }, // future: email when new matches arrive
    lastRunAt: { type: Date, default: null },
    runCount:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

savedSearchSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.SavedSearch || mongoose.model('SavedSearch', savedSearchSchema);
