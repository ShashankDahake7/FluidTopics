'use strict';

/**
 * Turn stored search `filters` into compact { label, value } chips for analytics tables.
 */
function facetsFromFilters(filters) {
  if (!filters || typeof filters !== 'object') return [];
  const out = [];

  if (filters.language) {
    out.push({ label: 'Language', value: String(filters.language) });
  }
  if (Array.isArray(filters.tags)) {
    for (const t of filters.tags) {
      out.push({ label: 'Module', value: String(t) });
    }
  } else if (filters.tags) {
    out.push({ label: 'Module', value: String(filters.tags) });
  }
  if (filters.product) {
    out.push({ label: 'Product', value: String(filters.product) });
  }
  if (filters.version) {
    out.push({ label: 'Version', value: String(filters.version) });
  }
  if (filters.titlesOnly) {
    out.push({ label: 'Titles only', value: 'yes' });
  }
  if (Array.isArray(filters.documentIds) && filters.documentIds.length) {
    out.push({ label: 'Documents', value: `${filters.documentIds.length} selected` });
  }
  if (Array.isArray(filters.topicIds) && filters.topicIds.length) {
    out.push({ label: 'Topics', value: `${filters.topicIds.length} selected` });
  }
  return out;
}

/**
 * Stable string for grouping rows with the same term + filter combination.
 * @param {object} filters
 * @returns {string}
 */
function filterSignatureFromFilters(filters) {
  if (!filters || typeof filters !== 'object') return '';
  const f = filters;
  const tagStr = Array.isArray(f.tags)
    ? [...f.tags].map((t) => String(t)).sort().join(',')
    : f.tags
      ? String(f.tags)
      : '';
  const docStr = Array.isArray(f.documentIds)
    ? [...f.documentIds].map(String).sort().join(',')
    : '';
  const topStr = Array.isArray(f.topicIds) ? [...f.topicIds].map(String).sort().join(',') : '';
  return [
    f.language != null ? String(f.language) : '',
    tagStr,
    f.product != null ? String(f.product) : '',
    f.version != null ? String(f.version) : '',
    f.titlesOnly ? '1' : '',
    docStr,
    topStr,
  ].join('::');
}

module.exports = {
  facetsFromFilters,
  filterSignatureFromFilters,
};
