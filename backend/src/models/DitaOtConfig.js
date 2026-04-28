const mongoose = require('mongoose');

// Single-document collection holding the portal-wide DITA-OT configuration.
// The Sources admin page exposes one "Configure DITA-OT" modal; everything in
// it lives on this row so the upload/reset/advanced-settings semantics stay
// dead simple — there's only ever one config to read or mutate.
//
// We enforce singleton-ness with a fixed `key: 'default'` unique index instead
// of relying on the Mongo `_id` so seeding/upsert from the routes layer stays
// straightforward.

const archiveSchema = new mongoose.Schema(
  {
    bucket:       { type: String, default: '' },
    key:          { type: String, default: '' }, // S3 key under raw bucket: dita-ot/<timestamp>-<originalName>
    originalName: { type: String, default: '' },
    sizeBytes:    { type: Number, default: 0 },
    etag:         { type: String, default: '' },
    uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt:   { type: Date,   default: null },
  },
  { _id: false }
);

const parameterSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, trim: true, maxlength: 200 },
    value: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false }
);

const ditaOtConfigSchema = new mongoose.Schema(
  {
    // Singleton key — guarantees a single document exists.
    key: { type: String, default: 'default', unique: true, index: true },

    // Empty/null when `isDefault` is true (i.e. nothing has been uploaded
    // yet and the portal is using stock DITA-OT 3.5.4).
    archive: { type: archiveSchema, default: () => ({}) },

    // Advanced settings — `transtype` overrides the default transtype the
    // ingestion pipeline passes to DITA-OT, and `parameters` is the list of
    // key/value pairs surfaced in the modal's Advanced tab.
    transtype:  { type: String, default: '' },
    parameters: { type: [parameterSchema], default: [] },

    // True when the portal is on stock DITA-OT 3.5.4 with no archive
    // uploaded — the modal renders a different empty state in that case.
    isDefault: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DitaOtConfig', ditaOtConfigSchema);
