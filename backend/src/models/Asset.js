const mongoose = require('mongoose');

// Reusable media stored in a global asset library — not tied to any specific
// document. Used by the FT-equivalent /api/assets/:id endpoint.
const assetSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    title:    { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    size:     { type: Number, default: 0 },
    path:     { type: String, required: true },     // relative path under uploads/assets/
    tags:     [{ type: String }],
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
