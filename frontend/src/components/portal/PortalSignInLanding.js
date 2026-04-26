'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api, { storeAuthSession } from '@/lib/api';
import PortalFooter from '@/components/portal/PortalFooter';
import './portal.css';

const ROLES = [
  { id: 'client', label: 'Sign In as Client' },
  { id: 'employee', label: 'Sign In as Employee' },
  { id: 'staging', label: 'Sign In as Staging User' },
];

function DbIcon() {
  return (
    <svg className="portal-signin-role-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function PortalSignInLanding({ onSuccess }) {
  const [role, setRole] = useState('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authConfig, setAuthConfig] = useState(null);

  useEffect(() => {
    api
      .get('/auth/config')
      .then(setAuthConfig)
      .catch(() =>
        setAuthConfig({
          methods: ['password'],
          selfRegistration: true,
          passwordResetEnabled: true,
        })
      );
  }, []);

  const showPasswordAuth = !authConfig || (authConfig.methods || []).includes('password');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      if (!data?.token) {
        setError('Unexpected response from server');
        setLoading(false);
        return;
      }
      storeAuthSession(
        { token: data.token, refreshToken: data.refreshToken, user: data.user },
        remember
      );
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Sign in failed');
    }
    setLoading(false);
  };

  return (
    <div className="portal-signin-page">
      <div className="portal-signin-body">
        <div className="portal-signin-card">
          <div className="portal-signin-card-brand">
            <img src="/ft-header-logo.png" alt="Darwinbox" className="portal-signin-card-logo" />
          </div>

          <div className="portal-signin-roles" role="group" aria-label="Sign-in context">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`portal-signin-role-btn${role === r.id ? ' is-active' : ''}`}
                onClick={() => setRole(r.id)}
              >
                <DbIcon />
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          <h1 className="portal-signin-title">Sign In</h1>

          {!authConfig && (
            <p className="portal-signin-muted">Loading sign-in options…</p>
          )}

          {authConfig && !showPasswordAuth && (
            <p className="portal-signin-warn">
              Password sign-in is not enabled. Contact your administrator.
            </p>
          )}

          {error && (
            <div className="portal-signin-error" role="alert">
              <svg
                className="portal-signin-error-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {showPasswordAuth && (
            <form className="portal-signin-form" onSubmit={handleSubmit}>
              <label className="portal-signin-label" htmlFor="portal-email">Email</label>
              <input
                id="portal-email"
                className="portal-signin-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />

              <label className="portal-signin-label" htmlFor="portal-password">Password</label>
              <div className="portal-signin-password-wrap">
                <input
                  id="portal-password"
                  className="portal-signin-input portal-signin-input-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="portal-signin-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="portal-signin-row">
                <label className="portal-signin-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(ev) => setRemember(ev.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                {authConfig?.passwordResetEnabled !== false ? (
                  <Link
                    href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                    className="portal-signin-link"
                  >
                    Forgot password
                  </Link>
                ) : null}
              </div>

              <button type="submit" className="portal-signin-submit" disabled={loading || !authConfig}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {authConfig?.selfRegistration !== false && (
            <p className="portal-signin-footer-note">
              Need an account?{' '}
              <Link href="/login?register=1" className="portal-signin-inline-link">Create one</Link>
            </p>
          )}
        </div>
      </div>
      <PortalFooter />
    </div>
  );
}
