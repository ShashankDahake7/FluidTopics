const mongoose = require('mongoose');

// Portal-wide settings stored as a single row keyed by `key: 'singleton'`.
// `getSingleton()` returns it, creating defaults the first time.
const siteConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'singleton', unique: true },
    defaultLocale: { type: String, default: 'en' },
    // Locales the portal explicitly supports — when empty, all locales found
    // in the content are considered available.
    enabledLocales: [{ type: String }],

    // Legal terms (My Library / login acceptance) — admin Legal terms page.
    legalTermsEnabled: { type: Boolean, default: false },
    legalTermsMessages: {
      type: [
        {
          locale: { type: String, required: true },
          label: { type: String, default: '' },
          linksHtml: { type: String, default: '' },
          validated: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    legalTermsPolicyVersion: { type: Number, default: 0 },
    legalTermsLastPolicyUpdateAt: { type: Date, default: null },
  },
  { timestamps: true }
);

siteConfigSchema.statics.getSingleton = async function () {
  let cfg = await this.findOne({ key: 'singleton' });
  if (!cfg) cfg = await this.create({ key: 'singleton' });
  return cfg;
};

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
