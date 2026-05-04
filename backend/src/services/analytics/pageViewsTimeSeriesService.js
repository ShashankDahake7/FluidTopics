'use strict';

/**
 * Traffic → Page views — `page.display` ftEvents with `data.path` (client navigations).
 */

const Analytics = require('../../models/Analytics');

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

function normalizePath(raw) {
  if (raw == null || typeof raw !== 'string') return '(unknown)';
  let x = raw.trim();
  if (!x.startsWith('/')) x = `/${x}`;
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x || '/';
}

async function getPageViewsTimeSeries(body = {}) {
  const {
    startDate,
    endDate,
    groupByPeriod = 'month',
    authStatus = 'all',
    interfaceLanguage = 'all',
  } = body;

  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate are required');
    err.status = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    const err = new Error('Invalid date range');
    err.status = 400;
    throw err;
  }

  const periods = generatePeriods(start, end, groupByPeriod);
  if (!periods.length) {
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      groupByPeriod,
      periods: [],
      pathCounts: {},
    };
  }

  const match = {
    eventType: 'event',
    'data.ftEvent': 'page.display',
    timestamp: { $gte: start, $lt: end },
  };

  if (interfaceLanguage && interfaceLanguage !== 'all') {
    match.$or = [
      { 'data.filters.language': interfaceLanguage },
      { 'data.filters.lang': interfaceLanguage },
      { 'data.filters.locale': interfaceLanguage },
    ];
  }

  if (authStatus === 'authenticated') {
    match.userId = { $ne: null };
  } else if (authStatus === 'unauthenticated') {
    match.userId = null;
  }

  const events = await Analytics.find(match).select('timestamp data.path').lean();

  const periodTimes = periods.map((p) => ({
    s: new Date(p.periodStartDate).getTime(),
    e: new Date(p.periodEndDate).getTime(),
  }));

  const n = periods.length;
  const pathCounts = {};

  for (const ev of events) {
    const path = normalizePath(ev.data && ev.data.path);
    const t = new Date(ev.timestamp).getTime();
    for (let i = 0; i < periodTimes.length; i++) {
      if (t >= periodTimes[i].s && t < periodTimes[i].e) {
        if (!pathCounts[path]) pathCounts[path] = new Array(n).fill(0);
        pathCounts[path][i]++;
        break;
      }
    }
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    groupByPeriod,
    periods,
    pathCounts,
  };
}

module.exports = {
  getPageViewsTimeSeries,
};
