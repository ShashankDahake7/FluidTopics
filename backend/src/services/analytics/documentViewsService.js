'use strict';

/**
 * Document views analytics — counts Analytics `view` events in a date range.
 * Structured: data.documentId. Unstructured: data.unstructuredId (tracked on file content load).
 */

const mongoose = require('mongoose');
const Analytics = require('../../models/Analytics');
const Document = require('../../models/Document');
const UnstructuredDocument = require('../../models/UnstructuredDocument');

const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 3660;

function parseStart(d) {
  if (!d) return new Date(Date.now() - 30 * DAY_MS);
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? new Date(Date.now() - 30 * DAY_MS) : x;
}

function parseEnd(d) {
  if (!d) return new Date();
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? new Date() : x;
}

function customFieldsToObject(meta) {
  if (!meta) return {};
  const out = {};
  const cf = meta.customFields;
  if (cf && typeof cf.get === 'function') {
    for (const [k, v] of cf.entries()) out[k] = v;
  } else if (cf && typeof cf === 'object') {
    Object.assign(out, cf);
  }
  return out;
}

function metadataRowsFromDoc(meta, source = 'structured') {
  const rows = [];
  const flat = source === 'structured' ? customFieldsToObject(meta) : {};
  const flatKeys = new Set(Object.keys(flat));
  if (source === 'structured') {
    for (const [key, value] of Object.entries(flat)) {
      const label = humanLabel(key);
      rows.push({
        key,
        label,
        values: [String(value ?? '')],
        display: `${label}(${key}): ${String(value ?? '')}`,
      });
    }
  }
  if (meta?.tags?.length && !flatKeys.has('tags')) {
    const v = meta.tags.join(', ');
    rows.push({
      key: 'tags',
      label: 'tags',
      values: [v],
      display: `tags(tags): ${v}`,
    });
  }
  if (meta?.product && !flatKeys.has('product')) {
    rows.push({
      key: 'product',
      label: 'product',
      values: [String(meta.product)],
      display: `product(product): ${meta.product}`,
    });
  }
  if (source === 'unstructured' && meta?.author) {
    rows.push({
      key: 'author',
      label: 'author',
      values: [String(meta.author)],
      display: `author(author): ${meta.author}`,
    });
  }
  return rows;
}

function humanLabel(key) {
  const i = key.lastIndexOf(':');
  return i >= 0 ? key.slice(i + 1) : key;
}

/**
 * @param {object} reqBody
 * @param {string} [reqBody.startDate]
 * @param {string} [reqBody.endDate]
 * @param {object} [reqBody.paging]
 * @param {object} [reqBody.filters]
 * @param {'asc'|'desc'} [reqBody.sortOrder]
 */
async function getDocumentViewsTop(reqBody) {
  const { startDate, endDate, paging, filters, sortOrder } = reqBody || {};
  const page = Math.max(1, parseInt(paging?.page, 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(paging?.perPage, 10) || 50));

  let since = parseStart(startDate);
  let until = parseEnd(endDate);
  if (until < since) {
    const t = since;
    since = until;
    until = t;
  }
  const spanDays = (until - since) / DAY_MS;
  if (spanDays > MAX_RANGE_DAYS) {
    since = new Date(until.getTime() - MAX_RANGE_DAYS * DAY_MS);
  }

  let userId = null;
  if (filters?.userId && mongoose.isValidObjectId(filters.userId)) {
    userId = new mongoose.Types.ObjectId(filters.userId);
  }

  const matchView = {
    eventType: 'view',
    timestamp: { $gte: since, $lte: until },
  };
  if (userId) matchView.userId = userId;

  const [structuredCounts, unstructuredCounts] = await Promise.all([
    Analytics.aggregate([
      { $match: { ...matchView, 'data.documentId': { $exists: true, $ne: null } } },
      { $group: { _id: '$data.documentId', count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      { $match: { ...matchView, 'data.unstructuredId': { $exists: true, $ne: null } } },
      { $group: { _id: '$data.unstructuredId', count: { $sum: 1 } } },
    ]),
  ]);

  const byDoc = {};
  for (const r of structuredCounts) {
    if (r._id) byDoc[String(r._id)] = r.count;
  }
  const byUnstruct = {};
  for (const r of unstructuredCounts) {
    if (r._id) byUnstruct[String(r._id)] = r.count;
  }

  const docs = await Document.find({ status: 'completed' })
    .select('title metadata topicIds isPaligoFormat publication originalFilename prettyUrl sourceFormat')
    .lean();
  const unstruct = await UnstructuredDocument.find({})
    .select('title metadata filename mimeType')
    .lean();

  const titleQ = (filters?.titleQuery || '').trim().toLowerCase();

  let combined = [
    ...docs.map((d) => {
      const id = String(d._id);
      const displayCount = byDoc[id] || 0;
      const metaRows = metadataRowsFromDoc(d.metadata, 'structured');
      const contentKind = d.isPaligoFormat ? 'ARTICLE' : 'BOOK';
      return {
        id,
        title: d.title || d.originalFilename || 'Untitled',
        type: 'STRUCTURED_DOCUMENT',
        contentKind,
        displayCount,
        link: `/dashboard/docs/${id}`,
        metadata: metaRows,
      };
    }),
    ...unstruct.map((u) => {
      const id = String(u._id);
      const displayCount = byUnstruct[id] || 0;
      const metaRows = metadataRowsFromDoc(u.metadata, 'unstructured');
      return {
        id,
        title: u.title || u.filename || 'Untitled',
        type: 'UNSTRUCTURED_DOCUMENT',
        contentKind: 'UNSTRUCTURED',
        displayCount,
        link: `/dashboard/file/${id}`,
        metadata: metaRows,
      };
    }),
  ];

  if (titleQ) {
    combined = combined.filter((r) => r.title.toLowerCase().includes(titleQ));
  }

  if (filters?.metadata && filters.metadata.length > 0) {
    combined = combined.filter((doc) =>
      filters.metadata.every((filter) => {
        const row = doc.metadata.find((m) => m.key === filter.key);
        if (!row) return false;
        return filter.values.some((val) => row.values.includes(val));
      }),
    );
  }

  const desc = sortOrder !== 'asc';
  combined.sort((a, b) => (desc ? b.displayCount - a.displayCount : a.displayCount - b.displayCount));

  const totalDisplayCount = combined.reduce((s, d) => s + d.displayCount, 0);
  const totalCount = combined.length;
  const startIdx = (page - 1) * perPage;
  const results = combined.slice(startIdx, startIdx + perPage);

  return {
    startDate: since.toISOString(),
    endDate: until.toISOString(),
    totalDisplayCount,
    paging: {
      page,
      perPage,
      totalCount,
      lastPage: startIdx + perPage >= totalCount,
    },
    results,
  };
}

/**
 * Per-topic view counts in range for heatmap (structured documents only).
 */
async function getTopicViewCountsForDocument(documentId, { startDate, endDate, userId } = {}) {
  let since = parseStart(startDate);
  let until = parseEnd(endDate);
  if (until < since) [since, until] = [until, since];

  const match = {
    eventType: 'view',
    timestamp: { $gte: since, $lte: until },
    'data.documentId': new mongoose.Types.ObjectId(documentId),
    'data.topicId': { $exists: true, $ne: null },
  };
  if (userId && mongoose.isValidObjectId(userId)) {
    match.userId = new mongoose.Types.ObjectId(userId);
  }

  const rows = await Analytics.aggregate([
    { $match: match },
    { $group: { _id: '$data.topicId', count: { $sum: 1 } } },
  ]);
  const map = {};
  for (const r of rows) {
    if (r._id) map[String(r._id)] = r.count;
  }
  return map;
}

async function countDocumentViewsInRange(documentId, { startDate, endDate, userId } = {}) {
  let since = parseStart(startDate);
  let until = parseEnd(endDate);
  if (until < since) [since, until] = [until, since];

  const match = {
    eventType: 'view',
    timestamp: { $gte: since, $lte: until },
    'data.documentId': new mongoose.Types.ObjectId(documentId),
  };
  if (userId && mongoose.isValidObjectId(userId)) {
    match.userId = new mongoose.Types.ObjectId(userId);
  }

  const r = await Analytics.aggregate([
    { $match: match },
    { $group: { _id: null, count: { $sum: 1 } } },
  ]);
  return r[0]?.count || 0;
}

module.exports = {
  getDocumentViewsTop,
  getTopicViewCountsForDocument,
  countDocumentViewsInRange,
  parseStart,
  parseEnd,
};
