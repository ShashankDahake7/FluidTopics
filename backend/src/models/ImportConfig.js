const mongoose = require('mongoose');

const originPortalSchema = new mongoose.Schema({
  baseUrl: { type: String, required: true },
  apiKey: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const importRecordSchema = new mongoose.Schema({
  portalId: { type: mongoose.Schema.Types.ObjectId, ref: 'OriginPortal', required: true },
  url: { type: String, required: true },
  author: { type: String, default: '' },
  categories: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'retrieving', 'ready', 'applying', 'done', 'failed'],
    default: 'pending',
  },
  error: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const OriginPortal = mongoose.models.OriginPortal || mongoose.model('OriginPortal', originPortalSchema);
const ImportRecord = mongoose.models.ImportRecord || mongoose.model('ImportRecord', importRecordSchema);

module.exports = { OriginPortal, ImportRecord };
