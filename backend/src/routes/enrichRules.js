const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Worker } = require('worker_threads');

const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { ENRICHMENT: AR_ENR } = require('../constants/adminRoles');

const adminGate = requireTierOrAdminRoles(['admin', 'editor'], AR_ENR);
const EnrichRule = require('../models/EnrichRule');
const EnrichConfig = require('../models/EnrichConfig');
const EnrichReprocessJob = require('../models/EnrichReprocessJob');
const enrichService = require('../services/enrich/enrichService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotEnrichAndClean } = require('../services/configHistorySnapshots');

const router = express.Router();

// Admin/editor tier, or ENRICHMENT_ADMIN / KHUB_ADMIN.

const REPROCESS_WORKER_PATH = path.resolve(
  __dirname,
  '../workers/reprocessEnrichCleanWorker.js'
);

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

// ── List ──────────────────────────────────────────────────────────────────
router.get('/', auth, adminGate, async (req, res, next) => {
  try {
    const data = await enrichService.listRules();
    const runningJob = await EnrichReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 }).lean();
    res.json({
      rules: data.rules,
      config: { ...data.config, runningJob: serialiseJob(runningJob) },
    });
  } catch (err) { next(err); }
});

// ── Per-rule CRUD ─────────────────────────────────────────────────────────
router.post('/', auth, adminGate, async (req, res, next) => {
  try {
    const before = await snapshotEnrichAndClean();
    const created = await enrichService.createRule(req.body || {}, req.user);
    const after = await snapshotEnrichAndClean();
    await logConfigChange({
      category: 'Enrich and Clean',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(201).json({ rule: created });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.patch('/:id', auth, adminGate, async (req, res, next) => {
  try {
    const before = await snapshotEnrichAndClean();
    const updated = await enrichService.updateRule(req.params.id, req.body || {}, req.user);
    const after = await snapshotEnrichAndClean();
    await logConfigChange({
      category: 'Enrich and Clean',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ rule: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id', auth, adminGate, async (req, res, next) => {
  try {
    const before = await snapshotEnrichAndClean();
    await enrichService.deleteRule(req.params.id);
    const after = await snapshotEnrichAndClean();
    await logConfigChange({
      category: 'Enrich and Clean',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(204).end();
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Batch PUT (the page's Save button) ────────────────────────────────────
//
// Body: { rules: [...] } — full replacement. Service validates the whole
// list before any destructive write, and rolls back from the snapshot on
// failure. Returns the freshly-stored list so the page can replace its
// working copy with the canonical server view.
router.put('/', auth, adminGate, async (req, res, next) => {
  try {
    const { rules } = req.body || {};
    const before = await snapshotEnrichAndClean();
    const stored = await enrichService.replaceAllRules(rules || [], req.user);
    const after = await snapshotEnrichAndClean();
    await logConfigChange({
      category: 'Enrich and Clean',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ rules: stored });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Reprocess ─────────────────────────────────────────────────────────────
router.post('/reprocess', auth, adminGate, async (req, res, next) => {
  try {
    const inflight = await EnrichReprocessJob.findOne({
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 });
    if (inflight) {
      return res.status(202).json({ job: serialiseJob(inflight), reused: true });
    }

    const Topic = require('../models/Topic');
    const total = await Topic.estimatedDocumentCount();
    const ruleSnapshotRows = await EnrichRule.find({ enabled: true, scope: 'all' })
      .sort({ metadataKey: 1, priority: 1 })
      .lean();

    const job = await EnrichReprocessJob.create({
      status: 'queued',
      total,
      processed: 0,
      errorCount: 0,
      ruleSnapshot: ruleSnapshotRows.map((r) => ({
        id: String(r._id),
        metadataKey: r.metadataKey,
        type: r.type,
        scope: r.scope,
      })),
      triggeredBy: req.user?._id || null,
    });

    spawnReprocessWorker(String(job._id), req.user?._id || null);
    res.status(202).json({ job: serialiseJob(job), reused: false });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', auth, adminGate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = await EnrichReprocessJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// ── Worker plumbing ───────────────────────────────────────────────────────
// Same shape as the metadata + vocabularies reprocess spawners — the
// route already returned 202, so we don't await the worker.
function spawnReprocessWorker(jobId, triggeredBy) {
  let worker;
  try {
    worker = new Worker(REPROCESS_WORKER_PATH, { workerData: { jobId, triggeredBy } });
  } catch (err) {
    EnrichReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: `Worker spawn failed: ${err.message}`, finishedAt: new Date() } }
    ).catch(() => {});
    return;
  }

  EnrichReprocessJob.updateOne(
    { _id: jobId },
    { $set: { status: 'running', startedAt: new Date() } }
  ).catch(() => {});

  worker.on('message', async (msg) => {
    try {
      if (msg?.type === 'progress') {
        await EnrichReprocessJob.updateOne(
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
        await EnrichReprocessJob.updateOne(
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
        await EnrichReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: msg.message || 'Worker reported an error', finishedAt: new Date() } }
        );
      }
    } catch (err) {
      console.warn('enrich rules reprocess worker message handler error:', err.message);
    }
  });

  worker.on('error', async (err) => {
    await EnrichReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: err.message, finishedAt: new Date() } }
    ).catch(() => {});
  });

  worker.on('exit', async (code) => {
    if (code !== 0) {
      const job = await EnrichReprocessJob.findById(jobId).lean().catch(() => null);
      if (job && job.status !== 'done' && job.status !== 'failed') {
        await EnrichReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: `Worker exited with code ${code}`, finishedAt: new Date() } }
        ).catch(() => {});
      }
    }
  });
}

module.exports = router;
// Re-export EnrichConfig getter used by tests / other services if needed.
module.exports.EnrichConfig = EnrichConfig;
