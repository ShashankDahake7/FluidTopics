const { generateUniqueSlug } = require('../../utils/helpers');

/**
 * Extract topics from parsed document sections
 * Builds hierarchical topic structure from heading-based sections
 */
const extractTopics = (sections, documentMetadata = {}, sourcePath = '') => {
  const topics = [];
  const stack = []; // Stack to track parent hierarchy

  sections.forEach((section, index) => {
    const slug = generateUniqueSlug(section.title, `${index}-${Date.now().toString(36)}`);

    const topic = {
      title: section.title,
      slug,
      sourcePath,
      content: {
        html: section.html || '',
        text: section.text || '',
      },
      hierarchy: {
        level: section.level || 1,
        parent: null,
        children: [],
        order: index,
      },
      metadata: {
        tags: documentMetadata.keywords || [],
        version: documentMetadata.version || '1.0',
        product: documentMetadata.product || '',
        language: documentMetadata.language || 'en',
        author: documentMetadata.author || '',
      },
      media: [],
    };

    // Find parent based on heading level
    while (stack.length > 0 && stack[stack.length - 1].hierarchy.level >= section.level) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      topic.hierarchy.parent = parent._tempIndex;
      parent.hierarchy.children.push(index);
    }

    topic._tempIndex = index;
    stack.push(topic);
    topics.push(topic);
  });

  return topics;
};

module.exports = { extractTopics };
