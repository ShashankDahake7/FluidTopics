const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const Document = require('../../models/Document');
const Topic = require('../../models/Topic');
const config = require('../../config/env');
const { parseHTML } = require('./parsers/htmlParser');
const { parseMarkdown } = require('./parsers/markdownParser');
const { parseDOCX } = require('./parsers/docxParser');
const { parseXML } = require('./parsers/xmlParser');
const { handleZip } = require('./zipHandler');
const { transformContent } = require('../transformation/transformationEngine');
const { detectFormat } = require('../../utils/helpers');
const { detectPaligoRoot, parsePaligoZip } = require('./paligoParser');
const {
  upsertMetadataRegistry,
  snapshotCustomRawForDocument,
  reprojectTopicsForDocument,
} = require('../metadata/registryService');
const { regenerateForDocument: regeneratePrettyUrlsForDocument } = require('../prettyUrl/prettyUrlService');
const { diffAndApplyTopics } = require('./diffIngest');
const { computeStableId, computeTopicContentHash } = require('./stableIdentity');

/**
 * Main ingestion orchestrator
 * Handles the full pipeline: upload → parse → transform → store → index
 */
const ingestFile = async (file, userId = null) => {
  const format = detectFormat(file.originalname);
  if (!format) {
    throw new Error(`Unsupported file format: ${file.originalname}`);
  }

  // Create document record
  const doc = await Document.create({
    title: path.basename(file.originalname, path.extname(file.originalname)),
    sourceFormat: format,
    originalFilename: file.originalname,
    fileSize: file.size,
    status: 'processing',
    uploadedBy: userId,
    ingestionLog: [{ message: `Ingestion started for ${file.originalname}`, level: 'info' }],
  });

  try {
    let allTopicIds = [];

    if (format === 'zip') {
      // Handle ZIP — process each file inside
      const { files, images } = handleZip(file.path);
      doc.ingestionLog.push({
        message: `ZIP extracted: ${files.length} content files, ${images.length} images`,
        level: 'info',
      });

      // Save images to disk and build zipPath → served URL map
      const imageSrcMap = saveZipImages(images);

      // Check if this is a Paligo HTML5 Help Center publication
      const paligoRoot = detectPaligoRoot(files);

      if (paligoRoot) {
        doc.ingestionLog.push({ message: `Paligo format detected (root: ${paligoRoot})`, level: 'info' });

        const { topicDataList, tocTree, publication, langPrefix } = await parsePaligoZip(files, images, paligoRoot);
        doc.ingestionLog.push({ message: `Paligo TOC parsed: ${topicDataList.length} topics`, level: 'info' });

        allTopicIds = await savePaligoTopics(topicDataList, doc._id, imageSrcMap, langPrefix);

        doc.isPaligoFormat = true;
        doc.tocTree       = tocTree;
        doc.publication   = publication;

        // Use publication title if available
        if (publication.portalTitle) doc.title = publication.portalTitle;
        // Do not set doc.metadata.author to companyName — that is not the content author
        // ("Written by" uses per-topic metadata.author from HTML / index-en.html).

      } else {
        // Generic ZIP — use existing pipeline
        const fileTopicResults = [];
        for (const zipFile of files) {
          // Skip binary files (pdf, pptx, etc.) — they are recognised by
          // zipHandler for manifest counting but have no parseable topic
          // content. Attempting parseByFormat on them would throw.
          if (zipFile.isBinary || zipFile.format === 'binary') continue;

          const parsed = await parseByFormat(zipFile.format, zipFile.content, zipFile.filename);
          const transformed = await transformContent(parsed, zipFile.filename, zipFile.path);
          const topicIds = await saveTopics(transformed, doc._id);
          fileTopicResults.push({ filePath: zipFile.path, topicIds });
          allTopicIds.push(...topicIds);
        }
        await rewriteZipContent(fileTopicResults, imageSrcMap);
      }
    } else {
      // Single file
      const content =
        format === 'docx' ? file.path : fs.readFileSync(file.path, 'utf-8');
      const parsed = await parseByFormat(format, content, file.originalname);
      const transformed = await transformContent(parsed, file.originalname);
      allTopicIds = await saveTopics(transformed, doc._id);

      // Update document metadata from parsed content
      doc.metadata = {
        author: transformed.metadata.author || '',
        tags: transformed.metadata.keywords || [],
        description: transformed.metadata.description || '',
        product: transformed.metadata.product || '',
      };
    }

    // Update document. Atlas Search auto-syncs from the topics collection,
    // so no explicit indexing step is needed here.
    doc.topicIds = allTopicIds;
    doc.status = 'completed';
    doc.ingestionLog.push({
      message: `Ingestion completed: ${allTopicIds.length} topics created`,
      level: 'info',
    });
    await doc.save();

    // Metadata configuration tail. Two best-effort steps:
    //   1. Discover any new custom metadata keys + sample values into the
    //      MetadataKey registry so the admin page lists them.
    //   2. Re-project metadata.indexedValues / metadata.dateValues on the
    //      topics we just saved using the *current* registry, so newly
    //      ingested content respects existing toggles without the admin
    //      having to click "Save and reprocess".
    // Both wrapped — failure here must not fail the whole ingestion.
    try {
      await upsertMetadataRegistry(allTopicIds);
    } catch (err) {
      doc.ingestionLog.push({
        message: `Metadata registry upsert warning: ${err.message}`,
        level: 'warn',
      });
    }
    // Snapshot the freshly-ingested raw custom metadata BEFORE the
    // Enrich-and-Clean rule engine fires inside reprojectTopicsForDocument.
    // The corpus reprocess worker depends on this snapshot to re-derive
    // metadata.custom from a clean baseline whenever a rule is added,
    // edited, or deleted. Failure here just means we lose the snapshot
    // for these topics; reprocess will fall back to the (rule-mutated)
    // current value.
    try {
      await snapshotCustomRawForDocument(doc._id);
    } catch (err) {
      doc.ingestionLog.push({
        message: `Metadata raw snapshot warning: ${err.message}`,
        level: 'warn',
      });
    }
    try {
      await reprojectTopicsForDocument(doc._id);
    } catch (err) {
      doc.ingestionLog.push({
        message: `Metadata reprojection warning: ${err.message}`,
        level: 'warn',
      });
    }
    // Pretty URL generation tail. Renders the document + every topic
    // against the currently *active* template set so freshly ingested
    // content is reachable through whichever pretty URL the admin has
    // configured. Fails open: if no template matches, prettyUrl stays
    // empty and the read-side falls back to /dashboard/docs/<id>.
    try {
      const result = await regeneratePrettyUrlsForDocument(doc._id);
      if (result?.documentUrl) {
        doc.ingestionLog.push({
          message: `Pretty URL generated: ${result.documentUrl} (+${result.topicUrlCount} topic URLs)`,
          level: 'info',
        });
      }
    } catch (err) {
      doc.ingestionLog.push({
        message: `Pretty URL generation warning: ${err.message}`,
        level: 'warn',
      });
    }
    try { await doc.save(); } catch (_) { /* ignore — log only */ }

    // Cleanup uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      /* ignore cleanup errors */
    }

    return doc;
  } catch (error) {
    doc.status = 'failed';
    doc.ingestionLog.push({ message: `Error: ${error.message}`, level: 'error' });
    await doc.save();
    throw error;
  }
};

/**
 * Save Paligo topics from parsed topicDataList.
 * Uses parentIndex/children from the TOC (not heading levels).
 */
const savePaligoTopics = async (topicDataList, documentId, imageSrcMap, langPrefix = '') => {
  const topicIds   = [];
  const savedTopics = [];

  // Use a slug generator that incorporates originId to ensure uniqueness
  const usedSlugs = new Set();
  const makeSlug = (title, originId, idx) => {
    const base = (title || 'topic')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
    const suffix = originId ? originId.slice(-8) : String(idx);
    let slug = `${base}-${suffix}`;
    let n = 0;
    while (usedSlugs.has(slug)) slug = `${base}-${suffix}-${++n}`;
    usedSlugs.add(slug);
    return slug;
  };

  // First pass: create all topics
  for (let i = 0; i < topicDataList.length; i++) {
    const td = topicDataList[i];
    const topic = await Topic.create({
      documentId,
      title:      td.title,
      slug:       makeSlug(td.title, td.originId, i),
      originId:   td.originId || '',
      permalink:  td.permalink || '',
      timeModified: td.timeModified || null,
      sourcePath: td.sourcePath || '',
      content:    td.content,
      hierarchy: {
        level:    td.topicLevel || 1,
        parent:   null,
        children: [],
        order:    td.order,
      },
      metadata: { language: 'en', author: td.author || '' },
    });
    topicIds.push(topic._id);
    savedTopics.push(topic);
  }

  // Second pass: wire up parent-child references
  for (let i = 0; i < topicDataList.length; i++) {
    const td = topicDataList[i];
    if (td.parentIndex !== null && td.parentIndex !== undefined && savedTopics[td.parentIndex]) {
      savedTopics[i].hierarchy.parent = savedTopics[td.parentIndex]._id;
      await savedTopics[i].save();

      savedTopics[td.parentIndex].hierarchy.children.push(savedTopics[i]._id);
      await savedTopics[td.parentIndex].save();
    }
  }

  // Third pass: rewrite image sources using imageSrcMap
  const posix = require('path').posix;
  for (let i = 0; i < savedTopics.length; i++) {
    const topic    = savedTopics[i];
    const permalink = topicDataList[i].permalink || '';
    if (!topic.content.html || !Object.keys(imageSrcMap).length) continue;

    const $ = require('cheerio').load(topic.content.html);
    let modified = false;
    const sourceDir = posix.dirname(permalink);

    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src || /^(https?:|data:|\/|#)/.test(src)) return;
      // Resolve relative to the full ZIP path (langPrefix + topic's directory)
      const resolved = posix.normalize(posix.join(langPrefix, sourceDir, src));
      const newSrc = imageSrcMap[resolved];
      if (newSrc) { $(el).attr('src', newSrc); modified = true; }
    });

    if (modified) {
      topic.content.html = $('body').html() || topic.content.html;
      await topic.save();
    }
  }

  // Fourth pass: rewrite internal <a href> links to /portal/docs/{topicId}
  const permalinkToTopicId = {};
  for (let i = 0; i < topicDataList.length; i++) {
    if (topicDataList[i].permalink) permalinkToTopicId[topicDataList[i].permalink] = savedTopics[i]._id;
  }

  for (let i = 0; i < savedTopics.length; i++) {
    const topic     = savedTopics[i];
    const permalink = topicDataList[i].permalink || '';
    if (!topic.content.html) continue;

    const $ = require('cheerio').load(topic.content.html);
    let modified = false;
    const dirParts = permalink.split('/').slice(0, -1);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || /^(https?:|\/|#|mailto:|tel:)/.test(href)) return;

      const [filePart, anchor] = href.split('#');
      if (!filePart) return;

      const resolved = [...dirParts, ...filePart.split('/')]
        .reduce((acc, p) => {
          if (p === '..') return acc.slice(0, -1);
          if (p && p !== '.') return [...acc, p];
          return acc;
        }, [])
        .join('/');

      const targetId = permalinkToTopicId[resolved];
      if (targetId) {
        $(el).attr('href', anchor ? `/portal/docs/${targetId}#${anchor}` : `/portal/docs/${targetId}`);
        modified = true;
      }
    });

    if (modified) {
      topic.content.html = $('body').html() || topic.content.html;
      await topic.save();
    }
  }

  return topicIds;
};

/**
 * Parse content by format
 */
const parseByFormat = async (format, content, filename) => {
  switch (format) {
    case 'html':
      return parseHTML(content, filename);
    case 'markdown':
      return parseMarkdown(content, filename);
    case 'docx':
      return await parseDOCX(content, filename);
    case 'xml':
      return await parseXML(content, filename);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
};

/**
 * Save transformed topics to MongoDB
 */
const saveTopics = async (transformed, documentId) => {
  const topicIds = [];
  const savedTopics = [];

  for (const topicData of transformed.topics) {
    const topic = await Topic.create({
      documentId,
      title: topicData.title,
      slug: topicData.slug,
      sourcePath: topicData.sourcePath || '',
      content: topicData.content,
      hierarchy: {
        level: topicData.hierarchy.level,
        parent: null, // Will be resolved after all topics saved
        children: [],
        order: topicData.hierarchy.order,
      },
      metadata: topicData.metadata,
      media: topicData.media || [],
    });

    topicIds.push(topic._id);
    savedTopics.push({ topic, originalData: topicData });
  }

  // Resolve parent-child references
  for (let i = 0; i < savedTopics.length; i++) {
    const { topic, originalData } = savedTopics[i];
    const parentIdx = originalData.hierarchy.parent;

    if (parentIdx !== null && parentIdx !== undefined && savedTopics[parentIdx]) {
      topic.hierarchy.parent = savedTopics[parentIdx].topic._id;
      await topic.save();

      // Add child reference to parent
      const parentTopic = savedTopics[parentIdx].topic;
      parentTopic.hierarchy.children.push(topic._id);
      await parentTopic.save();
    }
  }

  return topicIds;
};

/**
 * Save image files extracted from a ZIP to uploads/media/ on disk.
 * Returns a map of { zipPath: '/uploads/media/filename.ext' }.
 */
const saveZipImages = (images) => {
  const mediaDir = path.resolve(config.upload.dir, 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  const srcMap = {};
  for (const img of images) {
    const hash = crypto.createHash('md5').update(img.content).digest('hex');
    const ext = img.filename.toLowerCase().split('.').pop();
    const savedName = `${hash}.${ext}`;
    const savedPath = path.join(mediaDir, savedName);
    if (!fs.existsSync(savedPath)) {
      fs.writeFileSync(savedPath, img.content);
    }
    srcMap[img.zipPath] = `/uploads/media/${savedName}`;
  }
  return srcMap;
};

/**
 * After all ZIP files are ingested, rewrite relative <a href> and <img src>
 * in topic HTML so they point to served routes instead of raw ZIP paths.
 */
const rewriteZipContent = async (fileTopicResults, imageSrcMap) => {
  const posix = path.posix;

  // Map each file path to the ID of the first topic extracted from that file
  const pathToTopicId = {};
  for (const { filePath, topicIds } of fileTopicResults) {
    if (topicIds.length > 0) {
      pathToTopicId[filePath] = topicIds[0];
    }
  }

  const allIds = fileTopicResults.flatMap((r) => r.topicIds);
  const topics = await Topic.find({ _id: { $in: allIds }, sourcePath: { $ne: '' } });

  for (const topic of topics) {
    if (!topic.content.html) continue;

    const $ = cheerio.load(topic.content.html);
    let modified = false;
    const sourceDir = posix.dirname(topic.sourcePath);

    // Rewrite internal links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || /^(https?:|\/|#|mailto:)/.test(href)) return;

      const [filePart] = href.split(/[?#]/);
      if (!filePart) return;

      const resolved = posix.normalize(posix.join(sourceDir, filePart));
      const targetId = pathToTopicId[resolved];
      if (targetId) {
        $(el).attr('href', `/topics/${targetId}`);
        modified = true;
      }
    });

    // Rewrite image sources
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src || /^(https?:|data:|\/|#)/.test(src)) return;

      const resolved = posix.normalize(posix.join(sourceDir, src));
      const newSrc = imageSrcMap[resolved];
      if (newSrc) {
        $(el).attr('src', newSrc);
        modified = true;
      }
    });

    if (modified) {
      topic.content.html = $('body').html() || topic.content.html;
      await topic.save();
    }
  }
};

// ── Diff-aware ingest path ────────────────────────────────────────────────
//
// `ingestZipForTarget` is the entry point used by the publication
// pipeline (publishing/publicationService.js → ingestValidatedPublication).
// Unlike legacy `ingestFile`, it:
//
//   1. Resolves an existing target Document (if `opts.targetDocumentId`
//      is set) instead of always creating a new one. This is what makes
//      "Publish as new version of X" preserve Document._id, prettyUrl,
//      and the bookmarks/ratings/customRaw graph keyed off Topic._id.
//
//   2. Parses the zip into pure candidate objects (no DB writes), then
//      hands the entire batch to diffAndApplyTopics for an
//      INSERT/UPDATE/KEEP/DELETE merge. Atlas Search auto-sync emits
//      only the deltas — a single-topic edit re-indexes one topic, not
//      the whole document.
//
//   3. Records provenance (stableId, contentHash, firstSeen/lastUpdated)
//      so the drawer's "Version chain" UX has full per-topic history.
//
// `opts`:
//   - targetDocumentId: ObjectId | null   (null → create new doc)
//   - publicationId:    ObjectId | null   (provenance pointer, optional)
//
// Returns: the (possibly newly-created) Document plus a diffSummary the
// caller can persist into Document.versionHistory + the publication log.
async function ingestZipForTarget(file, userId = null, opts = {}) {
  const { targetDocumentId = null, publicationId = null } = opts;

  const format = detectFormat(file.originalname);
  if (!format || format !== 'zip') {
    throw new Error(`ingestZipForTarget only handles zip uploads (got: ${format || 'unknown'})`);
  }

  // Resolve / create the target Document. We do this BEFORE parsing so
  // failures here surface to the caller without burning any parse work.
  let doc;
  if (targetDocumentId) {
    doc = await Document.findById(targetDocumentId);
    if (!doc) {
      throw new Error(`ingestZipForTarget: target document ${targetDocumentId} not found`);
    }
    doc.ingestionLog.push({
      message: `Re-ingest started for ${file.originalname} (publication ${publicationId || 'n/a'})`,
      level: 'info',
    });
    doc.status = 'processing';
    await doc.save();
  } else {
    doc = await Document.create({
      title: path.basename(file.originalname, path.extname(file.originalname)),
      sourceFormat: 'zip',
      originalFilename: file.originalname,
      fileSize: file.size,
      status: 'processing',
      uploadedBy: userId,
      ingestionLog: [{ message: `Ingestion started for ${file.originalname}`, level: 'info' }],
    });
  }

  let diffSummary = { added: [], updated: [], removed: [], kept: [], errors: [] };
  try {
    // Parse → in-memory candidates.
    const parsed = await parseZipToCandidates(file, doc);
    doc.ingestionLog.push({
      message: `Parsed ${parsed.candidates.length} topic candidates from ${file.originalname}`,
      level: 'info',
    });

    // Apply parser-derived doc-level metadata (Paligo carries portalTitle,
    // tocTree, etc.). For an existing target, we only overwrite when the
    // parser actually produced a non-empty value so we don't blank out
    // user edits between versions.
    if (parsed.docMeta) {
      if (parsed.docMeta.title) doc.title = parsed.docMeta.title;
      if (parsed.docMeta.isPaligoFormat !== undefined) doc.isPaligoFormat = parsed.docMeta.isPaligoFormat;
      if (parsed.docMeta.tocTree) doc.tocTree = parsed.docMeta.tocTree;
      if (parsed.docMeta.publication) doc.publication = parsed.docMeta.publication;
      if (parsed.docMeta.metadata) {
        // Generic ZIP path returns metadata for the doc — preserve
        // existing fields when the parser didn't supply replacements.
        const next = parsed.docMeta.metadata;
        doc.metadata = {
          author:      next.author      ?? doc.metadata?.author      ?? '',
          tags:        next.tags        ?? doc.metadata?.tags        ?? [],
          description: next.description ?? doc.metadata?.description ?? '',
          product:     next.product     ?? doc.metadata?.product     ?? '',
        };
      }
    }

    // Diff-merge into the existing topic graph.
    diffSummary = await diffAndApplyTopics({
      documentId: doc._id,
      candidates: parsed.candidates,
      publicationId,
    });

    // Refresh the topicIds list to reflect what's actually on disk after
    // INSERT/UPDATE/DELETE. Source of truth is Topic.documentId.
    const allTopicIds = await Topic.find({ documentId: doc._id }).distinct('_id');
    doc.topicIds = allTopicIds;
    doc.status = 'completed';
    doc.ingestionLog.push({
      message: `Diff ingest: +${diffSummary.added.length} added, ~${diffSummary.updated.length} updated, -${diffSummary.removed.length} removed, =${diffSummary.kept.length} kept`,
      level: 'info',
    });
    await doc.save();

    // Post-pass: rewrite cross-topic <a href> links + image srcs in the
    // freshly-created/updated topics so they point at the actual
    // Topic._ids that diff-ingest assigned. KEEP topics already carry
    // the correct rewritten html from a prior publication (and their
    // link targets either survived as the same _id or were
    // INSERT/DELETED — which the rewriter on touched topics handles).
    const touchedIds = [...diffSummary.added, ...diffSummary.updated];
    if (touchedIds.length && parsed.linkRewriter) {
      try {
        await parsed.linkRewriter(touchedIds);
      } catch (err) {
        doc.ingestionLog.push({
          message: `Link rewrite warning: ${err.message}`,
          level: 'warn',
        });
      }
    }

    // Tail steps — registry / customRaw / projection / pretty URL.
    // Scoped to touched topics where the helper supports it; the
    // others operate per-document (still cheap because the underlying
    // queries are indexed on documentId).
    if (touchedIds.length) {
      try {
        await upsertMetadataRegistry(touchedIds);
      } catch (err) {
        doc.ingestionLog.push({ message: `Metadata registry upsert warning: ${err.message}`, level: 'warn' });
      }
    }
    try {
      // Idempotent — only sets customRaw on topics that don't already
      // have one, so KEEP/UPDATE topics retain their original raw
      // baseline across versions.
      await snapshotCustomRawForDocument(doc._id);
    } catch (err) {
      doc.ingestionLog.push({ message: `Metadata raw snapshot warning: ${err.message}`, level: 'warn' });
    }
    try {
      // Scope to touched topics when we have any (avoids re-projecting
      // the entire document when only one topic changed). If nothing
      // was touched we still skip — projections survive across
      // re-publishes because customRaw + custom are preserved.
      await reprojectTopicsForDocument(doc._id, touchedIds.length ? { topicIds: touchedIds } : undefined);
    } catch (err) {
      doc.ingestionLog.push({ message: `Metadata reprojection warning: ${err.message}`, level: 'warn' });
    }
    try {
      const result = await regeneratePrettyUrlsForDocument(doc._id);
      if (result?.documentUrl) {
        doc.ingestionLog.push({
          message: `Pretty URL generated: ${result.documentUrl} (+${result.topicUrlCount} topic URLs)`,
          level: 'info',
        });
      }
    } catch (err) {
      doc.ingestionLog.push({ message: `Pretty URL generation warning: ${err.message}`, level: 'warn' });
    }
    try { await doc.save(); } catch (_) { /* ignore — log only */ }

    // Cleanup uploaded file
    try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }

    return { document: doc, diffSummary };
  } catch (error) {
    doc.status = 'failed';
    doc.ingestionLog.push({ message: `Error: ${error.message}`, level: 'error' });
    try { await doc.save(); } catch (_) { /* ignore */ }
    throw error;
  }
}

// ── Pure parser → candidate adapter ──
//
// Reads the multer-shaped file into a list of in-memory topic candidates
// (no Topic.create here — diffAndApplyTopics owns the writes). Returns
// the candidate batch + a doc-level metadata object + a `linkRewriter`
// closure the caller invokes AFTER diff-ingest assigned _ids.
async function parseZipToCandidates(file, doc) {
  const documentIdString = String(doc._id);
  const out = {
    candidates: [],
    docMeta: null,
    linkRewriter: null,
  };

  const { files, images } = handleZip(file.path);
  // saveZipImages happens up here (not in the legacy savePaligoTopics
  // post-pass) so the imageSrcMap is available at candidate-build time
  // and rewrites land on the html BEFORE we hash it.
  const imageSrcMap = saveZipImages(images);

  const paligoRoot = detectPaligoRoot(files);
  if (paligoRoot) {
    return await buildPaligoCandidates(files, images, paligoRoot, imageSrcMap, documentIdString);
  }

  // Generic ZIP path.
  const usedSlugs = new Set();
  // Pull existing slugs out of the way so a re-publish doesn't collide
  // on `slug`'s unique index when a topic gets net-new.
  try {
    const existingSlugs = await Topic.find({ documentId: doc._id }).distinct('slug');
    for (const s of existingSlugs) usedSlugs.add(s);
  } catch (_) { /* best-effort */ }

  const fileTopicResults = []; // { sourcePath, candidates: [{ stableId, … }] }
  const docMetaPieces = []; // collect parser-emitted doc metadata
  for (const zipFile of files) {
    // Skip binary files (pdf, pptx, etc.) — they are recognised by
    // zipHandler for manifest counting but have no parseable topic
    // content. Attempting parseByFormat on them would throw.
    if (zipFile.isBinary || zipFile.format === 'binary') continue;

    const parsed = await parseByFormat(zipFile.format, zipFile.content, zipFile.filename);
    const transformed = await transformContent(parsed, zipFile.filename, zipFile.path);
    if (transformed?.metadata) docMetaPieces.push(transformed.metadata);

    // Each transformed.topic[] entry becomes one candidate. The parser
    // already wires a hierarchy.parent index — we translate that to a
    // parentStableId in a second pass below.
    const fileCandidates = transformed.topics.map((topicData, idx) => {
      const slugBase = (topicData.slug || `topic-${idx}`).toString();
      let slug = slugBase;
      let n = 1;
      while (usedSlugs.has(slug)) { slug = `${slugBase}-${++n}`; }
      usedSlugs.add(slug);

      const sourcePath = topicData.sourcePath || zipFile.path || '';
      const stableId = computeStableId({
        documentId: documentIdString,
        sourcePath,
        title: topicData.title,
        slug,
      });
      // contentHash is computed here from the PRE-link-rewrite html so
      // it stays stable across versions — the post-pass link rewriter
      // mutates html in place, but never affects this hash.
      const contentHash = computeTopicContentHash({
        html: topicData.content?.html || '',
        text: topicData.content?.text || '',
        custom: topicData.metadata?.custom,
        hierarchy: topicData.hierarchy,
      });
      return {
        stableId,
        parentIndex: topicData.hierarchy?.parent ?? null,
        title: topicData.title,
        slug,
        content: topicData.content,
        hierarchy: topicData.hierarchy,
        metadata: topicData.metadata,
        sourcePath,
        contentHash,
        media: topicData.media || [],
      };
    });
    fileTopicResults.push({ sourcePath: zipFile.path, candidates: fileCandidates });
  }

  // Translate parentIndex → parentStableId across the full file batch.
  const flatCandidates = [];
  for (const fileResult of fileTopicResults) {
    for (let i = 0; i < fileResult.candidates.length; i++) {
      const c = fileResult.candidates[i];
      const parentIdx = c.parentIndex;
      const parentCandidate = (parentIdx != null) ? fileResult.candidates[parentIdx] : null;
      c.parentStableId = parentCandidate?.stableId || null;
      delete c.parentIndex;
      flatCandidates.push(c);
    }
  }
  out.candidates = flatCandidates;

  // Combine doc-level metadata from parsed pieces (last writer wins).
  if (docMetaPieces.length) {
    const last = docMetaPieces[docMetaPieces.length - 1];
    out.docMeta = {
      metadata: {
        author:      last.author || '',
        tags:        last.keywords || [],
        description: last.description || '',
        product:     last.product || '',
      },
    };
  }

  // Link rewriter closure: invoked after diff-ingest with the list of
  // touched topic ids so we can rewrite cross-topic links + image srcs
  // in their html now that we know every Topic._id.
  out.linkRewriter = async (touchedIds) => {
    const sourcePathToTopicId = new Map();
    // Build the path → first-topic-id map. For diff-ingest, the topic
    // for a given sourcePath is uniquely identified by stableId, so we
    // can join the candidate set against the saved Topic rows.
    const candidateBySourcePath = new Map();
    for (const c of flatCandidates) {
      if (!c.sourcePath) continue;
      if (!candidateBySourcePath.has(c.sourcePath)) candidateBySourcePath.set(c.sourcePath, c);
    }
    if (candidateBySourcePath.size) {
      const stableIds = [...candidateBySourcePath.values()].map((c) => c.stableId).filter(Boolean);
      if (stableIds.length) {
        const rows = await Topic.find({ documentId: doc._id, stableId: { $in: stableIds } })
          .select('_id stableId')
          .lean();
        const idByStable = new Map(rows.map((r) => [r.stableId, r._id]));
        for (const [sp, c] of candidateBySourcePath.entries()) {
          const id = idByStable.get(c.stableId);
          if (id) sourcePathToTopicId.set(sp, id);
        }
      }
    }
    await rewriteGenericTopicLinks(touchedIds, sourcePathToTopicId, imageSrcMap);
  };

  return out;
}

// Paligo-flavoured candidate build. Produces one candidate per topic in
// the parser's tocTree-derived `topicDataList`, with stableIds keyed off
// the existing `originId` field — the most stable per-source identifier
// Paligo exports.
async function buildPaligoCandidates(files, images, paligoRoot, imageSrcMap, documentIdString) {
  const { topicDataList, tocTree, publication, langPrefix } = await parsePaligoZip(files, images, paligoRoot);

  const usedSlugs = new Set();
  const makeSlug = (title, originId, idx) => {
    const base = (title || 'topic')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
    const suffix = originId ? originId.slice(-8) : String(idx);
    let slug = `${base}-${suffix}`;
    let n = 0;
    while (usedSlugs.has(slug)) slug = `${base}-${suffix}-${++n}`;
    usedSlugs.add(slug);
    return slug;
  };

  const candidates = topicDataList.map((td, i) => {
    const stableId = computeStableId({
      documentId: documentIdString,
      originId: td.originId,
      sourcePath: td.sourcePath,
      title: td.title,
    });
    const contentHash = computeTopicContentHash({
      html: td.content?.html || '',
      text: td.content?.text || '',
      hierarchy: { level: td.topicLevel || 1, order: td.order },
    });
    return {
      stableId,
      parentIndex: td.parentIndex ?? null,
      title:       td.title,
      slug:        makeSlug(td.title, td.originId, i),
      content:     td.content,
      hierarchy: {
        level: td.topicLevel || 1,
        order: td.order,
      },
      metadata: { language: 'en', author: td.author || '' },
      sourcePath: td.sourcePath || '',
      originId:   td.originId || '',
      permalink:  td.permalink || '',
      timeModified: td.timeModified || null,
      contentHash,
    };
  });

  // parentIndex → parentStableId.
  for (let i = 0; i < candidates.length; i++) {
    const idx = candidates[i].parentIndex;
    candidates[i].parentStableId = (idx != null && candidates[idx]) ? candidates[idx].stableId : null;
    delete candidates[i].parentIndex;
  }

  return {
    candidates,
    docMeta: {
      isPaligoFormat: true,
      tocTree,
      publication,
      title: publication?.portalTitle || undefined,
    },
    // Paligo link rewriter — closure over topicDataList + langPrefix so
    // we can use the existing posix-resolution rules at rewrite time.
    linkRewriter: async (touchedIds) => {
      // Build permalink → Topic._id from the saved rows. We need the
      // FULL set (not just touched) because a touched topic's html may
      // link to a non-touched (kept) topic.
      const stableByOriginId = new Map();
      for (const c of candidates) {
        if (c.originId) stableByOriginId.set(c.originId, c.stableId);
      }
      const allStableIds = candidates.map((c) => c.stableId).filter(Boolean);
      const rows = allStableIds.length
        ? await Topic.find({ stableId: { $in: allStableIds } })
            .select('_id stableId')
            .lean()
        : [];
      const idByStable = new Map(rows.map((r) => [r.stableId, r._id]));

      const permalinkToTopicId = {};
      for (const c of candidates) {
        if (c.permalink) {
          const id = idByStable.get(c.stableId);
          if (id) permalinkToTopicId[c.permalink] = id;
        }
      }

      await rewritePaligoTopicLinks(touchedIds, permalinkToTopicId, imageSrcMap, candidates, langPrefix);
    },
  };
}

// Post-diff link rewriter for Paligo HTML. Mirrors the four-pass logic
// in the legacy savePaligoTopics, but only for the touched topic set.
async function rewritePaligoTopicLinks(touchedIds, permalinkToTopicId, imageSrcMap, candidates, langPrefix = '') {
  if (!Array.isArray(touchedIds) || !touchedIds.length) return;
  const posix = require('path').posix;

  // Build a lookup of touched _id → candidate for the per-row context.
  const candidateByStable = new Map(candidates.map((c) => [c.stableId, c]));

  const touchedRows = await Topic.find({ _id: { $in: touchedIds } })
    .select('_id stableId content.html');
  for (const topic of touchedRows) {
    const cand = candidateByStable.get(topic.stableId);
    if (!cand) continue;
    if (!topic.content?.html) continue;

    const $ = require('cheerio').load(topic.content.html);
    let modified = false;

    // Image src rewrite using imageSrcMap.
    const sourceDir = posix.dirname(cand.permalink || '');
    if (Object.keys(imageSrcMap).length) {
      $('img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (!src || /^(https?:|data:|\/|#)/.test(src)) return;
        const resolved = posix.normalize(posix.join(langPrefix, sourceDir, src));
        const newSrc = imageSrcMap[resolved];
        if (newSrc) { $(el).attr('src', newSrc); modified = true; }
      });
    }

    // Cross-topic <a href> rewrite.
    const dirParts = (cand.permalink || '').split('/').slice(0, -1);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || /^(https?:|\/|#|mailto:|tel:)/.test(href)) return;
      const [filePart, anchor] = href.split('#');
      if (!filePart) return;
      const resolved = [...dirParts, ...filePart.split('/')]
        .reduce((acc, p) => {
          if (p === '..') return acc.slice(0, -1);
          if (p && p !== '.') return [...acc, p];
          return acc;
        }, [])
        .join('/');
      const targetId = permalinkToTopicId[resolved];
      if (targetId) {
        $(el).attr('href', anchor ? `/portal/docs/${targetId}#${anchor}` : `/portal/docs/${targetId}`);
        modified = true;
      }
    });

    if (modified) {
      topic.content.html = $('body').html() || topic.content.html;
      await topic.save();
    }
  }
}

// Post-diff link rewriter for generic ZIP. Mirrors the legacy
// rewriteZipContent loop but scoped to the touched set.
async function rewriteGenericTopicLinks(touchedIds, sourcePathToTopicId, imageSrcMap) {
  if (!Array.isArray(touchedIds) || !touchedIds.length) return;
  const posix = path.posix;

  const topics = await Topic.find({ _id: { $in: touchedIds }, sourcePath: { $ne: '' } });
  for (const topic of topics) {
    if (!topic.content?.html) continue;
    const $ = cheerio.load(topic.content.html);
    let modified = false;
    const sourceDir = posix.dirname(topic.sourcePath);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || /^(https?:|\/|#|mailto:)/.test(href)) return;
      const [filePart] = href.split(/[?#]/);
      if (!filePart) return;
      const resolved = posix.normalize(posix.join(sourceDir, filePart));
      const targetId = sourcePathToTopicId.get(resolved);
      if (targetId) {
        $(el).attr('href', `/topics/${targetId}`);
        modified = true;
      }
    });

    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src || /^(https?:|data:|\/|#)/.test(src)) return;
      const resolved = posix.normalize(posix.join(sourceDir, src));
      const newSrc = imageSrcMap[resolved];
      if (newSrc) { $(el).attr('src', newSrc); modified = true; }
    });

    if (modified) {
      topic.content.html = $('body').html() || topic.content.html;
      await topic.save();
    }
  }
}

module.exports = {
  ingestFile,
  ingestZipForTarget,
  // exposed for tests + smoke scripts
  parseZipToCandidates,
};
