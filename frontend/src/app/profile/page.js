'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import ProfileShell from '@/components/profile/ProfileShell';
import { useTranslation, LANGUAGES } from '@/lib/i18n';

const Icon = {
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  searchGo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
      <path d="m12 8 3 3-3 3" />
    </svg>
  ),
  pencil: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
    </svg>
  ),
  thumbsUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  ),
  feedback: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  ),
  saveSearch: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  ),
  collection: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 6V4h8v2" />
    </svg>
  ),
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: true, timeZoneName: 'shortOffset',
    });
  } catch { return String(d); }
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { t, lang, setLang } = useTranslation();

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) {
      router.replace('/login');
      return;
    }
    try {
      const stored = localStorage.getItem('ft_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    api.get('/user/profile')
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const role = user?.role || profile?.role;
  const isAdmin = role === 'admin' || role === 'editor';
  const name = profile?.name || user?.name || '—';
  const email = profile?.email || user?.email || '—';
  const lastLogin = profile?.lastLogin || user?.lastLogin;

  if (loading) {
    return (
      <ProfileShell active="profile">
        <div style={S.spinnerWrap}><div className="spinner" /></div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell active="profile">
      <h1 style={S.pageTitle}>{t('profile')}</h1>

        {/* About me */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>{t('aboutMe')}</h2>

          <Field label={t('name')} value={name} />
          <Field label={t('emailAddress')} value={email} />
          <Field label={t('lastLogin')} value={formatDate(lastLogin)} />

          <div style={{ marginTop: '14px' }}>
            <div style={S.fieldLabel}>{t('password')}</div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                style={S.passwordLink}
              >
                {Icon.pencil}
                <span>{t('changePassword')}</span>
              </button>
            ) : (
              <div style={S.infoBanner}>
                <span style={S.infoIcon}>{Icon.info}</span>
                <span>{t('contactAdmin')}</span>
              </div>
            )}
          </div>
        </section>
        {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}

        {/* Interface preferences */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>{t('interfacePreferences')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
            <span style={{ fontSize: '0.92rem', color: '#1f2937' }}>{t('language')}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={S.select}
            >
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </section>

        {/* Available features */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>{t('availableFeatures')}</h2>

          <FeatureGroup title={t('readerPage')}>
            <FeatureItem icon={Icon.thumbsUp} label={t('canRate')} muted />
            <FeatureItem icon={Icon.feedback} label={t('canFeedback')} muted />
          </FeatureGroup>

          <FeatureGroup title={t('myLibraryHeading')}>
            <FeatureItem icon={Icon.saveSearch} label={t('canSaveSearches')}     href="/mylibrary/searches"    />
            <FeatureItem icon={Icon.collection} label={t('canCreateCollections')} href="/mylibrary/collections" />
          </FeatureGroup>

        </section>
    </ProfileShell>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={S.fieldLabel}>{label}</div>
      <div style={S.fieldValue}>{value}</div>
    </div>
  );
}

function ChangePasswordDialog({ onClose }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = current.length > 0 && next.length >= 6 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      alert('Password updated');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const EyeIcon = ({ off }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );

  return (
    <div style={D.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={D.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={D.header}>
          <div style={D.title}>{t('changePassword')}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={D.closeBtn}>×</button>
        </div>
        <div style={D.body}>
          <label style={D.label}>{t('currentPassword')}</label>
          <div style={D.inputWrap}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
              style={D.input}
            />
            <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? 'Hide password' : 'Show password'} style={D.eyeBtn}>
              <EyeIcon off={!showCurrent} />
            </button>
          </div>

          <label style={{ ...D.label, marginTop: '18px' }}>{t('newPassword')}</label>
          <div style={D.hint}>{t('sixMin')}</div>
          <div style={D.inputWrap}>
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              style={D.input}
            />
            <button type="button" onClick={() => setShowNext((v) => !v)} aria-label={showNext ? 'Hide password' : 'Show password'} style={D.eyeBtn}>
              <EyeIcon off={!showNext} />
            </button>
          </div>
          {error && <div style={D.errorMsg}>{error}</div>}
        </div>
        <div style={D.footer}>
          <button type="button" onClick={onClose} style={D.cancelBtn}>✕ {t('cancel')}</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ ...D.okBtn, opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            ✓ {submitting ? '…' : t('ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

const D = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  },
  dialog: {
    background: '#ffffff',
    width: '100%', maxWidth: '600px',
    borderRadius: '6px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#0f172a' },
  closeBtn: {
    background: 'transparent', border: 'none',
    fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
    color: '#374151', width: '28px', height: '28px',
  },
  body: { padding: '22px 24px' },
  label: { display: 'block', fontSize: '0.92rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' },
  hint: { fontSize: '0.78rem', color: '#6b7280', marginBottom: '6px' },
  inputWrap: { position: 'relative' },
  input: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    border: '1px solid #2563eb',
    borderRadius: '4px',
    fontSize: '0.92rem',
    color: '#0f172a',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute', top: '50%', right: '8px',
    transform: 'translateY(-50%)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  errorMsg: {
    marginTop: '14px',
    fontSize: '0.85rem',
    color: '#dc2626',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
    padding: '14px 24px',
    borderTop: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  cancelBtn: {
    background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '4px',
    padding: '8px 18px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
  },
  okBtn: {
    background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: '4px',
    padding: '8px 22px',
    fontSize: '0.85rem', fontWeight: 600,
  },
};

function FeatureGroup({ title, children }) {
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={S.featureGroupTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
        {children}
      </div>
    </div>
  );
}

function FeatureItem({ icon, label, href, muted }) {
  const color = muted ? '#374151' : '#1d4ed8';
  const inner = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color, fontSize: '0.92rem' }}>
      <span style={{ display: 'inline-flex', color }}>{icon}</span>
      {label}
    </span>
  );
  if (href && !muted) {
    return <Link href={href} style={{ textDecoration: 'none', padding: '4px 0' }}>{inner}</Link>;
  }
  return <div style={{ padding: '4px 0' }}>{inner}</div>;
}

const S = {
  spinnerWrap: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 600,
    color: '#1d4ed8',
    margin: '0 0 24px',
    letterSpacing: '-0.01em',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  fieldLabel: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '2px',
  },
  fieldValue: {
    fontSize: '0.92rem',
    color: '#374151',
  },
  passwordLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    color: '#1d4ed8',
    fontSize: '0.92rem',
    cursor: 'pointer',
    padding: '6px 0',
    fontFamily: 'var(--font-sans)',
  },
  infoBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '4px',
    color: '#1e3a8a',
    fontSize: '0.88rem',
    marginTop: '4px',
  },
  infoIcon: {
    display: 'inline-flex',
    color: '#1d4ed8',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.9rem',
    background: '#ffffff',
    fontFamily: 'var(--font-sans)',
    color: '#1f2937',
    cursor: 'pointer',
  },
  featureGroupTitle: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#0f172a',
  },
};
