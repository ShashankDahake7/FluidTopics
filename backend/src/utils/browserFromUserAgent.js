'use strict';

/**
 * Map a raw User-Agent string to a short browser / client label for Traffic → Browsers.
 * Order of checks matters (e.g. Edge before Chrome).
 * @param {string} ua
 * @returns {string}
 */
function browserFamilyFromUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return 'Other / Unknown';
  const s = ua;

  if (/axios\/|node-fetch|got\(/i.test(s) && !/Mozilla/i.test(s)) return 'API client';
  if (/curl/i.test(s)) return 'curl';
  if (/Postman/i.test(s)) return 'Postman';
  if (/insomnia/i.test(s)) return 'Insomnia';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/EdgiOS/i.test(s)) return 'Edge';
  if (/OPR\/|Opera\//i.test(s)) return 'Opera';
  if (/SamsungBrowser/i.test(s)) return 'Samsung Internet';
  if (/Firefox|FxiOS/i.test(s)) return 'Firefox';
  if (/Brave/i.test(s)) return 'Brave';
  if (/Vivaldi/i.test(s)) return 'Vivaldi';
  if (/YaBrowser/i.test(s)) return 'Yandex Browser';
  if (/UCBrowser/i.test(s)) return 'UC Browser';
  if (/HeadlessChrome|Headless/i.test(s)) return 'Headless Chrome';
  if (/Chrome.*Mobile/i.test(s) || /CriOS/i.test(s)) return 'Chrome Mobile';
  if (/Chrome/i.test(s)) return 'Chrome';
  if (/Safari/i.test(s) && !/Chrome/i.test(s)) {
    if (/Mobile\/|iPhone|iPad|iPod/i.test(s)) return 'Mobile Safari';
    return 'Safari';
  }
  if (/Trident|MSIE|Edge\/12/i.test(s)) return 'Internet Explorer';

  return 'Other / Unknown';
}

module.exports = {
  browserFamilyFromUserAgent,
};
