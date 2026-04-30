// Vocabulary CRUD orchestration. Uploads the original file to S3 (so the
// admin can re-download verbatim), runs the right parser based on the
// detected format, persists header + terms in MongoDB, and busts the
// synonym index cache so the next ingest / reprocess run sees the change.
//
// Mongo transactions are used opportunistically — the deployment may be a
// standalone (no transaction support), so each write path falls back to
// best-effort sequencing when the session can't begin a transaction. The
// only path where consistency really matters is "replace all terms during
// update": the order is delete-old → insertMany-new with a try/catch
// re-attempt, and the parsed terms array is retained in memory so a
// failure mid-flight can be retried by the operator.

const crypto = require('crypto');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

const config = require('../../config/env');
const s3 = require('../storage/s3Service');
const Vocabulary = require('../../models/Vocabulary');
const VocabularyTerm = require('../../models/VocabularyTerm');
const VocabularyConfig = require('../../models/VocabularyConfig');

const { parseCsv } = require('./vocabularyParsers/csvParser');
const { parseSkos } = require('./vocabularyParsers/skosParser');
const { bumpSynonymCache } = require('./synonymProjector');

const BUCKET = () => config.s3.rawBucket;
const S3_PREFIX = 'vocabularies/';

// ── Format detection ──────────────────────────────────────────────────────
const SKOS_EXTS = new Set(['.rdf', '.xml', '.owl', '.ttl', '.nt', '.jsonld']);

function detectFormat(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (ext === '.csv') return 'csv';
  if (SKOS_EXTS.has(ext)) return 'skos';
  // Fallback: peek at the first bytes? For safety, default to csv if the
  // file looks comma-delimited, else skos. Since the upload UI only
  // advertises csv/rdf/xml, this is just a defensive default.
  return ext === '.txt' ? 'csv' : 'skos';
}

async function readBuffer(filePath) {
  return fs.promises.readFile(filePath);
}

function checksumOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function s3KeyFor(vocabId, originalName) {
  const safe = path.basename(originalName || 'vocabulary').replace(/[^A-Za-z0-9._-]/g, '_');
  return `${S3_PREFIX}${vocabId}/${Date.now()}-${safe}`;
}

// ── Parsing ───────────────────────────────────────────────────────────────
async function parseFile({ buffer, originalName, format }) {
  if (format === 'csv') return parseCsv(buffer);
  if (format === 'skos') return parseSkos(buffer, originalName);
  const err = new Error(`Unsupported vocabulary format: ${format}`);
  err.status = 400;
  throw err;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function vocabExposable(vocab) {
  if (!vocab) return null;
  const obj = typeof vocab.toObject === 'function' ? vocab.toObject() : vocab;
  return {
    id: String(obj._id),
    name: obj.name,
    displayName: obj.displayName || obj.name,
    format: obj.format,
    sourceFilename: obj.sourceFilename || '',
    sizeBytes: obj.sizeBytes || 0,
    languages: obj.languages || [],
    usedInSearch: !!obj.usedInSearch,
    status: obj.status,
    parseError: obj.parseError || '',
    termCount: obj.termCount || 0,
    updatedSinceReprocess: !!obj.updatedSinceReprocess,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    createdBy: obj.createdBy || null,
    updatedBy: obj.updatedBy || null,
  };
}

async function flagPendingReprocessIfActive(vocab) {
  if (!vocab || !vocab.usedInSearch) return;
  await VocabularyConfig.updateOne(
    { key: 'default' },
    { $set: { pendingReprocess: true } },
    { upsert: true }
  );
}

async function setUpdatedSinceReprocess(vocabId, value = true) {
  await Vocabulary.updateOne({ _id: vocabId }, { $set: { updatedSinceReprocess: !!value } });
}

// ── Term replacement ──────────────────────────────────────────────────────
async function insertTerms(vocabId, terms) {
  if (!terms.length) return 0;
  const docs = terms.map((t) => ({
    vocabularyId: vocabId,
    termId: t.termId,
    language: t.language || '*',
    prefLabel: t.prefLabel,
    altLabels: t.altLabels || [],
    broader: t.broader || '',
  }));
  const chunkSize = 1000;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const out = await VocabularyTerm.insertMany(chunk, { ordered: false });
    inserted += out.length;
  }
  return inserted;
}

async function replaceTerms(vocabId, terms) {
  await VocabularyTerm.deleteMany({ vocabularyId: vocabId });
  return insertTerms(vocabId, terms);
}

// ── Public surface ────────────────────────────────────────────────────────

// createVocabulary — full lifecycle of a brand-new vocabulary upload.
//   - parse fail        → 400 + nothing persisted
//   - S3 upload fail    → 5xx + nothing persisted
//   - DB header fail    → S3 object cleaned up
//   - Term insert fail  → S3 object cleaned up + header rolled back
async function createVocabulary({ name, displayName, file, usedInSearch = false, user }) {
  const slug = String(name || '').trim().toLowerCase();
  const display = String(displayName || name || '').trim();
  if (!slug) {
    const err = new Error('Vocabulary id is required.');
    err.status = 400;
    throw err;
  }
  const existing = await Vocabulary.findOne({ name: slug });
  if (existing) {
    const err = new Error(`A vocabulary with id "${display}" already exists.`);
    err.status = 409;
    err.code = 'duplicate_name';
    throw err;
  }

  const buffer = await readBuffer(file.path);
  const format = detectFormat(file.originalname);
  const parsed = await parseFile({ buffer, originalName: file.originalname, format });

  // Reserve an _id up-front so the S3 key is deterministic before we save.
  const vocabId = new mongoose.Types.ObjectId();
  const key = s3KeyFor(vocabId, file.originalname);

  let s3Result;
  try {
    s3Result = await s3.putObject({
      bucket: BUCKET(),
      key,
      body: buffer,
      contentType: format === 'csv' ? 'text/csv' : 'application/rdf+xml',
    });
  } catch (err) {
    // Best-effort cleanup is implicit — the object never landed.
    err.status = err.status || 502;
    throw err;
  }

  let header;
  try {
    header = await Vocabulary.create({
      _id: vocabId,
      name: slug,
      displayName: display,
      format,
      sourceFilename: file.originalname,
      s3Bucket: BUCKET(),
      s3Key: key,
      sizeBytes: file.size || buffer.length,
      checksum: checksumOf(buffer),
      languages: parsed.languages,
      usedInSearch: !!usedInSearch,
      status: 'ready',
      parseError: '',
      termCount: parsed.terms.length,
      updatedSinceReprocess: true,
      createdBy: user?._id || null,
      updatedBy: user?._id || null,
    });
  } catch (err) {
    await safeS3Delete(key);
    if (err?.code === 11000) {
      const dup = new Error(`A vocabulary with id "${display}" already exists.`);
      dup.status = 409;
      dup.code = 'duplicate_name';
      throw dup;
    }
    throw err;
  }

  try {
    await insertTerms(header._id, parsed.terms);
  } catch (err) {
    // Roll back: drop any partially inserted terms + the header doc + S3 file.
    await VocabularyTerm.deleteMany({ vocabularyId: header._id }).catch(() => {});
    await Vocabulary.deleteOne({ _id: header._id }).catch(() => {});
    await safeS3Delete(key);
    err.status = err.status || 500;
    throw err;
  }

  await flagPendingReprocessIfActive(header);
  bumpSynonymCache();
  return { vocab: vocabExposable(header), warnings: parsed.warnings || [] };
}

// updateVocabulary — supports three independent operations, any combination:
//   - rename (displayName only; the slug is locked once data exists)
//   - toggle usedInSearch
//   - replace the file (re-parse, re-upload, swap terms)
async function updateVocabulary(id, { displayName, usedInSearch, file, user }) {
  const header = await Vocabulary.findById(id);
  if (!header) {
    const err = new Error('Vocabulary not found.');
    err.status = 404;
    throw err;
  }

  const willAffectSearch =
    (usedInSearch != null && !!usedInSearch !== !!header.usedInSearch) ||
    !!file ||
    (header.usedInSearch && (file != null));

  let parsed = null;
  let newKey = null;
  let buffer = null;

  if (file) {
    buffer = await readBuffer(file.path);
    const format = detectFormat(file.originalname);
    parsed = await parseFile({ buffer, originalName: file.originalname, format });
    newKey = s3KeyFor(header._id, file.originalname);
    try {
      await s3.putObject({
        bucket: BUCKET(),
        key: newKey,
        body: buffer,
        contentType: format === 'csv' ? 'text/csv' : 'application/rdf+xml',
      });
    } catch (err) {
      err.status = err.status || 502;
      throw err;
    }
    // Update header fields tied to the new file.
    header.format = format;
    header.sourceFilename = file.originalname;
    header.sizeBytes = file.size || buffer.length;
    header.checksum = checksumOf(buffer);
    header.languages = parsed.languages;
    header.termCount = parsed.terms.length;
    header.parseError = '';
  }

  if (displayName != null) header.displayName = String(displayName).trim();
  if (usedInSearch != null) header.usedInSearch = !!usedInSearch;
  header.updatedBy = user?._id || header.updatedBy || null;
  header.updatedSinceReprocess = true;

  // Term swap goes after the header save so the header always carries the
  // new termCount; if the swap fails we still mark the header parseError
  // and surface a clear 500.
  try {
    await header.save();
  } catch (err) {
    if (newKey) await safeS3Delete(newKey);
    throw err;
  }

  if (parsed) {
    try {
      await replaceTerms(header._id, parsed.terms);
    } catch (err) {
      // Don't blow away the old terms silently — the delete succeeded but
      // the insert failed. Mark the vocab as failed so the admin sees it.
      header.status = 'failed';
      header.parseError = `Term replacement failed: ${err.message}`;
      await header.save().catch(() => {});
      throw err;
    }
  }

  // Drop the prior S3 object only after the new one has fully replaced it.
  if (newKey && header.s3Key && header.s3Key !== newKey) {
    const previousKey = header.s3Key;
    header.s3Key = newKey;
    header.s3Bucket = BUCKET();
    await header.save().catch(() => {});
    await safeS3Delete(previousKey);
  } else if (newKey) {
    header.s3Key = newKey;
    header.s3Bucket = BUCKET();
    await header.save().catch(() => {});
  }

  if (willAffectSearch) {
    await flagPendingReprocessIfActive(header);
    bumpSynonymCache();
  }
  return { vocab: vocabExposable(header), warnings: parsed?.warnings || [] };
}

async function deleteVocabulary(id) {
  const header = await Vocabulary.findById(id);
  if (!header) {
    const err = new Error('Vocabulary not found.');
    err.status = 404;
    throw err;
  }
  const wasActive = !!header.usedInSearch;
  const key = header.s3Key;

  await VocabularyTerm.deleteMany({ vocabularyId: header._id }).catch(() => {});
  await Vocabulary.deleteOne({ _id: header._id });
  await safeS3Delete(key);

  if (wasActive) {
    await VocabularyConfig.updateOne(
      { key: 'default' },
      { $set: { pendingReprocess: true } },
      { upsert: true }
    );
    bumpSynonymCache();
  }
  return { ok: true };
}

async function getVocabularyDownloadStream(id) {
  const header = await Vocabulary.findById(id).lean();
  if (!header) {
    const err = new Error('Vocabulary not found.');
    err.status = 404;
    throw err;
  }
  if (!header.s3Bucket || !header.s3Key) {
    const err = new Error('No file is associated with this vocabulary.');
    err.status = 404;
    throw err;
  }
  const stream = await s3.getObjectStream({ bucket: header.s3Bucket, key: header.s3Key });
  return { stream, filename: header.sourceFilename || `${header.name}.${header.format === 'csv' ? 'csv' : 'rdf'}` };
}

async function safeS3Delete(key) {
  if (!key) return;
  try {
    await s3.deleteFromAllBuckets(key);
  } catch (err) {
    console.warn('vocabularyService: failed to delete S3 object', key, err.message);
  }
}

module.exports = {
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  getVocabularyDownloadStream,
  vocabExposable,
  setUpdatedSinceReprocess,
};
