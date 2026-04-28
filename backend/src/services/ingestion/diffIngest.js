// Diff-based topic ingest.
//
// The classic ingest path created a brand-new Topic._id for every entry
// in every re-publish, which orphaned bookmarks/ratings/customRaw and
// forced a full Atlas Search re-index. diff-ingest swaps that for an
// in-place merge keyed by `stableId` (see stableIdentity.js), producing
// only INSERTs for net-new topics, UPDATEs for changed bodies, and
// DELETEs for topics that disappeared from the new zip — Atlas auto-sync
// then emits the same delta and nothing more.
//
// All mutations live behind a single function, `diffAndApplyTopics`, so
// the existing ingestion service has a clean seam to call. The function
// is intentionally side-effecty (DB writes) but never throws on a single
// topic failure — partial success is preserved and logged so an oddball
// topic can't unwind the whole publish.
//
//   Returns: {
//     added:   [Topic._id, …]   // newly created
//     updated: [Topic._id, …]   // contentHash changed, body re-saved
//     removed: [Topic._id, …]   // present in old, absent in new
//     kept:    [Topic._id, …]   // present in both, contentHash unchanged
//     errors:  [{ stableId, message, phase }],
//   }

const Topic = require('../../models/Topic');

// Field projection for the existing-topic lookup. We need just enough to
// run the diff (stableId, contentHash, hierarchy), and to re-emit the
// preserved fields on UPDATE so the existing _id round-trips.
const EXISTING_PROJECTION =
  '_id stableId contentHash hierarchy.order hierarchy.level metadata.customRaw';

// Insert / update / delete the topics under `documentId` to reflect the
// fresh `candidates` array. `publicationId` flows into provenance pointers
// so the drawer can show "introduced in V1, last touched in V3".
//
// Candidate shape (what ingestionService produces):
//   {
//     stableId,
//     parentStableId,    // null for root topics
//     title, slug,
//     content: { html, text },
//     hierarchy: { level, order },
//     metadata: { custom: Map|object, ... },
//     sourcePath,
//     originId, permalink, timeModified,    // Paligo-only, optional
//     contentHash,
//     media: [...],
//   }
async function diffAndApplyTopics({ documentId, candidates, publicationId }) {
  if (!documentId) {
    throw new Error('diffAndApplyTopics: documentId is required');
  }
  const errors = [];
  const out = { added: [], updated: [], removed: [], kept: [], errors };

  const safeCandidates = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!safeCandidates.length) {
    // No new topics — treat every existing topic as "removed" so the
    // caller can decide whether that's a publish failure.
    const existing = await Topic.find({ documentId })
      .select(EXISTING_PROJECTION)
      .lean();
    if (existing.length) {
      const removeIds = existing.map((t) => t._id);
      await Topic.deleteMany({ _id: { $in: removeIds } });
      out.removed = removeIds;
    }
    return out;
  }

  // Build the new-side index. Last-write-wins on stableId collisions
  // (shouldn't happen given the per-format derivation but cheap to
  // tolerate).
  const newByStable = new Map();
  for (const c of safeCandidates) {
    if (!c.stableId) {
      errors.push({ stableId: '', message: 'Candidate missing stableId', phase: 'index' });
      continue;
    }
    newByStable.set(c.stableId, c);
  }

  // Pull the old-side index. We deliberately scan every topic under the
  // document — small per-doc cardinality (typically < 5k) makes the
  // round-trip cheaper than a 1000-deep $in lookup.
  const existing = await Topic.find({ documentId })
    .select(EXISTING_PROJECTION)
    .lean();
  const oldByStable = new Map();
  const orphans = []; // legacy topics with no stableId — left untouched.
  for (const t of existing) {
    if (t.stableId) oldByStable.set(t.stableId, t);
    else orphans.push(t);
  }

  // ── Pass 1: INSERT + UPDATE + KEEP (no parent wiring yet) ──
  // We resolve hierarchy.parent in pass 2 once every topic has an _id.
  const stableToId = new Map(); // stableId -> Topic._id (string)
  for (const t of existing) {
    if (t.stableId) stableToId.set(t.stableId, t._id);
  }

  for (const candidate of safeCandidates) {
    if (!candidate.stableId) continue;
    const prior = oldByStable.get(candidate.stableId);

    try {
      if (!prior) {
        // INSERT — fresh topic. Caller already supplied a unique slug.
        const created = await Topic.create({
          documentId,
          title:      candidate.title,
          slug:       candidate.slug,
          sourcePath: candidate.sourcePath || '',
          originId:   candidate.originId || '',
          permalink:  candidate.permalink || '',
          timeModified: candidate.timeModified || null,
          content:    candidate.content || { html: '', text: '' },
          hierarchy: {
            level:    candidate.hierarchy?.level ?? 1,
            parent:   null,
            children: [],
            order:    candidate.hierarchy?.order ?? 0,
          },
          metadata: candidate.metadata || {},
          media:    candidate.media || [],
          stableId: candidate.stableId,
          contentHash: candidate.contentHash || '',
          firstSeenInPublication:   publicationId || null,
          lastUpdatedInPublication: publicationId || null,
        });
        out.added.push(created._id);
        stableToId.set(candidate.stableId, created._id);
      } else if (candidate.contentHash && candidate.contentHash === prior.contentHash) {
        // KEEP — bytes unchanged. Skip the write entirely so Atlas
        // Search doesn't see a no-op update event. Still bump the
        // lastUpdatedInPublication so the drawer chain is complete?
        // No — leave it untouched so the version chain correctly
        // shows the LAST publication that changed this topic.
        out.kept.push(prior._id);
      } else {
        // UPDATE — body / hierarchy diff. Preserve _id, prettyUrl,
        // viewCount, customRaw, originId (if not changing). We
        // intentionally DO NOT $set metadata.customRaw — the raw
        // snapshot is owned by the registry tail and survives across
        // versions until the admin explicitly clears it.
        const set = {
          title:      candidate.title,
          slug:       candidate.slug,
          sourcePath: candidate.sourcePath || '',
          'content.html': candidate.content?.html || '',
          'content.text': candidate.content?.text || '',
          'hierarchy.level': candidate.hierarchy?.level ?? 1,
          'hierarchy.order': candidate.hierarchy?.order ?? 0,
          'metadata.custom': customToObject(candidate.metadata?.custom),
          stableId:    candidate.stableId,
          contentHash: candidate.contentHash || '',
          lastUpdatedInPublication: publicationId || null,
        };
        // Optional metadata.{tags, language, author, product, version}
        // pass-through — only $set when supplied so we don't blow away
        // existing values.
        const optionalMetaKeys = ['tags', 'language', 'author', 'product', 'version', 'aiSummary'];
        for (const k of optionalMetaKeys) {
          if (candidate.metadata && Object.prototype.hasOwnProperty.call(candidate.metadata, k)) {
            set[`metadata.${k}`] = candidate.metadata[k];
          }
        }
        if (candidate.media) set.media = candidate.media;
        if (candidate.timeModified) set.timeModified = candidate.timeModified;
        if (candidate.originId) set.originId = candidate.originId;
        if (candidate.permalink) set.permalink = candidate.permalink;

        await Topic.updateOne({ _id: prior._id }, { $set: set, $unset: { 'hierarchy.children': '' } });
        out.updated.push(prior._id);
      }
    } catch (err) {
      errors.push({ stableId: candidate.stableId, message: err.message, phase: 'apply' });
    }
  }

  // ── Pass 2: parent / children wiring ──
  // Resolve parentStableId → ObjectId, then write hierarchy.parent in
  // one bulkWrite + reconstruct hierarchy.children from the parent
  // pointer (the $unset above guaranteed children starts empty for
  // updated rows).
  const parentOps = [];
  const childrenByParent = new Map();
  for (const candidate of safeCandidates) {
    const childId = stableToId.get(candidate.stableId);
    if (!childId) continue;
    const parentId = candidate.parentStableId
      ? stableToId.get(candidate.parentStableId) || null
      : null;
    parentOps.push({
      updateOne: {
        filter: { _id: childId },
        update: { $set: { 'hierarchy.parent': parentId } },
      },
    });
    if (parentId) {
      const key = String(parentId);
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(childId);
    }
  }
  if (parentOps.length) {
    try {
      await Topic.bulkWrite(parentOps, { ordered: false });
    } catch (err) {
      errors.push({ stableId: '', message: `parent-wire: ${err.message}`, phase: 'parent' });
    }
  }
  const childrenOps = [];
  for (const [parentId, children] of childrenByParent.entries()) {
    childrenOps.push({
      updateOne: {
        filter: { _id: parentId },
        update: { $set: { 'hierarchy.children': children } },
      },
    });
  }
  if (childrenOps.length) {
    try {
      await Topic.bulkWrite(childrenOps, { ordered: false });
    } catch (err) {
      errors.push({ stableId: '', message: `children-wire: ${err.message}`, phase: 'children' });
    }
  }

  // ── Pass 3: DELETE — anything in old that isn't in new ──
  // Orphan legacy topics (no stableId) are left as-is rather than
  // wiped, so a stableId-less corpus doesn't silently nuke itself the
  // first time a re-publish happens. They'll get stableIds the next
  // time their parent document is re-published from scratch.
  const removeIds = [];
  for (const [stableId, prior] of oldByStable.entries()) {
    if (!newByStable.has(stableId)) removeIds.push(prior._id);
  }
  if (removeIds.length) {
    try {
      await Topic.deleteMany({ _id: { $in: removeIds } });
      out.removed = removeIds;
    } catch (err) {
      errors.push({ stableId: '', message: `delete: ${err.message}`, phase: 'delete' });
    }
  }

  // Surface the "untouched legacy topics" count so the caller can warn
  // about the migration when it's the first re-publish of an old doc.
  out.legacyOrphans = orphans.length;

  return out;
}

// Mongoose Map / plain object → plain object suitable for $set.
function customToObject(custom) {
  if (!custom) return {};
  if (custom instanceof Map) {
    const out = {};
    for (const [k, v] of custom.entries()) out[k] = Array.isArray(v) ? v : [String(v)];
    return out;
  }
  return custom;
}

module.exports = {
  diffAndApplyTopics,
};
