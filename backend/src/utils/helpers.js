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

const detectFormat = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const formatMap = {
    html: 'html',
    htm: 'html',
    xml: 'xml',
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
