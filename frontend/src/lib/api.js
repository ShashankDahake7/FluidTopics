// Use relative URL so requests go through the Next.js rewrite proxy (/api → localhost:4000/api).
// This keeps all API calls same-origin and avoids CORS preflight issues.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/** Prefer session token (Remember me off) then persistent token. */
export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('ft_token') || localStorage.getItem('ft_token');
}

function getStoredRefreshToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('ft_refresh') || localStorage.getItem('ft_refresh');
}

/** Storage that holds the current access token (same bucket as refresh). */
function getAuthStorage() {
  if (typeof window === 'undefined') return null;
  if (sessionStorage.getItem('ft_token')) return sessionStorage;
  if (localStorage.getItem('ft_token')) return localStorage;
  return null;
}

let refreshInFlight = null;

async function refreshAccessTokenLocked() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = getStoredRefreshToken();
      if (!refresh) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      if (!data?.token) return false;
      const storage = getAuthStorage();
      if (!storage) return false;
      storage.setItem('ft_token', data.token);
      if (data.refreshToken) storage.setItem('ft_refresh', data.refreshToken);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('ft-auth'));
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** True when a 401 should trigger a refresh + single retry (not for auth endpoints). */
function shouldRetryWithRefresh(path, status) {
  if (status !== 401) return false;
  if (path === '/auth/login' || path === '/auth/register' || path === '/auth/refresh') return false;
  return true;
}

async function fetchWithOptionalRefresh(path, init = {}) {
  const headers = { ...getHeaders(), ...init.headers };
  const merged = { ...init, headers };
  if (init.body instanceof FormData) delete merged.headers['Content-Type'];

  let res = await fetch(`${API_BASE}${path}`, merged);
  if (shouldRetryWithRefresh(path, res.status)) {
    const ok = await refreshAccessTokenLocked();
    if (ok) {
      const h2 = { ...getHeaders(), ...init.headers };
      const merged2 = { ...init, headers: h2 };
      if (init.body instanceof FormData) delete merged2.headers['Content-Type'];
      res = await fetch(`${API_BASE}${path}`, merged2);
    }
  }
  return res;
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('ft_user') || localStorage.getItem('ft_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Writes auth payload to sessionStorage (guest browser) or localStorage (remember me). */
export function storeAuthSession({ token, refreshToken, user }, rememberMe) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('ft_token');
  sessionStorage.removeItem('ft_refresh');
  sessionStorage.removeItem('ft_user');
  localStorage.removeItem('ft_token');
  localStorage.removeItem('ft_refresh');
  localStorage.removeItem('ft_user');
  const storage = rememberMe ? localStorage : sessionStorage;
  if (token) storage.setItem('ft_token', token);
  if (refreshToken) storage.setItem('ft_refresh', refreshToken);
  if (user) {
    storage.setItem('ft_user', JSON.stringify(user));
    import('./i18n')
      .then(({ syncUiLanguageFromUser }) => syncUiLanguageFromUser(user))
      .catch(() => {});
  }
}

/**
 * Refresh stored user from GET /auth/me. JWTs only carry user id — administrative
 * roles (KHUB_ADMIN, etc.) live on the user document and must be synced here.
 */
export async function syncCurrentUserFromServer() {
  if (typeof window === 'undefined') return;
  if (!getStoredToken()) return;
  try {
    const res = await fetchWithOptionalRefresh('/auth/me', { method: 'GET' });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const fresh = data.user;
    if (!fresh) return;
    const rememberMe = !!localStorage.getItem('ft_token');
    const refresh = getStoredRefreshToken();
    storeAuthSession(
      { token: getStoredToken(), refreshToken: refresh || undefined, user: fresh },
      rememberMe
    );
    window.dispatchEvent(new Event('ft-auth'));
  } catch {
    /* ignore */
  }
}

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Throws an Error whose `.message` is the clean, user-facing text returned by
// the API (e.g. "Invalid email or password"). The HTTP method/path/status are
// preserved on the error object so callers / dev tools can still trace the
// failing request without that diagnostic prefix leaking into the UI.
async function failResponse(method, path, res) {
  const body = await res.json().catch(() => ({}));
  const userMessage = body.error || defaultMessageForStatus(res.status, res.statusText);
  const err = new Error(userMessage);
  err.status = res.status;
  err.path = path;
  err.method = method;
  err.detail = `${method} ${path} → ${res.status} ${userMessage}`;
  throw err;
}

function defaultMessageForStatus(status, statusText) {
  switch (status) {
    case 400: return statusText || 'Invalid request';
    case 401: return 'You are not signed in';
    case 403: return 'You do not have permission to do that';
    case 404: return 'Not found';
    case 409: return 'Conflict';
    case 423: return 'Account temporarily locked';
    case 429: return 'Too many requests — please slow down';
    case 500: return 'Server error — please try again';
    case 503: return 'Service unavailable — please try again';
    default:  return statusText || 'Request failed';
  }
}

const api = {
  async get(path) {
    const res = await fetchWithOptionalRefresh(path, { method: 'GET' });
    if (!res.ok) await failResponse('GET', path, res);
    return res.json();
  },
  async post(path, data) {
    const res = await fetchWithOptionalRefresh(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!res.ok) await failResponse('POST', path, res);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  },

  /** Revokes the server session (if any), then clears local tokens. */
  async signOut() {
    if (typeof window === 'undefined') return;
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: '{}',
        });
      } catch {
        /* still clear client state */
      }
    }
    sessionStorage.removeItem('ft_token');
    sessionStorage.removeItem('ft_refresh');
    sessionStorage.removeItem('ft_user');
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_refresh');
    localStorage.removeItem('ft_user');
    window.dispatchEvent(new Event('ft-auth'));
  },
  async upload(path, formData) {
    const res = await fetchWithOptionalRefresh(path, { method: 'POST', body: formData });
    if (!res.ok) await failResponse('POST', path, res);
    return res.json();
  },
  async uploadPatch(path, formData) {
    const res = await fetchWithOptionalRefresh(path, { method: 'PATCH', body: formData });
    if (!res.ok) await failResponse('PATCH', path, res);
    return res.json();
  },
  async delete(path) {
    const res = await fetchWithOptionalRefresh(path, { method: 'DELETE' });
    if (!res.ok) await failResponse('DELETE', path, res);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  },
  async patch(path, data) {
    const res = await fetchWithOptionalRefresh(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) await failResponse('PATCH', path, res);
    return res.json();
  },
  async put(path, data) {
    const res = await fetchWithOptionalRefresh(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });
    if (!res.ok) await failResponse('PUT', path, res);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  },
};

export default api;
