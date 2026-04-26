const mongoose = require('mongoose');

// Personal book — an ordered curation of topics the user wants to read /
// export together. Distinct from Collection (unordered grouping) in that
// books carry an explicit linear order and an export status.
const personalBookSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' },
    coverColor:  { type: String, default: '#1d4ed8' },
    // Ordered list of topic ids — order is preserved exactly.
    topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    // Visibility — defaults to private; can be flipped public for sharing.
    visibility:  { type: String, enum: ['private', 'public'], default: 'private' },
    // Export records — populated when the user generates a PDF/HTML.
    exports: [{
      format:     { type: String, enum: ['pdf', 'html'] },
      generatedAt:{ type: Date, default: Date.now },
      url:        { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

personalBookSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.PersonalBook || mongoose.model('PersonalBook', personalBookSchema);
