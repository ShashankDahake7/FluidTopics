'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import PortalFooter from '@/components/portal/PortalFooter';
import { useTranslation } from '@/lib/i18n';
import '@/components/portal/portal.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('email');
      if (q) setEmail(decodeURIComponent(q));
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setMsg(t('resetPasswordSent'));
    } catch (e2) {
      setErr(e2.message || t('resetPasswordError'));
    }
    setBusy(false);
  };

  return (
    <div className="portal-signin-page portal-forgot-page">
      <div className="portal-signin-body">
        <div className="portal-signin-card portal-forgot-card">
          <h1 className="portal-forgot-title">{t('resetYourPassword')}</h1>
          <p className="portal-forgot-lead">{t('resetPasswordLead')}</p>

          {msg && <p className="portal-signin-forgot-msg" role="status">{msg}</p>}
          {err && <div className="portal-signin-error" role="alert">{err}</div>}

          <form className="portal-forgot-form" onSubmit={submit}>
            <label className="portal-signin-label" htmlFor="forgot-email">{t('emailPlaceholder')}</label>
            <input
              id="forgot-email"
              className="portal-signin-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />

            <div className="portal-forgot-actions">
              <Link href="/login" className="portal-forgot-cancel">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                <span>{t('cancel')}</span>
              </Link>
              <button type="submit" className="portal-forgot-submit" disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M15 3h4v4" />
                  <path d="M10 14 21 3" />
                  <path d="M21 3v7h-7" />
                  <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                </svg>
                <span>{busy ? t('loading') : t('sendResetLinkPrimary')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
      <PortalFooter />
    </div>
  );
}
