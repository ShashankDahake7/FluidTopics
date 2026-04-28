const mongoose = require('mongoose');

// Singleton for the Alerts administration interface (Notifications → Alerts).
//
// Three knobs come from the BRD:
//
//   - `matchMode` — 'any' | 'all'. Controls whether a saved-search alert
//     fires when at least one term matches (default; broader recall) or
//     only when every term matches (precision-first).
//
//   - `recurrenceDays` — list of weekday names in {Monday,…,Sunday}. The
//     alert worker iterates this set on each daily tick; entries are kept
//     in canonical Mon→Sun order so the audit log diff stays readable.
//
//   - `bodyMetadataKeys` — ordered list of metadata keys that the alert
//     email template will surface alongside each match. The order is
//     authoritative — the UI is a drag-to-reorder list — so admins control
//     how the rendered email reads.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MATCH_MODES = ['any', 'all'];

const alertsConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'alerts-config' },

    matchMode: {
      type: String,
      enum: MATCH_MODES,
      default: 'any',  // BRD: "default value is when at least one search term matches"
    },

    recurrenceDays: {
      type: [String],
      default: ['Monday'],            // BRD: "default setting […] is once every Monday"
      validate: {
        validator: (arr) => !arr || arr.every((d) => DAYS.includes(d)),
        message:   'recurrenceDays must be a subset of weekday names.',
      },
    },

    bodyMetadataKeys: {
      type: [String],
      default: ['Created_by', 'title', 'publicationDate'],
    },

    updatedByEmail: { type: String, default: '' },
  },
  { _id: false, timestamps: true }
);

alertsConfigSchema.statics.getSingleton = async function () {
  let cfg = await this.findById('alerts-config');
  if (!cfg) cfg = await this.create({ _id: 'alerts-config' });
  return cfg;
};

alertsConfigSchema.statics.DAYS = DAYS;
alertsConfigSchema.statics.MATCH_MODES = MATCH_MODES;

module.exports = mongoose.models.AlertsConfig
  || mongoose.model('AlertsConfig', alertsConfigSchema);
module.exports.DAYS = DAYS;
module.exports.MATCH_MODES = MATCH_MODES;
