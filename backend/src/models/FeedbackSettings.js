const mongoose = require('mongoose');

// Singleton holding the "Feedback" admin-page configuration. The BRD specifies
// the following knobs:
//   - Recipients          → comma-separated list of email aliases that
//                           receive every feedback email.
//   - Enrich email subject→ ordered list of metadata keys appended to the
//                           subject line as `[value]` tokens.
//   - Enrich email body   → ordered list of metadata keys to render in the
//                           body alongside the topic / document reference.
//   - Email service for authenticated users   → 'ft' | 'user'
//                           ('ft' = Fluid Topics sends, 'user' = mailto:)
//   - Email service for unauthenticated users → 'ft' | 'user'
//                           ('ft' is only available when the Email admin's
//                           SMTP relay is configured; default is 'user').
//   - Confirmation email  → boolean, only effective when authenticated mode
//                           is 'ft' (i.e. FT actually sends the message).
//   - Forbidden attachment file extensions     → list (case- and
//                           dot-insensitive). Stored lowercased without dots.
//   - Maximum attachment size (MB)             → 1..23 inclusive.
//
// Metadata key arrays are stored as ordered string lists so admins can drag
// to reorder; the public-feedback emit pipeline iterates them in order.
const feedbackSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'feedback-settings' },

    recipients:                { type: [String], default: [] },
    subjectMetadataKeys:       { type: [String], default: [] },
    bodyMetadataKeys: {
      type: [String],
      default: [
        'ft:lastPublication',
        'publicationDate',
        'author_personname',
        'title',
        'ft:publication_title',
      ],
    },

    // 'ft' = Fluid Topics sends the email; 'user' = open the user's mail
    // client (mailto). Names mirror the BRD wording.
    authenticatedEmailService:   { type: String, enum: ['ft', 'user'], default: 'ft' },
    unauthenticatedEmailService: { type: String, enum: ['ft', 'user'], default: 'user' },

    confirmationEmailEnabled: { type: Boolean, default: true },

    // Lower-cased without dots so the comparison in feedback.js can be a flat
    // Set lookup against the upload filename's extension. Persisted in the
    // exact form the admin typed (also lowercased) so the UI can echo it back.
    forbiddenAttachmentExtensions: { type: [String], default: [] },

    // 1..23 MB per the BRD.
    maxAttachmentSizeMb: { type: Number, default: 5, min: 1, max: 23 },

    updatedByEmail: { type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

feedbackSettingsSchema.statics.getSingleton = async function () {
  let cfg = await this.findOne({ _id: 'feedback-settings' });
  if (!cfg) cfg = await this.create({ _id: 'feedback-settings' });
  return cfg;
};

module.exports = mongoose.models.FeedbackSettings
  || mongoose.model('FeedbackSettings', feedbackSettingsSchema);
