'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getStoredToken, storeAuthSession } from '@/lib/api';
import PortalSignInLanding from '@/components/portal/PortalSignInLanding';
import '@/components/portal/portal.css';

function readQuery() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function resolveNextRoute(query) {
  let to = '/dashboard';
  try {
    const stored =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('portal_redirect')
        : null;
    if (stored && stored.startsWith('/') && stored !== '/login') {
      to = stored;
    }
    const nextParam = query?.get('next');
    if (nextParam && nextParam.startsWith('/') && nextParam !== '/login') {
      to = nextParam;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('portal_redirect');
    }
  } catch {
    /* ignore */
  }
  return to;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const handoffToken = query.get('db_sso_token');
  const ssoError = useMemo(() => {
    return query.get('db_sso_error') ? query.get('message') || 'Darwinbox SSO sign-in failed.' : '';
  }, [query]);
  const mode = query.get('register') === '1' ? 'register' : 'signin';

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams(queryString);
    const handoffToken = q.get('db_sso_token');
    const handoffRefresh = q.get('db_sso_refresh');

    if (handoffToken) {
      (async () => {
        storeAuthSession({ token: handoffToken, refreshToken: handoffRefresh }, true);
        try {
          const me = await api.get('/auth/me');
          if (!cancelled) {
            storeAuthSession(
              { token: handoffToken, refreshToken: handoffRefresh, user: me?.user },
              true
            );
          }
        } catch {
          /* The token is enough to let the next page retry /auth/me. */
        }
        if (!cancelled) {
          window.dispatchEvent(new Event('ft-auth'));
          router.replace(resolveNextRoute(q));
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (getStoredToken()) {
      router.replace(resolveNextRoute(q));
      return;
    }
    return () => {
      cancelled = true;
    };
  }, [router, queryString]);

  if (handoffToken) {
    return (
      <main className="portal-shell-main portal-gate-loading-main">
        <div className="portal-gate-loading">
          <div className="portal-gate-spinner" />
        </div>
      </main>
    );
  }

  if (mode === 'signin') {
    return (
      <main className="portal-shell-main">
        <PortalSignInLanding
          initialError={ssoError}
          onSuccess={() => {
            window.dispatchEvent(new Event('ft-auth'));
            router.replace(resolveNextRoute(readQuery()));
          }}
        />
      </main>
    );
  }

  return <RegisterForm router={router} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="portal-shell-main portal-gate-loading-main">
          <div className="portal-gate-loading">
            <div className="portal-gate-spinner" />
          </div>
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function RegisterForm({ router }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState(null);

  useEffect(() => {
    api
      .get('/auth/config')
      .then(setAuthConfig)
      .catch(() =>
        setAuthConfig({
          methods: ['password'],
          selfRegistration: true,
          passwordResetEnabled: false,
          emailVerificationEnabled: false,
        })
      );
  }, []);

  const selfRegEnabled = useMemo(
    () => !authConfig || authConfig.selfRegistration !== false,
    [authConfig]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/register', form);
      if (data?.token) {
        storeAuthSession(
          { token: data.token, refreshToken: data.refreshToken, user: data.user },
          true
        );
      }
      window.dispatchEvent(new Event('ft-auth'));
      router.replace(resolveNextRoute(readQuery()));
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };

  if (!selfRegEnabled) {
    return (
      <main className="portal-shell-main">
        <div style={shellStyle}>
          <div className="card" style={cardStyle}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Sign-up disabled</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              Self-registration is not enabled. Contact your administrator.
            </p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="btn btn-primary"
              style={{ marginTop: 16 }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="portal-shell-main">
      <div style={shellStyle}>
        <div className="card" style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Create an account
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: '0.875rem' }}>
              Sign up to access the platform
            </p>
          </div>

          {error && (
            <div style={errorStyle}>
              <span style={{ flexShrink: 0 }}>⚠</span> {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label style={labelStyle}>Email address</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
              disabled={loading || !authConfig}
            >
              {loading ? 'Please wait…' : 'Create account'}
            </button>
          </form>

          <p
            style={{
              textAlign: 'center',
              marginTop: 20,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.replace('/login')}
              style={inlineLinkStyle}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

const shellStyle = {
  background: 'var(--bg-secondary)',
  minHeight: 'calc(100vh - var(--header-height))',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '24px',
};

const cardStyle = { width: '100%', maxWidth: '400px', padding: '40px' };

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
  marginBottom: '20px',
  color: '#dc2626',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '5px',
};

const inlineLinkStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.85rem',
  fontWeight: 600,
};
