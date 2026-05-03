// REST surface for the Pretty URL admin page.
//
// Routes (mounted at /api/pretty-urls):
//
//   GET    /              → { documents: { active, draft }, topics: { active, draft },
//                              config, runningJob, lastJob }
//   POST   /              → create a template (body: { scope, state, template, requirements?, priority? })
//   PATCH  /:id           → edit template fields (template/requirements/priority/state)
//   DELETE /:id           → drop a template
//   POST   /reorder       → bulk priority reassignment (body: { scope, state, ids: [...] })
//   PATCH  /config        → toggle removeAccents / lowercase
//   POST   /reset-draft   → drop every state:'draft' row, copying actives back over
//   POST   /activate      → promote drafts → active, kick off reprocess
//   POST   /save-and-activate → upsert payload + activate in one call
//   POST   /reprocess     → manual reprocess without changing templates
//   GET    /jobs/:id      → progress poll endpoint

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Worker } = require('worker_threads');

const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { METADATA: AR_META } = require('../constants/adminRoles');

const adminOrEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_META);
const PrettyUrlTemplate = require('../models/PrettyUrlTemplate');
const PrettyUrlConfig = require('../models/PrettyUrlConfig');
const PrettyUrlReprocessJob = require('../models/PrettyUrlReprocessJob');
const Document = require('../models/Document');
const { invalidateCache } = require('../services/prettyUrl/prettyUrlService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotPrettyUrl } = require('../services/configHistorySnapshots');

const router = express.Router();

const REPROCESS_WORKER_PATH = path.resolve(
  __dirname,
  '../workers/reprocessPrettyUrlsWorker.js'
);

function serialiseTemplate(row) {
  if (!row) return null;
  const obj = typeof row.toObject === 'function' ? row.toObject() : row;
  return {
    id: String(obj._id),
    scope: obj.scope,
    state: obj.state,
    template: obj.template || '',
    priority: obj.priority || 0,
    notes: obj.notes || '',
    requirements: (obj.requirements || []).map((r) => ({
      key: r.key,
      required: r.required !== false,
      topicSource: !!r.topicSource,
    })),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serialiseConfig(cfg) {
  if (!cfg) return null;
  const obj = typeof cfg.toObject === 'function' ? cfg.toObject() : cfg;
  return {
    removeAccents: !!obj.removeAccents,
    lowercase: !!obj.lowercase,
    pendingReprocess: !!obj.pendingReprocess,
    lastActivatedAt: obj.lastActivatedAt || null,
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

// Mark the global config as needing a reprocess. Called from every
// mutation so the admin sees the "you have unsaved changes" badge.
async function markPendingReprocess() {
  await PrettyUrlConfig.updateOne(
    { singletonKey: 'global' },
    { $set: { pendingReprocess: true } },
    { upsert: true }
  );
  invalidateCache();
}

router.get('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const [rows, cfg, runningJob, lastJob] = await Promise.all([
      PrettyUrlTemplate.find({}).sort({ scope: 1, state: 1, priority: 1, createdAt: 1 }).lean(),
      PrettyUrlConfig.getSingleton(),
      PrettyUrlReprocessJob.findOne({ status: { $in: ['queued', 'running'] } })
        .sort({ createdAt: -1 }).lean(),
      PrettyUrlReprocessJob.findOne({ status: { $in: ['done', 'failed'] } })
        .sort({ createdAt: -1 }).lean(),
    ]);

    const buckets = {
      documents: { active: [], draft: [] },
      topics: { active: [], draft: [] },
    };
    for (const row of rows) {
      const scopeKey = row.scope === 'topic' ? 'topics' : 'documents';
      const stateKey = row.state === 'draft' ? 'draft' : 'active';
      buckets[scopeKey][stateKey].push(serialiseTemplate(row));
    }

    res.json({
      ...buckets,
      config: serialiseConfig(cfg),
      runningJob: serialiseJob(runningJob),
      lastJob: serialiseJob(lastJob),
    });
  } catch (err) { next(err); }
});

router.post('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    const { scope, state = 'draft', template, requirements = [], priority, notes = '' } = req.body || {};
    if (!['document', 'topic'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be "document" or "topic"' });
    }
    if (!['active', 'draft'].includes(state)) {
      return res.status(400).json({ error: 'state must be "active" or "draft"' });
    }
    if (!template || !String(template).trim()) {
      return res.status(400).json({ error: 'template is required' });
    }

    // Default priority — append to the bottom of its section.
    let nextPriority = priority;
    if (nextPriority == null) {
      const last = await PrettyUrlTemplate.findOne({ scope, state })
        .sort({ priority: -1 }).lean();
      nextPriority = (last?.priority || 0) + 1;
    }

    const created = await PrettyUrlTemplate.create({
      scope,
      state,
      template: String(template).trim(),
      requirements: sanitiseRequirements(requirements),
      priority: nextPriority,
      notes: String(notes || ''),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    await markPendingReprocess();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(201).json({ item: serialiseTemplate(created) });
  } catch (err) { next(err); }
});

router.patch('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const row = await PrettyUrlTemplate.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Template not found' });

    const { template, requirements, priority, state, notes } = req.body || {};
    if (template != null) row.template = String(template).trim();
    if (Array.isArray(requirements)) row.requirements = sanitiseRequirements(requirements);
    if (priority != null && Number.isFinite(Number(priority))) row.priority = Number(priority);
    if (state != null) {
      if (!['active', 'draft'].includes(state)) {
        return res.status(400).json({ error: 'state must be "active" or "draft"' });
      }
      row.state = state;
    }
    if (notes != null) row.notes = String(notes || '');
    row.updatedBy = req.user?._id || null;

    await row.save();
    await markPendingReprocess();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ item: serialiseTemplate(row) });
  } catch (err) { next(err); }
});

router.delete('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const row = await PrettyUrlTemplate.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Template not found' });
    await row.deleteOne();
    await markPendingReprocess();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// Bulk priority assignment. Body shape: { scope, state, ids: ['<id1>', ...] }.
// Each id's index in the array becomes its new priority. Ids belonging to a
// different (scope, state) bucket are ignored.
router.post('/reorder', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    const { scope, state, ids } = req.body || {};
    if (!['document', 'topic'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be "document" or "topic"' });
    }
    if (!['active', 'draft'].includes(state)) {
      return res.status(400).json({ error: 'state must be "active" or "draft"' });
    }
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    const ops = ids
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id, idx) => ({
        updateOne: {
          filter: { _id: id, scope, state },
          update: { $set: { priority: idx } },
        },
      }));
    if (ops.length) await PrettyUrlTemplate.bulkWrite(ops, { ordered: false });
    await markPendingReprocess();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ ok: true, updated: ops.length });
  } catch (err) { next(err); }
});

router.patch('/config', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    const { removeAccents, lowercase } = req.body || {};
    const cfg = await PrettyUrlConfig.getSingleton();
    if (removeAccents != null) cfg.removeAccents = !!removeAccents;
    if (lowercase != null) cfg.lowercase = !!lowercase;
    cfg.pendingReprocess = true;
    await cfg.save();
    invalidateCache();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ config: serialiseConfig(cfg) });
  } catch (err) { next(err); }
});

// Reset drafts: remove every state:'draft' row, then materialise a fresh
// draft copy of the current actives so the admin always sees a working set
// equal to "what's live right now".
router.post('/reset-draft', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    await PrettyUrlTemplate.deleteMany({ state: 'draft' });

    const actives = await PrettyUrlTemplate.find({ state: 'active' }).lean();
    if (actives.length) {
      await PrettyUrlTemplate.insertMany(
        actives.map((a) => ({
          scope: a.scope,
          state: 'draft',
          template: a.template,
          requirements: a.requirements,
          priority: a.priority,
          notes: a.notes,
          createdBy: a.createdBy,
          updatedBy: req.user?._id || null,
        }))
      );
    }
    invalidateCache();
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ ok: true, copied: actives.length });
  } catch (err) { next(err); }
});

// Activate: promote drafts to active. Replaces the existing active set in
// one transaction-ish sequence (delete actives, flip drafts → active),
// then queues a reprocess job.
router.post('/activate', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    await PrettyUrlTemplate.deleteMany({ state: 'active' });
    await PrettyUrlTemplate.updateMany({ state: 'draft' }, { $set: { state: 'active' } });
    const cfg = await PrettyUrlConfig.getSingleton();
    cfg.pendingReprocess = true;
    cfg.lastActivatedAt = new Date();
    cfg.lastActivatedBy = req.user?._id || null;
    await cfg.save();
    invalidateCache();
    const job = await queueReprocessJob(req.user?._id);
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(202).json({ ok: true, job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// Save-and-activate: take the entire client-side draft list, replace the
// existing draft+active rows for both scopes with that payload, then run
// activate. Body shape:
//   { documents: [{ template, requirements, priority? }, ...],
//     topics:    [{ template, requirements, priority? }, ...],
//     config: { removeAccents, lowercase } }
router.post('/save-and-activate', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotPrettyUrl();
    const { documents = [], topics = [], config = {} } = req.body || {};
    const newRows = [
      ...documents.map((d, i) => ({
        scope: 'document',
        state: 'active',
        template: String(d.template || '').trim(),
        requirements: sanitiseRequirements(d.requirements || []),
        priority: d.priority != null ? Number(d.priority) : i,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      })),
      ...topics.map((t, i) => ({
        scope: 'topic',
        state: 'active',
        template: String(t.template || '').trim(),
        requirements: sanitiseRequirements(t.requirements || []),
        priority: t.priority != null ? Number(t.priority) : i,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      })),
    ].filter((r) => r.template);

    await PrettyUrlTemplate.deleteMany({});
    if (newRows.length) await PrettyUrlTemplate.insertMany(newRows);

    const cfg = await PrettyUrlConfig.getSingleton();
    if (config.removeAccents != null) cfg.removeAccents = !!config.removeAccents;
    if (config.lowercase != null) cfg.lowercase = !!config.lowercase;
    cfg.pendingReprocess = true;
    cfg.lastActivatedAt = new Date();
    cfg.lastActivatedBy = req.user?._id || null;
    await cfg.save();
    invalidateCache();

    const job = await queueReprocessJob(req.user?._id);
    const after = await snapshotPrettyUrl();
    await logConfigChange({
      category: 'Pretty URL',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.status(202).json({ ok: true, job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// Force a reprocess without mutating templates. Useful after pretty URL
// generation has been disabled and re-enabled, or to catch up content
// that was ingested before the user got around to clicking "Activate".
router.post('/reprocess', auth, adminOrEditor, async (req, res, next) => {
  try {
    const job = await queueReprocessJob(req.user?._id);
    res.status(202).json({ ok: true, job: serialiseJob(job) });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = await PrettyUrlReprocessJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: serialiseJob(job) });
  } catch (err) { next(err); }
});

// ──────────────────────────────────────────────────────────────────────────

function sanitiseRequirements(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((r) => ({
      key: String(r?.key || '').trim(),
      required: r?.required !== false,
      topicSource: !!r?.topicSource,
    }))
    .filter((r) => r.key);
}

async function queueReprocessJob(userId) {
  const inflight = await PrettyUrlReprocessJob.findOne({
    status: { $in: ['queued', 'running'] },
  }).sort({ createdAt: -1 });
  if (inflight) return inflight;

  const total = await Document.estimatedDocumentCount();
  const job = await PrettyUrlReprocessJob.create({
    status: 'queued',
    total,
    processed: 0,
    errorCount: 0,
    triggeredBy: userId || null,
  });
  spawnReprocessWorker(String(job._id));
  return job;
}

function spawnReprocessWorker(jobId) {
  let worker;
  try {
    worker = new Worker(REPROCESS_WORKER_PATH, { workerData: { jobId } });
  } catch (err) {
    PrettyUrlReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: `Worker spawn failed: ${err.message}`, finishedAt: new Date() } }
    ).catch(() => {});
    return;
  }

  PrettyUrlReprocessJob.updateOne(
    { _id: jobId },
    { $set: { status: 'running', startedAt: new Date() } }
  ).catch(() => {});

  worker.on('message', async (msg) => {
    try {
      if (msg?.type === 'progress') {
        await PrettyUrlReprocessJob.updateOne(
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
        await PrettyUrlReprocessJob.updateOne(
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
        // Worker finished cleanly — clear the pending banner.
        await PrettyUrlConfig.updateOne(
          { singletonKey: 'global' },
          { $set: { pendingReprocess: false } }
        );
        invalidateCache();
      } else if (msg?.type === 'error') {
        await PrettyUrlReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: msg.message || 'Worker reported an error', finishedAt: new Date() } }
        );
      }
    } catch (err) {
      console.warn('pretty-url reprocess worker handler error:', err.message);
    }
  });

  worker.on('error', async (err) => {
    await PrettyUrlReprocessJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', lastError: err.message, finishedAt: new Date() } }
    ).catch(() => {});
  });

  worker.on('exit', async (code) => {
    if (code !== 0) {
      const job = await PrettyUrlReprocessJob.findById(jobId).lean().catch(() => null);
      if (job && job.status !== 'done' && job.status !== 'failed') {
        await PrettyUrlReprocessJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', lastError: `Worker exited with code ${code}`, finishedAt: new Date() } }
        ).catch(() => {});
      }
    }
  });
}

module.exports = router;
