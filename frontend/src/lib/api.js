const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ft_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async post(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async upload(path, formData) {
    const headers = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('ft_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async patch(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
};

export default api;
