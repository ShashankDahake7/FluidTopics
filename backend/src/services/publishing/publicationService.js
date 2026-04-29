const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const Publication = require('../../models/Publication');
const PublicationLog = require('../../models/PublicationLog');
const Document = require('../../models/Document');
const Topic = require('../../models/Topic');
const Source = require('../../models/Source');
const ValidationCache = require('../../models/ValidationCache');
const config = require('../../config/env');
const s3 = require('../storage/s3Service');
const { ingestFile, ingestZipForTarget } = require('../ingestion/ingestionService');

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

// Stream-hash a file from disk in a single pass. Returns the hex digest.
// Used both to compute the raw zip's contentHash before we PUT it to S3
// and to compare against the in-DB Publication.contentHash index.
function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Step 1: file already on disk (multer drop) → stream-hash it, dedupe
// against prior validated publications by `contentHash`, then either:
//   - HIT  → copy the prior row's manifest + validation summary, mark
//            this Publication as `dedupeMode: 'reused-zip'`, jump
//            straight to ingest. Extract + validate workers never run.
//   - MISS → upload to a content-addressed raw key and continue with the
//            normal extract → validate → ingest lifecycle.
//
// `sourceId` is the canonical string id from the Source model (e.g.
// "paligo"). `replaces` (optional) is a Publication ObjectId chosen via
// the upload modal's "Publish as new version of" dropdown — when set,
// ingest will merge into that publication's Document instead of creating
// a fresh one (see ingestValidatedPublication / diffIngest).
async function uploadPublication({ file, userId, sourceId, sourceLabel, replaces }) {
  let resolvedSourceObjectId = null;
  let resolvedSourceLabel = sourceLabel || '';

  if (sourceId) {
    const source = await Source.findOne({ sourceId: String(sourceId).trim() });
    if (!source) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
      const err = new Error(`Unknown source: ${sourceId}`);
      err.status = 400;
      throw err;
    }
    resolvedSourceObjectId = source._id;
    resolvedSourceLabel = sourceLabel || source.name;
  }

  // Validate `replaces` BEFORE creating the Publication row so a bad id
  // doesn't leave an orphan in the history table. Cheap lookup + ensures
  // the target shares the same source so the dropdown can't be abused
  // to merge across unrelated documents.
  let resolvedReplaces = null;
  if (replaces) {
    let target;
    try {
      target = await Publication.findById(replaces).select('sourceId status documentId').lean();
    } catch (_) { target = null; }
    if (!target) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
      const err = new Error(`Unknown publication to replace: ${replaces}`);
      err.status = 400;
      throw err;
    }
    if (resolvedSourceObjectId && target.sourceId && String(target.sourceId) !== String(resolvedSourceObjectId)) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
      const err = new Error('Replacement target must belong to the same source.');
      err.status = 400;
      throw err;
    }
    resolvedReplaces = target._id;
  }

  // Compute the raw zip hash up front. Streaming so even a multi-GB drop
  // stays bounded in memory. A failure here just means we lose dedupe;
  // the upload still proceeds with an empty contentHash so the lifecycle
  // matches the legacy behaviour.
  let contentHash = '';
  try {
    contentHash = await sha256OfFile(file.path);
  } catch (err) {
    console.warn('uploadPublication: contentHash computation failed:', err.message);
  }

  const pub = await Publication.create({
    name: path.basename(file.originalname, path.extname(file.originalname)),
    originalFilename: file.originalname,
    sizeBytes: file.size,
    sourceId: resolvedSourceObjectId,
    sourceLabel: resolvedSourceLabel,
    uploadedBy: userId || null,
    status: 'uploaded',
    raw: { bucket: config.s3.rawBucket, key: '' },
    extracted: { bucket: config.s3.extractedBucket, prefix: '' },
    timings: { uploadedAt: new Date() },
    contentHash,
    replaces: resolvedReplaces,
    dedupeMode: 'fresh',
  });

  await appendLog(pub._id, 'upload', {
    level: 'info',
    code: 'upload_received',
    message: `Upload received: ${file.originalname} (${file.size} bytes)`,
    context: { filename: file.originalname, size: file.size, contentHash },
  });

  // Look for a prior Publication that already finished extract + validate
  // for this exact zip body. We exclude the current row from the lookup
  // (just-created → not validated, but be safe in case of races) and
  // require manifest + validation to be present. A missing contentHash
  // disables dedupe entirely, mirroring the legacy path.
  let priorValidated = null;
  if (contentHash) {
    try {
      priorValidated = await Publication.findOne({
        contentHash,
        status: 'validated',
        _id: { $ne: pub._id },
        'extracted.manifest.0': { $exists: true },
      })
        .sort({ createdAt: -1 })
        .lean();
    } catch (err) {
      console.warn('uploadPublication: dedupe lookup failed:', err.message);
    }
  }

  // CAS key for the raw zip. Falls back to the legacy per-pub layout
  // when contentHash is empty (e.g. hash failure above).
  const rawKey = contentHash
    ? s3.rawCasKey(contentHash)
    : s3.rawKey(pub._id);

  // Skip the S3 PUT entirely when an existing CAS object is already
  // present. headObject is a single round-trip; the alternative is a
  // multipart upload of potentially gigabytes of bytes for a row that's
  // about to be dedupe-jumped anyway.
  let etag = '';
  let alreadyExists = false;
  if (contentHash) {
    try {
      alreadyExists = await s3.objectExists({ bucket: config.s3.rawBucket, key: rawKey });
    } catch (err) {
      console.warn('uploadPublication: raw existence check failed:', err.message);
    }
  }

  if (!alreadyExists) {
    try {
      const res = await s3.putFile({
        bucket: config.s3.rawBucket,
        key: rawKey,
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
  } else {
    // Reuse the existing object's etag if we can — purely informational
    // for the drawer, never load-bearing.
    try {
      const head = await s3.headObject({ bucket: config.s3.rawBucket, key: rawKey });
      etag = String(head.ETag || '').replace(/^"|"$/g, '');
    } catch (_) { /* ignore */ }
  }

  pub.raw = { bucket: config.s3.rawBucket, key: rawKey, etag };
  pub.extracted.prefix = s3.extractedRoot(pub._id);
  await pub.save();

  await appendLog(pub._id, 'upload', {
    level: 'info',
    code: 'upload_complete',
    message: alreadyExists
      ? `Reused existing raw object ${rawKey} (${contentHash.slice(0, 12)}…)`
      : `Stored in raw bucket as ${rawKey}`,
    context: { bucket: config.s3.rawBucket, key: rawKey, etag, deduped: alreadyExists },
  });

  // Local multer drop is no longer needed — the durable copy lives in S3
  // (or already lived there). Note: the publication is intentionally NOT
  // exposed in the portal yet. The Document/Topic rows are only created
  // after a clean validation run (or via dedupe → ingest below) so
  // unverified content never leaks into the portal.
  try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }

  // Dedupe shortcut: prior validated row with the same hash. Copy the
  // manifest + validation summary verbatim and jump straight to ingest in
  // the background. The drawer still sees a normal uploaded → extracted
  // → validated → published trail, but extract/validate timings are ~0ms.
  if (priorValidated) {
    runDedupedPublishInBackground(pub._id, priorValidated).catch((err) => {
      console.error('uploadPublication: dedupe pipeline error:', err);
    });
  } else {
    // Auto-chain extract → validate → portal-publish so a single click of
    // "Publish" in the UI takes the zip all the way through. Validate is
    // chained from runExtractionInBackground on success.
    extractPublication(pub._id).catch((err) => {
      console.error('uploadPublication: auto-extract error:', err);
    });
  }

  return pub;
}

// Background helper for the dedupe-on-upload path. Copies the prior
// row's manifest + validation, walks through the standard lifecycle log
// entries so the drawer renders a normal trail, then fires ingestion.
async function runDedupedPublishInBackground(publicationId, prior) {
  try {
    const fresh = await Publication.findById(publicationId);
    if (!fresh) return;

    fresh.dedupeMode = 'reused-zip';
    fresh.status = 'extracting';
    fresh.timings.extractStart = new Date();
    await fresh.save();

    await appendLog(publicationId, 'extract', {
      level: 'info',
      code: 'extract_skipped',
      message: `Skipping extract — identical zip already extracted in publication ${prior._id}.`,
      context: { reusedFrom: String(prior._id), fileCount: prior.extracted?.fileCount || 0 },
    });

    fresh.extracted = {
      bucket: prior.extracted.bucket,
      prefix: prior.extracted.prefix,
      fileCount: prior.extracted.fileCount || 0,
      totalBytes: prior.extracted.totalBytes || 0,
      manifest: prior.extracted.manifest || [],
    };
    fresh.status = 'extracted';
    fresh.timings.extractEnd = new Date();
    await fresh.save();

    fresh.status = 'validating';
    fresh.timings.validateStart = new Date();
    await fresh.save();

    await appendLog(publicationId, 'validate', {
      level: 'info',
      code: 'validate_skipped',
      message: `Skipping validate — reusing summary from publication ${prior._id}.`,
      context: { reusedFrom: String(prior._id) },
    });

    fresh.validation = prior.validation || fresh.validation;
    fresh.status = 'validated';
    fresh.timings.validateEnd = new Date();
    await fresh.save();

    await ingestValidatedPublication(fresh);
  } catch (err) {
    console.error('runDedupedPublishInBackground error:', err);
    try {
      const fresh = await Publication.findById(publicationId);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = { phase: 'publish', message: err.message, occurredAt: new Date() };
        await fresh.save();
      }
      await appendLog(publicationId, 'publish', {
        level: 'error',
        code: 'publish_failed',
        message: `Deduped publish failed: ${err.message}`,
      });
    } catch (innerErr) {
      console.error('runDedupedPublishInBackground bookkeeping error:', innerErr);
    }
  }
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

    // Reflect the per-file CAS reuse into the ExtractedFileBlob index so
    // a future GC sweep can drop zero-ref objects + so the admin can see
    // which blobs are hot. Best-effort: failure here doesn't unwind the
    // extract success.
    try {
      await upsertExtractedFileBlobs(manifest);
    } catch (err) {
      console.warn('runExtractionInBackground: blob index upsert warning:', err.message);
    }

    // Chain validate so the publish UI runs the full pipeline on a single
    // click. Validation itself only ingests into the portal on a clean
    // (zero-issue) run, so failed validations stop short of dashboard publish.
    try {
      await validatePublication(fresh._id);
    } catch (err) {
      console.error('runExtractionInBackground: auto-validate error:', err);
    }
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

    // Resolve the Source type so the validation worker can adjust strictness
    // for binary/attachment-oriented sources (UD, MapAttachments, etc.).
    let sourceType = null;
    if (pub.sourceId) {
      try {
        const source = await Source.findById(pub.sourceId).select('type').lean();
        sourceType = source?.type || null;
      } catch (_) { /* best-effort */ }
    }

    // ValidationCache short-circuit: a previous run against this exact
    // zip body already produced a summary. The summary is purely a
    // function of the extracted manifest, which is purely a function of
    // the zip bytes, so re-running the worker would just yield the same
    // numbers. We bump hitCount + lastSeen for ops visibility.
    let cached = null;
    if (pub.contentHash) {
      try {
        cached = await ValidationCache.findOneAndUpdate(
          { _id: pub.contentHash },
          { $inc: { hitCount: 1 }, $set: { validatedAt: new Date() } },
          { new: false }
        ).lean();
      } catch (err) {
        console.warn('runValidationInBackground: cache lookup failed:', err.message);
      }
    }

    let summary;
    if (cached?.summary) {
      summary = cached.summary;
      await appendLog(publicationId, 'validate', {
        level: 'info',
        code: 'validate_cached',
        message: `Reusing cached validation summary for contentHash ${pub.contentHash.slice(0, 12)}…`,
        context: {
          contentHash: pub.contentHash,
          ...summary,
        },
      });
      // Surface the cache hit on the Publication itself so the drawer's
      // dedupeMode pill flips to "reused-validation" — but only when we
      // didn't already mark the row as 'reused-zip' (which trumps).
      if (pub.dedupeMode === 'fresh') {
        pub.dedupeMode = 'reused-validation';
        await pub.save();
      }
    } else {
      const result = await runWorker(VALIDATE_WORKER_PATH, {
        publicationId: String(pub._id),
        extracted: { bucket: pub.extracted.bucket, prefix: pub.extracted.prefix },
        manifest: pub.extracted.manifest.map((m) => ({ path: m.path, key: m.key })),
        sourceType,
      }, { publicationId: pub._id, phase: 'validate' });
      summary = result.summary || {};
    }

    const missingTopicCount      = summary.missingTopicCount      || 0;
    const missingAttachmentCount = summary.missingAttachmentCount || 0;
    const brokenLinkCount        = summary.brokenLinkCount        || 0;
    const unresolvedXrefCount    = summary.unresolvedXrefCount    || 0;
    const hasParseableContent    = summary.hasParseableContent !== false;
    const hasBinaryContent       = summary.hasBinaryContent === true;
    const totalIssues =
      missingTopicCount +
      missingAttachmentCount +
      brokenLinkCount +
      unresolvedXrefCount;

    const fresh = await Publication.findById(publicationId);
    if (!fresh) return;
    fresh.status = 'validated';
    fresh.timings.validateEnd = new Date();
    fresh.validation = {
      checkedAt: new Date(),
      missingTopicCount,
      missingAttachmentCount,
      brokenLinkCount,
      summary: `${missingTopicCount} topics, ${missingAttachmentCount} attachments, ${brokenLinkCount + unresolvedXrefCount} other`,
    };
    await fresh.save();

    // Persist the freshly-computed summary into ValidationCache so the
    // next upload of the same zip skips the worker. We only cache on
    // fresh runs (cached === null) so a second cache-hit doesn't write
    // back the same row needlessly. Best-effort: failure here just
    // disables dedupe for the next upload.
    if (!cached && fresh.contentHash) {
      try {
        await ValidationCache.updateOne(
          { _id: fresh.contentHash },
          {
            $setOnInsert: {
              _id: fresh.contentHash,
              summary: {
                missingTopicCount,
                missingAttachmentCount,
                brokenLinkCount,
                unresolvedXrefCount,
                hasParseableContent,
                hasBinaryContent,
              },
              validatedAt: new Date(),
              hitCount: 0,
            },
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('runValidationInBackground: cache persist warning:', err.message);
      }
    }

    // Determine whether to auto-publish into the portal. Three tracks:
    //
    //   1. Structured source (Paligo, DITA, Confluence, etc.) with clean
    //      validation and parseable HTML/XML topics → publish normally.
    //
    //   2. Binary/attachment source (UD, MapAttachments, External, etc.)
    //      with clean validation → publish even when there are no
    //      parseable HTML topics, as long as binary content exists.
    //      These sources carry PDFs/Office docs that the portal can
    //      render as download links.
    //
    //   3. Any source with validation issues → skip publish, log why.
    const { BINARY_SOURCE_TYPES } = require('../../utils/helpers');
    const isBinarySource = sourceType && BINARY_SOURCE_TYPES.has(sourceType);
    const canPublish = totalIssues === 0
      && (hasParseableContent || (isBinarySource && hasBinaryContent))
      && !fresh.documentId;

    if (canPublish) {
      await ingestValidatedPublication(fresh);
    } else if (totalIssues > 0) {
      await appendLog(publicationId, 'validate', {
        level: 'warn',
        code: 'publish_skipped',
        message: `Skipping portal publish: validation found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} (${missingTopicCount} missing topics, ${missingAttachmentCount} missing attachments, ${unresolvedXrefCount} unresolved xrefs, ${brokenLinkCount} broken links). Fix the source and re-validate.`,
        context: { missingTopicCount, missingAttachmentCount, unresolvedXrefCount, brokenLinkCount },
      });
    } else if (!hasParseableContent && !hasBinaryContent) {
      await appendLog(publicationId, 'validate', {
        level: 'warn',
        code: 'publish_skipped',
        message: 'Skipping portal publish: extracted zip has no HTML/XML/DITA topics and no binary content for this source type.',
        context: { missingTopicCount, missingAttachmentCount, unresolvedXrefCount, brokenLinkCount, sourceType: sourceType || 'unknown' },
      });
    } else if (!hasParseableContent && hasBinaryContent && !isBinarySource) {
      await appendLog(publicationId, 'validate', {
        level: 'warn',
        code: 'publish_skipped',
        message: `Skipping portal publish: extracted zip has no HTML/XML/DITA topics. It contains binary files, but source type "${sourceType}" expects parseable content.`,
        context: { missingTopicCount, missingAttachmentCount, unresolvedXrefCount, brokenLinkCount, sourceType: sourceType || 'unknown' },
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

// Pull the raw zip back out of S3 to a tempfile and run the diff-aware
// ingestion pipeline on it. Two modes:
//
//   - `pub.replaces` UNSET — fresh publish: a brand-new Document is
//     created. Behaves identically to the legacy snapshot pipeline.
//
//   - `pub.replaces` SET   — re-publish: we resolve the prior
//     publication's Document and diff-merge the new topic candidates
//     into it. Topic._id continuity preserves bookmarks, ratings, view
//     counts, prettyUrl, and Atlas Search entries for unchanged topics.
//
// Concurrency: `acquirePublishLock` writes a sentinel into
// Document.currentPublicationId before ingest runs. A second concurrent
// re-publish against the same target sees the sentinel and 409s.
async function ingestValidatedPublication(pub) {
  if (!pub?.raw?.bucket || !pub?.raw?.key) {
    await appendLog(pub._id, 'publish', {
      level: 'error',
      code: 'publish_failed',
      message: 'Cannot publish: raw zip not available in S3.',
    });
    return;
  }

  // Resolve the merge target up front. A bad `replaces` here means we
  // can't honour the user's intent — better to fail loudly than to
  // silently fork a new Document.
  let targetDocumentId = null;
  if (pub.replaces) {
    let priorPub;
    try {
      priorPub = await Publication.findById(pub.replaces).select('documentId').lean();
    } catch (_) { priorPub = null; }
    if (!priorPub) {
      await appendLog(pub._id, 'publish', {
        level: 'error',
        code: 'publish_failed',
        message: `Cannot publish: replacement target ${pub.replaces} no longer exists.`,
      });
      return;
    }
    if (!priorPub.documentId) {
      await appendLog(pub._id, 'publish', {
        level: 'error',
        code: 'publish_failed',
        message: `Cannot publish: replacement target ${pub.replaces} has no associated document yet.`,
      });
      return;
    }
    targetDocumentId = priorPub.documentId;
  }

  // Acquire the document-level publish lock when we have a target
  // (fresh-publish path doesn't need a lock — there's no shared doc).
  let lockAcquired = false;
  if (targetDocumentId) {
    lockAcquired = await acquirePublishLock(targetDocumentId, pub._id);
    if (!lockAcquired) {
      await appendLog(pub._id, 'publish', {
        level: 'error',
        code: 'publish_locked',
        message: `Another re-publish is already in flight for the target document. Try again once it finishes.`,
        context: { targetDocumentId: String(targetDocumentId) },
      });
      const fresh = await Publication.findById(pub._id);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = { phase: 'publish', message: 'Publish lock contention', occurredAt: new Date() };
        await fresh.save();
      }
      return;
    }
  }

  const tmpDir = path.resolve(config.upload.dir);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpName = `publish-${pub._id}-${Date.now()}.zip`;
  const tmpPath = path.join(tmpDir, tmpName);

  await appendLog(pub._id, 'publish', {
    level: 'info',
    code: 'publish_started',
    message: targetDocumentId
      ? `Validation clean — re-publishing into document ${targetDocumentId}…`
      : 'Validation clean — publishing to portal…',
    context: targetDocumentId ? { targetDocumentId: String(targetDocumentId) } : {},
  });

  try {
    // Stream raw zip → local tmp file. ingestZipForTarget reads from
    // disk, so we avoid loading the whole archive into memory just to
    // hand it off.
    const stream = await s3.getObjectStream({ bucket: pub.raw.bucket, key: pub.raw.key });
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmpPath);
      stream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      stream.on('error', reject);
    });

    const fakeFile = {
      path: tmpPath,
      originalname: pub.originalFilename,
      size: pub.sizeBytes,
      mimetype: 'application/zip',
    };
    const { document: doc, diffSummary } = await ingestZipForTarget(fakeFile, pub.uploadedBy || null, {
      targetDocumentId,
      publicationId: pub._id,
    });

    const topicCount = Array.isArray(doc.topicIds) ? doc.topicIds.length : 0;
    if (topicCount === 0) {
      // Fresh-publish only: a brand-new Document with zero topics is a
      // dead link. Wipe it. Re-publish into an existing document with
      // zero NEW topics is fine (the existing topics may still be
      // there; diff-ingest just removed everything because the new zip
      // had none).
      if (!targetDocumentId) {
        try { await Topic.deleteMany({ documentId: doc._id }); } catch (_) { /* ignore */ }
        try { await Document.deleteOne({ _id: doc._id }); } catch (_) { /* ignore */ }
      }
      await appendLog(pub._id, 'publish', {
        level: 'error',
        code: 'publish_failed',
        message: 'Portal publish skipped: ingestion produced 0 topics. The zip likely contains no parseable content for this source type.',
        context: { documentId: String(doc._id), originalFilename: pub.originalFilename },
      });
      try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
      if (lockAcquired) await releasePublishLock(targetDocumentId, pub._id);
      return;
    }

    // Determine the final dedupeMode for the publication. 'reused-zip' /
    // 'reused-validation' was set earlier; 'reused-document' wins when
    // we just merged into an existing doc unless one of the more
    // specific labels already applies.
    const refreshed = await Publication.findById(pub._id);
    if (refreshed) {
      refreshed.documentId = doc._id;
      if (targetDocumentId && refreshed.dedupeMode === 'fresh') {
        refreshed.dedupeMode = 'reused-document';
      }
      await refreshed.save();
    }

    // Bump Document.version and append a versionHistory row. The
    // version field has always existed; we now actually use it.
    try {
      doc.version = (doc.version || 1) + (targetDocumentId ? 1 : 0);
      doc.currentPublicationId = pub._id;
      doc.versionHistory = doc.versionHistory || [];
      doc.versionHistory.push({
        publicationId: pub._id,
        ingestedAt: new Date(),
        topicsAdded:   diffSummary.added.length,
        topicsUpdated: diffSummary.updated.length,
        topicsRemoved: diffSummary.removed.length,
        topicsKept:    diffSummary.kept.length,
        dedupeMode:    refreshed?.dedupeMode || 'fresh',
        note: targetDocumentId ? 'Merged into existing document' : 'Initial publish',
      });
      await doc.save();
    } catch (err) {
      console.warn('ingestValidatedPublication: version-history bookkeeping warning:', err.message);
    }

    await appendLog(pub._id, 'publish', {
      level: 'info',
      code: 'publish_complete',
      message: targetDocumentId
        ? `Re-published into document ${doc._id}: +${diffSummary.added.length} added, ~${diffSummary.updated.length} updated, -${diffSummary.removed.length} removed, =${diffSummary.kept.length} kept.`
        : `Published to portal as document ${doc._id} (${topicCount} topic${topicCount === 1 ? '' : 's'})`,
      context: {
        documentId: String(doc._id),
        title: doc.title,
        topicCount,
        diff: {
          added:   diffSummary.added.length,
          updated: diffSummary.updated.length,
          removed: diffSummary.removed.length,
          kept:    diffSummary.kept.length,
        },
      },
    });
  } catch (err) {
    console.error('ingestValidatedPublication error:', err);
    await appendLog(pub._id, 'publish', {
      level: 'error',
      code: 'publish_failed',
      message: `Portal publish failed: ${err.message}`,
    });
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
  } finally {
    if (lockAcquired) {
      try { await releasePublishLock(targetDocumentId, pub._id); }
      catch (err) { console.warn('ingestValidatedPublication: lock release warning:', err.message); }
    }
  }
}

// Try to set Document.currentPublicationId atomically — if the field is
// either null or already equal to our pub._id (re-entry from a retried
// run), we take the lock. Otherwise the lock is held by another in-flight
// publish.
//
// We deliberately overload `currentPublicationId` for the lock instead of
// adding a separate sentinel field, because:
//   - The "successful publish completed" state already writes the same
//     field.
//   - On crash mid-publish, the field is left pointing at our pub._id
//     and a manual retry of the same publication can reclaim the lock.
//   - A retry of a DIFFERENT publication against the same doc still
//     blocks until the first one completes / fails / is deleted.
async function acquirePublishLock(documentId, publicationId) {
  if (!documentId) return false;
  try {
    const updated = await Document.findOneAndUpdate(
      {
        _id: documentId,
        $or: [
          { currentPublicationId: null },
          { currentPublicationId: publicationId },
        ],
      },
      { $set: { currentPublicationId: publicationId } },
      { new: true }
    ).select('_id').lean();
    return !!updated;
  } catch (err) {
    console.warn('acquirePublishLock: error:', err.message);
    return false;
  }
}

// Release is intentionally permissive — we only release if we're still
// the holder, so a stale release call from a timed-out publish can't
// blow away a brand-new in-flight publish's lock. On the success path
// we leave currentPublicationId pointing at us (it's the latest
// successful publish anyway); the release is mostly relevant for the
// failure unwind.
async function releasePublishLock(documentId, publicationId) {
  if (!documentId) return;
  try {
    await Document.updateOne(
      { _id: documentId, currentPublicationId: publicationId },
      { $set: { currentPublicationId: null } }
    );
  } catch (_) { /* best-effort */ }
}

// ── Read APIs (for the publishing list + drawer) ───────────────────────────

async function listPublications({ search, status, source, from, to, page = 1, limit = 25, sortKey = 'createdAt', sortDir = 'desc' } = {}) {
  const q = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    q.$or = [{ name: rx }, { originalFilename: rx }, { sourceLabel: rx }];
  }
  if (status && status !== 'all') q.status = status;
  if (source) {
    // Resolve the wire `source` query value to the canonical `sourceId` ref
    // when possible — so the Sources page "publications count" link can pass
    // the canonical id and still get a clean filter. Falls back to a label
    // match for legacy rows / free-form values.
    const src = await Source.findOne({
      $or: [{ sourceId: source }, { name: source }],
    }).lean();
    if (src) q.sourceId = src._id;
    else q.sourceLabel = source;
  }
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
      .populate('sourceId', 'sourceId name type')
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

// List the publications that are eligible to be replaced by a new
// upload. The upload modal's "Publish as new version of" dropdown
// renders this. Constraints:
//
//   - status must be 'validated' or 'extracted' (both have a parsable
//     document chain). 'failed' publications are skipped because their
//     Document is missing.
//   - sourceId must match the proposed upload's source (otherwise we'd
//     be merging across unrelated documents).
//   - documentId must be set — re-publishing into a publication that
//     never made it to portal would just create a brand-new doc, which
//     defeats the purpose of the dropdown.
//
// We sort newest-first because that's the natural reading order for the
// dropdown ("most recent successful publish at the top").
async function listReplaceablePublications({ sourceId } = {}) {
  const q = {
    status: { $in: ['validated', 'extracted', 'completed', 'published'] },
    documentId: { $ne: null },
  };
  if (sourceId) {
    const source = await Source.findOne({ sourceId: String(sourceId).trim() }).select('_id').lean();
    if (!source) return { items: [] };
    q.sourceId = source._id;
  }
  const rows = await Publication.find(q)
    .sort({ createdAt: -1 })
    .limit(50)
    .select('name originalFilename createdAt status documentId sourceLabel sourceId contentHash dedupeMode')
    .lean();
  return {
    items: rows.map((p) => ({
      id: String(p._id),
      name: p.name,
      originalFilename: p.originalFilename,
      createdAt: p.createdAt,
      status: p.status,
      documentId: p.documentId ? String(p.documentId) : null,
      sourceLabel: p.sourceLabel || '',
      contentHash: p.contentHash || '',
    })),
  };
}

async function getPublication(id) {
  const pub = await Publication.findById(id)
    .populate('uploadedBy', 'name email')
    .populate('sourceId', 'sourceId name type')
    .lean();
  if (!pub) return null;
  // Resolve a few cross-document fields the drawer needs:
  //   - documentPrettyUrl for the "Open in portal" link
  //   - documentVersionHistory for the V3 ← V2 ← V1 chain (lives on the
  //     Document, not the Publication, since multiple Publications fold
  //     into one Document on the re-publish path)
  //   - replacesSummary for a one-line "(was V2 — Q3 release.zip)" caption
  //     under the dedupeMode pill
  let documentPrettyUrl = '';
  let documentVersionHistory = [];
  if (pub.documentId) {
    try {
      const doc = await Document.findById(pub.documentId)
        .select('prettyUrl versionHistory')
        .lean();
      documentPrettyUrl       = doc?.prettyUrl || '';
      documentVersionHistory  = Array.isArray(doc?.versionHistory) ? doc.versionHistory : [];
    } catch (_) { /* best effort */ }
  }
  let replacesSummary = null;
  if (pub.replaces) {
    try {
      const prior = await Publication.findById(pub.replaces)
        .select('originalFilename name createdAt status documentId')
        .lean();
      if (prior) {
        replacesSummary = {
          id: String(prior._id),
          name: prior.name,
          originalFilename: prior.originalFilename,
          createdAt: prior.createdAt,
          status: prior.status,
          documentId: prior.documentId ? String(prior.documentId) : null,
        };
      }
    } catch (_) { /* best effort */ }
  }
  const out = serialise(pub, { includeManifest: true });
  return { ...out, documentPrettyUrl, documentVersionHistory, replacesSummary };
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
  // Prefer the manifest entry's `key` (CAS path) so attachments resolve
  // to the right S3 object even after we've re-pointed extract output at
  // a content-addressed layout. Falls back to the legacy
  // publications/<id>/extracted/<relPath> shape for old rows whose
  // manifest entries don't carry a `key`.
  const key = s3.keyForManifestEntry(pub, relPath);
  if (!key) return null;
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
  // `sourceId` may be a populated Source doc, an ObjectId, or null. Normalise
  // the wire shape to two flat fields the UI can consume directly:
  //   - sourceId    → canonical string id ("paligo") or null
  //   - sourceRefId → opaque Mongo _id (used by the publishing list filter)
  let sourceCanonicalId = null;
  let sourceRefId = null;
  if (pub.sourceId && typeof pub.sourceId === 'object' && pub.sourceId.sourceId) {
    sourceCanonicalId = pub.sourceId.sourceId;
    sourceRefId = String(pub.sourceId._id);
  } else if (pub.sourceId) {
    sourceRefId = String(pub.sourceId);
  }
  return {
    id: String(pub._id),
    name: pub.name,
    originalFilename: pub.originalFilename,
    sizeBytes: pub.sizeBytes,
    sourceId: sourceCanonicalId,
    sourceRefId,
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
    // Surface the incremental-publish bookkeeping so the drawer can render
    // status pills + the "version chain" UI. `replacesPublicationId` is
    // the canonical wire name for the back-pointer (Publication.replaces
    // is the schema name).
    contentHash:            pub.contentHash || '',
    dedupeMode:             pub.dedupeMode || 'fresh',
    replacesPublicationId:  pub.replaces ? String(pub.replaces) : null,
    versionHistory:         Array.isArray(pub.versionHistory) ? pub.versionHistory : [],
    uploadedBy: pub.uploadedBy
      ? { id: String(pub.uploadedBy._id), name: pub.uploadedBy.name, email: pub.uploadedBy.email }
      : null,
    createdAt: pub.createdAt,
    updatedAt: pub.updatedAt,
  };
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Bulk-upsert the ExtractedFileBlob CAS index from a freshly-completed
// manifest. We $setOnInsert the immutable fields (key, contentType, size,
// firstSeenAt) and $inc refCount + bump lastSeenAt on every hit so the
// index stays in sync with what the buckets actually carry.
//
// Lazy require for ExtractedFileBlob keeps this file's import graph
// independent of the model — and lets a deployment that hasn't run
// migrations yet boot without crashing the publishing service.
async function upsertExtractedFileBlobs(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) return;
  let ExtractedFileBlob;
  try {
    ExtractedFileBlob = require('../../models/ExtractedFileBlob');
  } catch (_) { return; }

  const ops = [];
  const now = new Date();
  for (const entry of manifest) {
    const hash = entry?.contentHash;
    if (!hash || !entry.key) continue;
    ops.push({
      updateOne: {
        filter: { _id: hash },
        update: {
          $setOnInsert: {
            _id: hash,
            bucket: config.s3.extractedBucket,
            key: entry.key,
            contentType: entry.contentType || 'application/octet-stream',
            size: entry.size || 0,
            firstSeenAt: now,
          },
          $inc: { refCount: 1 },
          $set: { lastSeenAt: now },
        },
        upsert: true,
      },
    });
  }
  if (!ops.length) return;
  await ExtractedFileBlob.bulkWrite(ops, { ordered: false });
}

module.exports = {
  uploadPublication,
  extractPublication,
  validatePublication,
  listPublications,
  listReplaceablePublications,
  getPublication,
  getLogs,
  streamLogsAsText,
  presignArchive,
  presignFile,
  deletePublication,
};
