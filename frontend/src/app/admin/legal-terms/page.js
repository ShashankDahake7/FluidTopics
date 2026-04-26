'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </svg>
);

const LANGUAGES = [
  'Italiano', 'Français', 'Deutsch', 'Español', '日本語', '中文', 'Português',
];

export default function LegalTermsPage() {
  const [enabled, setEnabled] = useState(false);
  const [savedToggle, setSavedToggle] = useState(true);
  const [addLang, setAddLang] = useState('Italiano');
  const [messages, setMessages] = useState([
    {
      lang: 'English (United States)',
      fallback: true,
      example: 'I agree to the Terms of Use',
      readMore: 'Read our Terms of Use',
    },
  ]);
  const [dirty, setDirty] = useState(false);

  const toggleEnabled = () => {
    setEnabled((v) => !v);
    setSavedToggle(false);
  };

  const addLanguage = () => {
    if (messages.some((m) => m.lang === addLang)) return;
    setMessages((arr) => [...arr, { lang: addLang, fallback: false, example: '', readMore: '' }]);
    setDirty(true);
  };

  return (
    <AdminShell
      active="legal-terms"
      footer={
        <>
          <button type="button" style={S.btnCancel} onClick={() => setDirty(false)} disabled={!dirty}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
            onClick={() => setDirty(false)}
            disabled={!dirty}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Save</span>
          </button>
        </>
      }
    >
      <h1 style={S.h1}>Legal terms</h1>
      <p style={S.subtitle}>Define legal terms for users to accept.</p>

      <div style={S.toggleRow}>
        <button type="button" onClick={toggleEnabled} style={S.toggle(enabled)} aria-label="Toggle legal terms">
          <span style={S.toggleKnob(enabled)} />
        </button>
        <span style={S.toggleLabel}>{enabled ? 'Legal terms enabled' : 'Legal terms disabled'}</span>
        <button type="button" style={S.linkBtn} onClick={() => setSavedToggle(true)} disabled={savedToggle}>
          {savedToggle ? 'Saved' : 'Save'}
        </button>
      </div>

      <hr style={S.hr} />

      {/* Message */}
      <section style={S.section}>
        <h2 style={S.h2}>Message</h2>
        <p style={S.sectionDesc}>Prompts users to accept legal terms and displays one or more links to these terms.</p>

        <div style={S.tableWrap}>
          <div style={S.thead}>
            <div style={{ flex: '0 0 220px' }}>Language</div>
            <div style={{ flex: 1 }}>Message</div>
            <div style={{ width: '40px' }} />
          </div>
          {messages.map((m, i) => (
            <div key={m.lang} style={S.row}>
              <div style={{ flex: '0 0 220px' }}>
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>{m.lang}</div>
                {m.fallback && <span style={S.badgeFallback}>Fallback language</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#d97706', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Example of message:</div>
                <div style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                  <input type="checkbox" disabled style={{ marginRight: '6px' }} />
                  {m.example || 'I agree to the Terms of Use'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>{m.readMore || 'Read our Terms of Use'}</div>
              </div>
              <button type="button" style={S.editIcon} aria-label="Edit message" onClick={() => alert('Edit dialog placeholder')}>
                <PencilIcon />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>Add language</span>
          <select value={addLang} onChange={(e) => setAddLang(e.target.value)} style={S.select}>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button type="button" onClick={addLanguage} style={S.addBtn} aria-label="Add language">+</button>
        </div>
      </section>

      <hr style={S.hr} />

      {/* Version */}
      <section style={S.section}>
        <h2 style={S.h2}>Version</h2>
        <p style={S.sectionDesc}>Prompts users to accept updated legal terms. Legal terms have never been updated.</p>

        <button type="button" style={S.btnGhost} onClick={() => alert('New version flow placeholder')}>
          New version
        </button>
      </section>
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  toggle: (on) => ({
    width: '40px', height: '20px',
    borderRadius: '999px',
    background: on ? '#1d4ed8' : '#cbd5e1',
    border: 'none', cursor: 'pointer',
    position: 'relative', flexShrink: 0,
    transition: 'background 150ms',
    padding: 0,
  }),
  toggleKnob: (on) => ({
    position: 'absolute',
    top: '2px',
    left: on ? '22px' : '2px',
    width: '16px', height: '16px',
    background: '#fff', borderRadius: '50%',
    transition: 'left 150ms',
  }),
  toggleLabel: { fontSize: '0.92rem', color: '#0f172a', fontWeight: 500 },
  linkBtn: {
    background: 'transparent', border: 'none', color: '#1d4ed8',
    fontSize: '0.92rem', cursor: 'pointer', padding: 0,
    fontFamily: 'var(--font-sans)',
  },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' },
  section: { marginBottom: '28px' },
  h2: { fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.92rem', color: '#374151', margin: '0 0 14px' },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  thead: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '10px 14px',
    background: '#f1f5f9',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '14px',
    background: '#ffffff',
    borderTop: '1px solid #e5e7eb',
  },
  badgeFallback: {
    display: 'inline-block',
    marginTop: '6px',
    padding: '2px 10px',
    background: '#1d4ed8',
    color: '#fff',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  editIcon: {
    color: '#a21caf',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
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
  addBtn: {
    width: '28px', height: '28px',
    borderRadius: '50%',
    background: '#a21caf',
    color: '#fff',
    border: 'none',
    fontSize: '1.1rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    padding: '8px 18px',
    background: '#fce7f3',
    color: '#9d174d',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
  },
  btnCancel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    background: '#a21caf',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
  },
};
