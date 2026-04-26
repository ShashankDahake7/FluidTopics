'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, FormInput, MagentaLinks, Checkbox, Radio, ReorderList, Btn } from '@/components/admin/AdminBits';

const TEMPLATES = [
  'Topic feedback (sent to admin)',
  'Topic feedback confirmation (sent to user)',
  'Document feedback (sent to admin)',
  'Document feedback confirmation (sent to user)',
];

const METADATA_OPTIONS = [
  'author_personname',
  'authorgroup_author_personname',
  'ft:lastPublication',
  'publicationDate',
  'title',
  'ft:publication_title',
  'ft:topic_id',
  'ft:source_id',
];

export default function FeedbackNotificationsPage() {
  const [recipients, setRecipients] = useState('docs@darwinbox.com, shivani.k@darwinbox.in');
  const [subjectMeta, setSubjectMeta] = useState([]);
  const [subjectAdd, setSubjectAdd] = useState('author_personname');
  const [bodyMeta, setBodyMeta] = useState(['ft:lastPublication', 'publicationDate', 'author_personname', 'title', 'ft:publication_title']);
  const [bodyAdd, setBodyAdd] = useState('authorgroup_author_personname');
  const [authService, setAuthService] = useState('ft');     // 'ft' | 'user'
  const [unauthService, setUnauthService] = useState('user');   // 'ft' | 'user'
  const [confirmEmail, setConfirmEmail] = useState(true);
  const [forbiddenExt, setForbiddenExt] = useState('');
  const [maxSize, setMaxSize] = useState(5);
  const [dirty, setDirty] = useState(false);
  const set = (fn) => (v) => { fn(v); setDirty(true); };

  const addSubjectMeta = () => {
    if (!subjectMeta.includes(subjectAdd)) { setSubjectMeta([...subjectMeta, subjectAdd]); setDirty(true); }
  };
  const removeSubjectMeta = (i) => { setSubjectMeta(subjectMeta.filter((_, idx) => idx !== i)); setDirty(true); };
  const addBodyMeta = () => {
    if (!bodyMeta.includes(bodyAdd)) { setBodyMeta([...bodyMeta, bodyAdd]); setDirty(true); }
  };
  const moveBodyMeta = (from, to) => {
    if (to < 0 || to >= bodyMeta.length) return;
    const arr = [...bodyMeta]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    setBodyMeta(arr); setDirty(true);
  };
  const removeBodyMeta = (i) => { setBodyMeta(bodyMeta.filter((_, idx) => idx !== i)); setDirty(true); };

  return (
    <AdminShell
      active="notif-feedback"
      footer={<ActionFooter dirty={dirty} onCancel={() => setDirty(false)} onSave={() => setDirty(false)} />}
    >
      <h1 style={S.h1}>Feedback</h1>
      <p style={S.subtitle}>Configure and preview the user feedback email template.</p>

      <Section title="Preview the email templates">
        <MagentaLinks items={TEMPLATES} onClick={(t) => alert(`Preview: ${t}`)} />
      </Section>

      <Section title="Recipients" desc="Comma-separated list of recipient email addresses.">
        <div style={S.warnBanner}>
          <span aria-hidden="true">⚠</span>
          <span>Please use email aliases as feedback emails are publicly available for functional reasons.</span>
        </div>
        <FormInput label="Recipient email addresses" value={recipients} onChange={set(setRecipients)} />
      </Section>

      <Section title="Enrich email subject" desc="Adds metadata to the email subject line.">
        <div style={S.metaBox}>
          {subjectMeta.length === 0 ? (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem', padding: '8px 0' }}>No metadata selected</div>
          ) : (
            <ReorderList
              items={subjectMeta}
              onMove={(from, to) => {
                if (to < 0 || to >= subjectMeta.length) return;
                const arr = [...subjectMeta]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
                setSubjectMeta(arr); setDirty(true);
              }}
              onRemove={removeSubjectMeta}
            />
          )}
          <div style={S.addRow}>
            <span style={{ fontSize: '0.9rem' }}>Add metadata</span>
            <select value={subjectAdd} onChange={(e) => setSubjectAdd(e.target.value)} style={S.select}>
              {METADATA_OPTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={addSubjectMeta} style={S.addBtn} aria-label="Add">+</button>
          </div>
        </div>
      </Section>

      <Section title="Enrich email body" desc="Adds metadata, only from the document, to the email body.">
        <div style={S.metaBox}>
          <ReorderList items={bodyMeta} onMove={moveBodyMeta} onRemove={removeBodyMeta} />
          <div style={S.addRow}>
            <span style={{ fontSize: '0.9rem' }}>Add metadata</span>
            <select value={bodyAdd} onChange={(e) => setBodyAdd(e.target.value)} style={S.select}>
              {METADATA_OPTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={addBodyMeta} style={S.addBtn} aria-label="Add">+</button>
          </div>
        </div>
      </Section>

      <Section title="Email service for authenticated users">
        <Radio checked={authService === 'ft'} onChange={() => set(setAuthService)('ft')} label="Feedback sent by Fluid Topics email sending method" />
        <Radio checked={authService === 'user'} onChange={() => set(setAuthService)('user')} label="Feedback sent by the user's email application" />
      </Section>

      <Section title="Email service for unauthenticated users">
        <div style={S.infoBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#1d4ed8', flexShrink: 0 }}>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          <span>Configure SMTP relay in <a href="/admin/notifications/email" style={{ color: '#1d4ed8' }}>Email settings</a> to use Fluid Topics email sending method.</span>
        </div>
        <Radio checked={unauthService === 'ft'} onChange={() => set(setUnauthService)('ft')} label="Feedback sent by Fluid Topics email sending method (only available with SMTP relay)" />
        <Radio checked={unauthService === 'user'} onChange={() => set(setUnauthService)('user')} label="Feedback sent by the user's email application" />
      </Section>

      <Section title="Confirmation email" desc="When authenticated users submit feedback, Fluid Topics sends them an email to acknowledge their action.">
        <Checkbox checked={confirmEmail} onChange={set(setConfirmEmail)} label="An email is sent to users after submitting feedback" />
      </Section>

      <Section title="Forbidden attachment file extensions" desc="Comma-separated list of file extensions.">
        <FormInput label="File extensions" value={forbiddenExt} onChange={set(setForbiddenExt)} placeholder=".exe, .bat" />
      </Section>

      <Section title="Maximum attachment size" desc="Defines the maximum total size for attached files (between 1MB and 23MB).">
        <FormInput value={maxSize} onChange={set(setMaxSize)} type="number" suffix="MB" />
      </Section>
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  warnBanner: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d',
    borderRadius: '4px', color: '#92400e', fontSize: '0.88rem',
    marginBottom: '12px',
  },
  metaBox: {
    background: '#FFFFFF',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
  },
  addRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px',
  },
  select: {
    padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', background: '#fff',
    fontFamily: 'var(--font-sans)', color: '#1f2937', cursor: 'pointer',
  },
  addBtn: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#a21caf', color: '#fff', border: 'none',
    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  infoBanner: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    marginBottom: '10px', padding: '8px 12px',
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px',
    color: '#1e3a8a', fontSize: '0.88rem',
  },
};
