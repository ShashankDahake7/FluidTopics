/**
 * Cached public IP + ISO country from the browser so the API can geolocate when
 * Node only sees a private address (e.g. Next.js → Express). Uses ipapi.co (single request).
 * Sync reads power default fetch headers; async fetch runs once per tab session.
 */
const STORAGE_IP = 'ft_analytics_client_ip_hint';
const STORAGE_CC = 'ft_analytics_client_country_hint';

/** @returns {string} */
export function getStoredClientIpSync() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(STORAGE_IP) || '';
  } catch {
    return '';
  }
}

/** @returns {string} ISO 3166-1 alpha-2 or '' */
export function getStoredCountryCodeSync() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(STORAGE_CC) || '';
  } catch {
    return '';
  }
}

/**
 * Fetches IP + country once per session. Order: ipapi.co → ipwho.is → ipify (IP only).
 * Safe to call multiple times; sessionStorage avoids repeat network work.
 */
export async function getClientGeoHint() {
  if (typeof window === 'undefined') return { ip: '', countryCode: '' };
  try {
    const cachedIp = sessionStorage.getItem(STORAGE_IP);
    const cachedCc = sessionStorage.getItem(STORAGE_CC);
    if (cachedIp && cachedCc) {
      return { ip: cachedIp, countryCode: cachedCc };
    }

    const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      const ip = typeof j?.ip === 'string' ? j.ip.trim() : '';
      let cc = typeof j?.country_code === 'string' ? j.country_code.trim().toUpperCase() : '';
      if (cc.length !== 2) cc = '';
      if (ip) sessionStorage.setItem(STORAGE_IP, ip);
      if (cc) sessionStorage.setItem(STORAGE_CC, cc);
      if (ip || cc) return { ip, countryCode: cc };
    }
  } catch {
    /* fall through */
  }

  try {
    const r2 = await fetch('https://ipwho.is/json/', { cache: 'no-store' });
    if (r2.ok) {
      const j2 = await r2.json();
      if (j2?.success !== false) {
        const ip = typeof j2?.ip === 'string' ? j2.ip.trim() : '';
        let cc = typeof j2?.country_code === 'string' ? j2.country_code.trim().toUpperCase() : '';
        if (cc.length !== 2) cc = '';
        if (ip) sessionStorage.setItem(STORAGE_IP, ip);
        if (cc) sessionStorage.setItem(STORAGE_CC, cc);
        if (ip || cc) return { ip, countryCode: cc };
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!r.ok) return { ip: '', countryCode: '' };
    const j = await r.json();
    const ip = typeof j?.ip === 'string' ? j.ip.trim() : '';
    if (ip) sessionStorage.setItem(STORAGE_IP, ip);
    return { ip, countryCode: getStoredCountryCodeSync() };
  } catch {
    return { ip: '', countryCode: '' };
  }
}

let _geoHintInflight = null;

/**
 * Wait until geo hints are resolved so {@link getHeaders} can attach
 * `X-Analytics-Client-Ip` / `X-Analytics-Country` on the **first** API call
 * (not only after a prior request filled sessionStorage).
 */
export function ensureClientGeoHint() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!_geoHintInflight) {
    _geoHintInflight = getClientGeoHint().finally(() => {
      _geoHintInflight = null;
    });
  }
  return _geoHintInflight;
}

/** @deprecated use getClientGeoHint — kept for callers that only need IP */
export async function getClientIpHint() {
  const { ip } = await getClientGeoHint();
  return ip;
}
