'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('ft_token')) {
      router.replace('/');
      return;
    }
    setIsRegister(false);
    setError('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const data = await api.post(endpoint, form);
      localStorage.setItem('ft_token', data.token);
      localStorage.setItem('ft_user', JSON.stringify(data.user));
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <>
      <Header />
      <div style={{
        background: 'var(--bg-secondary)',
        minHeight: 'calc(100vh - var(--header-height))',
        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px',
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {isRegister ? 'Create an account' : 'Welcome back'}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.875rem' }}>
              {isRegister ? 'Sign up to access the platform' : 'Sign in to your account'}
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              marginBottom: '20px', color: '#dc2626', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isRegister && (
              <div>
                <label style={labelStyle}>Full name</label>
                <input className="input" type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} required
                  placeholder="Jane Smith" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email address</label>
              <input className="input" type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required
                placeholder="you@company.com" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input className="input" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6}
                placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
              disabled={loading}>
              {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', fontWeight: 500 }}>
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.82rem', fontWeight: 500,
  color: 'var(--text-secondary)', marginBottom: '5px',
};
