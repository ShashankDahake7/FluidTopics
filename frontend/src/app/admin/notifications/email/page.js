'use client';
import { useState, useMemo } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, FormInput, MagentaLinks, Btn, Radio } from '@/components/admin/AdminBits';
import EmailPreviewDrawer from '@/components/admin/EmailPreviewDrawer';
import { buildEmailPreviewSrcDoc, resolveLogoAbs } from '@/lib/emailPreviews';

// Material-style outlined input with the label notched into the top border —
// matches the look of the Fluid Topics email-config screen.
function OutlinedInput({ label, value, onChange, type = 'text', disabled = false, suffix }) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: '10px 14px 12px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        background: disabled ? '#f8fafc' : '#fff',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <legend style={{ padding: '0 6px', fontSize: '0.72rem', color: '#475569' }}>{label}</legend>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '0.92rem',
          color: '#0f172a',
          fontFamily: 'var(--font-sans)',
          padding: 0,
        }}
      />
      {suffix}
    </fieldset>
  );
}

function OutlinedTextarea({ label, value, onChange, rows = 6, placeholder }) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: '8px 14px 12px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        background: '#fff',
        position: 'relative',
      }}
    >
      <legend style={{ padding: '0 6px', fontSize: '0.72rem', color: '#475569' }}>{label}</legend>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '0.92rem',
          color: '#0f172a',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          resize: 'vertical',
          padding: 0,
          minHeight: '120px',
        }}
      />
    </fieldset>
  );
}

function OutlinedSelect({ label, value, onChange, options }) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: '10px 14px 12px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        background: '#fff',
        position: 'relative',
      }}
    >
      <legend style={{ padding: '0 6px', fontSize: '0.72rem', color: '#475569' }}>{label}</legend>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '0.92rem',
          color: '#0f172a',
          fontFamily: 'var(--font-sans)',
          padding: 0,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundImage:
            'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0 center',
          backgroundSize: '16px',
          paddingRight: '20px',
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </fieldset>
  );
}

const TEMPLATES = [
  'User activation',
  'Change password',
  'Update password',
  'Alert',
  'Reset MFA confirmation',
];

export default function EmailNotificationsPage() {
  const [replyTo, setReplyTo] = useState('docs@darwinbox.com');
  const [logoUrl, setLogoUrl] = useState('/ft-header-logo.png');
  const [advanced, setAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(null);

  // Advanced — Email sending method + SMTP relay configuration.
  const [emailMethod, setEmailMethod]       = useState('smtp'); // 'internal' | 'spfdkim' | 'smtp'
  const [fromEmail, setFromEmail]           = useState('docs@darwinbox.com');
  const [smtpHost, setSmtpHost]             = useState('smtp.sendgrid.net');
  const [smtpPort, setSmtpPort]             = useState('25');
  const [smtpTransport, setSmtpTransport]   = useState('SMTP');
  const [smtpUser, setSmtpUser]             = useState('apikey');
  const [smtpPass, setSmtpPass]             = useState('•••••••••••••••••••••••••••••••••••••••••••');
  const [showSmtpPass, setShowSmtpPass]     = useState(false);
  const [testEmail, setTestEmail]           = useState('');

  // SPF / DKIM-specific fields.
  const [dkimFromEmail, setDkimFromEmail]   = useState('');
  const [dkimPrivateKey, setDkimPrivateKey] = useState('');
  const [dkimSelector, setDkimSelector]     = useState('');
  const [dnsChecked, setDnsChecked]         = useState(false);

  const set = (fn) => (v) => {
    fn(v);
    setDirty(true);
  };

  const fromAddr = replyTo || 'docs@darwinbox.com';

  const iframeSrcDoc = useMemo(() => {
    if (!preview) return '';
    return buildEmailPreviewSrcDoc(preview, {
      fromAddr,
      logoAbs: resolveLogoAbs(logoUrl),
    });
  }, [preview, fromAddr, logoUrl]);

  return (
    <AdminShell
      active="notif-email"
      footer={<ActionFooter dirty={dirty} onCancel={() => setDirty(false)} onSave={() => setDirty(false)} />}
    >
      <h1 style={S.h1}>Email</h1>
      <p style={S.subtitle}>Configure email parameters.</p>

      <Section title="Preview the email templates">
        <MagentaLinks items={TEMPLATES} onClick={setPreview} />
      </Section>

      <Section title="Reply-To address" desc="Defines a Reply-To address for all notification email.">
        <FormInput label="Email" value={replyTo} onChange={set(setReplyTo)} />
      </Section>

      <Section title="Logo" desc="Displays a logo in the email header.">
        <div style={S.logoCard}>
          <div style={S.logoLabel}>80x80 pixels logo</div>
          <div style={S.logoBody}>
            <div style={S.logoPreview}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Email logo"
                  style={{ maxWidth: '160px', maxHeight: '52px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No logo</span>
              )}
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
        <div style={S.advancedPanel}>
          <Section
            title="Email sending method"
            desc="Defines the method used to send all notification emails, including feedback."
          >
            <div style={S.infoBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                When selecting the internal mail server, the sender address for all notification emails is set to <strong>no-reply@fluidtopics.net</strong>.
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '10px' }}>
              <Radio
                checked={emailMethod === 'internal'}
                onChange={() => { setEmailMethod('internal'); setDirty(true); }}
                label="Use the internal mail server"
              />
              <Radio
                checked={emailMethod === 'spfdkim'}
                onChange={() => { setEmailMethod('spfdkim'); setDirty(true); }}
                label="Configure SPF and DKIM for the internal mail server"
              />
              <Radio
                checked={emailMethod === 'smtp'}
                onChange={() => { setEmailMethod('smtp'); setDirty(true); }}
                label="Use an external mail server with SMTP relay"
              />
            </div>

            {emailMethod === 'spfdkim' && (
              <div style={{ ...S.infoBanner, marginTop: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Before modifying, confirm with your DNS provider that an SPF record and DKIM public key exist in the DNS configuration.
                </span>
              </div>
            )}
          </Section>

          {emailMethod === 'spfdkim' && (
            <>
              <Section title="From address">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Email"
                    value={dkimFromEmail}
                    onChange={(v) => { setDkimFromEmail(v); setDirty(true); }}
                  />
                </div>
              </Section>

              <Section title="DKIM - DomainKeys Identified Mail">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '720px' }}>
                  <OutlinedTextarea
                    label="DKIM private key"
                    value={dkimPrivateKey}
                    onChange={(v) => { setDkimPrivateKey(v); setDirty(true); }}
                    rows={8}
                  />
                  <OutlinedInput
                    label="DKIM selector"
                    value={dkimSelector}
                    onChange={(v) => { setDkimSelector(v); setDirty(true); }}
                  />
                </div>
              </Section>

              <Section
                title="Test DNS configuration"
                desc="Validation of your DNS configuration is required before saving."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '720px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDnsChecked(true);
                      alert('DNS configuration check started.');
                    }}
                    style={S.checkDnsBtn}
                  >
                    Check DNS configuration
                  </button>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                    <div style={{ flex: 1 }}>
                      <OutlinedInput
                        label="Email"
                        value={testEmail}
                        onChange={setTestEmail}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!testEmail.trim() || !dnsChecked}
                      onClick={() => alert(`Test email sent to ${testEmail}`)}
                      style={{
                        ...S.testBtn,
                        opacity: testEmail.trim() && dnsChecked ? 1 : 0.55,
                        cursor: testEmail.trim() && dnsChecked ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Send a test email
                    </button>
                  </div>
                </div>
              </Section>
            </>
          )}

          {emailMethod === 'smtp' && (
            <>
              <Section title="From address">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Email"
                    value={fromEmail}
                    onChange={(v) => { setFromEmail(v); setDirty(true); }}
                  />
                </div>
              </Section>

              <Section title="SMTP server configuration">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Host"
                    value={smtpHost}
                    onChange={(v) => { setSmtpHost(v); setDirty(true); }}
                  />
                  <OutlinedInput
                    label="Port"
                    value={smtpPort}
                    onChange={(v) => { setSmtpPort(v); setDirty(true); }}
                  />
                  <OutlinedSelect
                    label="Transport strategy"
                    value={smtpTransport}
                    onChange={(v) => { setSmtpTransport(v); setDirty(true); }}
                    options={[
                      { value: 'SMTP',     label: 'SMTP' },
                      { value: 'SMTPS',    label: 'SMTPS' },
                      { value: 'SMTP_TLS', label: 'SMTP TLS' },
                    ]}
                  />
                </div>
              </Section>

              <Section title="SMTP authentication">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Username"
                    value={smtpUser}
                    onChange={(v) => { setSmtpUser(v); setDirty(true); }}
                  />
                  <OutlinedInput
                    label="Password"
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(v) => { setSmtpPass(v); setDirty(true); }}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass((v) => !v)}
                        aria-label={showSmtpPass ? 'Hide password' : 'Show password'}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#475569', padding: 0, display: 'inline-flex',
                        }}
                      >
                        {showSmtpPass ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.66 18.66 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                </div>
              </Section>

              <Section
                title="Test configuration"
                desc="Sending a test mail can help identify configuration issues."
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', maxWidth: '720px' }}>
                  <div style={{ flex: 1 }}>
                    <OutlinedInput
                      label="Email"
                      value={testEmail}
                      onChange={setTestEmail}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!testEmail.trim()}
                    onClick={() => alert(`Test email sent to ${testEmail}`)}
                    style={{
                      ...S.testBtn,
                      opacity: testEmail.trim() ? 1 : 0.55,
                      cursor: testEmail.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Send a test email
                  </button>
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      <EmailPreviewDrawer
        template={preview}
        srcDoc={iframeSrcDoc}
        onClose={() => setPreview(null)}
      />
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  logoCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
    maxWidth: '420px',
  },
  logoLabel: {
    background: '#f1f5f9',
    padding: '8px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
    textAlign: 'center',
  },
  logoBody: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
  },
  logoPreview: {
    flex: 1,
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1d4ed8',
    backgroundImage: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
    borderRadius: '4px',
    padding: '14px 16px',
  },
  advancedBtn: {
    marginTop: '12px',
    background: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: '#a21caf',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  advancedPanel: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '4px',
    fontSize: '0.85rem',
    color: '#0c4a6e',
    maxWidth: '720px',
    marginTop: '6px',
  },
  fieldGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxWidth: '720px',
  },
  testBtn: {
    background: '#a21caf',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '0 22px',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
  },
  checkDnsBtn: {
    background: '#a21caf',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '12px 16px',
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
};
