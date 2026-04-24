'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      <main style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - var(--header-height))', padding: '24px' }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', fontSize: '0.9rem' }}>
            {isRegister ? 'Sign up to access the platform' : 'Sign in to your account'}
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginTop: '20px', color: 'var(--error)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <div>
                <label style={labelStyle}>Name</label>
                <input className="input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </main>
    </>
  );
}

const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' };
