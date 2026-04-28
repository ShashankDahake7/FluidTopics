const mongoose = require('mongoose');

// One row per configured Source in the Knowledge Hub. Sources are the
// connector definitions that the Publish-content modal in
// /admin/khub/publishing surfaces — every uploaded zip is attributed to
// exactly one Source via Publication.sourceId.
//
// The user-facing canonical id ("paligo", "ud", "Confluence") lives in
// `sourceId` (a string) — it is human-typed in the New-source wizard and
// is what the Publish-content modal posts back as the FormData `source`
// field. The Mongo `_id` stays opaque to the client.
//
// Mirrors the Fluid Topics docs:
//   "Each source ID and source name must be unique. It is not possible to
//    reuse a source ID or source name that is already in use for another
//    source. Once set, [the source ID] cannot be modified."

// Allowed connector types — kept in sync with the New-source dropdown in
// frontend/src/app/admin/khub/sources/page.js.
const SOURCE_TYPES = [
  'MapAttachments',
  'Dita',
  'Html',
  'Ftml',
  'UnstructuredDocuments',
  'Authorit',
  'AuthoritMagellan',
  'Paligo',
  'Confluence',
  'ExternalDocument',
  'External',
];

const PERMISSION_MODES = ['admins', 'all_pubs', 'some_pubs'];

const permissionsSchema = new mongoose.Schema(
  {
    // 'admins'    — only ADMIN/KHUB_ADMIN equivalents (admin/superadmin)
    // 'all_pubs'  — admins + every CONTENT_PUBLISHER (editor)
    // 'some_pubs' — admins + the user/api-key allow-lists below
    mode: { type: String, enum: PERMISSION_MODES, default: 'admins' },

    // Real user references, populated when the future user picker lands.
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Stub: free-form strings until an ApiKey model exists. Holds whatever
    // the admin typed in the "Search for API keys" input so we can round-trip
    // it through the UI without losing data on save.
    apiKeyHints: [{ type: String }],
  },
  { _id: false }
);

const sourceSchema = new mongoose.Schema(
  {
    // Canonical, human-typed id from the wizard. Cannot be changed once
    // saved (enforced by the route — Mongoose has no immutable flag pre-7).
    sourceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: SOURCE_TYPES,
      required: true,
    },
    category:    { type: String, default: '', trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },

    permissions: { type: permissionsSchema, default: () => ({}) },

    // The docs hint at "If a source type seems to be missing from the list,
    // the associated connector may need to be activated first." Surfaced via
    // this field so we can later show a "Pending activation" badge.
    installationStatus: {
      type: String,
      enum: ['installed', 'pending'],
      default: 'installed',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

sourceSchema.index({ sourceId: 1 }, { unique: true });
sourceSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Source', sourceSchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.PERMISSION_MODES = PERMISSION_MODES;
