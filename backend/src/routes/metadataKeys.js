const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Worker } = require('worker_threads');

const { auth, requireRole } = require('../middleware/auth');
const MetadataKey = require('../models/MetadataKey');
const MetadataReprocessJob = require('../models/MetadataReprocessJob');
const Topic = require('../models/Topic');

const router = express.Router();

// Same gate as Sources / Publishing — admin or editor (superadmin implicit).
const adminOrEditor = requireRole('admin', 'editor');

const REPROCESS_WORKER_PATH = path.resolve(
  __dirname,
  '../workers/reprocessMetadataWorker.js'
);

function serialise(row) {
  if (!row) return null;
  const obj = typeof row.toObject === 'function' ? row.toObject() : row;
  return {
    id: String(obj._id),
    name: obj.name,
    displayName: obj.displayName || obj.name,
    isIndexed: !!obj.isIndexed,
    isDate: !!obj.isDate,
    manual: !!obj.manual,
    valuesSample: obj.valuesSample || [],
    valuesCount: obj.valuesCount || 0,
    invalidDateCount: obj.invalidDateCount || 0,
    lastSeenAt: obj.lastSeenAt || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serialiseJob(job) {
  if (!job) return null;
  const obj = typeof job.toObject === 'function' ? job.toObject() : job;
  return {
    id: String(obj._id),
    status: obj.status,
    total: obj.total || 0,
    processed: obj.processed || 0,
    errorCount: obj.errorCount || 0,
    startedAt: obj.startedAt || null,
    finishedAt: obj.finishedAt || null,
    lastError: obj.lastError || '',
  };
}

// GET /api/metadata-keys — list with optional ?search filter. Also returns
// a `runningJob` if a reprocess worker is in flight so the UI can resume
// polling without state loss.
router.get('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const { search } = req.query;
    const q = {};
    if (search && String(search).trim()) {
      // Lowercase + escape for case-insensitive substring match against
      // both the canonical lowercase name and the display version.
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ name: rx }, { displayName: rx }];
    }
    const items = await MetadataKey.find(q).sort({ name: 1 }).lean();

    const runningJob = await MetadataReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 }).lean();

    res.json({
      items: items.map(serialise),
      runningJob: serialiseJob(runningJob),
    });
  } catch (err) { next(err); }
});

// POST /api/metadata-keys — manual create. Used by the New metadata button.
// Rejects collisions case-insensitively and refuses reserved built-in names.
router.post('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const { name, isIndexed = false, isDate = false } = req.body || {};
    const display = String(name || '').trim();
    if (!display) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (MetadataKey.isReserved(display)) {
      return res.status(400).json({ error: `"${display}" is a reserved built-in metadata field.` });
    }
    const lower = display.toLowerCase();
    const existing = await MetadataKey.findOne({ name: lower });
    if (existing) {
      return res.status(409).json({ error: `Metadata key "${display}" already exists.` });
    }
    const created = await MetadataKey.create({
      name: lower,
      displayName: display,
      isIndexed: !!isIndexed,
      isDate: !!isDate,
      manual: true,
      createdBy: req.user?._id || null,
    });
    res.status(201).json({ item: serialise(created) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Metadata key already exists.' });
    }
    next(err);
  }
});

// PATCH /api/metadata-keys/:id — toggle isIndexed/isDate, or rename when no
// values are present. The frontend uses the toggles individually for live
// state and falls back to /save-and-reprocess for the bulk "apply config"
// gesture (which both persists and triggers the worker).
router.patch('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Metadata key not found' });
    }
    const row = await MetadataKey.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Metadata key not found' });

    const { name, isIndexed, isDate } = req.body || {};

    if (name != null) {
      const display = String(name).trim();
      if (!display) return res.status(400).json({ error: 'name cannot be empty' });
      if (MetadataKey.isReserved(display)) {
        return res.status(400).json({ error: `"${display}" is a reserved built-in metadata field.` });
      }
      // Renames are only safe before any topic carries the key — once
      // values exist the lower-cased name is referenced from
      // metadata.custom maps across the corpus.
      if (row.valuesCount > 0) {
        return res.status(409).json({ error: 'Cannot rename a key that already has values.' });
      }
      const lower = display.toLowerCase();
      if (lower !== row.name) {
        const dup = await MetadataKey.findOne({ name: lower, _id: { $ne: row._id } });
        if (dup) return res.status(409).json({ error: 'Another metadata key already uses that name.' });
        row.name = lower;
      }
      row.displayName = display;
    }

    if (isIndexed != null) row.isIndexed = !!isIndexed;
    if (isDate != null) {
      // The docs explicitly carve out built-in + hierarchical metadata as
      // ineligible for date — `isReserved` covers built-ins; we don't
      // model hierarchical so the second half is a no-op today.
      if (isDate && MetadataKey.isReserved(row.name)) {
        return res.status(400).json({ error: 'Built-in metadata cannot be set as date.' });
      }
      row.isDate = !!isDate;
    }

    await row.save();
    res.json({ item: serialise(row) });
  } catch (err) { next(err); }
});

// DELETE /api/metadata-keys/:id — manual-only, value-less keys can be
// removed before content arrives. Anything backed by topic data is locked.
router.delete('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Metadata key not found' });
    }
    const row = await MetadataKey.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Metadata key not found' });
    if (!row.manual) {
      return res.status(409).json({ error: 'Auto-discovered metadata keys cannot be deleted.' });
    }
    if (row.valuesCount > 0) {
      return res.status(409).json({
        error: 'This metadata key has associated values and cannot be deleted.',
      });
    }
    await row.deleteOne();
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/metadata-keys/save-and-reprocess — body shape:
//   { changes: [{ id, isIndexed?, isDate? }, ...] }
// or simply trigger a reprocess with no changes (changes: []).
//
// Returns 202 with the job id; the worker runs fire-and-forget. If a job
// is already running we return *that* job rather than queueing a duplicate
// — easier UX than a 409.
router.post('/save-and-reprocess', auth, adminOrEditor, async (req, res, next) => {
  try {
    const { changes = [] } = req.body || {};

    // Apply pending toggle changes first so the registry is consistent
    // before the worker reads it. Each row patched individually so an
    // invalid id (e.g. a stale row deleted in another tab) doesn't fail
    // the whole bulk.
    for (const ch of changes) {
      if (!ch?.id || !mongoose.isValidObjectId(ch.id)) continue;
      const update = {};
      if (ch.isIndexed != null) update.isIndexed = !!ch.isIndexed;
      if (ch.isDate != null) update.isDate = !!ch.isDate;
      if (Object.keys(update).length === 0) continue;
      try {
        await MetadataKey.updateOne({ _id: ch.id }, { $set: update });
      } catch (e) { /* skip silently */ }
    }

    const inflight = await MetadataReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 });
    if (inflight) {
      return res.status(202).json({ job: serialiseJob(inflight), reused: true });
    }

    const registry = await MetadataKey.find(
      {},
      'name isIndexed isDate'
    ).lean();
    const total = await Topic.estimatedDocumentCount();

    const job = await MetadataReprocessJob.create({
      status: 'queued',
      total,
      processed: 0,
      errorCount: 0,
      registrySnapshot: registry.map((r) => ({
        name: r.name,
        isIndexed: !!r.isIndexed,
        isDate: !!r.isDate,
      })),
      triggeredBy: req.user?._id || null,
    });

    // Spawn worker fire-and-forget. The worker writes its own progress
    // and final status straight into the MetadataReprocessJob row; the
    // route just returns 202 with the id.
    spawnReprocessWorker(String(job._id));

    res.status(202).json({ job: serialiseJob(job), reused: false });
  } catch (err) { next(err); }
});

// GET /api/metadata-keys/jobs/:id — poll endpoint for the progress strip.
router.get('/jobs/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = await MetadataReprocessJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// ──────────────────────────────────────────────────────────────────────────
// Worker plumbing. Same shape as publicationService.runWorker — listens for
// `progress` / `done` / `error` messages and writes them onto the job row.
// We intentionally don't `await` this; the route already returned 202.
function spawnReprocessWorker(jobId) {
  let worker;
  try {
    worker = new Worker(REPROCESS_WORKER_PATH, { workerData: { jobId } });
  } catch (err) {
    MetadataReprocessJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'failed',
          lastError: `Worker spawn failed: ${err.message}`,
          finishedAt: new Date(),
        },
      }
    ).catch(() => {});
    return;
  }

  MetadataReprocessJob.updateOne(
    { _id: jobId },
    { $set: { status: 'running', startedAt: new Date() } }
  ).catch(() => {});

  worker.on('message', async (msg) => {
    try {
      if (msg?.type === 'progress') {
        await MetadataReprocessJob.updateOne(
          { _id: jobId },
          {
            $set: {
              processed: msg.processed || 0,
              errorCount: msg.errorCount || 0,
              total: msg.total != null ? msg.total : undefined,
            },
          }
        );
      } else if (msg?.type === 'done') {
        await MetadataReprocessJob.updateOne(
          { _id: jobId },
          {
            $set: {
              status: 'done',
              processed: msg.processed || 0,
              errorCount: msg.errorCount || 0,
              total: msg.total != null ? msg.total : undefined,
              finishedAt: new Date(),
            },
          }
        );
      } else if (msg?.type === 'error') {
        await MetadataReprocessJob.updateOne(
          { _id: jobId },
          {
            $set: {
              status: 'failed',
              lastError: msg.message || 'Worker reported an error',
              finishedAt: new Date(),
            },
          }
        );
      }
    } catch (err) {
      console.warn('reprocess worker message handler error:', err.message);
    }
  });

  worker.on('error', async (err) => {
    await MetadataReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: err.message, finishedAt: new Date() } }
    ).catch(() => {});
  });

  worker.on('exit', async (code) => {
    if (code !== 0) {
      const job = await MetadataReprocessJob.findById(jobId).lean().catch(() => null);
      if (job && job.status !== 'done' && job.status !== 'failed') {
        await MetadataReprocessJob.updateOne(
          { _id: jobId },
          {
            $set: {
              status: 'failed',
              lastError: `Worker exited with code ${code}`,
              finishedAt: new Date(),
            },
          }
        ).catch(() => {});
      }
    }
  });
}

module.exports = router;
