// Worker-thread entrypoint: streams an uploaded .zip out of the raw S3 bucket
// and uploads every entry into the extracted S3 bucket while preserving the
// original folder structure inside the zip. Communicates with the parent via
// `parentPort.postMessage`. Never imports mongoose — DB writes are the
// orchestrator's job.
//
//   parent → worker:  { publicationId, raw, extracted, maxEntryBytes }
//   worker → parent:  { type: 'log',     entry: {...} }
//                     { type: 'progress', processed, totalBytesUploaded }
//                     { type: 'manifest', files: [...] }
//                     { type: 'done' }
//                     { type: 'error',   message }
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const unzipper = require('unzipper');
const mime = require('mime-types');

const { getObjectStream, putObject, normalizeRel } = require('../services/storage/s3Service');

const SKIP_PATTERNS = [
  /^__MACOSX\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/,
];

function send(msg) {
  parentPort.postMessage(msg);
}

function logEntry(level, code, message, context = {}) {
  send({ type: 'log', entry: { level, code, message, context, timestamp: new Date().toISOString() } });
}

async function streamToBuffer(readable) {
  const chunks = [];
  let total = 0;
  for await (const chunk of readable) {
    chunks.push(chunk);
    total += chunk.length;
  }
  return Buffer.concat(chunks, total);
}

async function run() {
  const { publicationId, raw, extracted, maxEntryBytes } = workerData;

  if (!publicationId || !raw?.bucket || !raw?.key || !extracted?.bucket || !extracted?.prefix) {
    send({ type: 'error', message: 'extractZipWorker: missing required workerData fields' });
    return;
  }

  logEntry('info', 'extract_started', `Extraction started for ${raw.key}`, { rawKey: raw.key });

  const manifest = [];
  let processed = 0;
  let totalBytesUploaded = 0;

  let zipStream;
  try {
    zipStream = await getObjectStream({ bucket: raw.bucket, key: raw.key });
  } catch (err) {
    send({ type: 'error', message: `Failed to fetch raw zip from S3: ${err.message}` });
    return;
  }

  // unzipper.Parse() reads the zip in streaming mode (Local File Header). We
  // pull entries sequentially: each entry is itself a stream we either consume
  // (upload) or autodrain (skip).
  try {
    const parser = zipStream.pipe(unzipper.Parse({ forceStream: true }));

    for await (const entry of parser) {
      const relRaw = entry.path;
      const type = entry.type; // 'File' | 'Directory'
      const sizeHint = entry.vars?.uncompressedSize ?? 0;

      if (type === 'Directory' || /\/$/.test(relRaw)) {
        entry.autodrain();
        continue;
      }

      const skip = SKIP_PATTERNS.some((rx) => rx.test(relRaw));
      if (skip) {
        logEntry('info', 'extract_entry_skipped', `Skipped ${relRaw}`, { path: relRaw });
        entry.autodrain();
        continue;
      }

      if (sizeHint && sizeHint > maxEntryBytes) {
        logEntry('error', 'extract_entry_too_large',
          `Entry ${relRaw} (${sizeHint} bytes) exceeds max ${maxEntryBytes}`,
          { path: relRaw, size: sizeHint, max: maxEntryBytes });
        entry.autodrain();
        continue;
      }

      const rel = normalizeRel(relRaw);
      const key = `${extracted.prefix}${rel}`;
      const contentType = mime.lookup(rel) || 'application/octet-stream';

      try {
        // Buffer-then-upload: we need an exact size + the resulting ETag, and
        // unzipper streams aren't restartable on transient S3 failures. The
        // per-entry cap above keeps memory bounded.
        const buf = await streamToBuffer(entry);

        if (buf.length > maxEntryBytes) {
          logEntry('error', 'extract_entry_too_large',
            `Entry ${relRaw} (${buf.length} bytes) exceeds max ${maxEntryBytes}`,
            { path: relRaw, size: buf.length, max: maxEntryBytes });
          continue;
        }

        const { etag } = await putObject({
          bucket: extracted.bucket,
          key,
          body: buf,
          contentType,
        });

        manifest.push({
          path: rel,
          key,
          size: buf.length,
          contentType,
          etag,
        });
        processed += 1;
        totalBytesUploaded += buf.length;

        if (processed % 25 === 0) {
          send({ type: 'progress', processed, totalBytesUploaded });
        }
      } catch (err) {
        logEntry('error', 'extract_failed',
          `Failed to upload ${relRaw}: ${err.message}`,
          { path: relRaw });
      }
    }
  } catch (err) {
    send({ type: 'error', message: `Zip parse failure: ${err.message}` });
    return;
  }

  send({ type: 'progress', processed, totalBytesUploaded });
  send({ type: 'manifest', files: manifest });
  logEntry('info', 'extract_complete',
    `Extraction complete: ${manifest.length} files, ${totalBytesUploaded} bytes`,
    { fileCount: manifest.length, totalBytes: totalBytesUploaded });
  send({ type: 'done' });
}

run().catch((err) => {
  send({ type: 'error', message: err?.message || String(err) });
});
