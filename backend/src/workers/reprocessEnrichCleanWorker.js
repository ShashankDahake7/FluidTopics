// Worker-thread entrypoint for "Reprocess" on the Enrich-and-Clean admin
// page. Streams every Topic, restores `metadata.custom` from
// `metadata.customRaw`, re-applies the active `scope: 'all'` rule set,
// recomputes projections, and writes aggregate progress back to the
// parent process.
//
// Mirrors `reprocessVocabulariesWorker` deliberately — same connect-on-
// entry, same cursor stream, same progress cadence. On completion we
// clear `EnrichConfig.pendingReprocess` and stamp `lastFullReprocessAt`
// / `lastFullReprocessBy` so the footer chip in the UI updates.
//
//   parent → worker: { jobId, triggeredBy }
//   worker → parent: { type: 'progress', processed, errorCount, total }
//                    { type: 'done',     processed, errorCount, total }
//                    { type: 'error',    message }

const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');

const config = require('../config/env');
const Topic = require('../models/Topic');
const MetadataKey = require('../models/MetadataKey');
const EnrichConfig = require('../models/EnrichConfig');
const EnrichReprocessJob = require('../models/EnrichReprocessJob');
const { recomputeTopicProjection } = require('../services/metadata/registryService');
const {
  getActiveSynonymIndexCached,
  expandIndexedValues,
} = require('../services/vocabularies/synonymProjector');
const enrichService = require('../services/enrich/enrichService');
const { applyRulesToTopic } = require('../services/enrich/ruleEngine');

function send(msg) {
  if (parentPort) parentPort.postMessage(msg);
}

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

async function run() {
  const { jobId, triggeredBy } = workerData || {};
  if (!jobId) {
    send({ type: 'error', message: 'reprocessEnrichCleanWorker: missing jobId' });
    return;
  }
  if (!config.mongodbUri) {
    send({ type: 'error', message: 'MONGODB_URI not configured' });
    return;
  }

  await mongoose.connect(config.mongodbUri, { autoIndex: false });

  // Active rules + per-vocab indexes loaded once. The per-topic loop
  // applies them after restoring from the raw snapshot.
  let activeRules = { rules: [], vocabularyTermIndexes: new Map() };
  try {
    activeRules = await enrichService.getActiveRulesCached({ scope: 'reprocess' });
  } catch (err) {
    send({ type: 'error', message: `enrich rule load failed: ${err.message}` });
    await mongoose.disconnect().catch(() => {});
    return;
  }

  // Registry for the projection step (mirrors metadata worker shape).
  const registryRows = await MetadataKey.find(
    {},
    'name isIndexed isDate'
  ).lean();
  const registryByName = new Map(
    registryRows.map((r) => [r.name, { isIndexed: !!r.isIndexed, isDate: !!r.isDate }])
  );

  // Synonym index for the post-projection expansion step.
  let synonymIndex = null;
  try {
    synonymIndex = await getActiveSynonymIndexCached();
  } catch (err) {
    console.warn('reprocessEnrichCleanWorker: synonym index load failed:', err.message);
  }

  const total = await Topic.estimatedDocumentCount();
  send({ type: 'progress', processed: 0, errorCount: 0, total });

  let processed = 0;
  let errorCount = 0;
  const cursor = Topic.find({}, 'metadata.custom metadata.customRaw').cursor({ batchSize: 200 });

  for await (const topic of cursor) {
    try {
      // Restore from raw snapshot. Legacy topics (no snapshot) keep
      // their current values as the baseline so we don't randomly
      // strip data.
      const raw = topic?.metadata?.customRaw;
      if (raw && (raw instanceof Map ? raw.size > 0 : Object.keys(raw).length > 0)) {
        topic.metadata.custom = cloneCustomMap(raw);
      } else {
        topic.metadata.custom = cloneCustomMap(topic.metadata?.custom);
      }

      // Apply rules (no-op when the active set is empty — still useful
      // for clearing previously-applied effects on first run after a
      // mass disable).
      if (activeRules.rules.length > 0) {
        applyRulesToTopic(topic, activeRules.rules, {
          vocabularyTermIndexes: activeRules.vocabularyTermIndexes,
        });
      }

      const { indexedValues, dateValues } =
        recomputeTopicProjection(topic, registryByName);
      const expanded = synonymIndex && synonymIndex.size > 0
        ? expandIndexedValues(indexedValues, synonymIndex)
        : indexedValues;

      await Topic.updateOne(
        { _id: topic._id },
        {
          $set: {
            'metadata.custom': customMapToObject(topic.metadata.custom),
            'metadata.indexedValues': expanded,
            'metadata.dateValues': dateValues,
          },
        }
      );

      processed += 1;
      if (processed % 100 === 0) {
        send({ type: 'progress', processed, errorCount, total });
      }
    } catch (err) {
      errorCount += 1;
      if (errorCount < 25) {
        console.warn(
          'reprocessEnrichCleanWorker topic error:',
          topic?._id?.toString?.(),
          err.message
        );
      }
    }
  }

  // Stamp completion + clear the pendingReprocess dot.
  try {
    await EnrichConfig.updateOne(
      { key: 'default' },
      {
        $set: {
          pendingReprocess: false,
          lastFullReprocessAt: new Date(),
          lastFullReprocessBy: triggeredBy || null,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('reprocessEnrichCleanWorker post-completion writeback error:', err.message);
  }

  send({ type: 'done', processed, errorCount, total });

  try {
    await EnrichReprocessJob.updateOne(
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
