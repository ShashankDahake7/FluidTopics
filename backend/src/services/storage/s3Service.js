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
// Both buckets share a single per-publication prefix (`publications/<id>/`)
// so the relationship between source + extracted is a pure substring match.
const rawKey       = (publicationId)             => `publications/${publicationId}/source.zip`;
const extractedRoot = (publicationId)            => `publications/${publicationId}/extracted/`;
const extractedKey  = (publicationId, relPath)   => `${extractedRoot(publicationId)}${normalizeRel(relPath)}`;

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
  extractedKey,
  extractedRoot,
  normalizeRel,
  putObject,
  putFile,
  getObjectStream,
  headObject,
  listAllObjects,
  deletePrefix,
  deleteOne,
  presignDownload,
};
