'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PortalFooter from '@/components/portal/PortalFooter';
import { useTranslation } from '@/lib/i18n';
import '@/components/portal/portal.css';

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const { t } = useTranslation();

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErr('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setErr(t('sixMin') || '6 characters minimum');
      return;
    }
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword: password });
      setMsg('Password updated successfully. Redirecting...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (e2) {
      setErr(e2.message || 'Failed to reset password');
    }
    setBusy(false);
  };

  return (
    <div className="portal-signin-page portal-forgot-page">
      <div className="portal-signin-body">
        <div className="portal-signin-card portal-forgot-card">
          <h1 className="portal-forgot-title">RESET PASSWORD</h1>
          {msg && <p className="portal-signin-forgot-msg" style={{color: 'green', marginBottom: '15px'}}>{msg}</p>}
          {err && <div className="portal-signin-error">{err}</div>}
          {!msg && (
            <form className="portal-forgot-form" onSubmit={submit}>
              <label className="portal-signin-label">New Password</label>
              <input 
                className="portal-signin-input" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <label className="portal-signin-label">Confirm Password</label>
              <input 
                className="portal-signin-input" 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
              <div className="portal-forgot-actions">
                <button type="submit" className="portal-forgot-submit" disabled={busy}>Update Password</button>
              </div>
            </form>
          )}
        </div>
      </div>
      <PortalFooter />
    </div>
  );
}
