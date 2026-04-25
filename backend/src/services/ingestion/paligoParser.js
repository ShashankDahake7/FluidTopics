'use strict';

/**
 * Paligo HTML5 Help Center ZIP parser.
 *
 * Detects and parses the Paligo-specific ZIP structure:
 *   {PubName}/out/
 *     toc-{lang}.html          ← authoritative navigation tree
 *     {lang}/
 *       params.manifest        ← publication metadata XML
 *       js/fuzzydata.js        ← pre-built Fuse.js index (optional)
 *       *.html                 ← topic content files
 *       subdir/*.html
 *     css/                     ← stylesheets
 *     js/ fonts/
 */

const path   = require('path');
const cheerio = require('cheerio');
const xml2js  = require('xml2js');

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Returns the `{PubName}/out/` prefix if this is a Paligo ZIP, otherwise null.
 * @param {Array<{path:string}>} files  — array from handleZip()
 */
const detectPaligoRoot = (files) => {
  // Match both layouts:
  //   {PubName}/out/toc-{lang}.html           (TOC at out/ level)
  //   {PubName}/out/{lang}/toc-{lang}.html    (TOC inside language subfolder)
  const tocEntry = files.find((f) =>
    /^[^/]+\/out\/(?:[^/]+\/)?toc-[^/]+\.html$/.test(f.path)
  );
  if (tocEntry) {
    return tocEntry.path.split('/').slice(0, 2).join('/') + '/';
  }
  return null;
};

// ---------------------------------------------------------------------------
// TOC parser
// ---------------------------------------------------------------------------

/**
 * Parses `toc-{lang}.html` into a flat array of topic entries.
 * Each entry carries { index, title, originId, permalink, topicLevel,
 *   timeModified, relativePrefix, anchor, parentIndex, children[] }.
 */
const parseTocHtml = (html) => {
  const $ = cheerio.load(html);
  const entries = [];

  const processLi = ($li, parentIndex) => {
    const $link = $li.children('a.topic-link').first();
    if (!$link.length) return;

    const href       = $link.attr('href') || '';
    const rawPermalink = $link.attr('data-permalink') || href.split('#')[0] || '';
    // Strip leading ./ or ../
    const permalink  = rawPermalink.replace(/^(\.\.?\/)+/, '');
    const anchor     = href.includes('#') ? href.split('#')[1] : '';

    const entry = {
      index:          entries.length,
      title:          $link.text().trim(),
      originId:       $link.attr('data-origin-id') || '',
      permalink,
      topicLevel:     parseInt($link.attr('data-topic-level') || '1', 10),
      timeModified:   $link.attr('data-time-modified') || '',
      relativePrefix: $link.attr('data-relative-prefix') || '',
      anchor,
      parentIndex,
      children:       [],
    };

    entries.push(entry);
    if (parentIndex !== null && entries[parentIndex]) {
      entries[parentIndex].children.push(entry.index);
    }

    // Recurse into nested <ul>
    $li.children('ul').children('li').each((_, childLi) => {
      processLi($(childLi), entry.index);
    });
  };

  $('ul').first().children('li').each((_, li) => {
    processLi($(li), null);
  });

  // Paligo often exports a flat <ul> with data-topic-level attributes instead of
  // nested <ul> elements. If DOM nesting gave us no parent-child relationships but
  // topicLevel varies, rebuild the hierarchy from the level values.
  const hasNesting       = entries.some((e) => e.parentIndex !== null);
  const levels           = new Set(entries.map((e) => e.topicLevel));
  const hasMultipleLevels = levels.size > 1;

  if (!hasNesting && hasMultipleLevels) {
    // Reset in case of partial state, then rebuild via level-stack algorithm
    entries.forEach((e) => { e.parentIndex = null; e.children = []; });

    const stack = []; // [{ level, index }]
    for (const entry of entries) {
      const lv = entry.topicLevel;
      while (stack.length > 0 && stack[stack.length - 1].level >= lv) stack.pop();
      if (stack.length > 0) {
        const parentIdx = stack[stack.length - 1].index;
        entry.parentIndex = parentIdx;
        entries[parentIdx].children.push(entry.index);
      }
      stack.push({ level: lv, index: entry.index });
    }
  }

  return entries;
};

// ---------------------------------------------------------------------------
// params.manifest parser
// ---------------------------------------------------------------------------

/**
 * Parses the Paligo `params.manifest` XML and returns a plain key→value map.
 */
const parseParamsManifest = async (xmlContent) => {
  try {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const result = await parser.parseStringPromise(xmlContent);
    const map = {};

    // Support both XML layouts:
    //   <map><entry key="k">v</entry></map>  (generic)
    //   <params><param name="k" select="v"/></params>  (Paligo)
    const fromEntry = result?.map?.entry;
    const fromParam = result?.params?.param;

    if (fromEntry) {
      const arr = Array.isArray(fromEntry) ? fromEntry : [fromEntry];
      arr.forEach((entry) => {
        const key = entry?.$ ? entry.$.key : entry.key;
        const val = entry?._ !== undefined ? entry._ : (typeof entry === 'string' ? entry : '');
        if (key) map[key] = val;
      });
    } else if (fromParam) {
      const arr = Array.isArray(fromParam) ? fromParam : [fromParam];
      arr.forEach((param) => {
        const key = param?.$?.name;
        const val = param?.$?.select ?? '';
        if (key) map[key] = val;
      });
    }

    return map;
  } catch (err) {
    console.warn('[paligoParser] params.manifest parse error:', err.message);
    return {};
  }
};

// ---------------------------------------------------------------------------
// Topic body extractor
// ---------------------------------------------------------------------------

const CONTENT_SELECTORS = [
  '.topic-content',
  '#content',
  '#content-wrapper',
  '[role="main"]',
  'main',
  'article',
  '.body-content',
  '.page-body',
  '.content',
];

/**
 * Strips the Paligo page chrome from a full topic HTML page and returns
 * only the body content (HTML string + plain text).
 */
const extractTopicBody = (html) => {
  const $ = cheerio.load(html);

  // Remove navigation chrome
  $('header, footer, nav, aside').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('[class*="breadcrumb"],[class*="sidebar"],[class*="toc-panel"],[class*="nav-"]').remove();
  $('[id*="sidebar"],[id*="toc"],[id*="nav"],[id*="header"],[id*="footer"]').remove();
  $('script, link[rel="stylesheet"], noscript').remove();

  // Find the actual content area
  let $content = null;
  for (const sel of CONTENT_SELECTORS) {
    const $found = $(sel).first();
    if ($found.length && ($found.html() || '').trim().length > 50) {
      $content = $found;
      break;
    }
  }
  if (!$content) $content = $('body');

  const htmlOut  = ($content.html() || '').trim();
  const textOut  = ($content.text() || '').replace(/\s+/g, ' ').trim();
  const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || '';

  return { html: htmlOut, text: textOut, pageTitle };
};

// ---------------------------------------------------------------------------
// TOC tree builder (compact, for storage)
// ---------------------------------------------------------------------------

const buildTocTree = (entries) => {
  const buildNode = (e) => ({
    title:      e.title,
    originId:   e.originId,
    permalink:  e.permalink,
    topicLevel: e.topicLevel,
    children:   e.children.map((ci) => buildNode(entries[ci])),
  });
  return entries.filter((e) => e.parentIndex === null).map(buildNode);
};

// ---------------------------------------------------------------------------
// Parse date like "03/31/2026" → Date
// ---------------------------------------------------------------------------
const parseModifiedDate = (dateStr) => {
  if (!dateStr) return null;
  const [m, d, y] = dateStr.split('/');
  if (!m || !d || !y) return null;
  const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  return isNaN(dt.getTime()) ? null : dt;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parses a Paligo ZIP into topic data + navigation tree + publication metadata.
 *
 * @param {Array}  files      — from handleZip()
 * @param {Array}  images     — from handleZip()
 * @param {string} rootPrefix — from detectPaligoRoot() e.g. 'Attendance/out/'
 * @param {string} langCode   — default 'en'
 * @returns {{ topicDataList, tocTree, publication }}
 */
const parsePaligoZip = async (files, images, rootPrefix, langCode = 'en') => {
  // Build a fast lookup map: zipPath → file entry
  const fileMap = {};
  files.forEach((f) => { fileMap[f.path] = f; });

  // ---- 1. Locate and parse toc-*.html ----
  const tocFile = files.find(
    (f) => f.path.startsWith(rootPrefix) && /toc-[^/]+\.html$/.test(f.path)
  );
  if (!tocFile) throw new Error('[paligoParser] toc-*.html not found in ZIP');

  const tocEntries = parseTocHtml(tocFile.content);
  console.log(`[paligoParser] TOC entries: ${tocEntries.length}`);

  // ---- 2. Detect language prefix ----
  // Try the requested langCode first; fall back to whatever folder exists
  let langPrefix = `${rootPrefix}${langCode}/`;
  const hasLangFolder = files.some((f) => f.path.startsWith(langPrefix));
  if (!hasLangFolder) {
    // Try to auto-detect: find a folder under rootPrefix that contains HTML files
    const candidate = files.find(
      (f) => f.path.startsWith(rootPrefix) && f.path.split('/').length >= 4 && f.path.endsWith('.html')
    );
    if (candidate) {
      const parts = candidate.path.split('/');
      langPrefix   = parts.slice(0, 3).join('/') + '/';
      console.log(`[paligoParser] Auto-detected language folder: ${langPrefix}`);
    }
  }

  // ---- 3. Parse params.manifest ----
  const manifestFile = files.find(
    (f) => f.path.startsWith(langPrefix) && f.path.endsWith('params.manifest')
  );
  let publication = {};
  if (manifestFile) {
    const params = await parseParamsManifest(manifestFile.content);
    publication = {
      publicationId:  params['publication.id'] || '',
      companyName:    params['company.name'] || '',
      copyright:      params['copyright'] || '',
      logoPath:       params['portal.logo.filename'] || '',
      backgroundPath: params['portal.background.filename'] || '',
      theme:          params['html5.theme'] || '1',
      contentTheme:   params['html5.content.theme'] || '1',
      portalTitle:    params['portal.title'] || params['portal.publication.title'] || params['publication.title'] || '',
      stickyHeader:   params['sticky.header'] === '1',
    };
  }

  // ---- 4. Build topic data from TOC entries ----
  //
  // Skip anchor-link entries: Paligo adds sub-section anchors (e.g. #id45407)
  // to the TOC for headings within a page. These have no data-origin-id and
  // their href contains a fragment. They are not separate topics.
  //
  // Also maintain a tocEntryIndex → topicDataList index map so that
  // parentIndex references (which are tocEntries indices) can be correctly
  // translated to topicDataList positions before being passed to savePaligoTopics.

  const tocIndexToListIndex = {};      // tocEntry.index → position in topicDataList
  const topicDataList       = [];

  for (const entry of tocEntries) {
    if (!entry.permalink) continue;
    if (entry.anchor && !entry.originId) continue; // skip in-page anchor headings

    tocIndexToListIndex[entry.index] = topicDataList.length;

    // Translate parent reference from tocEntries-space to topicDataList-space.
    // Walk up the ancestor chain in case the immediate parent was skipped.
    let parentListIndex = null;
    let pi = entry.parentIndex;
    while (pi !== null && pi !== undefined) {
      if (tocIndexToListIndex[pi] !== undefined) {
        parentListIndex = tocIndexToListIndex[pi];
        break;
      }
      pi = tocEntries[pi]?.parentIndex ?? null;
    }

    const htmlPath   = `${langPrefix}${entry.permalink}`;
    const fileEntry  = fileMap[htmlPath];
    let content      = { html: '', text: '' };

    if (fileEntry?.content) {
      const extracted = extractTopicBody(fileEntry.content);
      content = { html: extracted.html, text: extracted.text };
    } else {
      console.warn(`[paligoParser] Missing file for: ${entry.permalink}`);
    }

    topicDataList.push({
      title:        entry.title,
      originId:     entry.originId,
      permalink:    entry.permalink,
      topicLevel:   entry.topicLevel,
      timeModified: parseModifiedDate(entry.timeModified),
      parentIndex:  parentListIndex,
      order:        entry.index,
      content,
      sourcePath:   entry.permalink,
    });
  }

  const tocTree = buildTocTree(tocEntries);

  return { topicDataList, tocTree, publication, langPrefix };
};

module.exports = { detectPaligoRoot, parsePaligoZip, parseTocHtml, parseParamsManifest };
