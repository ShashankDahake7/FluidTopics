const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 500,
    },
    folder: {
      type: String,
      default: 'default',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate bookmarks
bookmarkSchema.index({ userId: 1, topicId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, folder: 1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
