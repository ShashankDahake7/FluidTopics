/**
 * Logs configuration changes for the Configuration history admin UI.
 */
const ConfigChange = require('../models/ConfigChange');

const BYTES_PER_GB = 1024 * 1024 * 1024;

/** Fluid Topics automatic maintenance attribution (BRD). */
const SYSTEM_MAINTENANCE_JOB = {
  author: 'System Maintenance Job',
  authorEmail: 'system-maintenance-job@fluidtopics.com',
};

const FLUID_TOPICS_ROOT_USER = {
  author: 'Fluid Topics Root User',
  authorEmail: 'root@fluidtopics.com',
};

function authorFromRequest(req) {
  const u = req?.user;
  if (!u) return { author: 'Unknown', authorEmail: '' };
  const name = (u.name || '').trim();
  const email = (u.email || '').trim();
  return {
    author: name || email || 'Unknown',
    authorEmail: email,
  };
}

/**
 * Delete oldest entries for this portal until estimated storage is <= 1 GB.
 */
async function enforcePortalHistoryLimit(portalId = 'default') {
  const match = portalFilter(portalId);
  let totalBytes = await sumBsonBytes(match);
  if (totalBytes == null) {
    await fallbackTrimByCount(match);
    return;
  }
  let guard = 0;
  while (totalBytes > BYTES_PER_GB && guard++ < 500000) {
    const oldest = await ConfigChange.findOne(match).sort({ createdAt: 1 }).select('_id').lean();
    if (!oldest) break;
    await ConfigChange.deleteOne({ _id: oldest._id });
    totalBytes = await sumBsonBytes(match);
    if (totalBytes == null) break;
  }
}

function portalFilter(portalId) {
  if (portalId === 'default') {
    return { $or: [{ portalId: 'default' }, { portalId: { $exists: false } }] };
  }
  return { portalId };
}

async function sumBsonBytes(match) {
  try {
    const agg = await ConfigChange.collection
      .aggregate([
        { $match: match },
        { $project: { sz: { $bsonSize: '$$ROOT' } } },
        { $group: { _id: null, t: { $sum: '$sz' } } },
      ])
      .toArray();
    return agg[0]?.t ?? 0;
  } catch {
    return null;
  }
}

/** When $bsonSize is unavailable, cap by approximate document count. */
async function fallbackTrimByCount(match) {
  const approxBytesPerDoc = 2048;
  const maxDocs = Math.floor(BYTES_PER_GB / approxBytesPerDoc);
  for (;;) {
    const n = await ConfigChange.countDocuments(match);
    if (n <= maxDocs) return;
    const oldest = await ConfigChange.findOne(match).sort({ createdAt: 1 }).select('_id').lean();
    if (!oldest) return;
    await ConfigChange.deleteOne({ _id: oldest._id });
  }
}

async function logConfigChange({
  category,
  author,
  authorEmail,
  before,
  after,
  portalId = 'default',
}) {
  try {
    await ConfigChange.create({
      category,
      author: author || 'Unknown',
      authorEmail: authorEmail || '',
      before: before ?? {},
      after: after ?? {},
      portalId,
    });
    await enforcePortalHistoryLimit(portalId);
  } catch (err) {
    console.error('[ConfigAudit] Failed to log change:', err.message);
  }
}

module.exports = {
  logConfigChange,
  authorFromRequest,
  enforcePortalHistoryLimit,
  SYSTEM_MAINTENANCE_JOB,
  FLUID_TOPICS_ROOT_USER,
  portalFilter,
};
