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

module.exports = { ingestFile };
