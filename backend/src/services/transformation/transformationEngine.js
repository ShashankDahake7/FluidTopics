const { extractTopics } = require('./topicExtractor');
const { extractMetadata } = require('./metadataExtractor');
const { extractMedia } = require('./mediaExtractor');
const { generateSummary, generateTags } = require('../ai/groqService');

/**
 * Main transformation engine
 * Takes parsed content and produces:
 * - Enriched metadata
 * - Structured topics with hierarchy
 * - Extracted media
 */
const transformContent = async (parsedDoc, originalFilename = '', sourcePath = '') => {
  // 1. Extract & enrich metadata
  const metadata = extractMetadata(parsedDoc, originalFilename);

  // 2. Extract media items (saves files to disk)
  const media = await extractMedia(parsedDoc);

  // 3. Extract topics from sections
  const topics = extractTopics(parsedDoc.sections, metadata, sourcePath);

  // 4. Distribute media to topics (attach to the topic where they appear)
  topics.forEach((topic, index) => {
    topic.media = media.filter((m) => {
      // Simple heuristic: if image alt text appears in topic content
      if (m.alt && topic.content.text.includes(m.alt)) return true;
      // For tables, assign to the section where they likely appear
      if (m.type === 'table' && topic.content.html.includes('<table')) return true;
      return false;
    });
  });

  // 5. Augment topics with AI (Summary & Semantic Tags)
  await Promise.all(
    topics.map(async (topic) => {
      const contentText = topic.content.text || '';
      if (contentText.length > 50) {
        try {
          const [aiSummary, aiTags] = await Promise.all([
            generateSummary(contentText),
            generateTags(contentText)
          ]);
          topic.metadata.aiSummary = aiSummary;
          topic.metadata.tags = [...new Set([...(topic.metadata.tags || []), ...aiTags])];
        } catch (error) {
          console.warn('AI augmentation failed for topic:', topic.title, error.message);
        }
      }
    })
  );

  return {
    metadata,
    topics,
    media,
    stats: {
      topicCount: topics.length,
      mediaCount: media.length,
      totalTextLength: topics.reduce((sum, t) => sum + (t.content.text?.length || 0), 0),
    },
  };
};

module.exports = { transformContent };
