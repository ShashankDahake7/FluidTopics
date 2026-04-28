// Worker-thread entrypoint for "Save and reprocess" on the Metadata
// configuration admin page. Streams every Topic, recomputes
// `metadata.indexedValues` + `metadata.dateValues` from the live registry,
// and writes an aggregate progress count back to the parent process.
//
// Unlike extract/validate, this worker DOES need its own MongoDB
// connection (workers can't share connections with the parent). That is
// the only reason `mongoose.connect()` appears here. We keep it lean —
// open on entry, close on exit, idempotent fail-safe writes.
//
//   parent → worker: { jobId }
//   worker → parent: { type: 'progress', processed, errorCount, total }
//                    { type: 'done',     processed, errorCount, total }
//                    { type: 'error',    message }
const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');

const config = require('../config/env');
const Topic = require('../models/Topic');
const MetadataKey = require('../models/MetadataKey');
const MetadataReprocessJob = require('../models/MetadataReprocessJob');
const { recomputeTopicProjection } = require('../services/metadata/registryService');
const {
  getActiveSynonymIndexCached,
  expandIndexedValues,
} = require('../services/vocabularies/synonymProjector');
// Enrich-and-Clean: load `scope: 'all'` rules once at start so the
// per-topic loop can apply them against a fresh restore from
// `metadata.customRaw`. Best-effort — if the rule loader throws we
// continue without rules rather than aborting the worker.
const enrichService = require('../services/enrich/enrichService');
const { applyRulesToTopic } = require('../services/enrich/ruleEngine');

function send(msg) {
  if (parentPort) parentPort.postMessage(msg);
}

async function run() {
  const { jobId } = workerData || {};
  if (!jobId) {
    send({ type: 'error', message: 'reprocessMetadataWorker: missing jobId' });
    return;
  }

  if (!config.mongodbUri) {
    send({ type: 'error', message: 'MONGODB_URI not configured' });
    return;
  }

  await mongoose.connect(config.mongodbUri, {
    // Workers should not autoIndex on every connect — the main process
    // already manages indexes.
    autoIndex: false,
  });

  // Reset the registry's invalid-date counters before we re-tally.
  await MetadataKey.updateMany({}, { $set: { invalidDateCount: 0 } });

  const registryRows = await MetadataKey.find(
    {},
    'name isIndexed isDate'
  ).lean();
  const registryByName = new Map(
    registryRows.map((r) => [r.name, { isIndexed: !!r.isIndexed, isDate: !!r.isDate }])
  );

  const total = await Topic.estimatedDocumentCount();
  send({ type: 'progress', processed: 0, errorCount: 0, total });

  // Helpers used by the per-topic loop. Hoisted as function declarations
  // so they're available below regardless of where they're written.
  function cloneCustomMap(src) {
    const out = new Map();
    if (!src) return out;
    const entries = src instanceof Map ? src.entries() : Object.entries(src);
    for (const [k, v] of entries) {
      out.set(String(k), Array.isArray(v) ? v.slice() : (v == null ? [] : [String(v)]));
    }
    return out;
  }
  function customMapToObject(custom) {
    if (!custom) return {};
    if (custom instanceof Map) {
      const out = {};
      for (const [k, v] of custom.entries()) out[k] = Array.isArray(v) ? v : [String(v)];
      return out;
    }
    return custom;
  }

  // Load the active vocabulary synonym index once. Failures here just
  // disable expansion for this run rather than aborting the worker.
  let synonymIndex = null;
  try {
    synonymIndex = await getActiveSynonymIndexCached();
  } catch (err) {
    console.warn('reprocessMetadataWorker: synonym index load failed:', err.message);
    synonymIndex = null;
  }

  // Load active Enrich-and-Clean rules (scope: 'all' only — corpus
  // reprocess never re-applies `new`-scope rules) plus any vocabulary
  // term indexes those rules need. Best-effort.
  let activeRules = { rules: [], vocabularyTermIndexes: new Map() };
  try {
    activeRules = await enrichService.getActiveRulesCached({ scope: 'reprocess' });
  } catch (err) {
    console.warn('reprocessMetadataWorker: enrich rule load failed:', err.message);
  }

  // Aggregate per-key invalid date counts so we can update MetadataKey
  // rows in one pass at the end rather than $inc per topic.
  const invalidDateAggregate = new Map();

  let processed = 0;
  let errorCount = 0;
  // Pull metadata.customRaw too so we can restore from the snapshot
  // before re-applying enrich rules.
  const cursor = Topic.find({}, 'metadata.custom metadata.customRaw').cursor({ batchSize: 200 });

  for await (const topic of cursor) {
    try {
      // Restore from raw snapshot so deleted/disabled rules really
      // un-apply. Legacy topics with no snapshot keep their current
      // values as the baseline.
      if (activeRules.rules.length > 0) {
        const raw = topic?.metadata?.customRaw;
        if (raw && (raw instanceof Map ? raw.size > 0 : Object.keys(raw).length > 0)) {
          topic.metadata.custom = cloneCustomMap(raw);
        }
        applyRulesToTopic(topic, activeRules.rules, {
          vocabularyTermIndexes: activeRules.vocabularyTermIndexes,
        });
      }

      const { indexedValues, dateValues, invalidDateKeys } =
        recomputeTopicProjection(topic, registryByName);

      const expanded = synonymIndex && synonymIndex.size > 0
        ? expandIndexedValues(indexedValues, synonymIndex)
        : indexedValues;

      const updateSet = {
        'metadata.indexedValues': expanded,
        'metadata.dateValues': dateValues,
      };
      // Persist the (potentially mutated) custom map only when rules
      // were applied — keep this worker's blast radius narrow when no
      // enrich rules exist.
      if (activeRules.rules.length > 0) {
        updateSet['metadata.custom'] = customMapToObject(topic.metadata.custom);
      }
      await Topic.updateOne({ _id: topic._id }, { $set: updateSet });

      for (const k of invalidDateKeys) {
        invalidDateAggregate.set(k, (invalidDateAggregate.get(k) || 0) + 1);
      }

      processed += 1;
      if (processed % 100 === 0) {
        send({ type: 'progress', processed, errorCount, total });
      }
    } catch (err) {
      errorCount += 1;
      // Bound the noise — log first ~25 errors then stay quiet.
      if (errorCount < 25) {
        console.warn('reprocessMetadataWorker topic error:', topic?._id?.toString?.(), err.message);
      }
    }
  }

  if (invalidDateAggregate.size > 0) {
    const ops = Array.from(invalidDateAggregate.entries()).map(([name, count]) => ({
      updateOne: {
        filter: { name },
        update: { $set: { invalidDateCount: count } },
      },
    }));
    try {
      await MetadataKey.bulkWrite(ops, { ordered: false });
    } catch (err) {
      console.warn('reprocessMetadataWorker invalidDateCount writeback error:', err.message);
    }
  }

  send({ type: 'done', processed, errorCount, total });

  // The route layer also writes the final job status from the
  // 'done' message above, but write here too as a belt-and-braces in
  // case the parent has restarted between spawn + finish.
  try {
    await MetadataReprocessJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'done',
          processed,
          errorCount,
          total,
          finishedAt: new Date(),
        },
      }
    );
  } catch (_) { /* ignore */ }

  await mongoose.disconnect().catch(() => {});
}

run().catch(async (err) => {
  send({ type: 'error', message: err?.message || String(err) });
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
});
