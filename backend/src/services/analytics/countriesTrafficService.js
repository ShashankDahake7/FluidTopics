'use strict';

/**
 * Traffic → Countries — share of analytics events by ISO country.
 * Uses stored countryCode when present; otherwise resolves country from IP (geoip-lite)
 * at query time so historic rows without countryCode still map when IP was recorded.
 *
 * Static resource paths (JS/CSS/fonts/images, `/_next/` chunks, favicon, etc.) are excluded
 * from counts (Fluid Topics–style methodology from Jan 2024 onward).
 */

const Analytics = require('../../models/Analytics');
const { countryFromIp } = require('../../utils/geoIp');
const { excludeStaticResourcePathsMatch } = require('../../utils/analyticsCountriesFilter');

function regionDisplayName(code) {
  if (!code || code.length !== 2) return 'Unknown';
  const c = String(code).toUpperCase();
  if (c === 'ZZ') return 'Unknown';
  try {
    const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(c);
    return n || c;
  } catch {
    return c;
  }
}

/** Events that already have a 2-letter ISO country on the document. */
function matchHasIsoCountryCode() {
  return {
    $expr: {
      $eq: [{ $strLenCP: { $toString: { $ifNull: ['$countryCode', ''] } } }, 2],
    },
  };
}

/** Events missing a usable ISO code on the document (need IP resolution or Unknown). */
function matchMissingIsoCountryCode() {
  return {
    $expr: {
      $ne: [{ $strLenCP: { $toString: { $ifNull: ['$countryCode', ''] } } }, 2],
    },
  };
}

async function getCountriesTraffic(body = {}) {
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

  const timeMatch = { timestamp: { $gte: start, $lte: end } };
  const scopeMatch = { ...timeMatch, ...excludeStaticResourcePathsMatch() };

  const [knownRows, ipRows, noIpCount] = await Promise.all([
    Analytics.aggregate([
      { $match: { ...scopeMatch, ...matchHasIsoCountryCode() } },
      { $group: { _id: { $toUpper: '$countryCode' }, count: { $sum: 1 } } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          ...scopeMatch,
          ...matchMissingIsoCountryCode(),
          ip: { $exists: true, $nin: [null, ''] },
        },
      },
      { $group: { _id: '$ip', count: { $sum: 1 } } },
    ]),
    Analytics.countDocuments({
      ...scopeMatch,
      ...matchMissingIsoCountryCode(),
      $or: [{ ip: { $exists: false } }, { ip: null }, { ip: '' }],
    }),
  ]);

  const countByCode = new Map();

  for (const r of knownRows) {
    const code = String(r._id || '').trim().toUpperCase();
    if (code.length === 2) {
      countByCode.set(code, (countByCode.get(code) || 0) + r.count);
    }
  }

  let unknown = typeof noIpCount === 'number' ? noIpCount : 0;

  for (const r of ipRows) {
    const ip = r._id;
    const n = r.count || 0;
    const cc = countryFromIp(ip);
    if (cc) {
      countByCode.set(cc, (countByCode.get(cc) || 0) + n);
    } else {
      unknown += n;
    }
  }

  const pairs = Array.from(countByCode.entries()).map(([code, count]) => ({ code, count }));
  if (unknown > 0) {
    pairs.push({ code: 'ZZ', count: unknown });
  }

  pairs.sort((a, b) => b.count - a.count);

  const total = pairs.reduce((s, p) => s + p.count, 0);

  const countries = pairs.map((p) => {
    const code = p.code === 'ZZ' ? 'ZZ' : p.code;
    const name = code === 'ZZ' ? 'Unknown' : regionDisplayName(code);
    return {
      code,
      name,
      count: p.count,
      share: total ? (100 * p.count) / total : 0,
    };
  });

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    total,
    countries,
    methodology: {
      excludesStaticResources: true,
      /** Matches Fluid Topics “January 2024 onward” static-resource exclusion for country traffic. */
      staticExclusionEffectiveFrom: '2024-01-01',
    },
  };
}

module.exports = {
  getCountriesTraffic,
};
