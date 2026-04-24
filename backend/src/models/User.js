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
    avatar: {
      type: String,
      default: '',
    },
    preferences: {
      products: [{ type: String }],
      interests: [{ type: String }],  // user-selected interest tags
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
