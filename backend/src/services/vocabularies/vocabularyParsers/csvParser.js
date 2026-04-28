// Pure CSV parser for the documented vocabulary shape. Hand-rolled rather
// than pulling another dep (`csv-parse` or similar) since the format is
// fixed and tiny:
//
//   id,label,language,synonyms
//   product.cloud,Cloud,en,"saas;hosted"
//   product.cloud,Cloud,fr,"infonuagique"
//
// - The header is case-insensitive; column order must match.
// - Synonyms are `;`-separated within the single CSV cell.
// - A blank `language` cell means "language-agnostic" and is normalised
//   to `'*'` so the synonym index keys are uniform.
// - Quoted fields ("...") may contain commas and `;`; doubled `""` is a
//   literal quote.
// - BOM at start of file is stripped.
// - Blank lines are skipped.
//
// Returns:
//   { terms: [{ termId, language, prefLabel, altLabels, broader }, ...],
//     languages: ['en', 'fr', '*', ...] (deduped),
//     warnings: ['line 4: ...', ...] }

const REQUIRED_HEADERS = ['id', 'label', 'language', 'synonyms'];

function parseCsv(buffer) {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = splitRecords(text);
  if (lines.length === 0) {
    throw makeError('CSV file is empty.');
  }

  const headerCells = parseRow(lines[0]).map((c) => c.trim().toLowerCase());
  for (const h of REQUIRED_HEADERS) {
    if (!headerCells.includes(h)) {
      throw makeError(`CSV header is missing required column "${h}". Expected: ${REQUIRED_HEADERS.join(',')}`);
    }
  }
  const idxId       = headerCells.indexOf('id');
  const idxLabel    = headerCells.indexOf('label');
  const idxLang     = headerCells.indexOf('language');
  const idxSyn      = headerCells.indexOf('synonyms');

  const terms = [];
  const languages = new Set();
  const warnings = [];

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const cells = parseRow(raw);
    if (cells.length < REQUIRED_HEADERS.length) {
      warnings.push(`line ${i + 1}: row has ${cells.length} columns, expected at least ${REQUIRED_HEADERS.length}`);
      continue;
    }
    const termId = String(cells[idxId] ?? '').trim();
    const prefLabel = String(cells[idxLabel] ?? '').trim();
    if (!termId) {
      warnings.push(`line ${i + 1}: missing id`);
      continue;
    }
    if (!prefLabel) {
      warnings.push(`line ${i + 1}: missing label`);
      continue;
    }
    const language = (String(cells[idxLang] ?? '').trim() || '*').toLowerCase();
    const synField = String(cells[idxSyn] ?? '').trim();
    const altLabels = synField
      ? synField.split(';').map((s) => s.trim()).filter(Boolean)
      : [];
    languages.add(language);
    terms.push({ termId, language, prefLabel, altLabels, broader: '' });
  }

  return { terms, languages: Array.from(languages), warnings };
}

// Split a CSV file into row records. A row may span multiple physical lines
// when a quoted cell contains a literal newline; we walk character by
// character and only emit a record when we are *outside* a quoted cell.
function splitRecords(text) {
  const records = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      records.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) records.push(cur);
  return records;
}

// Split a single CSV row into cells, honouring quoted fields with embedded
// commas and `""` escapes.
function parseRow(row) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function makeError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'csv_parse_failed';
  return err;
}

module.exports = { parseCsv };
