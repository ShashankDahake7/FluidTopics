/**
 * Security headers middleware.
 *
 * Adds OWASP-recommended response headers to every request:
 *   - X-Content-Type-Options (14.4.4)
 *   - Strict-Transport-Security (14.4.5)
 *   - Referrer-Policy (14.4.6)
 *   - Content-Security-Policy (14.4.7)
 *
 * The CSP frame-ancestors directive is dynamically built from the
 * SecurityConfig trusted origins stored in the database.
 */
const SecurityConfig = require('../models/SecurityConfig');

// Cache the CSP value for 60 seconds so we don't hit the DB on every request.
let _cspCache = null;
let _cspAt = 0;

async function buildCsp() {
  if (_cspCache && Date.now() - _cspAt < 60_000) return _cspCache;

  let origins = [];
  try {
    const cfg = await SecurityConfig.findOne().lean();
    if (cfg && cfg.trustedOrigins) {
      origins = cfg.trustedOrigins.split(',').map(s => s.trim()).filter(Boolean);
    }
  } catch { /* ignore */ }

  if (origins.length === 1 && origins[0] === '*') {
    // A bare wildcard means "no restriction" — omit CSP entirely.
    _cspCache = null;
  } else {
    const sources = ["'self'", ...origins].join(' ');
    _cspCache = `frame-ancestors ${sources}`;
  }
  _cspAt = Date.now();
  return _cspCache;
}

module.exports = function securityHeaders() {
  return async (req, res, next) => {
    // OWASP 14.4.4
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // OWASP 14.4.5  (only effective over HTTPS, harmless over HTTP)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // OWASP 14.4.6
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // OWASP 14.4.7 — Content-Security-Policy
    const csp = await buildCsp();
    if (csp) {
      res.setHeader('Content-Security-Policy', csp);
    }

    next();
  };
};
