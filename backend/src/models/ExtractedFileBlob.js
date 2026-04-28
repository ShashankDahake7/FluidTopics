const mongoose = require('mongoose');

// Content-addressed index for the extracted S3 bucket. One document per
// distinct file body (`_id` = sha256 of the bytes). The extract worker
// consults this index for every zip entry it processes:
//
//   - HIT  → reuse the existing S3 key, increment refCount + lastSeenAt
//            (no PUT, near-zero latency).
//   - MISS → upload to extracted/<hash[0..1]>/<hash[2..3]>/<hash><ext>,
//            insert a fresh row with refCount = 1.
//
// `refCount` lets a future GC sweep (out of scope for V1) drop S3 objects
// that no manifest still points at. Until that lands the field is
// informational only — never trusted to skip a delete.
const extractedFileBlobSchema = new mongoose.Schema(
  {
    // sha256 hex string. Mongo auto-indexes _id, which is exactly the
    // lookup we do per zip entry — no extra index needed.
    _id: { type: String, required: true },

    bucket:      { type: String, required: true },
    key:         { type: String, required: true },
    size:        { type: Number, default: 0 },
    contentType: { type: String, default: 'application/octet-stream' },

    // How many manifest entries currently reference this blob. Bumped by
    // the extract worker on insert/hit; not decremented yet (GC TODO).
    refCount:    { type: Number, default: 1 },

    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt:  { type: Date, default: () => new Date() },
  },
  {
    // _id is a string we manage ourselves; disable Mongoose's ObjectId
    // auto-generation so the explicit hex hash stays canonical.
    _id: false,
    timestamps: false,
  }
);

extractedFileBlobSchema.index({ lastSeenAt: 1 });

module.exports = mongoose.model('ExtractedFileBlob', extractedFileBlobSchema);
