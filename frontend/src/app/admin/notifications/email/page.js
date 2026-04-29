'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, FormInput, MagentaLinks, Btn, Radio } from '@/components/admin/AdminBits';
import EmailPreviewDrawer from '@/components/admin/EmailPreviewDrawer';
import { buildEmailPreviewSrcDoc, resolveLogoAbs } from '@/lib/emailPreviews';
import api from '@/lib/api';

// Material-style outlined input with the label notched into the top border —
// matches the look of the Fluid Topics email-config screen.
function OutlinedInput({ label, value, onChange, type = 'text', disabled = false, suffix, placeholder }) {
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
        placeholder={placeholder}
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

const REDACTED = '__redacted__';

// The settings shape mirrors the publicSettings projection from
// backend/src/routes/emailAdmin.js — kept as a single object so cancel/save
// reset the whole form atomically.
function emptySettings() {
  return {
    replyToAddress: '',
    logoUrl: '',
    sendingMethod: 'internal',
    dkimFromAddress: '',
    dkimPrivateKey: '',
    dkimSelector: '',
    dkimDnsValid: false,
    dkimDnsCheckedAt: null,
    smtpFromAddress: '',
    smtpHost: '',
    smtpPort: 25,
    smtpTransport: 'SMTP',
    smtpUser: '',
    smtpPassword: '',
    lastTestSentTo: '',
    lastTestSentAt: null,
    lastTestError: '',
  };
}

function Banner({ kind, children, onDismiss }) {
  if (!children) return null;
  const palette = {
    error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46' },
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#0c4a6e' },
  }[kind] || { bg: '#eff6ff', border: '#bfdbfe', color: '#0c4a6e' };
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      style={{
        marginBottom: '14px',
        padding: '10px 14px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: '4px',
        color: palette.color,
        fontSize: '0.88rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        maxWidth: '720px',
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function EmailNotificationsPage() {
  const [settings, setSettings] = useState(emptySettings());
  const [loading, setLoading] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [preview, setPreview] = useState(null);

  // Test-send and DNS-check state lives outside `settings` because it isn't
  // saved with the rest of the form.
  const [testEmail, setTestEmail] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [dnsBusy, setDnsBusy] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Snapshot of the last successful load so Cancel can restore it.
  const baseline = useRef(null);
  const fileInputRef = useRef(null);

  const set = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setErrorMsg('');
    setInfoMsg('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const d = await api.get('/admin/email');
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      baseline.current = JSON.stringify(next);
      setDirty(false);
      setAdvanced(next.sendingMethod !== 'internal' || !!next.smtpHost || !!next.dkimSelector);
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to load email settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = () => {
    if (!baseline.current) { setDirty(false); return; }
    const b = JSON.parse(baseline.current);
    setSettings(b);
    setDirty(false);
    setErrorMsg('');
    setInfoMsg('');
  };

  const save = async () => {
    setSaving(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const payload = { ...settings };
      // Don't echo the redacted sentinel back to the server.
      if (payload.dkimPrivateKey === REDACTED) delete payload.dkimPrivateKey;
      if (payload.smtpPassword === REDACTED) delete payload.smtpPassword;
      const d = await api.put('/admin/email', payload);
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      baseline.current = JSON.stringify(next);
      setDirty(false);
      setInfoMsg('Email settings saved.');
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to save email settings.');
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = () => fileInputRef.current?.click();

  const onLogoChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setInfoMsg('');
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const d = await api.upload('/admin/email/logo', fd);
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      baseline.current = JSON.stringify(next);
      setDirty(false);
      setInfoMsg('Logo updated.');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to upload logo.');
    }
  };

  const deleteLogo = async () => {
    setErrorMsg('');
    setInfoMsg('');
    try {
      const d = await api.delete('/admin/email/logo');
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      baseline.current = JSON.stringify(next);
      setDirty(false);
      setInfoMsg('Logo removed.');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to remove logo.');
    }
  };

  const checkDns = async () => {
    setDnsBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const d = await api.post('/admin/email/check-dns', {
        dkimFromAddress: settings.dkimFromAddress,
        dkimSelector: settings.dkimSelector,
      });
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      baseline.current = JSON.stringify(next);
      setDirty(false);
      if (d.ok) {
        setInfoMsg('DNS configuration is valid.');
      } else {
        setErrorMsg(`DNS check failed — SPF: ${d.spf?.error || (d.spf?.ok ? 'ok' : 'missing')}; DKIM: ${d.dkim?.error || (d.dkim?.ok ? 'ok' : 'missing')}.`);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'DNS check failed.');
    } finally {
      setDnsBusy(false);
    }
  };

  const sendTest = async () => {
    setTestBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await api.post('/admin/email/test', { email: testEmail.trim() });
      setInfoMsg(`Test email sent to ${testEmail.trim()}.`);
      // Re-load to pick up lastTestSentAt timestamp.
      load();
    } catch (err) {
      setErrorMsg(err?.message || 'Sending the test email failed.');
    } finally {
      setTestBusy(false);
    }
  };

  const fromAddr = useMemo(() => {
    if (settings.sendingMethod === 'smtp' && settings.smtpFromAddress) return settings.smtpFromAddress;
    if (settings.sendingMethod === 'spfdkim' && settings.dkimFromAddress) return settings.dkimFromAddress;
    return settings.replyToAddress || 'no-reply@fluidtopics.net';
  }, [settings.sendingMethod, settings.smtpFromAddress, settings.dkimFromAddress, settings.replyToAddress]);

  const iframeSrcDoc = useMemo(() => {
    if (!preview) return '';
    return buildEmailPreviewSrcDoc(preview, {
      fromAddr,
      logoAbs: resolveLogoAbs(settings.logoUrl),
    });
  }, [preview, fromAddr, settings.logoUrl]);

  if (loading) {
    return (
      <AdminShell active="notif-email" allowedRoles={['superadmin', 'admin']} allowedAdminRoles={['PORTAL_ADMIN']}>
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="notif-email"
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['PORTAL_ADMIN']}
      footer={<ActionFooter dirty={dirty && !saving} onCancel={cancel} onSave={save} />}
    >
      <h1 style={S.h1}>Email</h1>
      <p style={S.subtitle}>Configure email parameters.</p>

      <Banner kind="error" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner>
      <Banner kind="success" onDismiss={() => setInfoMsg('')}>{infoMsg}</Banner>

      <Section title="Preview the email templates">
        <MagentaLinks items={TEMPLATES} onClick={setPreview} />
      </Section>

      <Section title="Reply-To address" desc="Defines a Reply-To address for all notification email.">
        <FormInput
          label="Email"
          value={settings.replyToAddress}
          onChange={(v) => set({ replyToAddress: v })}
        />
      </Section>

      <Section title="Logo" desc="Displays a logo in the email header.">
        <div style={S.logoCard}>
          <div style={S.logoLabel}>80x80 pixels logo</div>
          <div style={S.logoBody}>
            <div style={S.logoPreview}>
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Email logo"
                  style={{ maxWidth: '160px', maxHeight: '52px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No logo</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Btn onClick={onPickLogo}>↻ Replace</Btn>
              <Btn onClick={deleteLogo} disabled={!settings.logoUrl}>🗑 Delete</Btn>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                onChange={onLogoChosen}
                style={{ display: 'none' }}
              />
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
                checked={settings.sendingMethod === 'internal'}
                onChange={() => set({ sendingMethod: 'internal' })}
                label="Use the internal mail server"
              />
              <Radio
                checked={settings.sendingMethod === 'spfdkim'}
                onChange={() => set({ sendingMethod: 'spfdkim' })}
                label="Configure SPF and DKIM for the internal mail server"
              />
              <Radio
                checked={settings.sendingMethod === 'smtp'}
                onChange={() => set({ sendingMethod: 'smtp' })}
                label="Use an external mail server with SMTP relay"
              />
            </div>

            {settings.sendingMethod === 'spfdkim' && (
              <div style={{ ...S.infoBanner, marginTop: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Before modifying, confirm with your DNS provider that an SPF record (containing <code>mx:antidot.net</code>) and a DKIM public key exist in the DNS configuration.
                </span>
              </div>
            )}
          </Section>

          {settings.sendingMethod === 'spfdkim' && (
            <>
              <Section title="From address">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Email"
                    value={settings.dkimFromAddress}
                    onChange={(v) => set({ dkimFromAddress: v })}
                    placeholder="no-reply@yourdomain.com"
                  />
                </div>
              </Section>

              <Section title="DKIM - DomainKeys Identified Mail">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '720px' }}>
                  <OutlinedTextarea
                    label="DKIM private key"
                    value={settings.dkimPrivateKey}
                    onChange={(v) => set({ dkimPrivateKey: v })}
                    rows={8}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  />
                  <OutlinedInput
                    label="DKIM selector"
                    value={settings.dkimSelector}
                    onChange={(v) => set({ dkimSelector: v })}
                    placeholder="fluid-topics"
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
                    onClick={checkDns}
                    disabled={dnsBusy || !settings.dkimFromAddress || !settings.dkimSelector}
                    style={{
                      ...S.checkDnsBtn,
                      opacity: dnsBusy || !settings.dkimFromAddress || !settings.dkimSelector ? 0.55 : 1,
                      cursor: dnsBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {dnsBusy ? 'Checking…' : 'Check DNS configuration'}
                  </button>
                  {settings.dkimDnsCheckedAt && (
                    <div style={{ fontSize: '0.82rem', color: settings.dkimDnsValid ? '#065f46' : '#991b1b' }}>
                      {settings.dkimDnsValid
                        ? `Last DNS check passed at ${new Date(settings.dkimDnsCheckedAt).toLocaleString()}.`
                        : `Last DNS check failed at ${new Date(settings.dkimDnsCheckedAt).toLocaleString()}.`}
                    </div>
                  )}
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
                      disabled={!testEmail.trim() || !settings.dkimDnsValid || testBusy}
                      onClick={sendTest}
                      style={{
                        ...S.testBtn,
                        opacity: testEmail.trim() && settings.dkimDnsValid && !testBusy ? 1 : 0.55,
                        cursor: testEmail.trim() && settings.dkimDnsValid && !testBusy ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {testBusy ? 'Sending…' : 'Send a test email'}
                    </button>
                  </div>
                </div>
              </Section>
            </>
          )}

          {settings.sendingMethod === 'smtp' && (
            <>
              <Section title="From address">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Email"
                    value={settings.smtpFromAddress}
                    onChange={(v) => set({ smtpFromAddress: v })}
                  />
                </div>
              </Section>

              <Section title="SMTP server configuration">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Host"
                    value={settings.smtpHost}
                    onChange={(v) => set({ smtpHost: v })}
                  />
                  <OutlinedInput
                    label="Port"
                    type="number"
                    value={String(settings.smtpPort ?? '')}
                    onChange={(v) => set({ smtpPort: Number(v) })}
                  />
                  <OutlinedSelect
                    label="Transport strategy"
                    value={settings.smtpTransport}
                    onChange={(v) => set({ smtpTransport: v })}
                    options={[
                      { value: 'SMTP', label: 'SMTP' },
                      { value: 'SMTPS', label: 'SMTPS' },
                      { value: 'SMTP_TLS', label: 'SMTP TLS' },
                    ]}
                  />
                </div>
              </Section>

              <Section title="SMTP authentication">
                <div style={S.fieldGrid}>
                  <OutlinedInput
                    label="Username"
                    value={settings.smtpUser}
                    onChange={(v) => set({ smtpUser: v })}
                  />
                  <OutlinedInput
                    label="Password"
                    type={showSmtpPass ? 'text' : 'password'}
                    value={settings.smtpPassword}
                    onChange={(v) => set({ smtpPassword: v })}
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
                    disabled={!testEmail.trim() || testBusy}
                    onClick={sendTest}
                    style={{
                      ...S.testBtn,
                      opacity: testEmail.trim() && !testBusy ? 1 : 0.55,
                      cursor: testEmail.trim() && !testBusy ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {testBusy ? 'Sending…' : 'Send a test email'}
                  </button>
                </div>
                {settings.lastTestSentAt && (
                  <div style={{ marginTop: '10px', fontSize: '0.82rem', color: settings.lastTestError ? '#991b1b' : '#065f46' }}>
                    {settings.lastTestError
                      ? `Last attempt to ${settings.lastTestSentTo || '(unknown)'} failed: ${settings.lastTestError}`
                      : `Last test sent to ${settings.lastTestSentTo || '(unknown)'} at ${new Date(settings.lastTestSentAt).toLocaleString()}.`}
                  </div>
                )}
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
