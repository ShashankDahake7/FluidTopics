const mongoose = require('mongoose');

// User groups — a label that an admin can hang on multiple users (e.g.
// "support-engineers", "beta-testers"). Useful for permission scoping and
// bulk operations later.
const groupSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Group || mongoose.model('Group', groupSchema);
