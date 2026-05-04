'use strict';

/**
 * Topic views — counts Analytics `view` events with `data.topicId` in a date range.
 */

const mongoose = require('mongoose');
const Analytics = require('../../models/Analytics');
const Topic = require('../../models/Topic');

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

/**
 * @param {string} key
 * @param {{ documentKind: string, hasParent: boolean }} row
 */
function typePredicate(key, row) {
  const { documentKind, hasParent } = row;
  switch (key) {
    case 'books':
      return documentKind === 'BOOK';
    case 'articles':
      return documentKind === 'ARTICLE';
    case 'unstructuredDocuments':
      return documentKind === 'UNSTRUCTURED';
    case 'topics':
      return documentKind === 'BOOK' && !hasParent;
    case 'attachments':
      return hasParent;
    default:
      return false;
  }
}

function matchesTypes(row, typeKeys) {
  if (!typeKeys || typeKeys.length === 0) return true;
  return typeKeys.some((k) => typePredicate(k, row));
}

/**
 * @param {object} reqBody
 */
async function getTopicViewsTop(reqBody) {
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
    'data.topicId': { $exists: true, $ne: null },
  };
  if (userId) matchView.userId = userId;

  const countsAgg = await Analytics.aggregate([
    { $match: matchView },
    { $group: { _id: '$data.topicId', count: { $sum: 1 } } },
  ]);

  const topicViewCounts = {};
  for (const r of countsAgg) {
    if (r._id) topicViewCounts[String(r._id)] = r.count;
  }

  const topics = await Topic.find({})
    .populate({
      path: 'documentId',
      select: 'title originalFilename isPaligoFormat status',
      match: { status: 'completed' },
    })
    .lean();

  const typeKeys = filters?.type && filters.type.length ? filters.type : null;

  let rows = [];
  for (const t of topics) {
    const doc = t.documentId;
    if (!doc) continue;

    const id = String(t._id);
    const views = topicViewCounts[id] || 0;

    let documentKind = 'BOOK';
    if (doc.isPaligoFormat) documentKind = 'ARTICLE';
    // Structured Topic → Document only in this schema (no unstructured branch here).

    const hasParent = !!(t.hierarchy && t.hierarchy.parent);

    const topicTitle = t.title || 'Untitled Topic';
    const documentTitle = doc.title || doc.originalFilename || 'Unknown Document';

    let contentKind = 'BOOK';
    if (documentKind === 'ARTICLE') contentKind = 'ARTICLE';
    if (documentKind === 'UNSTRUCTURED') contentKind = 'UNSTRUCTURED';

    const row = {
      id,
      topicTitle,
      views,
      documentTitle,
      documentId: String(doc._id),
      contentKind,
      documentKind,
      hasParent,
    };

    if (!matchesTypes(row, typeKeys)) continue;

    rows.push(row);
  }

  const tq = (filters?.topicTitleQuery || '').trim().toLowerCase();
  if (tq) {
    rows = rows.filter((r) => r.topicTitle.toLowerCase().includes(tq));
  }
  const dq = (filters?.documentTitleQuery || '').trim().toLowerCase();
  if (dq) {
    rows = rows.filter((r) => r.documentTitle.toLowerCase().includes(dq));
  }

  const desc = sortOrder !== 'asc';
  rows.sort((a, b) => (desc ? b.views - a.views : a.views - b.views));

  const totalDisplayCount = rows.reduce((s, r) => s + r.views, 0);
  const totalCount = rows.length;
  const startIdx = (page - 1) * perPage;
  const results = rows.slice(startIdx, startIdx + perPage).map((r) => ({
    id: r.id,
    topicTitle: r.topicTitle,
    views: r.views,
    documentTitle: r.documentTitle,
    documentId: r.documentId,
    contentKind: r.contentKind,
  }));

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

module.exports = { getTopicViewsTop };
