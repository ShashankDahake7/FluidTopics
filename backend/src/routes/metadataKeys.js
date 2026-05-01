const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Worker } = require('worker_threads');

const { auth, requireRole } = require('../middleware/auth');
const MetadataKey = require('../models/MetadataKey');
const MetadataReprocessJob = require('../models/MetadataReprocessJob');
const Topic = require('../models/Topic');
const Document = require('../models/Document');
const EnrichRule = require('../models/EnrichRule');
const AccessRule = require('../models/AccessRule');
const FeedbackSettings = require('../models/FeedbackSettings');
const AlertsConfig = require('../models/AlertsConfig');
const PrettyUrlTemplate = require('../models/PrettyUrlTemplate');
const SeoConfig = require('../models/SeoConfig');
const { syncPaligoMetadataRegistry } = require('../services/metadata/paligoApiMetadataService');
const { reprojectTopicsForDocument } = require('../services/metadata/registryService');

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
    reserved: MetadataKey.isReserved(obj.name),
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
    res.set('Cache-Control', 'no-store');
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

// POST /api/metadata-keys/sync-paligo — pull live metadata values from the
// Paligo API into the metadata registry shown by this page. Body:
//   { folderIds?: [39000, 1289615], includeRootDocuments?: boolean }
router.post('/sync-paligo', auth, adminOrEditor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const {
      folderIds = [],
      includeRootDocuments = true,
      includeDocumentDetails = true,
      projectToCorpus = true,
      indexForSearch = true,
    } = req.body || {};
    const result = await syncPaligoMetadataRegistry({
      folderIds,
      includeRootDocuments,
      includeDocumentDetails,
      projectToCorpus,
      indexForSearch,
    });
    res.json({ ok: true, result });
  } catch (err) { next(err); }
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

    const { name, isIndexed, isDate, addValue, removeValue } = req.body || {};

    if (name != null) {
      const display = String(name).trim();
      if (!display) return res.status(400).json({ error: 'name cannot be empty' });
      if (MetadataKey.isReserved(display)) {
        return res.status(400).json({ error: `"${display}" is a reserved built-in metadata field.` });
      }
      const lower = display.toLowerCase();
      if (lower !== row.name) {
        const dup = await MetadataKey.findOne({ name: lower, _id: { $ne: row._id } });
        if (dup) return res.status(409).json({ error: 'Another metadata key already uses that name.' });
        await renameMetadataEverywhere(row.name, display);
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

    if (addValue != null) {
      const value = String(addValue).trim();
      if (value) {
        const current = Array.isArray(row.valuesSample) ? row.valuesSample : [];
        if (!current.includes(value)) {
          row.valuesSample = [...current, value].slice(0, 10);
          row.valuesCount = Math.max(row.valuesCount || 0, row.valuesSample.length);
        }
      }
    }

    if (removeValue != null) {
      const value = String(removeValue).trim();
      if (value) {
        row.valuesSample = (row.valuesSample || []).filter((v) => v !== value);
        row.valuesCount = Math.max(0, Math.min(row.valuesCount || 0, row.valuesSample.length));
      }
    }

    await row.save();
    res.json({ item: serialise(row) });
  } catch (err) { next(err); }
});

// DELETE /api/metadata-keys/:id — remove a custom/discovered metadata key from
// the registry and from every topic/document metadata bag that uses it.
router.delete('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Metadata key not found' });
    }
    const row = await MetadataKey.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Metadata key not found' });
    if (MetadataKey.isReserved(row.name)) {
      return res.status(400).json({ error: 'Built-in metadata fields cannot be deleted.' });
    }
    await deleteMetadataEverywhere(row.name);
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

function valuesArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (value == null) return [];
  return [String(value)].filter(Boolean);
}

function mergeValues(a, b) {
  const out = [];
  for (const v of [...valuesArray(a), ...valuesArray(b)]) {
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function mapToPlain(mapLike) {
  if (!mapLike) return {};
  if (mapLike instanceof Map) return Object.fromEntries(mapLike.entries());
  return { ...mapLike };
}

function renameCustomBag(mapLike, oldLower, newDisplay) {
  const plain = mapToPlain(mapLike);
  const out = {};
  let moved = [];
  let changed = false;
  for (const [key, value] of Object.entries(plain)) {
    if (String(key).trim().toLowerCase() === oldLower) {
      moved = mergeValues(moved, value);
      changed = true;
    } else {
      out[key] = value;
    }
  }
  if (changed) out[newDisplay] = mergeValues(out[newDisplay], moved);
  return { changed, value: out };
}

function deleteFromCustomBag(mapLike, oldLower) {
  const plain = mapToPlain(mapLike);
  const out = {};
  let changed = false;
  for (const [key, value] of Object.entries(plain)) {
    if (String(key).trim().toLowerCase() === oldLower) {
      changed = true;
    } else {
      out[key] = value;
    }
  }
  return { changed, value: out };
}

async function mutateTopicMetadata(oldLower, mutator) {
  const affectedDocumentIds = new Set();
  const cursor = Topic.find(
    {
      $or: [
        { 'metadata.custom': { $exists: true } },
        { 'metadata.customRaw': { $exists: true } },
      ],
    },
    'metadata.custom metadata.customRaw documentId'
  ).cursor({ batchSize: 200 });

  for await (const topic of cursor) {
    const nextCustom = mutator(topic.metadata?.custom, oldLower);
    const nextRaw = mutator(topic.metadata?.customRaw, oldLower);
    if (!nextCustom.changed && !nextRaw.changed) continue;

    topic.metadata = topic.metadata || {};
    if (nextCustom.changed) topic.metadata.custom = nextCustom.value;
    if (nextRaw.changed) topic.metadata.customRaw = nextRaw.value;
    await topic.save();
    if (topic.documentId) affectedDocumentIds.add(String(topic.documentId));
  }

  return affectedDocumentIds;
}

async function mutateDocumentMetadata(oldLower, mutator) {
  const affectedDocumentIds = new Set();
  const cursor = Document.find(
    { 'metadata.customFields': { $exists: true } },
    'metadata.customFields'
  ).cursor({ batchSize: 200 });

  for await (const doc of cursor) {
    const next = mutator(doc.metadata?.customFields, oldLower);
    if (!next.changed) continue;
    doc.metadata = doc.metadata || {};
    const scalar = {};
    for (const [key, value] of Object.entries(next.value)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (first != null) scalar[key] = String(first);
    }
    doc.metadata.customFields = scalar;
    await doc.save();
    affectedDocumentIds.add(String(doc._id));
  }

  return affectedDocumentIds;
}

async function reprojectAffectedDocuments(ids) {
  for (const id of ids) {
    await reprojectTopicsForDocument(id);
  }
}

function sameKey(a, oldLower) {
  return String(a || '').trim().toLowerCase() === oldLower;
}

async function renameReferences(oldLower, newDisplay) {
  const newLower = newDisplay.toLowerCase();

  await EnrichRule.updateMany({ metadataKey: oldLower }, { $set: { metadataKey: newLower } });
  const copyRules = await EnrichRule.find({ 'config.sourceKey': oldLower });
  for (const rule of copyRules) {
    rule.config = { ...(rule.config || {}), sourceKey: newLower };
    await rule.save();
  }

  const accessRules = await AccessRule.find({});
  for (const rule of accessRules) {
    rule.requirements = (rule.requirements || []).map((r) => (
      sameKey(r.key, oldLower) ? { ...r.toObject?.() || r, key: newDisplay } : r
    ));
    if (sameKey(rule.autoBindKey, oldLower)) rule.autoBindKey = newDisplay;
    await rule.save();
  }

  await renameSingletonArrayKey(FeedbackSettings, 'feedback-settings', ['subjectMetadataKeys', 'bodyMetadataKeys'], oldLower, newDisplay);
  await renameSingletonArrayKey(AlertsConfig, 'alerts-config', ['bodyMetadataKeys'], oldLower, newDisplay);

  const pretty = await PrettyUrlTemplate.find({});
  for (const row of pretty) {
    row.requirements = (row.requirements || []).map((r) => (
      sameKey(r.key, oldLower) ? { ...r.toObject?.() || r, key: newDisplay } : r
    ));
    await row.save();
  }

  const seo = await SeoConfig.findOne();
  if (seo) {
    seo.titleTags = (seo.titleTags || []).map((t) => (
      sameKey(t.metadata, oldLower) ? { ...t.toObject?.() || t, metadata: newDisplay } : t
    ));
    seo.customRules = (seo.customRules || []).map((r) => (
      sameKey(r.metadataKey, oldLower) ? { ...r.toObject?.() || r, metadataKey: newDisplay } : r
    ));
    await seo.save();
  }
}

async function deleteReferences(oldLower) {
  await EnrichRule.deleteMany({ metadataKey: oldLower });
  const copyRules = await EnrichRule.find({ 'config.sourceKey': oldLower });
  for (const rule of copyRules) {
    rule.config = { ...(rule.config || {}) };
    delete rule.config.sourceKey;
    await rule.save();
  }

  const accessRules = await AccessRule.find({});
  for (const rule of accessRules) {
    rule.requirements = (rule.requirements || []).filter((r) => !sameKey(r.key, oldLower));
    if (sameKey(rule.autoBindKey, oldLower)) rule.autoBindKey = '';
    await rule.save();
  }

  await deleteSingletonArrayKey(FeedbackSettings, 'feedback-settings', ['subjectMetadataKeys', 'bodyMetadataKeys'], oldLower);
  await deleteSingletonArrayKey(AlertsConfig, 'alerts-config', ['bodyMetadataKeys'], oldLower);

  const pretty = await PrettyUrlTemplate.find({});
  for (const row of pretty) {
    row.requirements = (row.requirements || []).filter((r) => !sameKey(r.key, oldLower));
    await row.save();
  }

  const seo = await SeoConfig.findOne();
  if (seo) {
    seo.titleTags = (seo.titleTags || []).filter((t) => !sameKey(t.metadata, oldLower));
    seo.customRules = (seo.customRules || []).filter((r) => !sameKey(r.metadataKey, oldLower));
    await seo.save();
  }
}

async function renameSingletonArrayKey(Model, id, fields, oldLower, newDisplay) {
  const doc = await Model.findById(id).catch(() => null);
  if (!doc) return;
  let changed = false;
  for (const field of fields) {
    const arr = Array.isArray(doc[field]) ? doc[field] : [];
    const next = arr.map((v) => sameKey(v, oldLower) ? newDisplay : v);
    if (JSON.stringify(arr) !== JSON.stringify(next)) {
      doc[field] = next;
      changed = true;
    }
  }
  if (changed) await doc.save();
}

async function deleteSingletonArrayKey(Model, id, fields, oldLower) {
  const doc = await Model.findById(id).catch(() => null);
  if (!doc) return;
  let changed = false;
  for (const field of fields) {
    const arr = Array.isArray(doc[field]) ? doc[field] : [];
    const next = arr.filter((v) => !sameKey(v, oldLower));
    if (JSON.stringify(arr) !== JSON.stringify(next)) {
      doc[field] = next;
      changed = true;
    }
  }
  if (changed) await doc.save();
}

async function renameMetadataEverywhere(oldName, newDisplay) {
  const oldLower = String(oldName || '').trim().toLowerCase();
  if (!oldLower) return;
  if (MetadataKey.isReserved(oldLower)) {
    throw Object.assign(new Error('Built-in metadata fields cannot be renamed.'), { status: 400 });
  }
  const affected = new Set();
  for (const id of await mutateTopicMetadata(oldLower, (bag, key) => renameCustomBag(bag, key, newDisplay))) affected.add(id);
  for (const id of await mutateDocumentMetadata(oldLower, (bag, key) => renameCustomBag(bag, key, newDisplay))) affected.add(id);
  await renameReferences(oldLower, newDisplay);
  await reprojectAffectedDocuments(affected);
}

async function deleteMetadataEverywhere(oldName) {
  const oldLower = String(oldName || '').trim().toLowerCase();
  if (!oldLower) return;
  if (MetadataKey.isReserved(oldLower)) {
    throw Object.assign(new Error('Built-in metadata fields cannot be deleted.'), { status: 400 });
  }
  const affected = new Set();
  for (const id of await mutateTopicMetadata(oldLower, deleteFromCustomBag)) affected.add(id);
  for (const id of await mutateDocumentMetadata(oldLower, deleteFromCustomBag)) affected.add(id);
  await deleteReferences(oldLower);
  await reprojectAffectedDocuments(affected);
}

module.exports = router;
