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
  };
  return formatMap[ext] || null;
};

module.exports = {
  slugify,
  generateUniqueSlug,
  stripHtml,
  truncate,
  detectFormat,
};
