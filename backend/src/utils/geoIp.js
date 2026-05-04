'use strict';

const geoip = require('geoip-lite');

/**
 * ISO 3166-1 alpha-2 country code from client IP (offline GeoLite data via geoip-lite).
 * Returns '' for loopback, private ranges, or lookup misses.
 */
function countryFromIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  let v = ip.trim();
  if (!v || v === '::1' || v === '127.0.0.1') return '';
  if (v.startsWith('::ffff:')) v = v.slice(7);

  if (
    v.startsWith('10.') ||
    v === '127.0.0.1' ||
    v.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v)
  ) {
    return '';
  }

  const loc = geoip.lookup(v);
  if (!loc || !loc.country) return '';
  return String(loc.country).toUpperCase();
}

module.exports = { countryFromIp };
