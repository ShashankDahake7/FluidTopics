'use strict';

/**
 * Fluid Topics–style rejection of suspicious search strings (injection / probe patterns).
 * Matching queries do not emit analytics events and are excluded from search-term reports.
 */

const MAX_QUERY_LEN = 512;

/** @type {{ re: RegExp }[]} */
const SUSPICIOUS_PATTERNS = [
  { re: /<\/script/i },
  { re: /<script/i },
  { re: /javascript:/i },
  { re: /vbscript:/i },
  { re: /\bon\w+\s*=/i },
  { re: /\bunion\s+all\s+select\b/i },
  { re: /\bunion\s+select\b/i },
  { re: /\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i },
  { re: /;\s*(drop|delete|truncate|exec|execute)\b/i },
  { re: /--\s*$/m },
  { re: /\$\{\s*\w+/ },
  { re: /eval\s*\(/i },
  { re: /expression\s*\(/i },
];

/**
 * @param {unknown} query
 * @returns {boolean} true if the query must not be tracked or listed
 */
function isSuspiciousSearchQuery(query) {
  if (query == null || typeof query !== 'string') return true;
  const s = query.trim();
  if (!s) return true;
  if (s.length > MAX_QUERY_LEN) return true;
  return SUSPICIOUS_PATTERNS.some((p) => p.re.test(s));
}

/**
 * Conditions for `$match: { $and: [...] }` — non-suspicious `data.query` (mirrors {@link isSuspiciousSearchQuery}).
 * @returns {object[]}
 */
function mongoSafeSearchQueryConditions() {
  return [
    { 'data.query': { $exists: true, $type: 'string' } },
    {
      $expr: {
        $lte: [{ $strLenCP: { $ifNull: ['$data.query', ''] } }, MAX_QUERY_LEN],
      },
    },
    ...SUSPICIOUS_PATTERNS.map((p) => ({ 'data.query': { $not: p.re } })),
  ];
}

module.exports = {
  MAX_QUERY_LEN,
  isSuspiciousSearchQuery,
  mongoSafeSearchQueryConditions,
};
