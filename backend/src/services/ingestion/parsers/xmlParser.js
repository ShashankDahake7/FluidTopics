const xml2js = require('xml2js');
const { stripHtml } = require('../../../utils/helpers');

/**
 * Parse XML content (DITA/DocBook/generic) into structured sections
 * @param {string} xmlContent - Raw XML string
 * @param {string} filename - Original filename
 * @returns {Object} Parsed document structure
 */
const parseXML = async (xmlContent, filename = '') => {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });

  const result = await parser.parseStringPromise(xmlContent);

  const metadata = {
    title: '',
    author: '',
    description: '',
    keywords: [],
    language: 'en',
  };

  const sections = [];

  // Try to detect DITA format
  if (result.topic || result.concept || result.task || result.reference) {
    const root = result.topic || result.concept || result.task || result.reference;
    metadata.title = extractText(root.title) || filename;

    if (root.shortdesc) {
      metadata.description = extractText(root.shortdesc);
    }

    if (root.body || root.conbody || root.taskbody || root.refbody) {
      const body = root.body || root.conbody || root.taskbody || root.refbody;
      extractDITASections(body, sections, 1);
    }
  }
  // Try DocBook
  else if (result.article || result.book || result.chapter) {
    const root = result.article || result.book || result.chapter;
    metadata.title = extractText(root.title || root.info?.title) || filename;

    if (root.info?.author) {
      metadata.author = extractText(root.info.author.personname || root.info.author);
    }

    extractDocBookSections(root, sections, 1);
  }
  // Generic XML — flatten to text sections
  else {
    metadata.title = filename;
    const text = flattenXMLToText(result);
    if (text.trim()) {
      sections.push({
        title: filename,
        level: 1,
        html: `<p>${text}</p>`,
        text: text,
      });
    }
  }

  return {
    metadata,
    sections,
    images: [],
    tables: [],
  };
};

function extractText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node._) return node._;
  if (typeof node === 'object') {
    return Object.values(node)
      .map((v) => extractText(v))
      .join(' ');
  }
  return String(node);
}

function extractDITASections(body, sections, level) {
  if (!body) return;

  if (body.section) {
    const sectionList = Array.isArray(body.section) ? body.section : [body.section];
    sectionList.forEach((sec) => {
      const title = extractText(sec.title) || 'Untitled Section';
      const text = extractText(sec);
      sections.push({
        title,
        level,
        html: `<p>${text}</p>`,
        text,
      });
    });
  }

  // Handle steps in task topics
  if (body.steps) {
    const steps = body.steps.step;
    if (steps) {
      const stepList = Array.isArray(steps) ? steps : [steps];
      const stepsHtml = stepList
        .map((s, i) => `<li>${extractText(s.cmd || s)}</li>`)
        .join('');
      sections.push({
        title: 'Steps',
        level: level,
        html: `<ol>${stepsHtml}</ol>`,
        text: stepList.map((s) => extractText(s.cmd || s)).join(' '),
      });
    }
  }

  // Paragraphs
  if (body.p) {
    const paragraphs = Array.isArray(body.p) ? body.p : [body.p];
    const text = paragraphs.map((p) => extractText(p)).join(' ');
    if (text.trim()) {
      sections.push({
        title: 'Content',
        level,
        html: paragraphs.map((p) => `<p>${extractText(p)}</p>`).join(''),
        text,
      });
    }
  }
}

function extractDocBookSections(node, sections, level) {
  if (!node) return;

  const sectionTypes = ['section', 'sect1', 'sect2', 'sect3', 'chapter'];
  sectionTypes.forEach((type) => {
    if (node[type]) {
      const items = Array.isArray(node[type]) ? node[type] : [node[type]];
      items.forEach((item) => {
        const title = extractText(item.title) || 'Untitled';
        const text = extractText(item.para || item.simpara || item);
        sections.push({
          title,
          level,
          html: `<p>${text}</p>`,
          text,
        });
        extractDocBookSections(item, sections, level + 1);
      });
    }
  });
}

function flattenXMLToText(obj) {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(flattenXMLToText).join(' ');
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).map(flattenXMLToText).join(' ');
  }
  return String(obj || '');
}

module.exports = { parseXML };
