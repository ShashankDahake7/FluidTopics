const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const generateUniqueSlug = (title, suffix = '') => {
  const base = slugify(title);
  const uniquePart = suffix || Date.now().toString(36);
  return `${base}-${uniquePart}`;
};

const stripHtml = (html) => {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const truncate = (str, length = 200) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length).replace(/\s+\S*$/, '') + '...';
};

// Map known file extensions to the parser the ingestion pipeline should use.
// Anything that isn't here is silently ignored by handleZip(); we keep the
// list deliberately broad so DITA / Author-it / FTML / Confluence exports do
// not slip through as "0 content files".
// Source types whose zips carry primarily binary/attachment content rather than
// HTML/XML topic trees. These need relaxed validation (no "no parseable
// content" warning) and may bypass the full topic-extraction pipeline.
const BINARY_SOURCE_TYPES = new Set([
  'UnstructuredDocuments',
  'MapAttachments',
  'ExternalDocument',
  'External',
]);

// Source types where we expect a full topic/TOC tree (HTML, DITA, XML).
// Validation should be strict for these.
const STRUCTURED_SOURCE_TYPES = new Set([
  'Dita',
  'Paligo',
  'Confluence',
  'Authorit',
  'AuthoritMagellan',
  'Html',
  'Ftml',
]);

const detectFormat = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const formatMap = {
    html: 'html',
    htm: 'html',
    xhtml: 'html',
    xml: 'xml',
    // DITA topics + maps are XML under the hood — let parseXML handle them.
    dita: 'xml',
    ditamap: 'xml',
    bookmap: 'xml',
    // FrameMaker FTML / MIF metadata files are XML-ish
    ftml: 'xml',
    md: 'markdown',
    markdown: 'markdown',
    docx: 'docx',
    zip: 'zip',
    txt: 'markdown',
    // Binary / attachment formats — recognised so they aren't silently
    // dropped by zipHandler. The ingestion pipeline treats these as opaque
    // blobs (no topic extraction) but they count toward "has content" for
    // source types like UnstructuredDocuments and MapAttachments.
    pdf:  'binary',
    pptx: 'binary',
    xlsx: 'binary',
    xls:  'binary',
    ppt:  'binary',
    csv:  'binary',
    rtf:  'binary',
    odt:  'binary',
    ods:  'binary',
    odp:  'binary',
    epub: 'binary',
  };
  return formatMap[ext] || null;
};

// Matches validateRefsWorker.js — used to reconcile ValidationCache rows that
// predate summary.hasBinaryContent or omitted flags after a cache hit.
function manifestValidationFlags(manifest) {
  const HTML_RX = /\.(html?|xhtml)$/i;
  const DITA_RX = /\.(dita|ditamap|bookmap)$/i;
  const XML_RX = /\.xml$/i;
  const BINARY_RX = /\.(pdf|pptx?|xlsx?|csv|rtf|odt|ods|odp|epub)$/i;
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return { hasParseableContent: false, hasBinaryContent: false };
  }
  let parseable = false;
  let binary = false;
  for (const m of manifest) {
    const p = m?.path || '';
    if (HTML_RX.test(p) || DITA_RX.test(p) || XML_RX.test(p)) parseable = true;
    if (BINARY_RX.test(p)) binary = true;
    if (parseable && binary) break;
  }
  return { hasParseableContent: parseable, hasBinaryContent: binary };
}

module.exports = {
  slugify,
  generateUniqueSlug,
  stripHtml,
  truncate,
  detectFormat,
  manifestValidationFlags,
  BINARY_SOURCE_TYPES,
  STRUCTURED_SOURCE_TYPES,
};
