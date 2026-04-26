'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

const Check = ({ on }) => (
  <span style={{
    width: '16px', height: '16px',
    border: '2px solid', borderColor: on ? '#1d4ed8' : '#94a3b8',
    background: on ? '#1d4ed8' : 'transparent',
    borderRadius: '3px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    {on && (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </span>
);

function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={S.checkRow}>
      <Check on={checked} />
      <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{label}</span>
    </button>
  );
}

export default function AuthenticationPage() {
  const [requireAuth,    setRequireAuth]    = useState(false);
  const [openSsoCurrent, setOpenSsoCurrent] = useState(true);
  const [hideCredForm,   setHideCredForm]   = useState(false);
  const [logoutUrl,      setLogoutUrl]      = useState('');
  const [disableLogout,  setDisableLogout]  = useState(false);
  const [timeoutOn,      setTimeoutOn]      = useState(true);
  const [timeoutMin,     setTimeoutMin]     = useState(840);
  const [dirty,          setDirty]          = useState(false);

  const set = (setter) => (v) => { setter(v); setDirty(true); };

  return (
    <AdminShell
      active="authentication"
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
      <h1 style={S.h1}>Authentication</h1>
      <p style={S.subtitle}>Configure authentication parameters.</p>

      <Section title="Mandatory authentication" desc="Makes the portal only available to authenticated users.">
        <Checkbox checked={requireAuth} onChange={set(setRequireAuth)} label="Require authentication" />
      </Section>

      <Section title="SSO login and logout page" desc="Makes the external login and logout page open in the current browser window if an SSO realm is configured.">
        <Checkbox checked={openSsoCurrent} onChange={set(setOpenSsoCurrent)} label="Open SSO login and logout page in the current window" />
      </Section>

      <Section title="Credentials form" desc="Prevents the display of the default credentials form when both SSO and non-SSO realms are configured.">
        <Checkbox checked={hideCredForm} onChange={set(setHideCredForm)} label="Hide the credentials form if an SSO realm is configured" />
        <div style={S.infoBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#1d4ed8', flexShrink: 0 }}>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          <span>Bookmark the following URL to display the credentials form&nbsp;<code style={S.code}>https://help.darwinbox.com/login?direct=true</code></span>
        </div>
      </Section>

      <Section title="Logout redirect URL" desc="Redirects users to a URL after logout.">
        <input
          value={logoutUrl}
          onChange={(e) => set(setLogoutUrl)(e.target.value)}
          placeholder="Redirect URL"
          style={S.input}
        />
      </Section>

      <Section title="Native logout" desc="Hides the native logout button, for example, when a custom logout mechanism is provided.">
        <Checkbox checked={disableLogout} onChange={set(setDisableLogout)} label="Disable native logout" />
      </Section>

      <Section title="Authentication timeout" desc="Defines a number of minutes of inactivity before automatic logout (30 minutes minimum).">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Checkbox checked={timeoutOn} onChange={set(setTimeoutOn)} label="Trigger timeout after" />
          <input
            type="number"
            min={30}
            value={timeoutMin}
            onChange={(e) => set(setTimeoutMin)(Number(e.target.value))}
            style={{ ...S.input, width: '120px' }}
            disabled={!timeoutOn}
          />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>minutes of inactivity</span>
        </div>
      </Section>
    </AdminShell>
  );
}

function Section({ title, desc, children }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2}>{title}</h2>
      <p style={S.sectionDesc}>{desc}</p>
      <div style={{ marginTop: '8px' }}>{children}</div>
    </section>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  section: { marginBottom: '32px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.92rem', color: '#374151', margin: '0 0 6px' },
  checkRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 0',
    fontFamily: 'var(--font-sans)',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.92rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    maxWidth: '720px',
    color: '#0f172a',
    background: '#ffffff',
  },
  infoBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '10px',
    padding: '8px 12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '4px',
    color: '#1e3a8a',
    fontSize: '0.88rem',
  },
  code: {
    fontFamily: 'var(--font-mono)',
    background: '#dbeafe',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '0.82rem',
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
