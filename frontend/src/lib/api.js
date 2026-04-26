// Use relative URL so requests go through the Next.js rewrite proxy (/api → localhost:4000/api).
// This keeps all API calls same-origin and avoids CORS preflight issues.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ft_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Surface the failing method + path so console errors point at the bad call.
async function failResponse(method, path, res) {
  const body = await res.json().catch(() => ({}));
  const msg = body.error || res.statusText || 'Request failed';
  const err = new Error(`${method} ${path} → ${res.status} ${msg}`);
  err.status = res.status;
  err.path = path;
  err.method = method;
  throw err;
}

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: getHeaders() });
    if (!res.ok) await failResponse('GET', path, res);
    return res.json();
  },
  async post(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) await failResponse('POST', path, res);
    return res.json();
  },
  async upload(path, formData) {
    const headers = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('ft_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
    if (!res.ok) await failResponse('POST', path, res);
    return res.json();
  },
  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) await failResponse('DELETE', path, res);
    return res.json();
  },
  async patch(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) await failResponse('PATCH', path, res);
    return res.json();
  },
};

export default api;
