// Worker-thread entrypoint for the Pretty URL "Activate" / "Reprocess"
// flows. Streams every Document, calls prettyUrlService.regenerateForDocument
// with the *currently* active template set, and updates a job row with
// progress so the admin page can render a progress strip.
//
// Same shape as reprocessMetadataWorker.js — own MongoDB connection,
// fire-and-forget messaging, idempotent finalisation.
//
//   parent → worker: { jobId }
//   worker → parent: { type: 'progress', processed, errorCount, total }
//                    { type: 'done',     processed, errorCount, total }
//                    { type: 'error',    message }
const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');

const config = require('../config/env');
const Document = require('../models/Document');
const PrettyUrlReprocessJob = require('../models/PrettyUrlReprocessJob');
const PrettyUrlConfig = require('../models/PrettyUrlConfig');
const {
  loadActiveSet,
  regenerateForDocument,
  invalidateCache,
} = require('../services/prettyUrl/prettyUrlService');

function send(msg) {
  if (parentPort) parentPort.postMessage(msg);
}

async function run() {
  const { jobId } = workerData || {};
  if (!jobId) {
    send({ type: 'error', message: 'reprocessPrettyUrlsWorker: missing jobId' });
    return;
  }
  if (!config.mongodbUri) {
    send({ type: 'error', message: 'MONGODB_URI not configured' });
    return;
  }

  await mongoose.connect(config.mongodbUri, { autoIndex: false });

  // Force a cold load of the active set once at the start so every doc in
  // this run sees the same template list.
  invalidateCache();
  const activeSet = await loadActiveSet({ force: true });

  const total = await Document.estimatedDocumentCount();
  send({ type: 'progress', processed: 0, errorCount: 0, total });

  let processed = 0;
  let errorCount = 0;
  const cursor = Document.find({}, '_id').cursor({ batchSize: 50 });

  for await (const doc of cursor) {
    try {
      await regenerateForDocument(doc._id, { activeSet });
      processed += 1;
      if (processed % 25 === 0) {
        send({ type: 'progress', processed, errorCount, total });
      }
    } catch (err) {
      errorCount += 1;
      if (errorCount < 25) {
        console.warn(
          'reprocessPrettyUrlsWorker doc error:',
          doc?._id?.toString?.(),
          err.message
        );
      }
    }
  }

  send({ type: 'done', processed, errorCount, total });

  try {
    await PrettyUrlReprocessJob.updateOne(
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
    await PrettyUrlConfig.updateOne(
      { singletonKey: 'global' },
      { $set: { pendingReprocess: false } }
    );
  } catch (_) { /* ignore */ }

  await mongoose.disconnect().catch(() => {});
}

run().catch(async (err) => {
  send({ type: 'error', message: err?.message || String(err) });
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
});
