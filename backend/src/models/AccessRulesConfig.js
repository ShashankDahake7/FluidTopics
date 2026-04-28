const mongoose = require('mongoose');

// Singleton holding the portal-wide access-rules switches.
//   - mode:               which generation of the feature is live ("legacy" or
//                         "enhanced"). Once flipped to "enhanced" it cannot go
//                         back, mirroring the BRD: "Activating the enhanced
//                         Access rules is final."
//   - defaultRule:        the row at the top of the table when no other rule
//                         matches. "public" / "authenticated" / "none" /
//                         <groupId>. Both legacy and enhanced read it; only the
//                         legacy mode allows pinning it to a custom group.
//   - topicLevelEnabled:  topic-level rules only apply when this is true and
//                         mode === "enhanced".
//   - lastReprocessAt/By: stamped on every successful POST /reprocess so the
//                         footer can render "Last reprocess by …".
const accessRulesConfigSchema = new mongoose.Schema(
  {
    _id:                { type: String, default: 'access-rules' },
    mode:               { type: String, enum: ['legacy', 'enhanced'], default: 'enhanced' },
    defaultRule:        { type: String, default: 'public' }, // "public"|"authenticated"|"none"|<groupId>
    legacyDefaultGroup: { type: String, default: 'public' }, // legacy-only: "public"|"authenticated"|<groupId>
    topicLevelEnabled:  { type: Boolean, default: false },
    lastReprocessAt:    { type: Date, default: null },
    lastReprocessBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastReprocessByName:{ type: String, default: '' },
  },
  { timestamps: true, _id: false }
);

accessRulesConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findById('access-rules');
  if (existing) return existing;
  return this.create({ _id: 'access-rules' });
};

module.exports = mongoose.models.AccessRulesConfig
  || mongoose.model('AccessRulesConfig', accessRulesConfigSchema);
