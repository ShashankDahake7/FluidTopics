const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const { getS3Client, assertS3Configured } = require('./s3Client');
const config = require('../../config/env');

// ── Key helpers ────────────────────────────────────────────────────────────
// Two coexisting key shapes:
//
//   1. Per-publication prefix (legacy):  publications/<pubId>/source.zip
//      and publications/<pubId>/extracted/<relPath>. Still used as the
//      fallback when a Publication row predates contentHash / a manifest
//      entry doesn't carry an explicit `key`.
//
//   2. Content-addressed (CAS):
//        - raw zips:        raw/<h[0..1]>/<h>.zip
//        - extracted files: extracted/<h[0..1]>/<h[2..3]>/<h><ext>
//      Multiple Publications can point at the same CAS object, so any
//      delete path that targets these keys must consult the refcount
//      tables (Publication.contentHash for raw, ExtractedFileBlob for
//      per-file) before issuing the actual S3 delete.
const rawKey        = (publicationId)            => `publications/${publicationId}/source.zip`;
const extractedRoot = (publicationId)            => `publications/${publicationId}/extracted/`;
const extractedKey  = (publicationId, relPath)   => `${extractedRoot(publicationId)}${normalizeRel(relPath)}`;

// Content-addressed raw-zip key. Two-byte fan-out keeps any single S3
// "directory" listing under the practical limit even at very high blob
// counts.
function rawCasKey(contentHash) {
  const h = String(contentHash || '').toLowerCase();
  if (!h || h.length < 4) return rawKey('unknown');
  return `raw/${h.slice(0, 2)}/${h}.zip`;
}

// Content-addressed extracted-file key. Four-byte fan-out (two
// directories) gives the same listing-friendly shape under deeper trees.
// Original extension is preserved when possible so signed-URL downloads
// open in the right viewer (PDFs, images, etc.).
function extractedCasKey(contentHash, originalExt = '') {
  const h = String(contentHash || '').toLowerCase();
  if (!h || h.length < 4) return null;
  const ext = String(originalExt || '').replace(/^\.+/, '').toLowerCase();
  const safeExt = ext ? `.${ext.replace(/[^a-z0-9]+/g, '')}` : '';
  return `extracted/${h.slice(0, 2)}/${h.slice(2, 4)}/${h}${safeExt}`;
}

// Resolve a manifest-entry-or-relative-path to its S3 key. Caller passes
// either (a) the manifest entry object itself (preferred — already carries
// a CAS key, no recomputation needed) or (b) a relative path string, in
// which case we fall back to the legacy per-pub layout for old rows that
// haven't been re-extracted under CAS.
function keyForManifestEntry(pub, entryOrRelPath) {
  if (entryOrRelPath && typeof entryOrRelPath === 'object') {
    if (entryOrRelPath.key) return entryOrRelPath.key;
    if (entryOrRelPath.path) return extractedKey(pub._id || pub.id, entryOrRelPath.path);
    return null;
  }
  if (typeof entryOrRelPath === 'string') {
    const manifest = pub?.extracted?.manifest || [];
    const hit = manifest.find((m) => m.path === entryOrRelPath || normalizeRel(m.path) === normalizeRel(entryOrRelPath));
    if (hit?.key) return hit.key;
    return extractedKey(pub._id || pub.id, entryOrRelPath);
  }
  return null;
}

// POSIX-normalize the path inside the zip + strip leading slashes so we never
// generate a key like `publications/<id>/extracted//foo`.
function normalizeRel(p) {
  const posix = String(p).replace(/\\/g, '/');
  return posix.replace(/^\/+/, '');
}

// ── Uploads ────────────────────────────────────────────────────────────────
// Multipart-aware streaming upload. Accepts either a Buffer, a string, or a
// readable stream — the @aws-sdk lib-storage Upload helper picks the right
// strategy automatically (single PUT for small bodies, multipart for streams).
async function putObject({ bucket, key, body, contentType }) {
  assertS3Configured();
  const client = getS3Client();
  const uploader = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || mime.lookup(key) || 'application/octet-stream',
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  });
  const result = await uploader.done();
  return { etag: stripQuotes(result.ETag), key, bucket };
}

// Convenience wrapper for putting a local file (used after multer drops the
// upload onto disk). We stream it rather than reading the whole zip into RAM.
async function putFile({ bucket, key, filePath, contentType }) {
  return putObject({
    bucket,
    key,
    body: fs.createReadStream(filePath),
    contentType: contentType || mime.lookup(filePath) || 'application/octet-stream',
  });
}

// ── Reads ──────────────────────────────────────────────────────────────────
async function getObjectStream({ bucket, key }) {
  assertS3Configured();
  const client = getS3Client();
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return out.Body; // Node Readable
}

async function headObject({ bucket, key }) {
  assertS3Configured();
  const client = getS3Client();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

// True when the object exists. Returns false on any 404-ish AWS error so
// the caller can branch into "PUT it" without a noisy stack. Anything
// else (auth, network) re-throws so we never silently overwrite.
async function objectExists({ bucket, key }) {
  try {
    await headObject({ bucket, key });
    return true;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode || err?.statusCode;
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') return false;
    throw err;
  }
}

async function* listAllObjects({ bucket, prefix }) {
  assertS3Configured();
  const client = getS3Client();
  let token;
  do {
    const out = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of out.Contents || []) yield obj;
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
}

// ── Deletes ────────────────────────────────────────────────────────────────
// Batches into S3's 1000-key DeleteObjects limit so callers can pass a
// long-running publication's full manifest without thinking about it.
async function deletePrefix({ bucket, prefix }) {
  assertS3Configured();
  const client = getS3Client();
  let batch = [];
  let deleted = 0;

  const flush = async () => {
    if (!batch.length) return;
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
    }));
    deleted += batch.length;
    batch = [];
  };

  for await (const obj of listAllObjects({ bucket, prefix })) {
    batch.push(obj.Key);
    if (batch.length >= 1000) await flush();
  }
  await flush();
  return deleted;
}

async function deleteOne({ bucket, key }) {
  assertS3Configured();
  const client = getS3Client();
  await client.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: [{ Key: key }], Quiet: true },
  }));
}

// ── Presign ────────────────────────────────────────────────────────────────
async function presignDownload({ bucket, key, filename, expiresInSeconds }) {
  assertS3Configured();
  const client = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename
      ? { ResponseContentDisposition: `attachment; filename="${escapeFilename(filename)}"` }
      : {}),
  });
  return getSignedUrl(client, cmd, {
    expiresIn: expiresInSeconds || config.s3.presignExpires,
  });
}

function escapeFilename(name) {
  return String(name).replace(/[\r\n"]/g, '_');
}

function stripQuotes(s) {
  if (!s) return '';
  return String(s).replace(/^"|"$/g, '');
}

module.exports = {
  rawKey,
  rawCasKey,
  extractedKey,
  extractedCasKey,
  extractedRoot,
  keyForManifestEntry,
  normalizeRel,
  putObject,
  putFile,
  getObjectStream,
  headObject,
  objectExists,
  listAllObjects,
  deletePrefix,
  deleteOne,
  presignDownload,
};
