'use strict';

/**
 * Split X-Forwarded-For into ordered chain (leftmost = original client).
 * @param {string} v
 * @returns {string[]}
 */
function splitXff(v) {
  if (!v || typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Normalize IPv4-mapped IPv6 (::ffff:x.x.x.x).
 * @param {string} ip
 * @returns {string}
 */
function stripV4Mapped(ip) {
  let v = String(ip || '').trim();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v;
}

/**
 * True when the request’s server-side IP is not a public routable address
 * (dev / double-NAT / Next rewrite to Express). In those cases a browser
 * `clientIpHint` can be used for geolocation.
 * @param {string} ip
 * @returns {boolean}
 */
function shouldUseClientIpHint(ip) {
  const s = stripV4Mapped(typeof ip === 'string' ? ip : '');
  if (!s) return true;
  if (s === '127.0.0.1' || s === '::1') return true;
  if (looksLikeIpv4(s)) {
    const p = s.split('.').map(Number);
    const [a, b] = p;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (s.includes(':')) {
    const lower = s.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80:')) return true;
    return false;
  }
  return true;
}

/**
 * Best-effort client IP for Express behind nginx / Next / Vercel.
 * Requires `app.set('trust proxy', …)` so `req.ip` honors X-Forwarded-For when appropriate.
 * @param {import('express').Request} req
 * @returns {string}
 */
function clientIpFromReq(req) {
  if (!req) return '';

  const xffRaw = req.headers['x-forwarded-for'];
  const xff = splitXff(Array.isArray(xffRaw) ? xffRaw.join(',') : xffRaw || '');
  if (xff.length) {
    const first = stripV4Mapped(xff[0]);
    if (first) return first;
  }

  const xr = req.headers['x-real-ip'] || req.headers['true-client-ip'];
  if (xr && typeof xr === 'string') {
    const v = stripV4Mapped(xr);
    if (v) return v;
  }

  const cf = req.headers['cf-connecting-ip'];
  if (cf && typeof cf === 'string') {
    const v = stripV4Mapped(cf);
    if (v) return v;
  }

  if (req.ip && typeof req.ip === 'string') return stripV4Mapped(req.ip);

  const sock = req.socket || req.connection;
  if (sock && sock.remoteAddress) return stripV4Mapped(sock.remoteAddress);

  return '';
}

/**
 * IPv4 dotted quad (no strict validation of octet ranges).
 * @param {string} s
 * @returns {boolean}
 */
function looksLikeIpv4(s) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return false;
  const parts = s.split('.').map(Number);
  return parts.every((n) => n >= 0 && n <= 255);
}

/**
 * Accept a browser-reported public IP only when the server-side IP is not
 * geolocatable (typical for Next.js rewrite → Express seeing 127.0.0.1).
 * Prevents trivial spoofing when the proxy already provides a real client IP.
 * @param {string} serverIp
 * @param {unknown} hint
 * @returns {string}
 */
function resolveIpForAnalytics(serverIp, hint) {
  const s = typeof serverIp === 'string' ? serverIp.trim() : '';
  const h = typeof hint === 'string' ? hint.trim() : '';

  if (h && isSafePublicIpHint(h) && shouldUseClientIpHint(s)) return h;
  return s;
}

/**
 * IP hint from JSON body (POST) or from the browser on any API call.
 * @param {import('express').Request} req
 * @returns {string}
 */
function browserIpHintFromReq(req) {
  if (!req) return '';
  const body = req.body && typeof req.body.clientIpHint === 'string' ? req.body.clientIpHint.trim() : '';
  const h = req.headers['x-analytics-client-ip'];
  const header = Array.isArray(h) ? h[0] : h;
  const headerStr = typeof header === 'string' ? header.trim() : '';
  return body || headerStr || '';
}

/**
 * Best IP to store for Traffic → Countries when the server only sees a private address.
 * @param {import('express').Request} req
 * @returns {string}
 */
function clientIpResolvedForAnalytics(req) {
  return resolveIpForAnalytics(clientIpFromReq(req), browserIpHintFromReq(req));
}

/**
 * Optional ISO 3166-1 alpha-2 from the browser (ipapi + sessionStorage), via header or body.
 * @param {import('express').Request} req
 * @returns {string}
 */
function countryHintFromReq(req) {
  if (!req) return '';
  const body =
    req.body && typeof req.body.clientCountryHint === 'string' ? req.body.clientCountryHint.trim() : '';
  const h = req.headers['x-analytics-country'];
  const header = Array.isArray(h) ? h[0] : h;
  const headerStr = typeof header === 'string' ? header.trim() : '';
  const raw = (body || headerStr || '').toUpperCase();
  if (raw.length !== 2 || !/^[A-Z]{2}$/.test(raw) || raw === 'ZZ') return '';
  return raw;
}

/**
 * Shorthand for `trackEvent` / `trackFtEvent`: resolved client IP + optional country from headers/body.
 * @param {import('express').Request} req
 * @returns {{ ip: string, countryCode?: string }}
 */
function analyticsFromReq(req) {
  const ip = clientIpResolvedForAnalytics(req);
  const cc = countryHintFromReq(req);
  if (cc) return { ip, countryCode: cc };
  return { ip };
}

/**
 * Conservative check: syntax + not loopback / RFC1918 / link-local.
 * @param {string} ip
 * @returns {boolean}
 */
function isSafePublicIpHint(ip) {
  const v = stripV4Mapped(ip);
  if (!v) return false;

  if (looksLikeIpv4(v)) {
    if (v === '127.0.0.1' || v === '0.0.0.0') return false;
    const [a, b] = v.split('.').map(Number);
    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  if (v.includes(':')) {
    const lower = v.toLowerCase();
    if (lower === '::1') return false;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
    if (lower.startsWith('fe80:')) return false;
    return true;
  }

  return false;
}

module.exports = {
  clientIpFromReq,
  resolveIpForAnalytics,
  shouldUseClientIpHint,
  isSafePublicIpHint,
  clientIpResolvedForAnalytics,
  countryHintFromReq,
  analyticsFromReq,
};
