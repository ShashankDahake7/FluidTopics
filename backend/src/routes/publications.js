const express = require('express');
const upload = require('../middleware/upload');
const { auth, requireRole } = require('../middleware/auth');
const publicationService = require('../services/publishing/publicationService');

const router = express.Router();

// All publishing endpoints require an authenticated admin/editor — same gate
// as /api/ingest. Superadmin is implicitly allowed via the role check.
const adminOrEditor = requireRole('admin', 'editor');

// POST /api/publications — upload a .zip into the raw bucket and persist a
// Publication row. Does NOT trigger extraction; the caller must POST to
// /:id/extract once the upload returns 201.
router.post('/', auth, adminOrEditor, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // We accept a few non-zip formats (single HTML, DOCX) to keep parity with
    // the existing ingest flow, but the extract worker only knows zip — so for
    // now reject everything else explicitly. Single-file ingest still goes
    // through /api/ingest/upload.
    const isZip = /\.zip$/i.test(req.file.originalname);
    if (!isZip) {
      return res.status(400).json({
        error: 'Only .zip uploads are supported via this endpoint. Use /api/ingest/upload for single-file ingest.',
      });
    }

    // Wire format: the FormData field is still called `source` for back-compat
    // with older clients, but the value is now the canonical `Source.sourceId`
    // string (e.g. "paligo"). The service resolves it to a real ObjectId; if
    // the caller is on the legacy free-form-label path we fall through to
    // `sourceLabel` so the column still renders something sensible.
    const sourceFromBody = (req.body?.source || '').trim();
    // Optional: ObjectId of a previously-published Publication this upload
    // should diff-merge into. Empty / omitted → fresh publish (creates a
    // new Document on ingest, current behaviour). The service validates
    // that the target exists and shares the same source so the dropdown
    // can't be abused to merge across unrelated documents.
    const replacesFromBody = (req.body?.replaces || '').trim();
    const pub = await publicationService.uploadPublication({
      file: req.file,
      userId: req.user?._id,
      sourceId: sourceFromBody,
      sourceLabel: req.body?.sourceLabel || '',
      replaces: replacesFromBody || null,
    });

    res.status(201).json({ publication: serialise(pub) });
  } catch (err) { next(err); }
});

// GET /api/publications/replaceable?source=<sourceId> — feeds the
// "Publish as new version of" dropdown in the upload modal. Optionally
// filtered by source so the dropdown only shows publications that
// already belong to the source the user is uploading under.
router.get('/replaceable', auth, adminOrEditor, async (req, res, next) => {
  try {
    const out = await publicationService.listReplaceablePublications({
      sourceId: (req.query.source || '').trim(),
    });
    res.json(out);
  } catch (err) { next(err); }
});

// POST /api/publications/:id/extract — spawns the extract worker thread and
// returns 202 immediately. The worker runs in the background, appending log
// rows and finally flipping `status` to `extracted` (or `failed`). The drawer
// polls /:id and /:id/logs to render progress.
router.post('/:id/extract', auth, adminOrEditor, async (req, res, next) => {
  try {
    const pub = await publicationService.extractPublication(req.params.id);
    res.status(202).json({ publication: serialise(pub) });
  } catch (err) { next(err); }
});

// POST /api/publications/:id/validate — same fire-and-forget contract as
// /:id/extract; returns 202 once the validate worker has been spawned.
router.post('/:id/validate', auth, adminOrEditor, async (req, res, next) => {
  try {
    const pub = await publicationService.validatePublication(req.params.id);
    res.status(202).json({ publication: serialise(pub) });
  } catch (err) { next(err); }
});

// GET /api/publications — paged list for the History table.
router.get('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const out = await publicationService.listPublications({
      search:  req.query.search   || '',
      status:  req.query.status   || '',
      source:  req.query.source   || '',
      from:    req.query.from     || '',
      to:      req.query.to       || '',
      page:    parseInt(req.query.page,  10) || 1,
      limit:   Math.min(200, parseInt(req.query.limit, 10) || 25),
      sortKey: req.query.sortKey  || 'createdAt',
      sortDir: req.query.sortDir  || 'desc',
    });
    res.json(out);
  } catch (err) { next(err); }
});

// GET /api/publications/:id — full detail for the drawer.
router.get('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    const pub = await publicationService.getPublication(req.params.id);
    if (!pub) return res.status(404).json({ error: 'Publication not found' });
    res.json({ publication: pub });
  } catch (err) { next(err); }
});

// GET /api/publications/:id/logs — paginated log entries.
router.get('/:id/logs', auth, adminOrEditor, async (req, res, next) => {
  try {
    const out = await publicationService.getLogs(req.params.id, {
      page:  parseInt(req.query.page, 10) || 1,
      limit: Math.min(500, parseInt(req.query.limit, 10) || 100),
      level: req.query.level || '',
      code:  req.query.code  || '',
      phase: req.query.phase || '',
    });
    res.json(out);
  } catch (err) { next(err); }
});

// GET /api/publications/:id/logs.txt — plain-text log dump for the
// "Download logs" button in the drawer.
router.get('/:id/logs.txt', auth, adminOrEditor, async (req, res, next) => {
  try {
    const text = await publicationService.streamLogsAsText(req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="publication-${req.params.id}-logs.txt"`);
    res.send(text);
  } catch (err) { next(err); }
});

// GET /api/publications/:id/archive — presigned URL for the original zip
// ("Download archive" button).
router.get('/:id/archive', auth, adminOrEditor, async (req, res, next) => {
  try {
    const url = await publicationService.presignArchive(req.params.id);
    if (!url) return res.status(404).json({ error: 'No archive available' });
    res.json({ url });
  } catch (err) { next(err); }
});

// GET /api/publications/:id/files?path=relative/path/in/zip
// → presigned URL for one extracted file (used when rendering individual
// topics, attachments, or downloading a single asset).
router.get('/:id/files', auth, adminOrEditor, async (req, res, next) => {
  try {
    const rel = req.query.path;
    if (!rel) return res.status(400).json({ error: 'Missing ?path=' });
    const url = await publicationService.presignFile(req.params.id, rel);
    if (!url) return res.status(404).json({ error: 'Publication not found' });
    res.json({ url });
  } catch (err) { next(err); }
});

// DELETE /api/publications/clean — wipes all non-running publications.
router.post('/clean', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { deletedCount } = await publicationService.cleanHistory();
    res.json({ message: `Cleaned ${deletedCount} publications`, deletedCount });
  } catch (err) { next(err); }
});

// DELETE /api/publications/:id — wipes the raw zip, the extracted prefix,
// and all log rows. Restricted to admins.
router.delete('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const ok = await publicationService.deletePublication(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Publication not found' });
    res.json({ message: 'Publication deleted' });
  } catch (err) { next(err); }
});

// Trim down internal fields before returning to the client so the frontend
// doesn't have to know about S3 keys / etags unless it asks for /:id.
function serialise(pub) {
  if (!pub) return null;
  if (typeof pub.toObject === 'function') pub = pub.toObject();
  const uploadedBy = pub.uploadedBy && typeof pub.uploadedBy === 'object'
    ? { id: String(pub.uploadedBy._id), name: pub.uploadedBy.name, email: pub.uploadedBy.email }
    : null;
  // Mirror the publicationService.serialise contract — flat sourceId
  // (canonical string) + sourceRefId (Mongo _id) so the UI doesn't have to
  // case-split on the populated/raw shape.
  let sourceCanonicalId = null;
  let sourceRefId = null;
  if (pub.sourceId && typeof pub.sourceId === 'object' && pub.sourceId.sourceId) {
    sourceCanonicalId = pub.sourceId.sourceId;
    sourceRefId = String(pub.sourceId._id);
  } else if (pub.sourceId) {
    sourceRefId = String(pub.sourceId);
  }
  return {
    id: String(pub._id || pub.id),
    name: pub.name,
    originalFilename: pub.originalFilename,
    sizeBytes: pub.sizeBytes,
    sourceId: sourceCanonicalId,
    sourceRefId,
    sourceLabel: pub.sourceLabel,
    status: pub.status,
    documentId: pub.documentId ? String(pub.documentId) : null,
    counts: pub.counts || { info: 0, warn: 0, error: 0 },
    extractedFileCount: pub.extracted?.fileCount || 0,
    validation: pub.validation || null,
    timings: pub.timings || null,
    contentHash:           pub.contentHash || '',
    dedupeMode:            pub.dedupeMode || 'fresh',
    replacesPublicationId: pub.replaces ? String(pub.replaces) : null,
    uploadedBy,
    createdAt: pub.createdAt,
    updatedAt: pub.updatedAt,
  };
}

module.exports = router;
