// Worker-thread entrypoint: walks the extracted manifest of a publication and
// validates every internal reference (HTML <a href>, <img src>, <link href>,
// <script src>, plus Confluence-style attachments/<id>/<id> paths). Every
// missing target produces a structured log entry sent back to the parent.
//
//   parent → worker:  { publicationId, extracted, manifest }
//   worker → parent:  { type: 'log',     entry: {...} }
//                     { type: 'progress', processed, total }
//                     { type: 'summary', missingTopicCount, missingAttachmentCount, brokenLinkCount }
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

const HTML_RX = /\.(html?|xhtml)$/i;
const ATTACHMENT_RX = /^attachments\//i;

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
  if (/^(https?:|ftp:|mailto:|tel:|data:|javascript:)/i.test(href)) return true;
  if (href.startsWith('#')) return true;

  // Strip query/fragment before we test the path portion.
  const [pathOnly] = String(href).split(/[?#]/);
  if (!pathOnly) return true;

  // Server-absolute paths that look like application routes — not files in
  // the zip.
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

async function run() {
  const { publicationId, extracted, manifest } = workerData;

  if (!publicationId || !extracted?.bucket || !Array.isArray(manifest)) {
    send({ type: 'error', message: 'validateRefsWorker: missing required workerData fields' });
    return;
  }

  logEntry('info', 'validate_started',
    `Validation started over ${manifest.length} files`,
    { fileCount: manifest.length });

  // Build a fast existence index from the manifest. Keys are the in-zip POSIX
  // paths (NOT the S3 keys) so resolveRef() output can be looked up directly.
  const existing = new Set(manifest.map((m) => m.path));

  let missingTopicCount = 0;
  let missingAttachmentCount = 0;
  let brokenLinkCount = 0;

  let processed = 0;
  const htmlFiles = manifest.filter((m) => HTML_RX.test(m.path));

  for (const file of htmlFiles) {
    let html;
    try {
      const stream = await getObjectStream({ bucket: extracted.bucket, key: file.key });
      html = await streamToString(stream);
    } catch (err) {
      logEntry('error', 'validate_failed',
        `Could not read ${file.path}: ${err.message}`,
        { path: file.path });
      processed += 1;
      continue;
    }

    let $;
    try {
      $ = cheerio.load(html);
    } catch (err) {
      logEntry('warn', 'validate_failed',
        `HTML parse failed for ${file.path}: ${err.message}`,
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

    // ── <a href> ────────────────────────────────────────────────────────
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (isExternalRef(href)) return;
      const resolved = resolveRef(file.path, href);
      if (!resolved) return;
      if (existing.has(resolved)) return;

      if (HTML_RX.test(resolved)) {
        reportMiss('warn', 'topic_file_not_found', href, resolved);
      } else if (ATTACHMENT_RX.test(resolved)) {
        reportMiss('warn', 'attachment_not_in_zip', href, resolved);
      } else {
        reportMiss('warn', 'broken_link', href, resolved);
      }
    });

    // ── <img src> ───────────────────────────────────────────────────────
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (isExternalRef(src)) return;
      const resolved = resolveRef(file.path, src);
      if (!resolved || existing.has(resolved)) return;
      reportMiss('warn',
        ATTACHMENT_RX.test(resolved) ? 'attachment_not_in_zip' : 'asset_not_in_zip',
        src, resolved);
    });

    // ── <link href> + <script src> (CSS/JS in the export) ──────────────
    $('link[href], script[src]').each((_, el) => {
      const isLink = el.tagName === 'link';
      const ref = isLink ? $(el).attr('href') : $(el).attr('src');
      if (isExternalRef(ref)) return;
      const resolved = resolveRef(file.path, ref);
      if (!resolved || existing.has(resolved)) return;
      reportMiss('warn', 'asset_not_in_zip', ref, resolved);
    });

    processed += 1;
    if (processed % 10 === 0) {
      send({ type: 'progress', processed, total: htmlFiles.length });
    }
  }

  send({ type: 'progress', processed, total: htmlFiles.length });
  send({
    type: 'summary',
    missingTopicCount,
    missingAttachmentCount,
    brokenLinkCount,
  });
  logEntry('info', 'validate_complete',
    `Validation complete: ${missingTopicCount} missing topics, ${missingAttachmentCount} missing attachments, ${brokenLinkCount} other broken links`,
    { missingTopicCount, missingAttachmentCount, brokenLinkCount });
  send({ type: 'done' });
}

run().catch((err) => {
  send({ type: 'error', message: err?.message || String(err) });
});
