const mongoose = require('mongoose');

// Stores a custom icon image for a portal home tile. Each tile is identified
// by its type ("template" for built-in custom templates, "document" for
// published documents) and its key (the template slug or the document _id).
// Only superadmins may create/update/delete these records.
//
// The image binary is stored directly in MongoDB (as a Buffer field) so the
// icon is immediately available to every user on every server instance —
// no shared filesystem required.
const tileIconSchema = new mongoose.Schema(
  {
    tileType: {
      type: String,
      enum: ['template', 'document'],
      required: true,
    },
    tileKey: {
      type: String,
      required: true,
      trim: true,
    },
    filename: { type: String, required: true },
    mimeType: { type: String, default: 'image/png' },
    size:     { type: Number, default: 0 },
    // Image binary stored directly in the document — max 2 MB per icon.
    data:     { type: Buffer, required: true },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// One icon per tile — upsert replaces the previous one.
tileIconSchema.index({ tileType: 1, tileKey: 1 }, { unique: true });

module.exports = mongoose.models.TileIcon || mongoose.model('TileIcon', tileIconSchema);
