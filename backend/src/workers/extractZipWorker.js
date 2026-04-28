// Worker-thread entrypoint: streams an uploaded .zip out of the raw S3 bucket
// and uploads every entry into the extracted S3 bucket using a content-
// addressed (CAS) layout so identical bytes are stored once across every
// publication that ever ships them. Communicates with the parent via
// `parentPort.postMessage`. Never imports mongoose — DB writes are the
// orchestrator's job (it post-processes the manifest into ExtractedFileBlob
// refcount upserts after the worker exits).
//
//   parent → worker:  { publicationId, raw, extracted, maxEntryBytes }
//   worker → parent:  { type: 'log',     entry: {...} }
//                     { type: 'progress', processed, totalBytesUploaded, reused }
//                     { type: 'manifest', files: [...] }
//                     { type: 'done' }
//                     { type: 'error',   message }
//
// Manifest entry shape:
//   { path:        relative-path-inside-zip,
//     key:         CAS S3 key (extracted/<h[0..1]>/<h[2..3]>/<h><ext>),
//     size,
//     contentType,
//     etag,        // empty when we skipped the PUT (object already existed)
//     contentHash, // sha256 hex of the bytes — also the CAS row id
//     reused:      bool }
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const crypto = require('crypto');
const unzipper = require('unzipper');
const mime = require('mime-types');

const {
  getObjectStream,
  putObject,
  objectExists,
  extractedCasKey,
  normalizeRel,
} = require('../services/storage/s3Service');

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

// Streams the entry into a buffer while updating a sha256 hash incrementally.
// Returns { buffer, hash, size } so the caller can decide whether to PUT
// or to skip.
async function streamToBufferWithHash(readable, maxBytes) {
  const chunks = [];
  const hasher = crypto.createHash('sha256');
  let total = 0;
  for await (const chunk of readable) {
    if (total + chunk.length > maxBytes) {
      // Drain the remaining stream so unzipper can advance to the next entry.
      // Throwing here without draining hangs the parser.
      total += chunk.length;
      chunks.push(chunk);
      hasher.update(chunk);
      // Keep consuming so the parser doesn't deadlock; the caller will
      // notice the over-cap size and discard.
      continue;
    }
    chunks.push(chunk);
    hasher.update(chunk);
    total += chunk.length;
  }
  return { buffer: Buffer.concat(chunks, total), hash: hasher.digest('hex'), size: total };
}

async function run() {
  const { publicationId, raw, extracted, maxEntryBytes } = workerData;

  if (!publicationId || !raw?.bucket || !raw?.key || !extracted?.bucket) {
    send({ type: 'error', message: 'extractZipWorker: missing required workerData fields' });
    return;
  }

  logEntry('info', 'extract_started', `Extraction started for ${raw.key}`, { rawKey: raw.key });

  const manifest = [];
  let processed = 0;
  let reusedCount = 0;
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
      const ext = path.extname(rel);
      const contentType = mime.lookup(rel) || 'application/octet-stream';

      try {
        // Buffer-then-hash-then-CAS-or-PUT: we need the hash to compute
        // the CAS key, and unzipper streams aren't restartable on
        // transient S3 failures. The per-entry cap above keeps memory
        // bounded.
        const { buffer: buf, hash, size } = await streamToBufferWithHash(entry, maxEntryBytes);

        if (size > maxEntryBytes) {
          logEntry('error', 'extract_entry_too_large',
            `Entry ${relRaw} (${size} bytes) exceeds max ${maxEntryBytes}`,
            { path: relRaw, size, max: maxEntryBytes });
          continue;
        }

        const key = extractedCasKey(hash, ext);
        if (!key) {
          logEntry('error', 'extract_failed',
            `Failed to compute CAS key for ${relRaw} (hash=${hash})`,
            { path: relRaw, hash });
          continue;
        }

        // Headcheck before the PUT — when this is the third Publication
        // shipping the same logo.png we skip the multipart upload
        // entirely. headObject is a single tiny round-trip; the upload
        // it replaces would have been a full PUT of the file body.
        let alreadyExists = false;
        try {
          alreadyExists = await objectExists({ bucket: extracted.bucket, key });
        } catch (err) {
          // Not fatal — fall through to PUT.
          logEntry('warn', 'extract_head_failed',
            `headObject failed for ${key}: ${err.message}`,
            { path: relRaw, key });
        }

        let etag = '';
        if (!alreadyExists) {
          const res = await putObject({
            bucket: extracted.bucket,
            key,
            body: buf,
            contentType,
          });
          etag = res.etag;
          totalBytesUploaded += size;
        } else {
          reusedCount += 1;
        }

        manifest.push({
          path: rel,
          key,
          size,
          contentType,
          etag,
          contentHash: hash,
          reused: alreadyExists,
        });
        processed += 1;

        if (processed % 25 === 0) {
          send({ type: 'progress', processed, totalBytesUploaded, reused: reusedCount });
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

  send({ type: 'progress', processed, totalBytesUploaded, reused: reusedCount });
  send({ type: 'manifest', files: manifest });
  logEntry('info', 'extract_complete',
    `Extraction complete: ${manifest.length} files, ${totalBytesUploaded} bytes uploaded, ${reusedCount} reused`,
    { fileCount: manifest.length, totalBytes: totalBytesUploaded, reused: reusedCount });
  send({ type: 'done' });
}

run().catch((err) => {
  send({ type: 'error', message: err?.message || String(err) });
});
