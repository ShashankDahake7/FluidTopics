'use strict';

/**
 * Extract Paligo / DocBook-xinfo metadata for Topic.metadata.custom (registry +
 * metadata configuration UI). Also synthesizes Fluid Topics–style ft:* keys from
 * Paligo XML/HTML exports when the real FT pipeline is not present.
 */

const cheerio = require('cheerio');
const { RESERVED_KEYS } = require('../../models/MetadataKey');

function isReservedKey(key) {
  return RESERVED_KEYS.includes(String(key || '').trim().toLowerCase());
}

function pushUnique(bucket, rawKey, rawVal) {
  if (!rawKey || rawVal == null) return;
  const key = String(rawKey).trim();
  if (!key || isReservedKey(key)) return;
  const val = String(rawVal).trim();
  if (!val) return;
  if (!bucket[key]) bucket[key] = [];
  if (!bucket[key].includes(val)) bucket[key].push(val);
}

function mergeCustomMaps(target, source) {
  if (!target || !source) return target;
  for (const [k, vals] of Object.entries(source)) {
    if (!Array.isArray(vals)) continue;
    vals.forEach((v) => pushUnique(target, k, v));
  }
  return target;
}

/**
 * Parse DocBook 5 + Paligo xinfo from an already-loaded cheerio @param $ (xmlMode).
 * @param {import('cheerio').CheerioAPI} $
 * @returns {Record<string, string[]>}
 */
function extractPaligoDocbookFromCheerio($) {
  const out = {};
  if (!$) return out;

  const root = $('article, book, chapter').filter((_, el) => el).first();
  const scope = root.length ? root : $('*').first();

  // Root attributes: xinfo:*, xml:lang, xml:id
  if (scope.length) {
    const attribs = scope.get(0)?.attribs || {};
    Object.entries(attribs).forEach(([name, val]) => {
      if (!val) return;
      const n = String(name).toLowerCase();
      if (n.startsWith('xinfo:')) pushUnique(out, name, val);
      else if (n === 'xml:lang') {
        pushUnique(out, 'ft:locale', val);
      } else if (n === 'xml:id') {
        pushUnique(out, 'ud:id', val);
      }
    });
  }

  const info = scope.find('> info').first();
  if (info.length) {
    const titleEl = info.find('> title').first();
    const titleText = titleEl.text().replace(/\s+/g, ' ').trim();
    const titleAttrText = titleEl.attr('xinfo:text');
    if (titleText) {
      pushUnique(out, 'ft:title', titleText);
      pushUnique(out, 'ft:topicTitle', titleText);
      pushUnique(out, 'paligo:resourceTitle', titleText);
    }
    if (titleAttrText) pushUnique(out, 'xinfo:text', titleAttrText);

    const sub = info.find('> subtitle').first().text().replace(/\s+/g, ' ').trim();
    if (sub) pushUnique(out, 'subtitle', sub);

    info.find('> author > personname').each((_, el) => {
      const pname = $(el);
      const authorTxt = pname.text().replace(/\s+/g, ' ').trim();
      const authorAttrText = pname.attr('xinfo:text');
      if (authorTxt) pushUnique(out, 'author_personname', authorTxt);
      if (authorAttrText) pushUnique(out, 'author_personname_xinfo_text', authorAttrText);
    });

    info.find('> authorgroup > author > personname').each((_, el) => {
      const pname = $(el);
      const authorTxt = pname.text().replace(/\s+/g, ' ').trim();
      const authorAttrText = pname.attr('xinfo:text');
      if (authorTxt) pushUnique(out, 'authorgroup_author_personname', authorTxt);
      if (authorAttrText) pushUnique(out, 'authorgroup_author_personname_xinfo_text', authorAttrText);
    });

    const year = info.find('copyright year').first().text().replace(/\s+/g, ' ').trim();
    const holder = info.find('copyright holder').first().text().replace(/\s+/g, ' ').trim();
    if (year || holder) {
      const copyStr = [year, holder].filter(Boolean).join(' — ');
      if (copyStr) pushUnique(out, 'copyright', copyStr);
    }

    const vol = info.find('> volumenum').first().text().replace(/\s+/g, ' ').trim();
    if (vol && !/^\s*\?/.test(vol)) pushUnique(out, 'Key', vol);

    const pubdate = info.find('> pubdate').first().text().replace(/\s+/g, ' ').trim();
    if (pubdate && !/placeholder/i.test(pubdate)) pushUnique(out, 'publicationDate', pubdate);
  }

  // Mirror common xinfo attrs onto friendly keys when present on root
  const rt = scope.attr('xinfo:resource-title') || scope.attr('resource-title');
  if (rt) pushUnique(out, 'paligo:resourceTitle', rt);
  const rtl = scope.attr('xinfo:resource-titlelabel') || scope.attr('resource-titlelabel');
  if (rtl !== undefined) pushUnique(out, 'paligo:resourceTitleLabel', rtl);
  const rid = scope.attr('xinfo:resource-id') || scope.attr('resource-id');
  if (rid) {
    pushUnique(out, 'xinfo:document_id', rid);
    pushUnique(out, 'data_origin_id', rid);
  }
  const ru = scope.attr('xinfo:resource');
  if (ru) pushUnique(out, 'xinfo:origin_id', ru);

  const vmaj = scope.attr('xinfo:version-major');
  const vmin = scope.attr('xinfo:version-minor');
  if (vmaj) pushUnique(out, 'xinfo:version_major', vmaj);
  if (vmin) pushUnique(out, 'xinfo:version_minor', vmin);

  const rtype = scope.attr('xinfo:resource-type') || scope.attr('resource-type');
  if (rtype) {
    pushUnique(out, 'xinfo:resource-type', rtype);
    pushUnique(out, 'ft:document_type', rtype);
  }

  return out;
}

/**
 * @param {string} xmlContent
 * @returns {Record<string, string[]>}
 */
function extractPaligoDocbookFromXml(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') return {};
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true, decodeEntities: false });
    return extractPaligoDocbookFromCheerio($);
  } catch {
    return {};
  }
}

/**
 * Derive ft:* and related fields from extracted maps + content stats.
 * @param {Record<string, string[]>} custom — mutated in place
 * @param {{ plainText?: string, xmlLang?: string }} ctx
 * @param {{ skipMimeType?: boolean, skipStructure?: boolean }} opts
 */
function synthesizeFluidTopicsFields(custom, ctx = {}, opts = {}) {
  const text = ctx.plainText || '';
  const words = text.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const wc = words.length;
  if (wc > 0) pushUnique(custom, 'ft:wordCount', String(wc));

  if (!opts.skipMimeType && !firstVal(custom, 'ft:mimeType')) {
    pushUnique(custom, 'ft:mimeType', 'application/xml');
  }
  if (!opts.skipStructure && !firstVal(custom, 'ft:structure')) {
    pushUnique(custom, 'ft:structure', 'xml');
  }

  const lang = ctx.xmlLang || '';
  if (lang) pushUnique(custom, 'ft:locale', lang);

  const rtype = firstVal(custom, 'xinfo:resource-type') || firstVal(custom, 'ft:document_type') || '';
  const rt = String(rtype).toLowerCase();
  if (rt) {
    pushUnique(custom, 'ft:isPublication', rt.includes('publication') ? 'true' : 'false');
    pushUnique(custom, 'ft:isArticle', rt === 'topic' || rt.includes('article') ? 'true' : 'false');
    pushUnique(custom, 'ft:isBook', rt.includes('book') ? 'true' : 'false');
  }

  const title = firstVal(custom, 'ft:title') || firstVal(custom, 'paligo:resourceTitle');
  if (title) {
    pushUnique(custom, 'ft:title', title);
    pushUnique(custom, 'Name', title);
  }
}

function firstVal(custom, key) {
  const v = custom[key];
  if (!v || !v.length) return '';
  return v[0];
}

/**
 * HTML topic files from Paligo Help Center export – best-effort meta + data-* props.
 * @param {string} html
 * @returns {Record<string, string[]>}
 */
function extractPaligoHtmlAuxiliary(html) {
  const out = {};
  if (!html || typeof html !== 'string') return out;

  let $;
  try {
    $ = cheerio.load(html);
  } catch {
    return out;
  }

  $('[data-origin-id]').each((_, el) => {
    const id = $(el).attr('data-origin-id');
    if (id) {
      pushUnique(out, 'data_origin_id', id);
      pushUnique(out, 'ft:originId', id);
    }
    const tm = $(el).attr('data-time-modified');
    if (tm) {
      pushUnique(out, 'data_time_modified', tm);
      pushUnique(out, 'ft:lastTechChangeTimestamp', tm);
    }
  });

  $('meta[name]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (!name || !content) return;
    const n = name.toLowerCase();
    if (['viewport', 'charset'].includes(n)) return;
    pushUnique(out, name, content);
  });

  return out;
}

/**
 * Metadata bag for one Paligo TOC topic + publication params.manifest map.
 * @param {object} td — topicDataList entry from paligoParser
 * @param {object} publication — from parseParamsManifest-derived shape
 */
function buildPaligoZipTopicCustom(td, publication = {}) {
  const custom = {};
  const pub = publication || {};
  const modifiedIso = td.timeModified && td.timeModified instanceof Date && !isNaN(td.timeModified.getTime())
    ? td.timeModified.toISOString()
    : '';

  if (td.title) {
    pushUnique(custom, 'ft:title', td.title);
    pushUnique(custom, 'ft:topicTitle', td.title);
    pushUnique(custom, 'paligo:resourceTitle', td.title);
    pushUnique(custom, 'Name', td.title);
    pushUnique(custom, 'title', td.title);
  }

  if (td.originId) {
    pushUnique(custom, 'data_origin_id', td.originId);
    pushUnique(custom, 'ft:originId', td.originId);
    pushUnique(custom, 'ud:id', td.originId);
    pushUnique(custom, 'ft:baseId', td.originId);
    pushUnique(custom, 'xinfo:origin', td.originId);
    pushUnique(custom, 'xinfo:origin_id', td.originId);
  }

  if (modifiedIso) {
    pushUnique(custom, 'data_time_modified', modifiedIso);
    pushUnique(custom, 'Modified', modifiedIso);
    pushUnique(custom, 'ft:lastEdition', modifiedIso);
    pushUnique(custom, 'ft:lastPublication', modifiedIso);
    pushUnique(custom, 'ft:lastTechChange', modifiedIso);
    pushUnique(custom, 'ft:lastTechChangeTimestamp', modifiedIso);
  }

  if (pub.portalTitle) pushUnique(custom, 'ft:publication_title', pub.portalTitle);
  if (pub.publicationId) pushUnique(custom, 'ft:publicationId', String(pub.publicationId));
  if (pub.copyright) pushUnique(custom, 'copyright', pub.copyright);

  const text = td.content?.text || '';
  pushUnique(custom, 'ft:document_type', 'paligo-html-topic');
  pushUnique(custom, 'ft:editorialType', 'paligo-html-topic');
  pushUnique(custom, 'ft:filename', td.sourcePath || td.permalink || '');
  pushUnique(custom, 'ft:contentSize', String(Buffer.byteLength(td.content?.html || text || '', 'utf8')));
  pushUnique(custom, 'ft:tocPosition', String(td.order ?? ''));
  pushUnique(custom, 'ft:clusterId', pub.publicationId || '');
  pushUnique(custom, 'ft:container', pub.portalTitle || '');
  pushUnique(custom, 'ft:isAttachment', 'false');
  pushUnique(custom, 'ft:isHtmlPackage', 'true');
  pushUnique(custom, 'ft:isSynchronousAttachment', 'false');
  pushUnique(custom, 'ft:isUnstructured', 'false');
  pushUnique(custom, 'ft:khubVersion', '1');
  pushUnique(custom, 'ft:openMode', 'internal');
  pushUnique(custom, 'ft:prettyUrl', td.permalink || td.sourcePath || '');
  pushUnique(custom, 'ft:publishStatus', 'published');
  pushUnique(custom, 'ft:publishUploadId', pub.publicationId || '');
  pushUnique(custom, 'ft:searchableFromInt', '0');
  pushUnique(custom, 'ft:sourceCategory', 'Paligo');
  pushUnique(custom, 'ft:sourceId', 'paligo');
  pushUnique(custom, 'ft:sourceName', 'Paligo');
  pushUnique(custom, 'ft:sourceType', 'paligo');
  pushUnique(custom, 'generator', 'Paligo');
  pushUnique(custom, 'xinfo:contribution_editable', 'false');
  pushUnique(custom, 'xinfo:pagebreak', 'false');

  // Help Center HTML may carry extra tags (merge before synthesis so flags see real ids)
  if (td.content?.html) {
    const hx = extractPaligoHtmlAuxiliary(td.content.html);
    Object.entries(hx).forEach(([k, vals]) => {
      vals.forEach((v) => pushUnique(custom, k, v));
    });
  }

  synthesizeFluidTopicsFields(
    custom,
    { plainText: text, xmlLang: 'en' },
    { skipMimeType: true, skipStructure: true },
  );

  pushUnique(custom, 'ft:mimeType', 'text/html');
  pushUnique(custom, 'ft:structure', 'html');

  return custom;
}

module.exports = {
  extractPaligoDocbookFromXml,
  extractPaligoDocbookFromCheerio,
  mergeCustomMaps,
  synthesizeFluidTopicsFields,
  extractPaligoHtmlAuxiliary,
  buildPaligoZipTopicCustom,
  pushUnique,
};
