'use strict';

/**
 * Analytics → Search terms: popularity table from portal search events (`GET /api/search`).
 * Excludes in-document searches, suspicious queries (see searchQuerySafety), and empty strings.
 */

const Analytics = require('../../models/Analytics');
const { mongoSafeSearchQueryConditions } = require('../../utils/searchQuerySafety');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '730', 10);
const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 10000;

async function getSearchTermsAnalytics(body = {}) {
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

  const loc =
    locale != null && String(locale).trim() !== '' && String(locale).trim() !== 'all'
      ? String(locale).trim()
      : null;

  const matchAnd = [
    { eventType: 'search' },
    { timestamp: { $gte: start, $lte: end } },
    { $nor: [{ 'data.inDocument': true }] },
    ...(loc ? [{ 'data.filters.language': loc }] : []),
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
      },
    },
    {
      $group: {
        _id: '$qnorm',
        queries: { $sum: 1 },
        /** Representative label (first seen in aggregation order). */
        term: { $first: '$qtrim' },
      },
    },
    { $sort: { queries: -1, _id: 1 } },
    {
      $facet: {
        rows: exportAll ? [{ $limit: ps }] : [{ $skip: skip }, { $limit: ps }],
        summary: [
          {
            $group: {
              _id: null,
              totalDistinctTerms: { $sum: 1 },
              totalQueries: { $sum: '$queries' },
            },
          },
        ],
      },
    },
  ];

  const [agg] = await Analytics.aggregate(pipeline).allowDiskUse(true).exec();

  const summary = agg?.summary?.[0] || {};
  const totalDistinctTerms = typeof summary.totalDistinctTerms === 'number' ? summary.totalDistinctTerms : 0;
  const totalQueries = typeof summary.totalQueries === 'number' ? summary.totalQueries : 0;
  const rows = (agg?.rows || []).map((r) => ({
    term: r.term || r._id || '',
    queries: r.queries || 0,
  }));

  const totalPages =
    exportAll || ps === 0 ? 1 : Math.max(1, Math.ceil(totalDistinctTerms / ps));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    locale: loc || 'all',
    page: exportAll ? 1 : pg,
    pageSize: exportAll ? rows.length : ps,
    totalPages,
    totalDistinctTerms,
    totalQueries,
    terms: rows,
    methodology: {
      source: 'GET /api/search',
      excludesInDocumentSearch: true,
      excludesSuspiciousQueries: true,
    },
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

module.exports = {
  getSearchTermsAnalytics,
  MAX_PAGE_SIZE,
  MAX_EXPORT_ROWS,
};
