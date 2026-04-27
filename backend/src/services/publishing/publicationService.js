const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');

const Publication = require('../../models/Publication');
const PublicationLog = require('../../models/PublicationLog');
const Document = require('../../models/Document');
const Topic = require('../../models/Topic');
const config = require('../../config/env');
const s3 = require('../storage/s3Service');
const { ingestFile } = require('../ingestion/ingestionService');

// Resolve the worker scripts once at module load — Worker constructor wants an
// absolute path. The worker files intentionally live under src/workers/ so they
// stay near the rest of the source tree.
const EXTRACT_WORKER_PATH  = path.resolve(__dirname, '../../workers/extractZipWorker.js');
const VALIDATE_WORKER_PATH = path.resolve(__dirname, '../../workers/validateRefsWorker.js');

// ── Helpers ────────────────────────────────────────────────────────────────
async function appendLog(publicationId, phase, entry) {
  const doc = await PublicationLog.create({
    publicationId,
    phase,
    level:   entry.level   || 'info',
    code:    entry.code    || 'unknown',
    message: entry.message || '',
    context: entry.context || {},
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
  });

  // Maintain the per-level counters on Publication so the list page can render
  // the success/warning/error badge without an aggregation query.
  const inc = {};
  if (entry.level === 'warn')  inc['counts.warn']  = 1;
  if (entry.level === 'error') inc['counts.error'] = 1;
  if (entry.level === 'info' || !entry.level) inc['counts.info'] = 1;
  if (Object.keys(inc).length) {
    await Publication.updateOne({ _id: publicationId }, { $inc: inc });
  }
  return doc;
}

// Run a worker thread to completion, plumbing every `log` message through to
// PublicationLog and aggregating other message types into a final result.
//
// The returned promise resolves once the worker exits cleanly. Callers that
// must answer an HTTP request quickly should NOT await this promise — instead
// spawn it as a fire-and-forget and let the workerThread update the
// Publication row + logs in the background. The drawer polls for status, so
// the UI stays in sync without holding a long-running request open.
function runWorker(workerPath, workerData, { publicationId, phase, onMessage }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData });
    const result = { manifest: null, summary: null, error: null };

    worker.on('message', async (msg) => {
      try {
        if (msg.type === 'log') {
          await appendLog(publicationId, phase, msg.entry);
        } else if (msg.type === 'manifest') {
          result.manifest = msg.files;
        } else if (msg.type === 'summary') {
          result.summary = msg;
        } else if (msg.type === 'error') {
          result.error = msg.message;
        }
        if (onMessage) onMessage(msg);
      } catch (err) {
        console.error('publicationService.runWorker message error:', err);
      }
    });

    worker.on('error', (err) => {
      result.error = err.message;
      reject(err);
    });

    worker.on('exit', (code) => {
      if (result.error) return reject(new Error(result.error));
      if (code !== 0) return reject(new Error(`Worker exited with code ${code}`));
      resolve(result);
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

// Step 1: file already on disk (multer drop) → upload to raw bucket, create DB
// row. We don't run extraction here so the user gets a snappy 201 even for
// large zips; they'll click "Extract" to kick off the worker.
async function uploadPublication({ file, userId, sourceLabel }) {
  const pub = await Publication.create({
    name: path.basename(file.originalname, path.extname(file.originalname)),
    originalFilename: file.originalname,
    sizeBytes: file.size,
    sourceLabel: sourceLabel || '',
    uploadedBy: userId || null,
    status: 'uploaded',
    raw: { bucket: config.s3.rawBucket, key: '' },
    extracted: { bucket: config.s3.extractedBucket, prefix: '' },
    timings: { uploadedAt: new Date() },
  });

  await appendLog(pub._id, 'upload', {
    level: 'info',
    code: 'upload_received',
    message: `Upload received: ${file.originalname} (${file.size} bytes)`,
    context: { filename: file.originalname, size: file.size },
  });

  const key = s3.rawKey(pub._id);
  let etag = '';
  try {
    const res = await s3.putFile({
      bucket: config.s3.rawBucket,
      key,
      filePath: file.path,
      contentType: 'application/zip',
    });
    etag = res.etag;
  } catch (err) {
    pub.status = 'failed';
    pub.lastError = { phase: 'upload', message: err.message, occurredAt: new Date() };
    await pub.save();
    await appendLog(pub._id, 'upload', {
      level: 'error',
      code: 'extract_failed',
      message: `S3 upload failed: ${err.message}`,
    });
    try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
    throw err;
  }

  pub.raw = { bucket: config.s3.rawBucket, key, etag };
  pub.extracted.prefix = s3.extractedRoot(pub._id);
  await pub.save();

  await appendLog(pub._id, 'upload', {
    level: 'info',
    code: 'upload_complete',
    message: `Stored in raw bucket as ${key}`,
    context: { bucket: config.s3.rawBucket, key, etag },
  });

  // Local multer drop is no longer needed — the durable copy lives in S3 now.
  // Note: the publication is intentionally NOT exposed in the portal yet. The
  // Document/Topic rows that drive the dashboard are only created after a
  // clean validation run (see runValidationInBackground) so unverified content
  // never leaks into the portal.
  try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }

  return pub;
}

// Step 2: extract zip from raw bucket → extracted bucket. Idempotent: re-runs
// blow away the previous extracted prefix first to keep the 1:1 mapping clean.
//
// Returns as soon as the worker is spawned. The HTTP request that triggered
// this MUST NOT wait for extraction to finish — large zips on slow networks
// will easily exceed the dev-server proxy's 30s timeout. The drawer polls
// /publications/:id and /publications/:id/logs to surface progress.
async function extractPublication(publicationId) {
  const pub = await Publication.findById(publicationId);
  if (!pub) {
    const err = new Error('Publication not found');
    err.status = 404;
    throw err;
  }
  if (!pub.raw?.key) {
    const err = new Error('Publication has no raw zip in S3');
    err.status = 409;
    throw err;
  }
  if (pub.status === 'extracting' || pub.status === 'validating') {
    const err = new Error(`Publication is already ${pub.status}`);
    err.status = 409;
    throw err;
  }

  // Wipe any stale extracted contents so the manifest stays a true reflection
  // of what's currently in S3.
  if (pub.extracted?.prefix) {
    try {
      await s3.deletePrefix({ bucket: pub.extracted.bucket, prefix: pub.extracted.prefix });
    } catch (err) {
      console.warn('extractPublication: prefix wipe warning:', err.message);
    }
  }

  pub.status = 'extracting';
  pub.timings.extractStart = new Date();
  pub.extracted = {
    bucket: config.s3.extractedBucket,
    prefix: s3.extractedRoot(pub._id),
    fileCount: 0,
    totalBytes: 0,
    manifest: [],
  };
  await pub.save();

  // Fire-and-forget the worker. Errors are surfaced via PublicationLog and
  // the publication's `status: failed` + `lastError` fields.
  runExtractionInBackground(pub._id).catch((err) => {
    console.error('extractPublication background error:', err);
  });

  return pub;
}

async function runExtractionInBackground(publicationId) {
  try {
    const pub = await Publication.findById(publicationId);
    if (!pub) return;

    const result = await runWorker(EXTRACT_WORKER_PATH, {
      publicationId: String(pub._id),
      raw: { bucket: pub.raw.bucket, key: pub.raw.key },
      extracted: { bucket: pub.extracted.bucket, prefix: pub.extracted.prefix },
      maxEntryBytes: config.publishing.maxEntryBytes,
    }, { publicationId: pub._id, phase: 'extract' });

    const manifest = result.manifest || [];
    const totalBytes = manifest.reduce((acc, f) => acc + (f.size || 0), 0);

    // Re-fetch to avoid stale-doc parallel-save errors with mongoose.
    const fresh = await Publication.findById(publicationId);
    if (!fresh) return;
    fresh.status = 'extracted';
    fresh.timings.extractEnd = new Date();
    fresh.extracted.manifest = manifest;
    fresh.extracted.fileCount = manifest.length;
    fresh.extracted.totalBytes = totalBytes;
    await fresh.save();
  } catch (err) {
    console.error('runExtractionInBackground worker error:', err);
    try {
      const fresh = await Publication.findById(publicationId);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = { phase: 'extract', message: err.message, occurredAt: new Date() };
        fresh.timings.extractEnd = new Date();
        await fresh.save();
      }
      await appendLog(publicationId, 'extract', {
        level: 'error',
        code: 'extract_failed',
        message: `Extraction failed: ${err.message}`,
      });
    } catch (innerErr) {
      console.error('runExtractionInBackground failure-bookkeeping error:', innerErr);
    }
  }
}

// Step 3: validate references in the extracted manifest. Run any number of
// times — each run appends new log entries (we don't dedupe across runs on
// purpose so the user sees a fresh report every time).
//
// Like extractPublication, this returns as soon as the worker is spawned.
async function validatePublication(publicationId) {
  const pub = await Publication.findById(publicationId);
  if (!pub) {
    const err = new Error('Publication not found');
    err.status = 404;
    throw err;
  }
  if (!pub.extracted?.manifest?.length) {
    const err = new Error('Publication has no extracted manifest yet');
    err.status = 409;
    throw err;
  }
  if (pub.status === 'extracting' || pub.status === 'validating') {
    const err = new Error(`Publication is already ${pub.status}`);
    err.status = 409;
    throw err;
  }

  pub.status = 'validating';
  pub.timings.validateStart = new Date();
  await pub.save();

  runValidationInBackground(pub._id).catch((err) => {
    console.error('validatePublication background error:', err);
  });

  return pub;
}

async function runValidationInBackground(publicationId) {
  try {
    const pub = await Publication.findById(publicationId);
    if (!pub) return;

    const result = await runWorker(VALIDATE_WORKER_PATH, {
      publicationId: String(pub._id),
      extracted: { bucket: pub.extracted.bucket, prefix: pub.extracted.prefix },
      manifest: pub.extracted.manifest.map((m) => ({ path: m.path, key: m.key })),
    }, { publicationId: pub._id, phase: 'validate' });

    const summary = result.summary || {};
    const missingTopicCount      = summary.missingTopicCount      || 0;
    const missingAttachmentCount = summary.missingAttachmentCount || 0;
    const brokenLinkCount        = summary.brokenLinkCount        || 0;
    const totalIssues = missingTopicCount + missingAttachmentCount + brokenLinkCount;

    const fresh = await Publication.findById(publicationId);
    if (!fresh) return;
    fresh.status = 'validated';
    fresh.timings.validateEnd = new Date();
    fresh.validation = {
      checkedAt: new Date(),
      missingTopicCount,
      missingAttachmentCount,
      brokenLinkCount,
      summary: `${missingTopicCount} topics, ${missingAttachmentCount} attachments, ${brokenLinkCount} other`,
    };
    await fresh.save();

    // Only publish into the portal/dashboard once validation is *clean*. Any
    // missing topic/attachment/broken-link prevents the Document/Topic graph
    // from being created so unverified content never leaks into the user-
    // facing portal. The publication itself stays in the publishing list so
    // the admin can re-extract / re-validate after fixing the source.
    if (totalIssues === 0 && !fresh.documentId) {
      await ingestValidatedPublication(fresh);
    } else if (totalIssues > 0) {
      await appendLog(publicationId, 'validate', {
        level: 'warn',
        code: 'publish_skipped',
        message: `Skipping portal publish: validation found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} (${missingTopicCount} missing topics, ${missingAttachmentCount} missing attachments, ${brokenLinkCount} broken links). Fix the source and re-validate.`,
        context: { missingTopicCount, missingAttachmentCount, brokenLinkCount },
      });
    }
  } catch (err) {
    console.error('runValidationInBackground worker error:', err);
    try {
      const fresh = await Publication.findById(publicationId);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = { phase: 'validate', message: err.message, occurredAt: new Date() };
        fresh.timings.validateEnd = new Date();
        await fresh.save();
      }
      await appendLog(publicationId, 'validate', {
        level: 'error',
        code: 'validate_failed',
        message: `Validation failed: ${err.message}`,
      });
    } catch (innerErr) {
      console.error('runValidationInBackground failure-bookkeeping error:', innerErr);
    }
  }
}

// Pull the raw zip back out of S3 to a tempfile and run the existing
// ingestion pipeline on it. This is what makes the publication visible in
// the portal/dashboard. Called only after a clean validation run, never
// directly from the upload path.
async function ingestValidatedPublication(pub) {
  if (!pub?.raw?.bucket || !pub?.raw?.key) {
    await appendLog(pub._id, 'publish', {
      level: 'error',
      code: 'publish_failed',
      message: 'Cannot publish: raw zip not available in S3.',
    });
    return;
  }

  const tmpDir = path.resolve(config.upload.dir);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpName = `publish-${pub._id}-${Date.now()}.zip`;
  const tmpPath = path.join(tmpDir, tmpName);

  await appendLog(pub._id, 'publish', {
    level: 'info',
    code: 'publish_started',
    message: 'Validation clean — publishing to portal…',
  });

  try {
    // Stream raw zip → local tmp file. ingestFile() reads from disk, so we
    // avoid loading the whole archive into memory just to hand it off.
    const stream = await s3.getObjectStream({ bucket: pub.raw.bucket, key: pub.raw.key });
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmpPath);
      stream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      stream.on('error', reject);
    });

    // ingestFile() expects a multer-shaped file object; size + originalname
    // are the only fields it consults beyond `path`. ingestFile also unlinks
    // the path on its own success path, so we do not delete it here.
    const fakeFile = {
      path: tmpPath,
      originalname: pub.originalFilename,
      size: pub.sizeBytes,
      mimetype: 'application/zip',
    };
    const doc = await ingestFile(fakeFile, pub.uploadedBy || null);

    const refreshed = await Publication.findById(pub._id);
    if (refreshed) {
      refreshed.documentId = doc._id;
      await refreshed.save();
    }

    await appendLog(pub._id, 'publish', {
      level: 'info',
      code: 'publish_complete',
      message: `Published to portal as document ${doc._id}`,
      context: { documentId: String(doc._id), title: doc.title },
    });
  } catch (err) {
    console.error('ingestValidatedPublication error:', err);
    await appendLog(pub._id, 'publish', {
      level: 'error',
      code: 'publish_failed',
      message: `Portal publish failed: ${err.message}`,
    });
    // Best-effort cleanup; ingestFile may have already removed the file.
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
  }
}

// ── Read APIs (for the publishing list + drawer) ───────────────────────────

async function listPublications({ search, status, source, from, to, page = 1, limit = 25, sortKey = 'createdAt', sortDir = 'desc' } = {}) {
  const q = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    q.$or = [{ name: rx }, { originalFilename: rx }, { sourceLabel: rx }];
  }
  if (status && status !== 'all') q.status = status;
  if (source) q.sourceLabel = source;
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to)   q.createdAt.$lte = new Date(to);
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const sort = { [sortKey || 'createdAt']: sortDir === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    Publication.find(q)
      .populate('uploadedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Publication.countDocuments(q),
  ]);

  return {
    items: items.map(serialise),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getPublication(id) {
  const pub = await Publication.findById(id).populate('uploadedBy', 'name email').lean();
  if (!pub) return null;
  return serialise(pub, { includeManifest: true });
}

async function getLogs(id, { page = 1, limit = 100, level, code, phase } = {}) {
  const q = { publicationId: id };
  if (level) q.level = level;
  if (code) q.code = code;
  if (phase) q.phase = phase;
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    PublicationLog.find(q).sort({ timestamp: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    PublicationLog.countDocuments(q),
  ]);
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function streamLogsAsText(id) {
  const cursor = PublicationLog.find({ publicationId: id }).sort({ timestamp: 1, _id: 1 }).cursor();
  let out = '';
  for await (const doc of cursor) {
    const ts = doc.timestamp.toISOString();
    out += `[${ts}] ${doc.level.toUpperCase()} [${doc.phase}/${doc.code}] ${doc.message}\n`;
  }
  return out;
}

async function presignArchive(id) {
  const pub = await Publication.findById(id).lean();
  if (!pub || !pub.raw?.key) return null;
  return s3.presignDownload({
    bucket: pub.raw.bucket,
    key: pub.raw.key,
    filename: pub.originalFilename,
  });
}

async function presignFile(id, relPath) {
  const pub = await Publication.findById(id).lean();
  if (!pub) return null;
  const key = s3.extractedKey(pub._id, relPath);
  return s3.presignDownload({
    bucket: pub.extracted.bucket,
    key,
    filename: relPath.split('/').pop(),
  });
}

async function deletePublication(id) {
  const pub = await Publication.findById(id);
  if (!pub) return false;

  if (pub.raw?.key) {
    try { await s3.deleteOne({ bucket: pub.raw.bucket, key: pub.raw.key }); }
    catch (err) { console.warn('deletePublication raw cleanup warning:', err.message); }
  }
  if (pub.extracted?.prefix) {
    try { await s3.deletePrefix({ bucket: pub.extracted.bucket, prefix: pub.extracted.prefix }); }
    catch (err) { console.warn('deletePublication extracted cleanup warning:', err.message); }
  }

  // Cascade: drop the parsed Document/Topic graph the upload pipeline created
  // so the portal stops listing it. We don't fail the whole delete if these
  // collections don't exist — best-effort cleanup.
  if (pub.documentId) {
    try {
      await Topic.deleteMany({ documentId: pub.documentId });
      await Document.deleteOne({ _id: pub.documentId });
    } catch (err) {
      console.warn('deletePublication document cleanup warning:', err.message);
    }
  }

  await PublicationLog.deleteMany({ publicationId: pub._id });
  await Publication.deleteOne({ _id: pub._id });
  return true;
}

// ── Internals ──────────────────────────────────────────────────────────────
function serialise(pub, { includeManifest = false } = {}) {
  if (!pub) return null;
  return {
    id: String(pub._id),
    name: pub.name,
    originalFilename: pub.originalFilename,
    sizeBytes: pub.sizeBytes,
    sourceLabel: pub.sourceLabel,
    status: pub.status,
    documentId: pub.documentId ? String(pub.documentId) : null,
    counts: pub.counts || { info: 0, warn: 0, error: 0 },
    raw: pub.raw,
    extracted: includeManifest
      ? pub.extracted
      : {
          bucket: pub.extracted?.bucket,
          prefix: pub.extracted?.prefix,
          fileCount: pub.extracted?.fileCount || 0,
          totalBytes: pub.extracted?.totalBytes || 0,
        },
    validation: pub.validation || null,
    timings: pub.timings || null,
    lastError: pub.lastError || null,
    uploadedBy: pub.uploadedBy
      ? { id: String(pub.uploadedBy._id), name: pub.uploadedBy.name, email: pub.uploadedBy.email }
      : null,
    createdAt: pub.createdAt,
    updatedAt: pub.updatedAt,
  };
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = {
  uploadPublication,
  extractPublication,
  validatePublication,
  listPublications,
  getPublication,
  getLogs,
  streamLogsAsText,
  presignArchive,
  presignFile,
  deletePublication,
};
