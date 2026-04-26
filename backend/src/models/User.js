const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      default: 'viewer',
    },
    // Granular feature permissions (BRD Workflow 3)
    permissions: [{
      type: String,
      enum: [
        'PRINT_USER',
        'RATING_USER',
        'FEEDBACK_USER',
        'GENERATIVE_AI_USER',
        'GENERATIVE_AI_EXPORT_USER',
        'PERSONAL_BOOK_USER',
        'PERSONAL_BOOK_SHARE_USER',
        'HTML_EXPORT_USER',
        'PDF_EXPORT_USER',
        'SAVED_SEARCH_USER',
        'COLLECTION_USER',
        'OFFLINE_USER',
        'ANALYTICS_USER',
        'BETA_USER',
        'DEBUG_USER',
      ],
    }],
    avatar: {
      type: String,
      default: '',
    },
    preferences: {
      products: [{ type: String }],
      interests: [{ type: String }],  // user-selected interest tags
      // Search-preferences "Edit filters" panel — restricts the user's
      // search results to a specific set of documents and/or topics.
      documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
      releaseNotesOnly: { type: Boolean, default: false },
      // Prioritize-results panel — these don't restrict, they only boost.
      priorityDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
      priorityTopicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic'    }],
      priorityReleaseNotes: { type: Boolean, default: false },
      language: { type: String, default: 'en' },
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
    },
    // Auto-learned from behavior
    behaviorProfile: {
      topTags: {
        type: Map,
        of: Number,      // tag → view count
        default: {},
      },
      topProducts: {
        type: Map,
        of: Number,      // product → view count
        default: {},
      },
      totalViews: { type: Number, default: 0 },
      totalSearches: { type: Number, default: 0 },
      avgSessionDuration: { type: Number, default: 0 },  // seconds
      lastActiveAt: { type: Date },
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
