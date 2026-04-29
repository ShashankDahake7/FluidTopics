const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9_-]+$/,
  },
  description: { type: String, default: '' },
  secret: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  roles: [{ type: String }],
  groups: [{ type: String }],
  ipRestrictions: { type: String, default: '' },
  lastActivity: { type: Date, default: null },
}, { timestamps: true });

// Virtual "createdOn" formatted for display
apiKeySchema.virtual('createdOn').get(function () {
  const d = this.createdAt;
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
});

apiKeySchema.set('toJSON', { virtuals: true });
apiKeySchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);
