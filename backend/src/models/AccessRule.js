const mongoose = require('mongoose');

// One row per access rule. The status machine mirrors the BRD's "Inactive /
// Processing / Active / New / Modified / Deleted" lifecycle:
//
//   created  → status = 'New'      (saved but not yet reprocessed)
//   updated  → status = 'Modified' (saved but not yet reprocessed)
//   delete   → status = 'Deleted'  (soft delete; purged on next reprocess)
//   apply    → status = 'Processing' briefly, then 'Active'
//
// `inactiveSet === true` means the rule belongs to the "draft" set used while
// switching from legacy → enhanced; rules saved here aren't applied until the
// admin clicks "Activate new set".
const requirementSchema = new mongoose.Schema(
  {
    key:    { type: String, required: true, trim: true },
    op:     { type: String, enum: ['any', 'all', 'equals'], default: 'any' },
    values: [{ type: String, trim: true }],
  },
  { _id: false }
);

const accessRuleSchema = new mongoose.Schema(
  {
    name:               { type: String, default: '' },
    description:        { type: String, default: '' },

    requirements:       { type: [requirementSchema], default: [] },
    requirementsMode:   { type: String, enum: ['any', 'all'], default: 'any' },

    // Authorisation surface — exactly one wins. `groups` only meaningful when
    // authMode === 'groups'.
    authMode:           { type: String, enum: ['everyone', 'authenticated', 'groups', 'auto'], default: 'groups' },
    groups:             [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    autoBindKey:        { type: String, default: '' }, // only when authMode === 'auto'

    targetTopics:       { type: Boolean, default: false }, // enhanced-only

    status:             { type: String, enum: ['Inactive', 'Processing', 'Active', 'New', 'Modified', 'Deleted'], default: 'New' },
    inactiveSet:        { type: Boolean, default: false },

    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName:      { type: String, default: '' },
    createdByEmail:     { type: String, default: '' },
    updatedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName:      { type: String, default: '' },
    updatedByEmail:     { type: String, default: '' },

    lastReprocessAt:    { type: Date, default: null },
    lastReprocessBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastReprocessByName:{ type: String, default: '' },
  },
  { timestamps: true }
);

accessRuleSchema.index({ status: 1, inactiveSet: 1 });
accessRuleSchema.index({ 'requirements.key': 1 });

module.exports = mongoose.models.AccessRule || mongoose.model('AccessRule', accessRuleSchema);
