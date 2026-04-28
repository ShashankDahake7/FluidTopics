'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api, { getStoredToken } from '@/lib/api';

const SKIP_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/verify-email',
]);

function pathnameSkipsGate(pathname) {
  if (!pathname) return true;
  if (SKIP_PATHS.has(pathname)) return true;
  return pathname.startsWith('/reset-password');
}

export default function LegalTermsGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState(null); // { mustAccept, message, isUpdate, version, ... }
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastTokenRef = useRef(null);

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    lastTokenRef.current = token;
    if (!token) {
      setStatus(null);
      return;
    }
    if (pathnameSkipsGate(pathname)) {
      return;
    }
    try {
      const s = await api.get('/legal-terms/status');
      if (s?.mustAccept) {
        setStatus(s);
        setAccepted(false);
        setError('');
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    }
  }, [pathname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onSync = () => refresh();
    window.addEventListener('storage', onSync);
    window.addEventListener('ft-auth', onSync);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener('ft-auth', onSync);
    };
  }, [refresh]);

  const onAccept = useCallback(async () => {
    if (busy || !accepted) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/legal-terms/accept', {});
      setStatus(null);
    } catch (e) {
      setError(e?.message || 'Failed to record acceptance.');
    } finally {
      setBusy(false);
    }
  }, [accepted, busy]);

  const onDecline = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    let action = 'revoke';
    try {
      const r = await api.post('/legal-terms/decline', {});
      action = r?.action || 'revoke';
    } catch {
      // Even if the server failed, log the user out client-side so they
      // cannot bypass the gate by closing the modal.
    } finally {
      try { await api.signOut(); } catch { /* clear local */ }
      setStatus(null);
      setBusy(false);
      try {
        sessionStorage.removeItem('portal_redirect');
      } catch { /* noop */ }
      const reason = action === 'delete' ? 'account-deleted' : 'declined';
      router.replace(`/login?reason=${reason}`);
    }
  }, [busy, router]);

  if (!status?.mustAccept) return null;

  const msg = status.message || {};
  const labelText = (msg.label || '').trim() || 'I accept the Terms of Use';
  const linksHtml = (msg.linksHtml || '').trim();

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lt-title" style={S.backdrop}>
      <div style={S.box} onClick={(e) => e.stopPropagation()}>
        <h2 id="lt-title" style={S.title}>Legal Terms Agreement</h2>

        {status.isUpdate && (
          <p style={S.update}>We have updated our legal terms.</p>
        )}

        <div style={S.row}>
          <input
            id="lt-accept-cbx"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={busy}
            style={S.checkbox}
          />
          <label htmlFor="lt-accept-cbx" style={S.label}>
            {labelText}
          </label>
        </div>

        {linksHtml && (
          <div
            style={S.links}
            dangerouslySetInnerHTML={{ __html: linksHtml }}
          />
        )}

        {msg.usedFallback && (
          <p style={S.fallbackNote}>
            Displayed in the fallback language because no translation is configured for your interface language.
          </p>
        )}

        {error && <div style={S.error}>{error}</div>}

        <div style={S.actions}>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            style={{ ...S.btn, ...S.btnCancel, opacity: busy ? 0.65 : 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!accepted || busy}
            style={{
              ...S.btn,
              ...S.btnSave,
              opacity: !accepted || busy ? 0.55 : 1,
              cursor: !accepted || busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 4000,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: 'var(--font-sans)',
  },
  box: {
    background: '#fff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 480,
    padding: '22px 24px 18px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
  },
  title: {
    margin: '0 0 14px',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  update: {
    margin: '0 0 12px',
    fontSize: '0.92rem',
    color: '#0f172a',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  checkbox: {
    marginTop: 3,
    width: 16,
    height: 16,
    accentColor: '#1d4ed8',
  },
  label: {
    flex: 1,
    fontSize: '0.92rem',
    color: '#0f172a',
    lineHeight: 1.45,
  },
  links: {
    margin: '4px 0 14px 24px',
    fontSize: '0.88rem',
    color: '#1d4ed8',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },
  fallbackNote: {
    margin: '0 0 12px 24px',
    fontSize: '0.78rem',
    color: '#64748b',
    fontStyle: 'italic',
  },
  error: {
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '0.85rem',
    padding: '8px 10px',
    borderRadius: 4,
    marginBottom: 10,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  btn: {
    padding: '8px 18px',
    borderRadius: 4,
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    border: 'none',
  },
  btnCancel: {
    background: '#dc2626',
    color: '#fff',
  },
  btnSave: {
    background: '#1d4ed8',
    color: '#fff',
  },
};
