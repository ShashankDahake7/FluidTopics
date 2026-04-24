const fs = require('fs');
const path = require('path');
const Document = require('../../models/Document');
const Topic = require('../../models/Topic');
const { parseHTML } = require('./parsers/htmlParser');
const { parseMarkdown } = require('./parsers/markdownParser');
const { parseDOCX } = require('./parsers/docxParser');
const { parseXML } = require('./parsers/xmlParser');
const { handleZip } = require('./zipHandler');
const { transformContent } = require('../transformation/transformationEngine');
const { indexTopics } = require('../search/indexingService');
const { detectFormat } = require('../../utils/helpers');

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
      const files = handleZip(file.path);
      doc.ingestionLog.push({
        message: `ZIP extracted: ${files.length} files found`,
        level: 'info',
      });

      for (const zipFile of files) {
        const parsed = await parseByFormat(zipFile.format, zipFile.content, zipFile.filename);
        const transformed = await transformContent(parsed, zipFile.filename);
        const topicIds = await saveTopics(transformed, doc._id);
        allTopicIds.push(...topicIds);
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

    // Update document
    doc.topicIds = allTopicIds;
    doc.status = 'completed';
    doc.ingestionLog.push({
      message: `Ingestion completed: ${allTopicIds.length} topics created`,
      level: 'info',
    });
    await doc.save();

    // Index topics in Elasticsearch
    try {
      const topics = await Topic.find({ _id: { $in: allTopicIds } });
      await indexTopics(topics);
      doc.ingestionLog.push({ message: 'Topics indexed in Elasticsearch', level: 'info' });
      await doc.save();
    } catch (esError) {
      console.error('Elasticsearch indexing error:', esError.message);
      doc.ingestionLog.push({
        message: `Search indexing warning: ${esError.message}`,
        level: 'warn',
      });
      await doc.save();
    }

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

module.exports = { ingestFile };
