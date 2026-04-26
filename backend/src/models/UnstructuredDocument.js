const mongoose = require('mongoose');

// Unstructured documents — uploaded PDFs / DOCX / arbitrary blobs that aren't
// chunked into Topics. We persist both the raw file path and an extracted
// plain-text representation so they're searchable and previewable.
const unstructuredSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, index: 'text' },
    description: { type: String, default: '' },
    mimeType:    { type: String, default: 'application/octet-stream' },
    size:        { type: Number, default: 0 },
    filePath:    { type: String, default: '' },           // raw file under uploads/unstructured/
    contentText: { type: String, default: '' },          // extracted plain-text, used for search/preview
    contentHtml: { type: String, default: '' },          // optional rendered HTML preview
    metadata: {
      tags:     [{ type: String }],
      product:  { type: String, default: '' },
      version:  { type: String, default: '' },
      language: { type: String, default: 'en' },
      author:   { type: String, default: '' },
    },
    viewCount:   { type: Number, default: 0 },
    uploaderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

unstructuredSchema.index({ title: 'text', contentText: 'text' });

module.exports = mongoose.models.UnstructuredDocument || mongoose.model('UnstructuredDocument', unstructuredSchema);
