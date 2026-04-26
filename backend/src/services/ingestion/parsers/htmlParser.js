const cheerio = require('cheerio');
const { stripHtml } = require('../../../utils/helpers');
const { extractAuthorFromHtml } = require('../../../utils/authorFromHtml');

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
    author: extractAuthorFromHtml(htmlContent),
    description: $('meta[name="description"]').attr('content') || '',
    keywords: ($('meta[name="keywords"]').attr('content') || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    language: $('html').attr('lang') || 'en',
  };

  // Remove non-content elements (scripts, styles, nav chrome)
  $('script, style, link, noscript').remove();
  $('header, footer, nav, aside').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  // Try to isolate the main content area (Paligo and common doc formats)
  // Cheerio objects are always truthy, so we must check .length explicitly.
  const contentSelectors = [
    '#content-wrapper',
    'article',
    'main',
    '[role="main"]',
    '#main-content',
    '.topic-content',
    '.content',
  ];
  let workingRoot = $('body').length ? $('body') : $.root();
  for (const sel of contentSelectors) {
    const found = $(sel).first();
    if (found.length) {
      workingRoot = found;
      break;
    }
  }

  // Extract sections based on headings
  const sections = [];
  // Only count headings that are direct children — if headings are nested deeper
  // (e.g. Paligo's <section><div class="titlepage"><h2>) we treat the whole
  // content area as one section rather than doing a broken flat walk.
  const directHeadings = workingRoot.children().filter('h1, h2, h3, h4, h5, h6');

  if (directHeadings.length === 0) {
    // No direct-child headings — treat entire content area as one section
    const bodyHtml = workingRoot.html() || htmlContent;
    sections.push({
      title: metadata.title,
      level: 1,
      html: bodyHtml.trim(),
      text: stripHtml(bodyHtml),
    });
  } else {
    // Headings are direct children — walk them to build sections
    let currentSection = null;
    const bodyChildren = workingRoot.children();

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
