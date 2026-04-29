const mongoose = require('mongoose');

const securityConfigSchema = new mongoose.Schema({
  trustedOrigins: { type: String, default: '' },
  certificates: [{
    id: String,
    name: String,
    type: { type: String, enum: ['Imported', 'Self-signed'], default: 'Imported' },
    subject: String,
    expires: String,
    // In a real system we'd store PEM data encrypted; for now we keep a reference.
    privateKeyPem: String,
    chainPem: String,
  }],
}, { timestamps: true });

module.exports = mongoose.models.SecurityConfig || mongoose.model('SecurityConfig', securityConfigSchema);
