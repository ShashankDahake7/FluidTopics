// Worker-thread entrypoint: walks the extracted manifest of a publication and
// validates every internal reference. Handles both HTML/XHTML exports
// (Confluence, Paligo, Author-it, FTML, generic web help) AND DITA / XML
// (DITA-OT topics, ditamaps, bookmaps, FrameMaker XML).
//
// Every missing target produces a structured log entry. The summary message
// at the end carries the issue counts the orchestrator uses to decide whether
// to push the publication into the portal/dashboard.
//
//   parent → worker:  { publicationId, extracted, manifest }
//   worker → parent:  { type: 'log',     entry: {...} }
//                     { type: 'progress', processed, total }
//                     { type: 'summary', missingTopicCount, missingAttachmentCount, brokenLinkCount, unresolvedXrefCount, hasParseableContent }
//                     { type: 'done' }
//                     { type: 'error',   message }
const { parentPort, workerData } = require('worker_threads');
const cheerio = require('cheerio');
const posix = require('path').posix;

const { getObjectStream } = require('../services/storage/s3Service');

function send(msg) {
  parentPort.postMessage(msg);
}

function logEntry(level, code, message, context = {}) {
  send({ type: 'log', entry: { level, code, message, context, timestamp: new Date().toISOString() } });
}

async function streamToString(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

const HTML_RX        = /\.(html?|xhtml)$/i;
const DITA_RX        = /\.(dita|ditamap|bookmap)$/i;
const XML_RX         = /\.xml$/i;
const BINARY_RX      = /\.(pdf|pptx?|xlsx?|csv|rtf|odt|ods|odp|epub)$/i;
const ATTACHMENT_RX  = /^attachments\//i;

// Source types whose zips carry primarily binary/attachment content.
// These get relaxed validation — no "no parseable content" error.
const BINARY_SOURCE_TYPES = new Set([
  'UnstructuredDocuments',
  'MapAttachments',
  'ExternalDocument',
  'External',
]);

// Server-absolute refs that point at *application routes* rather than at files
// inside the zip. Cross-document links exported from Confluence/Paligo
// frequently start with these prefixes; flagging them as broken would drown
// real issues in noise. Anything matching here is treated as external.
const APP_ROUTE_PREFIXES = [
  '/document/',  // FT/Confluence cross-document preview links
  '/topics/',    // FT topic shortlinks
  '/portal/',    // FT portal-internal navigation
  '/api/',       // direct API calls
  '/admin/',     // admin UI
  '/favicon.ico',
  '/robots.txt',
];

// True for refs that don't need to exist in the manifest (external URLs,
// in-page anchors, mail/tel, data URIs, app routes, etc.).
function isExternalRef(href) {
  if (!href) return true;
  if (/^(https?:|ftp:|mailto:|tel:|data:|javascript:|urn:)/i.test(href)) return true;
  if (href.startsWith('#')) return true;

  // Strip query/fragment before we test the path portion.
  const [pathOnly] = String(href).split(/[?#]/);
  if (!pathOnly) return true;

  if (APP_ROUTE_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(p))) {
    return true;
  }

  return false;
}

function resolveRef(fromPath, ref) {
  // Strip query + fragment — only the file portion matters for existence.
  const [filePart] = String(ref).split(/[?#]/);
  if (!filePart) return null;

  // Absolute-from-zip-root references (start with `/`) get normalised against
  // the extracted prefix root, not the current file's directory.
  if (filePart.startsWith('/')) return posix.normalize(filePart.slice(1));

  const baseDir = posix.dirname(fromPath);
  return posix.normalize(posix.join(baseDir, filePart));
}

// Cheerio loaders. HTML uses the default forgiving parser; DITA/XML must use
// the strict XML mode so attribute names like `conref`, `keyref`, `xml:lang`
// survive parsing intact.
function loadHtml(text) {
  return cheerio.load(text);
}
function loadXml(text) {
  return cheerio.load(text, { xmlMode: true, decodeEntities: false });
}

async function run() {
  const { publicationId, extracted, manifest, sourceType } = workerData;
  const isBinarySource = BINARY_SOURCE_TYPES.has(sourceType);

  if (!publicationId || !extracted?.bucket || !Array.isArray(manifest)) {
    send({ type: 'error', message: 'validateRefsWorker: missing required workerData fields' });
    return;
  }

  logEntry('info', 'validate_started',
    `Validation started over ${manifest.length} files`,
    { fileCount: manifest.length });

  // Build a fast existence index from the manifest. Keys are the in-zip POSIX
  // paths (NOT the S3 keys) so resolveRef() output can be looked up directly.
  // We also keep a lowercased lookup so case mismatches between an exported
  // href ("Images/foo.png") and the actual zip entry ("images/foo.png") are
  // tolerated rather than reported as broken.
  const existing = new Set(manifest.map((m) => m.path));
  const existingLower = new Set(manifest.map((m) => m.path.toLowerCase()));
  const refExists = (resolved) => {
    if (!resolved) return false;
    if (existing.has(resolved)) return true;
    return existingLower.has(resolved.toLowerCase());
  };

  let missingTopicCount       = 0;
  let missingAttachmentCount  = 0;
  let brokenLinkCount         = 0;
  let unresolvedXrefCount     = 0;

  const htmlFiles = manifest.filter((m) => HTML_RX.test(m.path));
  const ditaFiles = manifest.filter((m) => DITA_RX.test(m.path));
  // Only treat .xml as content if it's NOT obviously a config/manifest blob
  // we don't author refs in (e.g. params.manifest is dropped already by
  // extension; OPF/META-INF would be matched here but they declare hrefs we
  // do want to validate).
  const xmlFiles  = manifest.filter((m) => XML_RX.test(m.path));
  const binaryFiles = manifest.filter((m) => BINARY_RX.test(m.path));

  const parseableFiles = [...htmlFiles, ...ditaFiles, ...xmlFiles];
  const total = parseableFiles.length;
  const hasBinaryContent = binaryFiles.length > 0;

  // Hard guard: if there's nothing in the zip we can render, fail validation
  // loudly — UNLESS this is a binary/attachment source type (UD,
  // MapAttachments, ExternalDocument, External) where the zip is expected
  // to carry only PDFs/Office docs/etc. For those sources, having binary
  // content is sufficient; they don't need HTML/XML topics.
  if (manifest.length === 0) {
    logEntry('error', 'no_parseable_content',
      'Extracted zip is empty — nothing to validate.',
      { fileCount: 0, sourceType: sourceType || 'unknown' });
    brokenLinkCount += 1;
  } else if (total === 0) {
    const sampleExt = manifest
      .slice(0, 5)
      .map((m) => (m.path.split('.').pop() || '').toLowerCase())
      .filter(Boolean);
    if (isBinarySource && hasBinaryContent) {
      // Binary-content source with binary files is perfectly fine.
      logEntry('info', 'binary_content_only',
        `No HTML/XML/DITA topics found, but ${binaryFiles.length} binary file(s) detected (e.g. .${sampleExt.join(', .')}). This is expected for source type "${sourceType}".`,
        { fileCount: manifest.length, binaryFileCount: binaryFiles.length, sampleExtensions: sampleExt, sourceType });
    } else {
      // Structured source with no parseable content — this is a real problem.
      logEntry('warn', 'no_parseable_content',
        `No HTML/XML/DITA topics found in extracted zip (${manifest.length} files, e.g. .${sampleExt.join(', .')}). The publication will not be rendered in the portal.`,
        { fileCount: manifest.length, sampleExtensions: sampleExt, sourceType: sourceType || 'unknown' });
      brokenLinkCount += 1;
    }
  }

  let processed = 0;

  for (const file of parseableFiles) {
    let text;
    try {
      const stream = await getObjectStream({ bucket: extracted.bucket, key: file.key });
      text = await streamToString(stream);
    } catch (err) {
      logEntry('error', 'validate_failed',
        `Could not read ${file.path}: ${err.message}`,
        { path: file.path });
      processed += 1;
      continue;
    }

    const isHtml = HTML_RX.test(file.path);
    const isDita = DITA_RX.test(file.path);
    const isXml  = !isHtml && !isDita && XML_RX.test(file.path);

    let $;
    try {
      $ = isHtml ? loadHtml(text) : loadXml(text);
    } catch (err) {
      logEntry('warn', 'validate_failed',
        `Parse failed for ${file.path}: ${err.message}`,
        { path: file.path });
      processed += 1;
      continue;
    }

    const seenMissing = new Set();
    const reportMiss = (level, code, ref, resolved, extra = {}) => {
      const dedupeKey = `${code}|${resolved}`;
      if (seenMissing.has(dedupeKey)) return;
      seenMissing.add(dedupeKey);

      let message;
      if (code === 'topic_file_not_found') {
        message = `topic file not found: ${resolved}`;
        missingTopicCount += 1;
      } else if (code === 'attachment_not_in_zip') {
        message = `${resolved} does not exist in the zip`;
        missingAttachmentCount += 1;
      } else if (code === 'asset_not_in_zip') {
        message = `${resolved} does not exist in the zip`;
        missingAttachmentCount += 1;
      } else if (code === 'unresolved_xref' || code === 'unresolved_conref' || code === 'unresolved_keyref') {
        message = `${code.replace('_', ' ')}: ${ref} (resolved as ${resolved})`;
        unresolvedXrefCount += 1;
      } else {
        message = `broken link: ${ref} (resolved as ${resolved})`;
        brokenLinkCount += 1;
      }
      logEntry(level, code, message, {
        sourceFile: file.path,
        ref,
        resolved,
        ...extra,
      });
    };

    if (isHtml) {
      // ── <a href> ──────────────────────────────────────────────────────
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (isExternalRef(href)) return;
        const resolved = resolveRef(file.path, href);
        if (!resolved || refExists(resolved)) return;

        if (HTML_RX.test(resolved)) {
          reportMiss('warn', 'topic_file_not_found', href, resolved);
        } else if (ATTACHMENT_RX.test(resolved)) {
          reportMiss('warn', 'attachment_not_in_zip', href, resolved);
        } else {
          reportMiss('warn', 'broken_link', href, resolved);
        }
      });

      // ── <img src> ─────────────────────────────────────────────────────
      $('img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (isExternalRef(src)) return;
        const resolved = resolveRef(file.path, src);
        if (!resolved || refExists(resolved)) return;
        reportMiss('warn',
          ATTACHMENT_RX.test(resolved) ? 'attachment_not_in_zip' : 'asset_not_in_zip',
          src, resolved);
      });

      // ── <link href> + <script src> ────────────────────────────────────
      $('link[href], script[src]').each((_, el) => {
        const isLink = el.tagName === 'link';
        const ref = isLink ? $(el).attr('href') : $(el).attr('src');
        if (isExternalRef(ref)) return;
        const resolved = resolveRef(file.path, ref);
        if (!resolved || refExists(resolved)) return;
        reportMiss('warn', 'asset_not_in_zip', ref, resolved);
      });
    } else if (isDita || isXml) {
      // DITA topics and ditamaps reference each other via @href on
      // <topicref>, <chapter>, <xref>, <link>, etc. Conditional content and
      // reuse rely on @conref / @conkeyref / @keyref — those *can* point at
      // sibling files, so we treat them like xrefs.
      $('[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (isExternalRef(href)) return;

        // Don't try to resolve key references — they go through DITA-OT key
        // resolution at render time, not the zip layout.
        const scope = $(el).attr('scope');
        if (scope === 'external' || scope === 'peer') return;
        const format = ($(el).attr('format') || '').toLowerCase();
        if (format && format !== 'dita' && format !== 'ditamap' && format !== 'html' && format !== '#default') {
          // images/pdf/text - validated via image/object handling below or
          // accepted as-is.
        }

        const resolved = resolveRef(file.path, href);
        if (!resolved || refExists(resolved)) return;

        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'topicref' || tag === 'chapter' || tag === 'mapref' || tag === 'topichead') {
          reportMiss('warn', 'topic_file_not_found', href, resolved);
        } else if (tag === 'xref' || tag === 'link') {
          reportMiss('warn', 'unresolved_xref', href, resolved);
        } else {
          reportMiss('warn', 'broken_link', href, resolved);
        }
      });

      // <image href="..."> in DITA. Some FrameMaker / FTML exports also use
      // <Graphic file="..."> and <object data="...">.
      $('image[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (isExternalRef(href)) return;
        const resolved = resolveRef(file.path, href);
        if (!resolved || refExists(resolved)) return;
        reportMiss('warn', 'asset_not_in_zip', href, resolved);
      });
      $('object[data]').each((_, el) => {
        const data = $(el).attr('data');
        if (isExternalRef(data)) return;
        const resolved = resolveRef(file.path, data);
        if (!resolved || refExists(resolved)) return;
        reportMiss('warn', 'asset_not_in_zip', data, resolved);
      });

      // @conref points at "<file>#<topicid>/<elementid>" — we only verify the
      // file portion exists in the zip; the element-id is a render-time
      // concern.
      $('[conref]').each((_, el) => {
        const conref = $(el).attr('conref');
        if (isExternalRef(conref)) return;
        const [filePart] = String(conref).split('#');
        if (!filePart) return; // pure intra-file conref — element-id only
        const resolved = resolveRef(file.path, filePart);
        if (!resolved || refExists(resolved)) return;
        reportMiss('warn', 'unresolved_conref', conref, resolved);
      });
    }

    processed += 1;
    if (processed % 10 === 0) {
      send({ type: 'progress', processed, total });
    }
  }

  send({ type: 'progress', processed, total });
  send({
    type: 'summary',
    missingTopicCount,
    missingAttachmentCount,
    brokenLinkCount,
    unresolvedXrefCount,
    hasParseableContent: total > 0,
    hasBinaryContent,
    parseableFileCount: total,
    binaryFileCount: binaryFiles.length,
    sourceType: sourceType || null,
  });
  logEntry('info', 'validate_complete',
    `Validation complete: ${missingTopicCount} missing topics, ${missingAttachmentCount} missing attachments, ${unresolvedXrefCount} unresolved xrefs, ${brokenLinkCount} other broken links${hasBinaryContent ? `, ${binaryFiles.length} binary file(s)` : ''}`,
    { missingTopicCount, missingAttachmentCount, unresolvedXrefCount, brokenLinkCount, binaryFileCount: binaryFiles.length, sourceType: sourceType || null });
  send({ type: 'done' });
}

run().catch((err) => {
  send({ type: 'error', message: err?.message || String(err) });
});
