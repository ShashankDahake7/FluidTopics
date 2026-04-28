// Worker-thread entrypoint for "Reprocess" on the Vocabularies admin
// page. Streams every Topic, recomputes `metadata.indexedValues` (now
// expanded with active vocabulary synonyms), and writes aggregate
// progress back to the parent process.
//
// Mirrors `reprocessMetadataWorker` deliberately — same connect-on-entry,
// same cursor stream, same progress cadence (every 100 topics). On
// completion we clear `VocabularyConfig.pendingReprocess` and reset every
// `Vocabulary.updatedSinceReprocess` flag so the dot disappears in the UI.
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
const Vocabulary = require('../models/Vocabulary');
const VocabularyTerm = require('../models/VocabularyTerm');
const VocabularyConfig = require('../models/VocabularyConfig');
const VocabularyReprocessJob = require('../models/VocabularyReprocessJob');
const { recomputeTopicProjection } = require('../services/metadata/registryService');
const {
  buildSynonymIndexForRows,
  expandIndexedValues,
} = require('../services/vocabularies/synonymProjector');
// Enrich-and-Clean: vocabularies reprocess also re-runs `scope: 'all'`
// rules so the durable values reflect any synonym-driven enrichments
// that depend on the vocabularies the admin just changed.
const enrichService = require('../services/enrich/enrichService');
const { applyRulesToTopic } = require('../services/enrich/ruleEngine');

function send(msg) {
  if (parentPort) parentPort.postMessage(msg);
}

async function run() {
  const { jobId, triggeredBy } = workerData || {};
  if (!jobId) {
    send({ type: 'error', message: 'reprocessVocabulariesWorker: missing jobId' });
    return;
  }

  if (!config.mongodbUri) {
    send({ type: 'error', message: 'MONGODB_URI not configured' });
    return;
  }

  await mongoose.connect(config.mongodbUri, { autoIndex: false });

  // Build the synonym index once at the start. Only `usedInSearch: true`
  // vocabularies contribute. If none are active the run is still useful —
  // it strips any stale synonyms from previously-indexed values.
  const activeVocabs = await Vocabulary.find(
    { usedInSearch: true, status: 'ready' },
    '_id'
  ).lean();
  const activeIds = activeVocabs.map((v) => v._id);
  const termRows = activeIds.length
    ? await VocabularyTerm.find(
        { vocabularyId: { $in: activeIds } },
        'vocabularyId termId language prefLabel altLabels'
      ).lean()
    : [];
  const synonymIndex = buildSynonymIndexForRows(termRows);

  // Load the metadata registry once so per-topic projection reads from
  // memory instead of issuing a query per row.
  const registryRows = await MetadataKey.find(
    {},
    'name isIndexed isDate'
  ).lean();
  const registryByName = new Map(
    registryRows.map((r) => [r.name, { isIndexed: !!r.isIndexed, isDate: !!r.isDate }])
  );

  // Enrich rules use scope: 'all' for corpus reprocess. Any failure
  // loading them downgrades to "no rules" rather than aborting.
  let activeRules = { rules: [], vocabularyTermIndexes: new Map() };
  try {
    activeRules = await enrichService.getActiveRulesCached({ scope: 'reprocess' });
  } catch (err) {
    console.warn('reprocessVocabulariesWorker: enrich rule load failed:', err.message);
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

  const total = await Topic.estimatedDocumentCount();
  send({ type: 'progress', processed: 0, errorCount: 0, total });

  let processed = 0;
  let errorCount = 0;
  const cursor = Topic.find({}, 'metadata.custom metadata.customRaw').cursor({ batchSize: 200 });

  for await (const topic of cursor) {
    try {
      // Restore from raw snapshot then re-apply scope: 'all' rules so
      // synonym + clean rules see the original values rather than the
      // already-mutated copy.
      if (activeRules.rules.length > 0) {
        const raw = topic?.metadata?.customRaw;
        if (raw && (raw instanceof Map ? raw.size > 0 : Object.keys(raw).length > 0)) {
          topic.metadata.custom = cloneCustomMap(raw);
        }
        applyRulesToTopic(topic, activeRules.rules, {
          vocabularyTermIndexes: activeRules.vocabularyTermIndexes,
        });
      }

      const { indexedValues, dateValues } =
        recomputeTopicProjection(topic, registryByName);
      const expanded = synonymIndex.size > 0
        ? expandIndexedValues(indexedValues, synonymIndex)
        : indexedValues;

      const updateSet = {
        'metadata.indexedValues': expanded,
        'metadata.dateValues': dateValues,
      };
      if (activeRules.rules.length > 0) {
        updateSet['metadata.custom'] = customMapToObject(topic.metadata.custom);
      }
      await Topic.updateOne({ _id: topic._id }, { $set: updateSet });
      processed += 1;
      if (processed % 100 === 0) {
        send({ type: 'progress', processed, errorCount, total });
      }
    } catch (err) {
      errorCount += 1;
      if (errorCount < 25) {
        console.warn(
          'reprocessVocabulariesWorker topic error:',
          topic?._id?.toString?.(),
          err.message
        );
      }
    }
  }

  // Successful run: clear the dot on every vocabulary row + drop the
  // pendingReprocess flag on the config singleton, stamping who/when.
  try {
    await Vocabulary.updateMany({}, { $set: { updatedSinceReprocess: false } });
    await VocabularyConfig.updateOne(
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
    console.warn('reprocessVocabulariesWorker post-completion writeback error:', err.message);
  }

  send({ type: 'done', processed, errorCount, total });

  try {
    await VocabularyReprocessJob.updateOne(
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
