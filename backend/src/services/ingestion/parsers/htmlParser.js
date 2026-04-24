const cheerio = require('cheerio');
const { stripHtml } = require('../../../utils/helpers');

/**
 * Parse HTML content into structured sections
 * @param {string} htmlContent - Raw HTML string
 * @param {string} filename - Original filename for metadata
 * @returns {Object} Parsed document structure
 */
const parseHTML = (htmlContent, filename = '') => {
  const $ = cheerio.load(htmlContent);

  // Extract metadata
  const metadata = {
    title: $('title').text().trim() || $('h1').first().text().trim() || filename,
    author: $('meta[name="author"]').attr('content') || '',
    description: $('meta[name="description"]').attr('content') || '',
    keywords: ($('meta[name="keywords"]').attr('content') || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    language: $('html').attr('lang') || 'en',
  };

  // Extract sections based on headings
  const sections = [];
  const headings = $('h1, h2, h3, h4, h5, h6');

  if (headings.length === 0) {
    // No headings — treat entire body as one section
    const bodyHtml = $('body').html() || htmlContent;
    sections.push({
      title: metadata.title,
      level: 1,
      html: bodyHtml.trim(),
      text: stripHtml(bodyHtml),
    });
  } else {
    let currentSection = null;
    const bodyChildren = $('body').length ? $('body').children() : $.root().children();

    bodyChildren.each((_, element) => {
      const el = $(element);
      const tagName = element.tagName?.toLowerCase() || '';
      const headingMatch = tagName.match(/^h([1-6])$/);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: el.text().trim(),
          level: parseInt(headingMatch[1]),
          html: '',
          text: '',
        };
      } else if (currentSection) {
        const outerHtml = $.html(el);
        currentSection.html += outerHtml;
        currentSection.text += ' ' + stripHtml(outerHtml);
      } else {
        // Content before first heading
        const outerHtml = $.html(el);
        if (outerHtml.trim()) {
          currentSection = {
            title: metadata.title,
            level: 1,
            html: outerHtml,
            text: stripHtml(outerHtml),
          };
        }
      }
    });

    // Push last section
    if (currentSection) {
      sections.push(currentSection);
    }
  }

  // Extract images
  const images = [];
  $('img').each((_, img) => {
    const $img = $(img);
    images.push({
      src: $img.attr('src') || '',
      alt: $img.attr('alt') || '',
      title: $img.attr('title') || '',
    });
  });

  // Extract tables
  const tables = [];
  $('table').each((i, table) => {
    tables.push({
      index: i,
      html: $.html(table),
    });
  });

  return {
    metadata,
    sections: sections.map((s) => ({
      ...s,
      text: s.text.trim(),
    })),
    images,
    tables,
  };
};

module.exports = { parseHTML };
