'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, FormInput, MagentaLinks, Btn } from '@/components/admin/AdminBits';

const TEMPLATES = [
  'User activation',
  'Change password',
  'Update password',
  'Alert',
  'Reset MFA confirmation',
];

export default function EmailNotificationsPage() {
  const [replyTo, setReplyTo]   = useState('docs@darwinbox.com');
  const [logoUrl, setLogoUrl]   = useState('/ft-header-logo.png');
  const [advanced, setAdvanced] = useState(false);
  const [dirty,   setDirty]     = useState(false);
  const set = (fn) => (v) => { fn(v); setDirty(true); };

  return (
    <AdminShell
      active="notif-email"
      footer={<ActionFooter dirty={dirty} onCancel={() => setDirty(false)} onSave={() => setDirty(false)} />}
    >
      <h1 style={S.h1}>Email</h1>
      <p style={S.subtitle}>Configure email parameters.</p>

      <Section title="Preview the email templates">
        <MagentaLinks items={TEMPLATES} onClick={(t) => alert(`Preview: ${t}`)} />
      </Section>

      <Section title="Reply-To address" desc="Defines a Reply-To address for all notification email.">
        <FormInput label="Email" value={replyTo} onChange={set(setReplyTo)} />
      </Section>

      <Section title="Logo" desc="Displays a logo in the email header.">
        <div style={S.logoCard}>
          <div style={S.logoLabel}>80x80 pixels logo</div>
          <div style={S.logoBody}>
            <div style={S.logoPreview}>
              {logoUrl ? <img src={logoUrl} alt="Email logo" style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain' }} /> : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Btn onClick={() => set(setLogoUrl)('/ft-header-logo.png')}>↻ Replace</Btn>
              <Btn onClick={() => set(setLogoUrl)('')}>🗑 Delete</Btn>
            </div>
          </div>
        </div>
      </Section>

      <button type="button" onClick={() => setAdvanced((v) => !v)} style={S.advancedBtn}>
        {advanced ? '▼' : '▶'} Advanced settings
      </button>
      {advanced && (
        <div style={S.advancedBox}>
          <FormInput label="SMTP host"      value="" onChange={() => setDirty(true)} />
          <FormInput label="SMTP port"      value="" onChange={() => setDirty(true)} />
          <FormInput label="SMTP user"      value="" onChange={() => setDirty(true)} />
          <FormInput label="SMTP password"  value="" type="password" onChange={() => setDirty(true)} />
        </div>
      )}
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  logoCard: {
    border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden',
    maxWidth: '420px',
  },
  logoLabel: {
    background: '#f1f5f9', padding: '8px 14px', fontSize: '0.85rem',
    fontWeight: 600, color: '#0f172a', textAlign: 'center',
  },
  logoBody: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '14px',
  },
  logoPreview: {
    flex: 1, height: '70px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff',
  },
  advancedBtn: {
    marginTop: '12px', background: 'transparent', border: '1px solid #e5e7eb',
    borderRadius: '4px', padding: '8px 14px', cursor: 'pointer',
    fontSize: '0.9rem', color: '#a21caf', fontFamily: 'var(--font-sans)', fontWeight: 500,
  },
  advancedBox: {
    marginTop: '12px', padding: '14px', border: '1px solid #e5e7eb',
    borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px',
    maxWidth: '560px',
  },
};
