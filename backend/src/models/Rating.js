const mongoose = require('mongoose');

// One rating per (user, target). Target is identified by exactly one of
// topicId / documentId / unstructuredId; the others are null.
const ratingSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    documentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
    unstructuredId:  { type: mongoose.Schema.Types.ObjectId, ref: 'UnstructuredDocument', default: null, index: true },
    value:           { type: Number, min: 1, max: 5, required: true },
    comment:         { type: String, default: '' },
  },
  { timestamps: true }
);

// At most one rating per (user, target) — recorded so re-rating updates in place.
ratingSchema.index(
  { userId: 1, topicId: 1, documentId: 1, unstructuredId: 1 },
  { unique: true, partialFilterExpression: { } }
);

module.exports = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);
