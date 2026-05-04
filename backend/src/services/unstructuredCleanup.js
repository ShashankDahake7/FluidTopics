const UnstructuredDocument = require('../models/UnstructuredDocument');
const Attachment = require('../models/Attachment');
const Rating = require('../models/Rating');
const config = require('../config/env');
const s3 = require('./storage/s3Service');

/**
 * Remove unstructured docs and dependent rows. Returns how many were deleted.
 */
async function deleteUnstructuredByIds(ids) {
  const list = (ids || []).map((id) => id).filter(Boolean);
  if (!list.length) return 0;
  await Promise.all([
    Attachment.deleteMany({ unstructuredId: { $in: list } }),
    Rating.deleteMany({ unstructuredId: { $in: list } }),
  ]);
  const r = await UnstructuredDocument.deleteMany({ _id: { $in: list } });
  return r.deletedCount ?? list.length;
}

/**
 * Drops unstructured hits whose backing blob is gone from S3 (unless inline
 * HTML preview exists). Deletes those Mongo rows so search and lists stay
 * consistent with storage.
 */
async function purgeUnstructuredMissingFromStorage(rawDocs) {
  const kept = [];
  const staleIds = [];
  for (const d of rawDocs) {
    if (d.hasContentHtml) {
      kept.push(d);
      continue;
    }
    const key = d.filePath && String(d.filePath).trim();
    if (!key) {
      kept.push(d);
      continue;
    }
    try {
      const ok = await s3.objectExists({ bucket: config.s3.extractedBucket, key });
      if (ok) {
        kept.push(d);
        continue;
      }
    } catch (_) {
      // S3 misconfigured or transient — do not hide results.
      kept.push(d);
      continue;
    }
    staleIds.push(d._id);
  }
  if (staleIds.length) {
    await deleteUnstructuredByIds(staleIds);
  }
  return { kept, removed: staleIds.length };
}

module.exports = { deleteUnstructuredByIds, purgeUnstructuredMissingFromStorage };
