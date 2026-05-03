const express = require('express');
const mongoose = require('mongoose');

const { auth, requireTierOrAdminRoles } = require('../middleware/auth');
const { CONTENT_PIPELINE: AR_CONTENT } = require('../constants/adminRoles');

const adminOrEditor = requireTierOrAdminRoles(['admin', 'editor'], AR_CONTENT);
const adminOnlyContent = requireTierOrAdminRoles(['admin'], AR_CONTENT);
const Source = require('../models/Source');
const Publication = require('../models/Publication');
const publicationService = require('../services/publishing/publicationService');
const { logConfigChange, authorFromRequest } = require('../services/configAudit');
const { snapshotSourcesFull } = require('../services/configHistorySnapshots');

const router = express.Router();

// Trim down a Source mongoose doc / lean object to the wire shape consumed by
// the Sources admin page. `publicationCount` is left to the caller because
// it's an aggregate the list endpoint computes in bulk.
function serialise(source, { publicationCount = null } = {}) {
  if (!source) return null;
  if (typeof source.toObject === 'function') source = source.toObject();
  const createdBy = source.createdBy && typeof source.createdBy === 'object'
    ? { id: String(source.createdBy._id), name: source.createdBy.name, email: source.createdBy.email }
    : (source.createdBy ? { id: String(source.createdBy) } : null);
  return {
    id: String(source._id),
    sourceId: source.sourceId,
    name: source.name,
    type: source.type,
    category: source.category || '',
    description: source.description || '',
    installationStatus: source.installationStatus || 'installed',
    permissions: {
      mode: source.permissions?.mode || 'admins',
      userIds: (source.permissions?.userIds || []).map(String),
      apiKeyHints: source.permissions?.apiKeyHints || [],
    },
    publicationCount: publicationCount == null ? undefined : publicationCount,
    createdBy,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

// GET /api/sources/types — exposes the static type list to the New-source
// wizard so the dropdown stays a single source of truth.
router.get('/types', auth, adminOrEditor, (req, res) => {
  res.json({ types: Source.SOURCE_TYPES, permissionModes: Source.PERMISSION_MODES });
});

// GET /api/sources — list every configured source, augmented with the count
// of Publications that reference it. The page is small enough (typically <50)
// that we don't bother paginating.
router.get('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const sources = await Source.find({}).sort({ createdAt: -1 }).lean();
    const ids = sources.map((s) => s._id);

    // One aggregation for the whole page — `publicationCount` is the number
    // of Publications whose `sourceId` ref points at this Source.
    const counts = await Publication.aggregate([
      { $match: { sourceId: { $in: ids } } },
      { $group: { _id: '$sourceId', n: { $sum: 1 } } },
    ]);
    const countByRef = new Map(counts.map((c) => [String(c._id), c.n]));

    res.json({
      items: sources.map((s) =>
        serialise(s, { publicationCount: countByRef.get(String(s._id)) || 0 })
      ),
      total: sources.length,
    });
  } catch (err) { next(err); }
});

// POST /api/sources — create a new source. Mirrors the docs' uniqueness
// constraints on both `sourceId` and `name`.
router.post('/', auth, adminOrEditor, async (req, res, next) => {
  try {
    const before = await snapshotSourcesFull();
    const { sourceId, name, type, category, description, permissions } = req.body || {};

    if (!sourceId || !String(sourceId).trim()) {
      return res.status(400).json({ error: 'sourceId is required' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!type || !Source.SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ error: 'type is required and must be a known source type' });
    }

    const trimmedId = String(sourceId).trim();
    const trimmedName = String(name).trim();

    // Pre-flight uniqueness checks so we can return a friendlier error than
    // Mongo's E11000 dump. The unique index is still the source of truth.
    const dupId   = await Source.findOne({ sourceId: trimmedId }).lean();
    if (dupId)   return res.status(409).json({ error: 'A source with this ID already exists', field: 'sourceId' });
    const dupName = await Source.findOne({ name: trimmedName }).lean();
    if (dupName) return res.status(409).json({ error: 'A source with this name already exists', field: 'name' });

    const created = await Source.create({
      sourceId: trimmedId,
      name: trimmedName,
      type,
      category: category || '',
      description: description || '',
      permissions: normalisePermissions(permissions),
      installationStatus: 'installed',
      createdBy: req.user?._id,
    });

    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });

    res.status(201).json({ source: serialise(created, { publicationCount: 0 }) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate sourceId or name' });
    }
    next(err);
  }
});

// GET /api/sources/:id — fetch one. `:id` accepts either the Mongo _id or the
// canonical sourceId string so callers can deep-link by whichever they have.
router.get('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    const source = await findByEither(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const publicationCount = await Publication.countDocuments({ sourceId: source._id });
    res.json({ source: serialise(source, { publicationCount }) });
  } catch (err) { next(err); }
});

// PATCH /api/sources/:id — name/category/description/permissions only.
// `sourceId` and `type` are deliberately immutable post-create, mirroring the
// Fluid Topics docs ("Once set, [the source ID] cannot be modified").
router.patch('/:id', auth, adminOrEditor, async (req, res, next) => {
  try {
    const source = await findByEither(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const before = await snapshotSourcesFull();
    const { name, category, description, permissions } = req.body || {};
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
      if (trimmed !== source.name) {
        const dup = await Source.findOne({ _id: { $ne: source._id }, name: trimmed }).lean();
        if (dup) return res.status(409).json({ error: 'A source with this name already exists', field: 'name' });
        source.name = trimmed;
      }
    }
    if (typeof category    === 'string') source.category    = category;
    if (typeof description === 'string') source.description = description;
    if (permissions && typeof permissions === 'object') {
      source.permissions = normalisePermissions(permissions);
    }

    await source.save();

    // Keep the denormalised label on Publications consistent with the new
    // Source.name — otherwise the publishing history table would still show
    // the old label until the row gets re-uploaded.
    if (typeof name === 'string') {
      await Publication.updateMany(
        { sourceId: source._id },
        { $set: { sourceLabel: source.name } }
      );
    }

    const publicationCount = await Publication.countDocuments({ sourceId: source._id });
    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ source: serialise(source, { publicationCount }) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate name' });
    }
    next(err);
  }
});

// POST /api/sources/:id/clean — delete every Publication attributed to this
// Source (including its raw zip, extracted prefix, and rendered Document/
// Topic graph). The Source row itself stays — matching the docs' "Cleaning a
// source does not delete the source or cancel queued processing jobs."
router.post('/:id/clean', auth, adminOrEditor, async (req, res, next) => {
  try {
    const source = await findByEither(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const pubs = await Publication.find({ sourceId: source._id }, { _id: 1 }).lean();
    let cleaned = 0;
    let failed = 0;
    for (const pub of pubs) {
      try {
        const ok = await publicationService.deletePublication(pub._id);
        if (ok) cleaned += 1;
      } catch (err) {
        failed += 1;
        console.error(`sources/clean: failed to delete publication ${pub._id}:`, err.message);
      }
    }

    res.json({
      message: `Cleaned ${cleaned} publication(s)${failed ? ` (${failed} failed)` : ''}`,
      cleaned,
      failed,
    });
  } catch (err) { next(err); }
});

// DELETE /api/sources/:id — refuse with 409 if any Publication still points
// at this source. The docs phrase this as a two-step (Clean, then Delete) to
// prevent accidental data loss; we preserve that by forcing the user through
// /clean first when there are linked publications.
router.delete('/:id', auth, adminOnlyContent, async (req, res, next) => {
  try {
    const source = await findByEither(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const before = await snapshotSourcesFull();
    const linked = await Publication.countDocuments({ sourceId: source._id });
    if (linked > 0) {
      return res.status(409).json({
        error: `Cannot delete source: ${linked} publication(s) still attributed to it. Clean the source first.`,
        linkedPublications: linked,
      });
    }

    await Source.deleteOne({ _id: source._id });
    const after = await snapshotSourcesFull();
    await logConfigChange({
      category: 'Sources',
      ...authorFromRequest(req),
      before,
      after,
    });
    res.json({ message: 'Source deleted' });
  } catch (err) { next(err); }
});

// Resolve `:id` to a Source doc by either Mongo _id or canonical sourceId.
async function findByEither(idOrSourceId) {
  if (mongoose.isValidObjectId(idOrSourceId)) {
    const byId = await Source.findById(idOrSourceId);
    if (byId) return byId;
  }
  return Source.findOne({ sourceId: String(idOrSourceId) });
}

// Coerce whatever the wizard sent (which can be sloppy on the frontend) into
// a permissions subdoc that round-trips cleanly through the schema.
function normalisePermissions(p) {
  if (!p || typeof p !== 'object') return { mode: 'admins', userIds: [], apiKeyHints: [] };
  const allowedModes = Source.PERMISSION_MODES;
  const mode = allowedModes.includes(p.mode) ? p.mode : 'admins';
  const userIds = Array.isArray(p.userIds)
    ? p.userIds.filter((id) => mongoose.isValidObjectId(id))
    : [];
  // apiKeyHints: free-form strings (the user typed them in a comma-separated
  // input). Drop empties + whitespace.
  let apiKeyHints = [];
  if (Array.isArray(p.apiKeyHints)) {
    apiKeyHints = p.apiKeyHints.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof p.apiKeyHints === 'string') {
    apiKeyHints = p.apiKeyHints.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return { mode, userIds, apiKeyHints };
}

module.exports = router;
