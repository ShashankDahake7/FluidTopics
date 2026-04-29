const mongoose = require('mongoose');

// Singleton holding all "Email" admin-page configuration. The BRD calls out
// three tabs of fields:
//   - Reply-To address
//   - Logo (URL of the uploaded image; we serve it via portalAssets)
//   - Email sending method  →  internal | spfdkim | smtp
//
// The per-method blocks are kept in flat fields rather than discriminator
// sub-documents so that switching methods doesn't lose previously-entered
// values (the BRD's UI lets admins flip between methods without losing prior
// inputs as long as they don't Save).
//
// Secrets (DKIM private key, SMTP password) are persisted as-is in MongoDB —
// the route layer is responsible for never echoing them back to the client.
// `dkimPrivateKey` is a free-form string (PEM); we don't parse it server-side
// at storage time but `services/email/emailService` will reject obvious
// garbage when actually constructing a transport.
const emailSettingsSchema = new mongoose.Schema(
  {
    _id:                { type: String, default: 'email-settings' },

    // Common fields
    replyToAddress:     { type: String, default: '' },
    logoUrl:            { type: String, default: '' },

    // Sending method selector
    sendingMethod:      {
      type: String,
      enum: ['internal', 'spfdkim', 'smtp', 'sendgrid'],
      default: 'internal',
    },

    // SPF + DKIM (internal mail server, custom From)
    dkimFromAddress:    { type: String, default: '' },
    dkimPrivateKey:     { type: String, default: '' },
    dkimSelector:       { type: String, default: '' },
    dkimDnsValid:       { type: Boolean, default: false },
    dkimDnsCheckedAt:   { type: Date,    default: null },
    dkimDnsLastError:   { type: String,  default: '' },

    // External SMTP relay
    smtpFromAddress:    { type: String, default: '' },
    smtpHost:           { type: String, default: '' },
    smtpPort:           { type: Number, default: 25 },
    smtpTransport:      {
      type: String,
      enum: ['SMTP', 'SMTPS', 'SMTP_TLS'],
      default: 'SMTP',
    },
    smtpUser:           { type: String, default: '' },
    smtpPassword:       { type: String, default: '' },

    // SendGrid API
    sendgridApiKey:     { type: String, default: '' },
    sendgridFromAddress: { type: String, default: '' },

    // Last successful test send (for the "Test configuration" UI)
    lastTestSentTo:     { type: String, default: '' },
    lastTestSentAt:     { type: Date,   default: null },
    lastTestError:      { type: String, default: '' },

    // Audit attribution (free of admin user model coupling — just the email).
    updatedByEmail:     { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

emailSettingsSchema.statics.getSingleton = async function () {
  let cfg = await this.findOne({ _id: 'email-settings' });
  if (!cfg) cfg = await this.create({ _id: 'email-settings' });
  return cfg;
};

module.exports = mongoose.models.EmailSettings || mongoose.model('EmailSettings', emailSettingsSchema);
