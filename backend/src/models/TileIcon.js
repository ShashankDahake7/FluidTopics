const mongoose = require('mongoose');

// Stores a custom icon image for a portal home tile. Each tile is identified
// by its type ("template" for built-in custom templates, "document" for
// published documents) and its key (the template slug or the document _id).
// Only superadmins may create/update/delete these records.
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
    path:     { type: String, required: true },   // relative to uploads/tile-icons/
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
