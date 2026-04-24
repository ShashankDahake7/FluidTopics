const { marked } = require('marked');
const matter = require('gray-matter');
const { parseHTML } = require('./htmlParser');

/**
 * Parse Markdown content into structured sections
 * @param {string} mdContent - Raw Markdown string
 * @param {string} filename - Original filename
 * @returns {Object} Parsed document structure
 */
const parseMarkdown = (mdContent, filename = '') => {
  // Extract frontmatter
  const { data: frontmatter, content } = matter(mdContent);

  // Convert markdown to HTML
  const html = marked.parse(content, {
    gfm: true,
    breaks: true,
  });

  // Use the HTML parser to extract sections
  const parsed = parseHTML(html, filename);

  // Merge frontmatter metadata
  if (frontmatter) {
    if (frontmatter.title) parsed.metadata.title = frontmatter.title;
    if (frontmatter.author) parsed.metadata.author = frontmatter.author;
    if (frontmatter.description) parsed.metadata.description = frontmatter.description;
    if (frontmatter.tags) {
      parsed.metadata.keywords = Array.isArray(frontmatter.tags)
        ? frontmatter.tags
        : frontmatter.tags.split(',').map((t) => t.trim());
    }
    if (frontmatter.language) parsed.metadata.language = frontmatter.language;
    if (frontmatter.product) parsed.metadata.product = frontmatter.product;
    if (frontmatter.version) parsed.metadata.version = frontmatter.version;
  }

  return parsed;
};

module.exports = { parseMarkdown };
