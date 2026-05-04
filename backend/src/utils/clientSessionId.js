'use strict';

/** Client-generated analytics session (see frontend `X-Analytics-Session` on API calls). */
function clientSessionIdFromReq(req) {
  if (!req || typeof req.get !== 'function') return '';
  const h = req.get('x-analytics-session');
  const s = h && String(h).trim();
  return s || '';
}

module.exports = { clientSessionIdFromReq };
