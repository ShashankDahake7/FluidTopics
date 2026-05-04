'use strict';

/**
 * Analytics → Searches with no results: zero-hit portal searches from `GET /api/search`.
 * Groups by normalized term + filter signature. Excludes in-document search and suspicious queries.
 */

const Analytics = require('../../models/Analytics');
const { mongoSafeSearchQueryConditions } = require('../../utils/searchQuerySafety');
const { facetsFromFilters } = require('../../utils/searchFacetDisplay');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '730', 10);
const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 10000;

function buildLocaleMatch(locale) {
  const s = locale != null ? String(locale).trim() : '';
  if (s === '__all_languages__' || s === 'all_languages') {
    return { 'data.searchLanguageParam': { $in: ['all', '*'] } };
  }
  if (s && s.toLowerCase() !== 'all') {
    return { 'data.filters.language': s };
  }
  return null;
}

async function getSearchNoResultsAnalytics(body = {}) {
  const {
    startDate,
    endDate,
    locale,
    page = 1,
    pageSize = 50,
    export: exportMode,
  } = body;

  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate are required');
    err.status = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    const err = new Error('Invalid date range');
    err.status = 400;
    throw err;
  }

  const earliestOk = new Date();
  earliestOk.setDate(earliestOk.getDate() - DEFAULT_RETENTION_DAYS);
  earliestOk.setHours(0, 0, 0, 0);
  if (start < earliestOk) {
    const err = new Error(
      `startDate must be within the analytics retention period (${DEFAULT_RETENTION_DAYS} days)`
    );
    err.status = 400;
    throw err;
  }

  const exportAll = exportMode === true || exportMode === 'true';
  const ps = exportAll
    ? Math.min(MAX_EXPORT_ROWS, Math.max(1, parseInt(pageSize, 10) || MAX_EXPORT_ROWS))
    : Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || 50));
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const skip = exportAll ? 0 : (pg - 1) * ps;

  const locMatch = buildLocaleMatch(locale);

  const matchAnd = [
    { eventType: 'search' },
    { timestamp: { $gte: start, $lte: end } },
    { $nor: [{ 'data.inDocument': true }] },
    { 'data.resultCount': { $lte: 0 } },
    ...(locMatch ? [locMatch] : []),
    ...mongoSafeSearchQueryConditions(),
  ];

  const pipeline = [
    { $match: { $and: matchAnd } },
    {
      $addFields: {
        qtrim: { $trim: { input: { $ifNull: ['$data.query', ''] } } },
      },
    },
    { $match: { qtrim: { $ne: '' } } },
    {
      $addFields: {
        qnorm: { $toLower: '$qtrim' },
        tagsJoined: {
          $cond: [
            { $isArray: { $ifNull: ['$data.filters.tags', []] } },
            {
              $reduce: {
                input: { $ifNull: ['$data.filters.tags', []] },
                initialValue: '',
                in: { $concat: ['$$value', ',', { $toString: '$$this' }] },
              },
            },
            '',
          ],
        },
        docIdsJoined: {
          $cond: [
            { $isArray: { $ifNull: ['$data.filters.documentIds', []] } },
            {
              $reduce: {
                input: { $ifNull: ['$data.filters.documentIds', []] },
                initialValue: '',
                in: { $concat: ['$$value', ',', { $toString: '$$this' }] },
              },
            },
            '',
          ],
        },
        topicIdsJoined: {
          $cond: [
            { $isArray: { $ifNull: ['$data.filters.topicIds', []] } },
            {
              $reduce: {
                input: { $ifNull: ['$data.filters.topicIds', []] },
                initialValue: '',
                in: { $concat: ['$$value', ',', { $toString: '$$this' }] },
              },
            },
            '',
          ],
        },
      },
    },
    {
      $addFields: {
        filterSig: {
          $concat: [
            { $toString: { $ifNull: ['$data.filters.language', ''] } },
            '::',
            '$tagsJoined',
            '::',
            { $toString: { $ifNull: ['$data.filters.product', ''] } },
            '::',
            { $toString: { $ifNull: ['$data.filters.version', ''] } },
            '::',
            {
              $cond: [{ $eq: ['$data.filters.titlesOnly', true] }, '1', ''],
            },
            '::',
            '$docIdsJoined',
            '::',
            '$topicIdsJoined',
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          qn: '$qnorm',
          sig: '$filterSig',
        },
        queries: { $sum: 1 },
        term: { $first: '$qtrim' },
        filtersOne: { $first: '$data.filters' },
      },
    },
    { $sort: { queries: -1, '_id.qn': 1, '_id.sig': 1 } },
    {
      $facet: {
        rows: exportAll ? [{ $limit: ps }] : [{ $skip: skip }, { $limit: ps }],
        summary: [
          {
            $group: {
              _id: null,
              totalDistinctRows: { $sum: 1 },
              totalQueries: { $sum: '$queries' },
            },
          },
        ],
      },
    },
  ];

  const [agg] = await Analytics.aggregate(pipeline).allowDiskUse(true).exec();

  const summary = agg?.summary?.[0] || {};
  const totalDistinctRows =
    typeof summary.totalDistinctRows === 'number' ? summary.totalDistinctRows : 0;
  const totalQueries = typeof summary.totalQueries === 'number' ? summary.totalQueries : 0;
  const rawRows = agg?.rows || [];

  const terms = rawRows.map((r) => {
    const f = r.filtersOne;
    return {
      term: r.term || '',
      queries: r.queries || 0,
      facets: facetsFromFilters(f && typeof f.toObject === 'function' ? f.toObject() : f),
    };
  });

  const totalPages = exportAll || ps === 0 ? 1 : Math.max(1, Math.ceil(totalDistinctRows / ps));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    locale: locale != null ? String(locale) : 'all',
    page: exportAll ? 1 : pg,
    pageSize: exportAll ? terms.length : ps,
    totalPages,
    totalDistinctRows,
    totalQueries,
    terms,
    methodology: {
      source: 'GET /api/search',
      zeroHitDefinition: 'resultCount <= 0',
      excludesInDocumentSearch: true,
      excludesSuspiciousQueries: true,
    },
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

module.exports = {
  getSearchNoResultsAnalytics,
  MAX_PAGE_SIZE,
  MAX_EXPORT_ROWS,
};
