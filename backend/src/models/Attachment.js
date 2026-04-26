const mongoose = require('mongoose');

// Files attached to a Document or UnstructuredDocument — separate from the
// document body so they can be listed and downloaded individually.
const attachmentSchema = new mongoose.Schema(
  {
    documentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
    unstructuredId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnstructuredDocument', default: null, index: true },
    originId:       { type: String, default: '' },   // optional external/origin id
    filename:       { type: String, required: true },
    mimeType:       { type: String, default: 'application/octet-stream' },
    size:           { type: Number, default: 0 },    // bytes
    path:           { type: String, required: true }, // relative path under uploads/
    title:          { type: String, default: '' },
  },
  { timestamps: true }
);

attachmentSchema.index({ documentId: 1, originId: 1 });

module.exports = mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);
