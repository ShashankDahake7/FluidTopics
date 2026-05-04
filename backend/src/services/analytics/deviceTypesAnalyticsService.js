'use strict';

/**
 * Traffic → Device types — session counts from `page.display` + viewport (Fluid Topics rules).
 * Static resource paths excluded (Jan 2024+ methodology).
 */

const Analytics = require('../../models/Analytics');
const { excludeStaticResourcePathsMatch } = require('../../utils/analyticsCountriesFilter');
const { deviceTypeFromViewport } = require('../../utils/deviceTypeFromViewport');
const { resolveSessionKeys } = require('./sessionConstants');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '730', 10);

const DEVICES = ['mobile', 'tablet', 'desktop', 'unknown'];

function startOfIsoWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(d) {
  return startOfIsoWeek(d).toISOString().slice(0, 10);
}

function labelMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[m - 1]} ${y}`;
}

function eachMonthKeyInRange(start, end) {
  const keys = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= last) {
    keys.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function eachWeekKeyInRange(start, end) {
  const keys = [];
  let w = startOfIsoWeek(new Date(start));
  const endT = end.getTime();
  while (w.getTime() <= endT) {
    keys.push(w.toISOString().slice(0, 10));
    const n = new Date(w);
    n.setDate(n.getDate() + 7);
    w = n;
  }
  return keys;
}

async function getDeviceTypesAnalytics(body = {}) {
  const { startDate, endDate, granularity = 'month' } = body;

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

  const gran = granularity === 'week' ? 'week' : 'month';

  const timeMatch = { timestamp: { $gte: start, $lte: end } };
  const scopeMatch = {
    ...timeMatch,
    eventType: 'event',
    'data.ftEvent': 'page.display',
    ...excludeStaticResourcePathsMatch(),
  };

  const events = await Analytics.find(scopeMatch)
    .select('_id sessionId userId ip timestamp data')
    .sort({ timestamp: 1 })
    .lean();

  const matchedPageDisplayEvents = events.length;

  const keyMap = resolveSessionKeys(events);

  /** @type {Map<string, { device: string, sessionStart: Date }>} */
  const sessionMeta = new Map();

  const byKey = new Map();
  for (const ev of events) {
    const sk = keyMap.get(String(ev._id));
    if (!sk) continue;
    if (!byKey.has(sk)) byKey.set(sk, []);
    byKey.get(sk).push(ev);
  }

  for (const [sk, evs] of byKey) {
    evs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const first = evs[0];
    const firstWithVp = evs.find(
      (e) =>
        Number(e.data?.viewportWidth) > 0 && Number(e.data?.viewportHeight) > 0
    );
    const device = firstWithVp
      ? deviceTypeFromViewport(firstWithVp.data.viewportWidth, firstWithVp.data.viewportHeight)
      : 'unknown';
    sessionMeta.set(sk, {
      device,
      sessionStart: new Date(first.timestamp),
    });
  }

  /** Whole-range distribution */
  const distribution = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
  for (const { device } of sessionMeta.values()) {
    if (distribution[device] !== undefined) distribution[device] += 1;
    else distribution.unknown += 1;
  }

  const totalSessions = sessionMeta.size;

  /** Build time buckets */
  const bucketCounts = new Map();
  const ensureBucket = (bk) => {
    if (!bucketCounts.has(bk)) {
      bucketCounts.set(bk, { mobile: 0, tablet: 0, desktop: 0, unknown: 0 });
    }
    return bucketCounts.get(bk);
  };

  const now = new Date();
  const rangeIncludesNow = start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
  const currentMonthKey = monthKey(now);
  const currentWeekKey = weekKey(now);

  for (const { device, sessionStart } of sessionMeta.values()) {
    const bk = gran === 'week' ? weekKey(sessionStart) : monthKey(sessionStart);
    const cell = ensureBucket(bk);
    if (cell[device] !== undefined) cell[device] += 1;
    else cell.unknown += 1;
  }

  const allKeys =
    gran === 'week' ? eachWeekKeyInRange(start, end) : eachMonthKeyInRange(start, end);

  const evolution = allKeys.map((key) => {
    const c = bucketCounts.get(key) || { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
    const sum = DEVICES.reduce((s, d) => s + (c[d] || 0), 0);
    const rowSum = sum || 1;
    const weekLabelDate =
      gran === 'week'
        ? (() => {
            const [yy, mm, dd] = key.split('-').map(Number);
            return new Date(yy, mm - 1, dd);
          })()
        : null;
    return {
      key,
      label:
        gran === 'week'
          ? weekLabelDate.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : labelMonth(key),
      granularity: gran,
      mobile: c.mobile,
      tablet: c.tablet,
      desktop: c.desktop,
      unknown: c.unknown,
      total: sum,
      sharePercent: {
        mobile: (100 * c.mobile) / rowSum,
        tablet: (100 * c.tablet) / rowSum,
        desktop: (100 * c.desktop) / rowSum,
        unknown: (100 * c.unknown) / rowSum,
      },
      ongoing:
        gran === 'month'
          ? key === currentMonthKey && rangeIncludesNow
          : key === currentWeekKey && rangeIncludesNow,
    };
  });

  const distTotal = totalSessions || 1;
  const distributionShares = {
    mobile: (100 * distribution.mobile) / distTotal,
    tablet: (100 * distribution.tablet) / distTotal,
    desktop: (100 * distribution.desktop) / distTotal,
    unknown: (100 * distribution.unknown) / distTotal,
  };

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    granularity: gran,
    /** Raw rows matching page.display in range (before session roll-up). */
    matchedPageDisplayEvents,
    totalSessions,
    distribution: {
      mobile: distribution.mobile,
      tablet: distribution.tablet,
      desktop: distribution.desktop,
      unknown: distribution.unknown,
      sharePercent: distributionShares,
    },
    evolution,
    methodology: {
      excludesStaticResources: true,
      staticExclusionEffectiveFrom: '2024-01-01',
      sourceEvent: 'page.display',
    },
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

module.exports = {
  getDeviceTypesAnalytics,
};
