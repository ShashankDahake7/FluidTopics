'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

const INITIAL = {
  trustedOrigins: '',
  certificates: [],
};

export default function SecurityPage() {
  const [state, setState] = useState(INITIAL);
  const [baseline, setBaseline] = useState(INITIAL);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/security-config')
      .then((data) => {
        const merged = { ...INITIAL, ...data };
        setState(merged);
        setBaseline(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dirty   = useMemo(() => JSON.stringify(state) !== JSON.stringify(baseline), [state, baseline]);
  const update  = (patch) => setState((s) => ({ ...s, ...patch }));
  const onCancel = () => setState(baseline);
  const onSave   = async () => {
    try {
      const data = await api.put('/security-config', state);
      setState(data);
      setBaseline(data);
      alert('Settings saved successfully');
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  };

  const addCertificate = (cert) => update({ certificates: [...state.certificates, cert] });
  const removeCertificate = (id) =>
    update({ certificates: state.certificates.filter((c) => c.id !== id) });

  if (loading) return null;

  return (
    <AdminShell
      active="integ-security"
      allowedRoles={['superadmin']}
      footer={
        <>
          <button
            type="button"
            style={{ ...S.btnCancel, opacity: dirty ? 1 : 0.6, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onCancel}
            disabled={!dirty}
          >
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onSave}
            disabled={!dirty}
          >
            <CheckIcon /> <span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ paddingBottom: '40px' }}>
        <h1 style={S.h1}>Security</h1>
        <p style={S.subtitle}>Configure web integration security settings.</p>

        <Section
          title="Trusted Origins"
          desc="Defines the list of web origins allowed to call Fluid Topics web services."
        >
          <FloatingInput
            label="Trusted origins"
            value={state.trustedOrigins}
            onChange={(v) => update({ trustedOrigins: v })}
          />
          <Notice variant="info">Use &ldquo;,&rdquo; to separate multiple values.</Notice>
        </Section>

        <Section
          title="Client Certificates"
          desc="Registers certificates that could be used to secure outgoing requests."
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" style={S.btnPrimary} onClick={() => setImportOpen(true)}>
              <UploadIcon />
              <span>Import a certificate</span>
            </button>
            <button type="button" style={S.btnPrimary} onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              <span>Create a new certificate</span>
            </button>
          </div>

          {state.certificates.length > 0 && (
            <div style={S.certList}>
              <div style={S.certHead}>
                <div style={{ flex: 2 }}>Name</div>
                <div style={{ flex: 1.4 }}>Type</div>
                <div style={{ flex: 1.2 }}>Expires</div>
                <div style={{ width: '40px' }} />
              </div>
              {state.certificates.map((c) => (
                <div key={c.id} style={S.certRow}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    {c.subject && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{c.subject}</div>}
                  </div>
                  <div style={{ flex: 1.4, color: '#475569' }}>{c.type}</div>
                  <div style={{ flex: 1.2, color: '#475569' }}>{c.expires || '—'}</div>
                  <button
                    type="button"
                    onClick={() => removeCertificate(c.id)}
                    title="Delete"
                    style={S.iconBtn}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {importOpen && (
        <ImportCertModal
          onCancel={() => setImportOpen(false)}
          onConfirm={(cert) => { addCertificate(cert); setImportOpen(false); }}
        />
      )}
      {createOpen && (
        <CreateCertModal
          onCancel={() => setCreateOpen(false)}
          onConfirm={(cert) => { addCertificate(cert); setCreateOpen(false); }}
        />
      )}
    </AdminShell>
  );
}

// ── Sections, common bits ─────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h2 style={S.h2}>{title}</h2>
      {desc && <p style={S.sectionDesc}>{desc}</p>}
      <div style={{ marginTop: '8px', maxWidth: '760px' }}>{children}</div>
    </section>
  );
}

function Notice({ variant = 'info', children }) {
  const palette = variant === 'warning'
    ? { bg: '#fef3c7', border: '#fde68a', icon: '#b45309', text: '#78350f' }
    : { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e3a8a' };
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: '4px', padding: '10px 14px', marginTop: '8px',
      color: palette.text, fontSize: '0.86rem', lineHeight: 1.45,
    }}>
      <span style={{ color: palette.icon, marginTop: '2px', display: 'inline-flex' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8"  x2="12.01" y2="8" />
        </svg>
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Material-style floating-label input ───────────────────────────────────
function FloatingInput({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div
      style={{ position: 'relative', background: '#fff', borderRadius: '4px' }}
      onClick={() => ref.current?.focus()}
    >
      <fieldset
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
          borderRadius: '4px', margin: 0, padding: '0 8px',
          pointerEvents: 'none', textAlign: 'left', minWidth: 0,
        }}
      >
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: '11px', visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        style={{
          position: 'relative', width: '100%',
          padding: '12px',
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '0.9rem', color: '#0f172a',
          fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
        }}
      />
      {!isFloated && (
        <label style={{
          position: 'absolute', left: '12px', top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.9rem', color: '#94a3b8',
          pointerEvents: 'none', background: 'transparent',
        }}>{label}</label>
      )}
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer, width = '520px' }) {
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modal, width }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{title}</span>
          <button type="button" onClick={onClose} style={S.iconBtn} title="Close">
            <CrossIcon />
          </button>
        </div>
        <div style={S.modalBody}>{children}</div>
        {footer && <div style={S.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}

function ImportCertModal({ onCancel, onConfirm }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [pwd, setPwd]   = useState('');
  const fileRef = useRef(null);
  const valid = !!name.trim() && !!file;

  return (
    <Modal
      title="Import a certificate"
      onClose={onCancel}
      footer={
        <>
          <button type="button" style={S.btnCancel} onClick={onCancel}>
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'default' }}
            disabled={!valid}
            onClick={() => onConfirm({
              id: `cert_${Date.now()}`,
              name: name.trim(),
              type: 'Imported',
              subject: file?.name,
              expires: '',
            })}
          >
            <CheckIcon /> <span>Import</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        <FloatingInput label="Name" value={name} onChange={setName} />

        <div>
          <button
            type="button"
            style={S.btnSecondary}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon />
            <span>{file ? 'Change file' : 'Choose certificate file'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".p12,.pfx,.pem,.crt,.cer"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file && (
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px' }}>
              {file.name} <span style={{ color: '#94a3b8' }}>({Math.round(file.size / 1024)} KB)</span>
            </div>
          )}
        </div>

        <FloatingInput label="Password (optional)" value={pwd} onChange={setPwd} />
        <Notice variant="info">
          Supported formats: PKCS#12 (.p12 / .pfx), PEM (.pem / .crt / .cer).
        </Notice>
      </div>
    </Modal>
  );
}

function CreateCertModal({ onCancel, onConfirm }) {
  const [name, setName]   = useState('');
  const [cn, setCn]       = useState('');
  const [org, setOrg]     = useState('');
  const [years, setYears] = useState('1');
  const valid = !!name.trim() && !!cn.trim();

  return (
    <Modal
      title="Create a new certificate"
      onClose={onCancel}
      footer={
        <>
          <button type="button" style={S.btnCancel} onClick={onCancel}>
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'default' }}
            disabled={!valid}
            onClick={() => {
              const exp = new Date();
              exp.setFullYear(exp.getFullYear() + (parseInt(years, 10) || 1));
              onConfirm({
                id: `cert_${Date.now()}`,
                name: name.trim(),
                type: 'Self-signed',
                subject: `CN=${cn}${org ? `, O=${org}` : ''}`,
                expires: exp.toISOString().slice(0, 10),
              });
            }}
          >
            <CheckIcon /> <span>Create</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        <FloatingInput label="Name" value={name} onChange={setName} />
        <FloatingInput label="Common name (CN)" value={cn} onChange={setCn} />
        <FloatingInput label="Organization (O)" value={org} onChange={setOrg} />
        <FloatingInput label="Validity (years)" value={years} onChange={setYears} />
      </div>
    </Modal>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.9rem', color: '#475569', margin: 0 },

  btnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px',
    background: '#fff', color: '#374151',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.88rem', fontFamily: 'var(--font-sans)', fontWeight: 500,
    cursor: 'pointer',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.88rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },
  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px',
    background: 'transparent', color: '#475569',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  },

  certList: {
    marginTop: '14px',
    border: '1px solid #e2e8f0', borderRadius: '6px',
    background: '#fff',
  },
  certHead: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '0.78rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
    color: '#64748b', background: '#f8fafc',
  },
  certRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '0.9rem', color: '#0f172a',
  },

  modalBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    background: '#fff', borderRadius: '8px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    maxWidth: '95vw', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
  },
  modalHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
  },
  modalBody: { padding: '18px', overflowY: 'auto' },
  modalFoot: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 18px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
};
