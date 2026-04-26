const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    color:  { type: String, default: '#0f172a' },
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    // 'manual' = topicIds is the source of truth.
    // 'smart'  = topicIds is ignored; results are computed from the saved
    //            query + filters at read time.
    kind: { type: String, enum: ['manual', 'smart'], default: 'manual' },
    query:   { type: String, default: '' },
    filters: {
      tags:        [{ type: String }],
      product:     { type: String, default: '' },
      titlesOnly:  { type: Boolean, default: false },
      documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    },
  },
  { timestamps: true }
);

collectionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);
