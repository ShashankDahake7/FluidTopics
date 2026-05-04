const SESSION_STORAGE_KEY = 'ft_analytics_session_id';

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Stable per–browser-tab session id for analytics. Sent on API requests (header) and
 * optional client-side `/analytics/track` calls so events can be grouped by session.
 */
export function getAnalyticsSessionId() {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = newId();
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
