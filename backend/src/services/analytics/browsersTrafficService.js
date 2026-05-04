'use strict';

/**
 * Traffic → Browsers — share of analytics events by derived browser family (User-Agent).
 * Excludes static resource paths (same methodology as Countries, Jan 2024+).
 */

const Analytics = require('../../models/Analytics');
const { excludeStaticResourcePathsMatch } = require('../../utils/analyticsCountriesFilter');
const { browserFamilyFromUserAgent } = require('../../utils/browserFromUserAgent');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '730', 10);

async function getBrowsersTraffic(body = {}) {
  const { startDate, endDate } = body;

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

  const timeMatch = { timestamp: { $gte: start, $lte: end } };
  const scopeMatch = { ...timeMatch, ...excludeStaticResourcePathsMatch() };

  const rows = await Analytics.aggregate([
    { $match: scopeMatch },
    { $group: { _id: '$userAgent', count: { $sum: 1 } } },
  ]);

  const byBrowser = new Map();
  for (const r of rows) {
    const name = browserFamilyFromUserAgent(typeof r._id === 'string' ? r._id : '');
    const n = r.count || 0;
    byBrowser.set(name, (byBrowser.get(name) || 0) + n);
  }

  const pairs = Array.from(byBrowser.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const total = pairs.reduce((s, p) => s + p.count, 0);

  const browsers = pairs.map((p) => ({
    name: p.name,
    count: p.count,
    share: total ? (100 * p.count) / total : 0,
  }));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    total,
    browsers,
    retentionDays: DEFAULT_RETENTION_DAYS,
    methodology: {
      excludesStaticResources: true,
      staticExclusionEffectiveFrom: '2024-01-01',
    },
  };
}

module.exports = {
  getBrowsersTraffic,
};
