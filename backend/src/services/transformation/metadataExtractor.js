const { stripHtml, truncate } = require('../../utils/helpers');

/**
 * Extract and enrich metadata from parsed content
 */
const extractMetadata = (parsedDoc, originalFilename = '') => {
  const metadata = { ...parsedDoc.metadata };

  // Auto-generate title if missing
  if (!metadata.title || metadata.title === originalFilename) {
    // Try to derive from first section
    if (parsedDoc.sections && parsedDoc.sections.length > 0) {
      metadata.title = parsedDoc.sections[0].title || originalFilename;
    }
  }

  // Auto-generate description if missing
  if (!metadata.description && parsedDoc.sections?.length > 0) {
    const firstSectionText = parsedDoc.sections[0].text || '';
    metadata.description = truncate(firstSectionText, 300);
  }

  // Auto-generate tags from content (simple keyword extraction)
  if (!metadata.keywords || metadata.keywords.length === 0) {
    metadata.keywords = autoGenerateTags(parsedDoc.sections);
  }

  return metadata;
};

/**
 * Simple keyword extraction for auto-tagging
 */
const autoGenerateTags = (sections) => {
  const text = sections.map((s) => s.text || '').join(' ').toLowerCase();
  const words = text.split(/\s+/).filter((w) => w.length > 4);

  // Count word frequency
  const freq = {};
  words.forEach((w) => {
    const clean = w.replace(/[^a-z]/g, '');
    if (clean.length > 4 && !STOP_WORDS.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1;
    }
  });

  // Get top 5 most frequent meaningful words
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
};

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'along', 'among',
  'around', 'because', 'before', 'behind', 'being', 'below', 'between',
  'beyond', 'could', 'doing', 'during', 'every', 'following', 'further',
  'having', 'itself', 'might', 'other', 'other', 'right', 'shall',
  'should', 'since', 'still', 'their', 'there', 'these', 'thing',
  'those', 'three', 'through', 'under', 'until', 'using', 'which',
  'while', 'would', 'yours', 'content', 'section', 'document',
]);

module.exports = { extractMetadata };
