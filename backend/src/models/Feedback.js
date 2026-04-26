const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    rating:  { type: Number, min: 1, max: 5, default: null },
    feedback:{ type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
