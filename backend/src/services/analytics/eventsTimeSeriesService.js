'use strict';

/**
 * Traffic → Events time series — maps stored telemetry to Fluid Topics-style event names.
 * Buckets align with generatePeriodsHelper() from analytics routes (same windows as user-traffic).
 */

const Analytics = require('../../models/Analytics');
const Rating = require('../../models/Rating');
const Feedback = require('../../models/Feedback');
const Bookmark = require('../../models/Bookmark');
const Collection = require('../../models/Collection');
const PersonalBook = require('../../models/PersonalBook');
const SavedSearch = require('../../models/SavedSearch');

function generatePeriods(startDate, endDate, groupByPeriod) {
  const p = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur < end) {
    let pEnd = new Date(cur);
    if (groupByPeriod === 'day') pEnd.setDate(pEnd.getDate() + 1);
    else if (groupByPeriod === 'week') pEnd.setDate(pEnd.getDate() + 7);
    else pEnd.setMonth(pEnd.getMonth() + 1);
    if (pEnd > end) pEnd = new Date(end);
    p.push({ periodStartDate: cur.toISOString(), periodEndDate: pEnd.toISOString() });
    cur = new Date(pEnd);
  }
  return p;
}

function bucketBoundaries(periods) {
  if (!periods.length) return [];
  const b = periods.map((x) => new Date(x.periodStartDate).getTime());
  b.push(new Date(periods[periods.length - 1].periodEndDate).getTime());
  return b;
}

function toBucketKey(v) {
  if (v == null) return NaN;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}

function bucketOutputToSeries(bucketResult, periods) {
  const n = periods.length;
  const out = Array(n).fill(0);
  const starts = periods.map((p) => new Date(p.periodStartDate).getTime());
  for (const row of bucketResult) {
    if (row._id === n || row._id === '_other') continue;
    const key = toBucketKey(row._id);
    if (Number.isNaN(key)) continue;
    const idx = starts.findIndex((s) => Math.abs(s - key) < 2);
    if (idx >= 0) out[idx] = row.c || 0;
  }
  return out;
}

async function aggregateAnalyticsByPeriod(periods, matchQuery) {
  const n = periods.length;
  if (!n) return [];
  const boundaries = bucketBoundaries(periods);
  const start = new Date(periods[0].periodStartDate);
  const end = new Date(periods[n - 1].periodEndDate);

  const raw = await Analytics.aggregate([
    {
      $match: {
        ...matchQuery,
        timestamp: { $gte: start, $lt: end },
      },
    },
    {
      $bucket: {
        groupBy: { $toLong: '$timestamp' },
        boundaries,
        default: n,
        output: { c: { $sum: 1 } },
      },
    },
  ]);
  return bucketOutputToSeries(raw, periods);
}

async function aggregateByDateField(Model, periods, dateField, extraMatch) {
  const n = periods.length;
  if (!n) return [];
  const boundaries = bucketBoundaries(periods);
  const start = new Date(periods[0].periodStartDate);
  const end = new Date(periods[n - 1].periodEndDate);

  const raw = await Model.aggregate([
    {
      $match: {
        ...extraMatch,
        [dateField]: { $gte: start, $lt: end },
      },
    },
    {
      $bucket: {
        groupBy: { $toLong: `$${dateField}` },
        boundaries,
        default: n,
        output: { c: { $sum: 1 } },
      },
    },
  ]);
  return bucketOutputToSeries(raw, periods);
}

async function aggregatePersonalBookUpdates(periods) {
  return aggregateByDateField(PersonalBook, periods, 'updatedAt', {
    $expr: { $gt: ['$updatedAt', '$createdAt'] },
  });
}

/** Named ft events (optional per-row data.count for bulk). */
async function aggregateFtEventWeighted(periods, ftEventName) {
  const n = periods.length;
  if (!n) return [];
  const boundaries = bucketBoundaries(periods);
  const start = new Date(periods[0].periodStartDate);
  const end = new Date(periods[n - 1].periodEndDate);

  const raw = await Analytics.aggregate([
    {
      $match: {
        eventType: 'event',
        'data.ftEvent': ftEventName,
        timestamp: { $gte: start, $lt: end },
      },
    },
    {
      $addFields: {
        _w: {
          $cond: {
            if: { $and: [{ $ne: ['$data.count', null] }, { $gt: ['$data.count', 0] }] },
            then: '$data.count',
            else: 1,
          },
        },
      },
    },
    {
      $bucket: {
        groupBy: { $toLong: '$timestamp' },
        boundaries,
        default: n,
        output: {
          c: { $sum: '$_w' },
        },
      },
    },
  ]);
  return bucketOutputToSeries(raw, periods);
}

async function getEventsTimeSeries({ startDate, endDate, groupByPeriod }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return {
      startDate,
      endDate,
      groupByPeriod,
      periods: [],
      series: {},
    };
  }

  const periods = generatePeriods(start, end, groupByPeriod);

  const [
    docStartDisplay,
    topicStartDisplay,
    pageDisplay,
    khubSearch,
    documentSearch,
    linkShare,
    documentPrint,
    documentDownload,
    feedbackSend,
    topicRate,
    docRate,
    bookmarkCreate,
    collectionCreate,
    collectionUpdate,
    personalBookCreate,
    personalBookUpdate,
    savedSearchCreate,
    savedSearchUpdate,
    searchPageSelect,
    documentUnrate,
    topicUnrate,
    bookmarkDelete,
    collectionDelete,
    personalBookDelete,
    savedSearchDelete,
    personalTopicCreate,
    personalTopicDelete,
    personalTopicUpdate,
  ] = await Promise.all([
    aggregateAnalyticsByPeriod(periods, {
      eventType: 'view',
      $or: [
        {
          $and: [
            { 'data.documentId': { $exists: true, $ne: null } },
            {
              $or: [
                { 'data.topicId': { $exists: false } },
                { 'data.topicId': null },
              ],
            },
          ],
        },
        { 'data.unstructuredId': { $exists: true, $ne: null } },
      ],
    }),
    aggregateAnalyticsByPeriod(periods, {
      eventType: 'view',
      'data.topicId': { $exists: true, $ne: null },
    }),
    aggregateAnalyticsByPeriod(periods, {
      eventType: 'view',
      $and: [
        {
          $or: [
            { 'data.documentId': { $exists: false } },
            { 'data.documentId': null },
          ],
        },
        {
          $or: [{ 'data.topicId': { $exists: false } }, { 'data.topicId': null }],
        },
        {
          $or: [
            { 'data.unstructuredId': { $exists: false } },
            { 'data.unstructuredId': null },
          ],
        },
      ],
    }),
    aggregateAnalyticsByPeriod(periods, {
      eventType: 'search',
      $nor: [{ 'data.inDocument': true }],
    }),
    aggregateAnalyticsByPeriod(periods, {
      eventType: 'search',
      'data.inDocument': true,
    }),
    aggregateAnalyticsByPeriod(periods, { eventType: 'share' }),
    aggregateAnalyticsByPeriod(periods, { eventType: 'print' }),
    aggregateAnalyticsByPeriod(periods, { eventType: 'download' }),
    aggregateByDateField(Feedback, periods, 'createdAt', {}),
    aggregateByDateField(Rating, periods, 'createdAt', {
      topicId: { $exists: true, $ne: null },
    }),
    aggregateByDateField(Rating, periods, 'createdAt', {
      $and: [
        {
          $or: [
            { topicId: null },
            { topicId: { $exists: false } },
          ],
        },
        {
          $or: [
            { documentId: { $exists: true, $ne: null } },
            { unstructuredId: { $exists: true, $ne: null } },
          ],
        },
      ],
    }),
    aggregateByDateField(Bookmark, periods, 'createdAt', {}),
    aggregateByDateField(Collection, periods, 'createdAt', {}),
    aggregateByDateField(Collection, periods, 'updatedAt', {
      $expr: { $gt: ['$updatedAt', '$createdAt'] },
    }),
    aggregateByDateField(PersonalBook, periods, 'createdAt', {}),
    aggregatePersonalBookUpdates(periods),
    aggregateByDateField(SavedSearch, periods, 'createdAt', {}),
    aggregateByDateField(SavedSearch, periods, 'updatedAt', {
      $expr: { $gt: ['$updatedAt', '$createdAt'] },
    }),
    aggregateFtEventWeighted(periods, 'search_page.select'),
    aggregateFtEventWeighted(periods, 'document.unrate'),
    aggregateFtEventWeighted(periods, 'topic.unrate'),
    aggregateFtEventWeighted(periods, 'bookmark.delete'),
    aggregateFtEventWeighted(periods, 'collection.delete'),
    aggregateFtEventWeighted(periods, 'personal_book.delete'),
    aggregateFtEventWeighted(periods, 'saved_search.delete'),
    aggregateFtEventWeighted(periods, 'personal_topic.create'),
    aggregateFtEventWeighted(periods, 'personal_topic.delete'),
    aggregateFtEventWeighted(periods, 'personal_topic.update'),
  ]);

  const series = {
    'document.start_display': docStartDisplay,
    'topic.start_display': topicStartDisplay,
    'page.display': pageDisplay,
    'khub.search': khubSearch,
    'search_page.select': searchPageSelect,
    'document.search': documentSearch,
    'link.share': linkShare,
    'feedback.send': feedbackSend,
    'document.rate': docRate,
    'topic.rate': topicRate,
    'document.unrate': documentUnrate,
    'topic.unrate': topicUnrate,
    'document.print': documentPrint,
    'document.download': documentDownload,
    'bookmark.delete': bookmarkDelete,
    'bookmark.create': bookmarkCreate,
    'collection.create': collectionCreate,
    'collection.delete': collectionDelete,
    'collection.update': collectionUpdate,
    'personal_book.create': personalBookCreate,
    'personal_book.delete': personalBookDelete,
    'personal_book.update': personalBookUpdate,
    'personal_topic.create': personalTopicCreate,
    'personal_topic.delete': personalTopicDelete,
    'personal_topic.update': personalTopicUpdate,
    'saved_search.create': savedSearchCreate,
    'saved_search.delete': savedSearchDelete,
    'saved_search.update': savedSearchUpdate,
  };

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    groupByPeriod,
    periods,
    series,
  };
}

module.exports = {
  getEventsTimeSeries,
  generatePeriods,
};
