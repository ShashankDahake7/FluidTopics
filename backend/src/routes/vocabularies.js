const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const { Worker } = require('worker_threads');

const upload = require('../middleware/upload');
const { auth, requireRole } = require('../middleware/auth');
const Vocabulary = require('../models/Vocabulary');
const VocabularyTerm = require('../models/VocabularyTerm');
const VocabularyConfig = require('../models/VocabularyConfig');
const VocabularyReprocessJob = require('../models/VocabularyReprocessJob');
const vocabularyService = require('../services/vocabularies/vocabularyService');

const router = express.Router();

// Vocabularies sit under the Knowledge Hub admin surface — superadmin only,
// matching the access rules baked into the AdminShell sidebar.
const adminGate = requireRole('superadmin');

const REPROCESS_WORKER_PATH = path.resolve(
  __dirname,
  '../workers/reprocessVocabulariesWorker.js'
);

// ── Serialisation helpers ─────────────────────────────────────────────────
async function withCreators(vocabRow) {
  const obj = vocabRow.toObject ? vocabRow.toObject() : vocabRow;
  // Light populate — only `name` + `email` so we don't ship the whole user
  // doc to the admin list. The mock UI shows "Last edited by Prem Garudadri"
  // so we expose `createdBy` + `updatedBy` here as their display names.
  const ids = [obj.createdBy, obj.updatedBy].filter(Boolean);
  if (!ids.length) {
    return { ...vocabularyService.vocabExposable(obj), createdByName: null, updatedByName: null };
  }
  const User = require('../models/User');
  const users = await User.find({ _id: { $in: ids } }, 'name email').lean();
  const map = new Map(users.map((u) => [String(u._id), u]));
  return {
    ...vocabularyService.vocabExposable(obj),
    createdByName: obj.createdBy ? map.get(String(obj.createdBy))?.name || null : null,
    updatedByName: obj.updatedBy ? map.get(String(obj.updatedBy))?.name || null : null,
  };
}

function serialiseConfig(cfg, runningJob) {
  if (!cfg) {
    return { lastFullReprocessAt: null, lastFullReprocessByName: null, pendingReprocess: false, runningJob: serialiseJob(runningJob) };
  }
  const obj = cfg.toObject ? cfg.toObject() : cfg;
  const by = obj.lastFullReprocessBy && typeof obj.lastFullReprocessBy === 'object'
    ? obj.lastFullReprocessBy
    : null;
  return {
    lastFullReprocessAt: obj.lastFullReprocessAt || null,
    lastFullReprocessByName: by?.name || null,
    pendingReprocess: !!obj.pendingReprocess,
    runningJob: serialiseJob(runningJob),
  };
}

function serialiseJob(job) {
  if (!job) return null;
  const obj = job.toObject ? job.toObject() : job;
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

function serialiseTerm(term) {
  const obj = term.toObject ? term.toObject() : term;
  return {
    id: String(obj._id),
    termId: obj.termId,
    language: obj.language,
    prefLabel: obj.prefLabel,
    altLabels: obj.altLabels || [],
    broader: obj.broader || '',
  };
}

function unlinkSafe(p) {
  try { if (p) fs.unlinkSync(p); } catch (_) { /* ignore */ }
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET / — list vocabularies + global config + running job (for resume polling).
router.get('/', auth, adminGate, async (req, res, next) => {
  try {
    const { search } = req.query;
    const q = {};
    if (search && String(search).trim()) {
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ name: rx }, { displayName: rx }];
    }
    const rows = await Vocabulary.find(q).sort({ name: 1 });
    const items = await Promise.all(rows.map(withCreators));

    const cfgRow = await VocabularyConfig.findOne({ key: 'default' })
      .populate('lastFullReprocessBy', 'name email');
    const runningJob = await VocabularyReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 }).lean();

    res.json({ items, config: serialiseConfig(cfgRow, runningJob) });
  } catch (err) { next(err); }
});

// POST / — multipart upload to create a brand-new vocabulary.
// Body fields (multipart): `name`, optional `displayName`, optional `usedInSearch`.
// File field name: `file`.
router.post('/', auth, adminGate, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (field name: file).' });
  }
  try {
    const { name, displayName, usedInSearch } = req.body || {};
    const result = await vocabularyService.createVocabulary({
      name,
      displayName: displayName || name,
      file: req.file,
      usedInSearch: usedInSearch === 'true' || usedInSearch === true,
      user: req.user,
    });
    unlinkSafe(req.file.path);
    const row = await Vocabulary.findById(result.vocab.id);
    const serialised = await withCreators(row);
    res.status(201).json({ item: serialised, warnings: result.warnings });
  } catch (err) {
    unlinkSafe(req.file?.path);
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /:id — JSON for rename/toggle, or multipart when re-uploading the file.
// `upload.single('file')` is multipart-only at the wire level, so JSON
// requests pass straight through with `req.file` undefined.
router.patch('/:id', auth, adminGate, upload.single('file'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      if (req.file) unlinkSafe(req.file.path);
      return res.status(404).json({ error: 'Vocabulary not found' });
    }
    const { displayName, usedInSearch } = req.body || {};
    const result = await vocabularyService.updateVocabulary(req.params.id, {
      displayName,
      usedInSearch:
        usedInSearch == null
          ? undefined
          : usedInSearch === 'true' || usedInSearch === true,
      file: req.file,
      user: req.user,
    });
    unlinkSafe(req.file?.path);
    const row = await Vocabulary.findById(result.vocab.id);
    const serialised = await withCreators(row);
    res.json({ item: serialised, warnings: result.warnings });
  } catch (err) {
    unlinkSafe(req.file?.path);
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /:id
router.delete('/:id', auth, adminGate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Vocabulary not found' });
    }
    await vocabularyService.deleteVocabulary(req.params.id);
    res.status(204).end();
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /:id/terms — paginated browser. The Vocabularies admin page itself
// doesn't render this today; the future Enrich-and-Clean rule editor uses
// it for autocomplete.
router.get('/:id/terms', auth, adminGate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Vocabulary not found' });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(500, Math.max(1, parseInt(req.query.size, 10) || 50));
    const filter = { vocabularyId: req.params.id };
    if (req.query.language) filter.language = String(req.query.language).trim().toLowerCase();
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ termId: rx }, { prefLabel: rx }, { altLabels: rx }];
    }
    const total = await VocabularyTerm.countDocuments(filter);
    const items = await VocabularyTerm.find(filter)
      .sort({ prefLabel: 1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean();
    res.json({ items: items.map(serialiseTerm), total, page, size });
  } catch (err) { next(err); }
});

// GET /:id/download — stream the originally uploaded file from S3.
router.get('/:id/download', auth, adminGate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Vocabulary not found' });
    }
    const { stream, filename } = await vocabularyService.getVocabularyDownloadStream(req.params.id);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(filename).replace(/[\r\n"]/g, '_')}"`);
    stream.on('error', (e) => next(e));
    stream.pipe(res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /reprocess — spawn the worker thread. If a job is already in flight
// we return *that* job rather than queue another, matching the metadata
// pattern.
router.post('/reprocess', auth, adminGate, async (req, res, next) => {
  try {
    const inflight = await VocabularyReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 });
    if (inflight) {
      return res.status(202).json({ job: serialiseJob(inflight), reused: true });
    }

    const Topic = require('../models/Topic');
    const total = await Topic.estimatedDocumentCount();

    const job = await VocabularyReprocessJob.create({
      status: 'queued',
      total,
      processed: 0,
      errorCount: 0,
      triggeredBy: req.user?._id || null,
    });

    spawnReprocessWorker(String(job._id), req.user?._id || null);
    res.status(202).json({ job: serialiseJob(job), reused: false });
  } catch (err) { next(err); }
});

// GET /jobs/:id — poll endpoint for the progress strip.
router.get('/jobs/:id', auth, adminGate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = await VocabularyReprocessJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// ── Worker plumbing ───────────────────────────────────────────────────────
// Same shape as the metadata reprocess spawner. We don't await the worker;
// the route already returned 202.
function spawnReprocessWorker(jobId, triggeredBy) {
  let worker;
  try {
    worker = new Worker(REPROCESS_WORKER_PATH, { workerData: { jobId, triggeredBy } });
  } catch (err) {
    VocabularyReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: `Worker spawn failed: ${err.message}`, finishedAt: new Date() } }
    ).catch(() => {});
    return;
  }

  VocabularyReprocessJob.updateOne(
    { _id: jobId },
    { $set: { status: 'running', startedAt: new Date() } }
  ).catch(() => {});

  worker.on('message', async (msg) => {
    try {
      if (msg?.type === 'progress') {
        await VocabularyReprocessJob.updateOne(
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
        await VocabularyReprocessJob.updateOne(
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
        await VocabularyReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: msg.message || 'Worker reported an error', finishedAt: new Date() } }
        );
      }
    } catch (err) {
      console.warn('vocabularies reprocess worker message handler error:', err.message);
    }
  });

  worker.on('error', async (err) => {
    await VocabularyReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: err.message, finishedAt: new Date() } }
    ).catch(() => {});
  });

  worker.on('exit', async (code) => {
    if (code !== 0) {
      const job = await VocabularyReprocessJob.findById(jobId).lean().catch(() => null);
      if (job && job.status !== 'done' && job.status !== 'failed') {
        await VocabularyReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: `Worker exited with code ${code}`, finishedAt: new Date() } }
        ).catch(() => {});
      }
    }
  });
}

module.exports = router;
