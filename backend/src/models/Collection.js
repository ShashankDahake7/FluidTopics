const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    color:  { type: String, default: '#0f172a' },
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  },
  { timestamps: true }
);

collectionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);
