// Implements the 8 date formats listed in the Fluid Topics docs for the
// Metadata configuration "Set as date" toggle. Returns a JS Date on
// success, or null on failure (the registry tracks the unparseable count
// separately).
//
// Supported formats (per docs):
//   1.  dd/MM/yyyy
//   2.  yyyy-MM-dd
//   3.  dd-MM-yyyy
//   4.  yyyy/MM/dd
//   5.  yyyy.MM.dd
//   6.  dd.MM.yyyy
//   7.  MMM yyyy            (e.g. "Apr 2026")
//   8.  ISO format          (Date.parse fallback for full ISO strings)
//
// Order matters: yyyy-prefixed patterns are tried before dd-prefixed ones
// because "2026-04-28" would otherwise match `dd-MM-yyyy` ambiguously on
// inputs where the year is two-digit. We also sanity-check month/day so a
// pattern match with bogus parts still returns null instead of silently
// wrapping into next year.

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function buildDate(year, monthIndex, day) {
  if (
    Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day) ||
    monthIndex < 0 || monthIndex > 11 ||
    day < 1 || day > 31 ||
    year < 1000 || year > 9999
  ) {
    return null;
  }
  const d = new Date(Date.UTC(year, monthIndex, day));
  // Round-trip check — `new Date(2024, 1, 30)` rolls into March; reject.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== monthIndex ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

const PATTERNS = [
  // yyyy-MM-dd
  { rx: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, build: (m) => buildDate(+m[1], +m[2] - 1, +m[3]) },
  // yyyy/MM/dd
  { rx: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, build: (m) => buildDate(+m[1], +m[2] - 1, +m[3]) },
  // yyyy.MM.dd
  { rx: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, build: (m) => buildDate(+m[1], +m[2] - 1, +m[3]) },
  // dd/MM/yyyy
  { rx: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, build: (m) => buildDate(+m[3], +m[2] - 1, +m[1]) },
  // dd-MM-yyyy
  { rx: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, build: (m) => buildDate(+m[3], +m[2] - 1, +m[1]) },
  // dd.MM.yyyy
  { rx: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, build: (m) => buildDate(+m[3], +m[2] - 1, +m[1]) },
  // MMM yyyy   (defaults day=1 — month-precision dates from datasheet
  // "Released MMM yyyy" style metadata).
  {
    rx: /^([A-Za-z]{3,9})\s+(\d{4})$/,
    build: (m) => {
      const monthIndex = MONTH_NAMES[m[1].toLowerCase()];
      if (monthIndex === undefined) return null;
      return buildDate(+m[2], monthIndex, 1);
    },
  },
];

function parseIso(input) {
  // Date.parse is forgiving; require it to round-trip via toISOString so
  // garbage like "abc" (NaN) is rejected. We also require either a 'T' or
  // a 'Z' so we don't accidentally swallow the dd-MM-yyyy patterns above.
  if (!/T|Z|\+\d{2}:\d{2}/.test(input)) return null;
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

// Public API. Returns Date | null.
function normalizeDate(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Cheap fast-path for already-ISO strings.
  const iso = parseIso(raw);
  if (iso) return iso;

  for (const { rx, build } of PATTERNS) {
    const m = raw.match(rx);
    if (m) {
      const d = build(m);
      if (d) return d;
    }
  }
  return null;
}

module.exports = { normalizeDate };
