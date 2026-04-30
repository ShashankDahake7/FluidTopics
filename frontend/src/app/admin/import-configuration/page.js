'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

export default function ImportConfigurationPage() {
  const [portals, setPortals] = useState([]);
  const [imports, setImports] = useState([]);
  const [addOpen, setAddOpen]   = useState(false);
  const [confirmRm, setConfirmRm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/import-config/portals').catch(() => []),
      api.get('/import-config/imports').catch(() => []),
    ]).then(([p, im]) => {
      setPortals(Array.isArray(p) ? p : []);
      setImports(Array.isArray(im) ? im : []);
    }).finally(() => setLoading(false));
  }, []);

  const onAddPortal = async ({ baseUrl, apiKey }) => {
    try {
      const portal = await api.post('/import-config/portals', { baseUrl: baseUrl.trim(), apiKey });
      setPortals((p) => [...p, portal]);
      setAddOpen(false);
    } catch (e) {
      alert('Failed to add portal: ' + e.message);
    }
  };

  const onRemovePortal = async (id) => {
    try {
      await api.delete(`/import-config/portals/${id}`);
      setPortals((p) => p.filter((x) => x._id !== id));
      setImports((im) => im.filter((x) => x.portalId !== id));
      setConfirmRm(null);
    } catch (e) {
      alert('Failed to remove portal: ' + e.message);
    }
  };

  const onCopyConfig = async (portal) => {
    try {
      const record = await api.post('/import-config/imports', { portalId: portal._id });
      setImports((im) => [record, ...im]);
      // Poll for status update
      const poll = setInterval(async () => {
        try {
          const updated = await api.get('/import-config/imports');
          setImports(Array.isArray(updated) ? updated : []);
          const rec = updated.find(r => r._id === record._id);
          if (rec && rec.status !== 'retrieving') clearInterval(poll);
        } catch { clearInterval(poll); }
      }, 2000);
    } catch (e) {
      alert('Failed to start import: ' + e.message);
    }
  };

  if (loading) return null;

  return (
    <AdminShell active="tenant-import" allowedRoles={['superadmin']} fullWidth>
      <div style={{ paddingBottom: '40px' }}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={S.h1}>Import configuration</h1>
            <a
              href="https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/My-tenant/Import-configuration"
              target="_blank"
              rel="noreferrer"
              title="More information"
              style={S.infoIcon}
            >
              <InfoIcon />
            </a>
          </div>
          <button type="button" style={S.btnPrimary} onClick={() => setAddOpen(true)}>
            <PlusIcon />
            <span>New origin portal</span>
          </button>
        </div>

        {/* Origin portals */}
        <h2 style={S.h2}>Origin portals</h2>
        {portals.length === 0 ? (
          <div style={S.divider} />
        ) : (
          <div style={S.cardsGrid}>
            {portals.map((p) => (
              <div key={p._id} style={S.portalCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.portalUrl} title={p.baseUrl}>{p.baseUrl}</div>
                    <div style={S.portalAdded}>Added on {new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button type="button" style={S.iconBtnDanger} onClick={() => setConfirmRm(p._id)} title="Remove portal">
                    <TrashIcon />
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button type="button" style={S.btnSecondary} onClick={() => onCopyConfig(p)}>
                    <DownloadIcon />
                    <span>Copy configuration</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Imports */}
        <h2 style={{ ...S.h2, marginTop: '28px' }}>Imports</h2>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Author</th>
                <th style={S.th}>Origin portal URL</th>
                <th style={S.th}>Status</th>
                <th style={S.thAction} />
              </tr>
            </thead>
            <tbody>
              {imports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={S.emptyCell}>
                    <CactusSVG />
                    <div style={S.emptyTitle}>No import to display.</div>
                    <div style={S.emptyHint}>Add a new origin portal to get started.</div>
                  </td>
                </tr>
              ) : (
                imports.map((im) => (
                  <tr key={im._id} style={S.tr}>
                    <td style={S.td}>{new Date(im.createdAt).toLocaleString()}</td>
                    <td style={S.td}>{im.author}</td>
                    <td style={S.td}>{im.url}</td>
                    <td style={S.td}>
                      <StatusPill status={im.status} />
                    </td>
                    <td style={S.tdAction} />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddPortalModal
          existingUrls={portals.map((p) => p.baseUrl)}
          onCancel={() => setAddOpen(false)}
          onSave={onAddPortal}
        />
      )}
      {confirmRm && (
        <ConfirmModal
          heading="Remove this origin portal?"
          body="The portal will be removed and its imports will no longer be available."
          confirmLabel="Remove"
          onCancel={() => setConfirmRm(null)}
          onConfirm={() => onRemovePortal(confirmRm)}
        />
      )}
    </AdminShell>
  );
}

// ── Add portal modal ──────────────────────────────────────────────────────
function AddPortalModal({ existingUrls, onCancel, onSave }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const baseRef = useRef(null);

  const trimmed = baseUrl.trim();
  const urlValid = /^https?:\/\/[^\s]+/.test(trimmed);
  const urlDup = existingUrls.some((u) => u.toLowerCase() === trimmed.toLowerCase());
  const valid = urlValid && !urlDup && !!apiKey;

  return (
    <Modal
      heading="Add origin portal"
      onClose={onCancel}
      footer={
        <>
          <button type="button" style={S.btnGhost} onClick={onCancel}>
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnPrimaryLg, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'default' }}
            disabled={!valid}
            onClick={() => onSave({ baseUrl: trimmed, apiKey })}
          >
            <CheckIcon /> <span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        <FloatingInput
          ref={baseRef}
          label="Portal URL"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://example.fluidtopics.net"
          error={trimmed && !urlValid
            ? 'Enter a valid URL starting with http(s)://'
            : urlDup
              ? 'A portal with this URL already exists.'
              : ''}
        />
        <FloatingInput
          label="API key"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={setApiKey}
          appendIcon={(
            <button
              type="button"
              style={S.iconBtn}
              onClick={() => setShowKey((s) => !s)}
              title={showKey ? 'Hide password' : 'Show password'}
              aria-label={showKey ? 'Hide password' : 'Show password'}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
        />
      </div>
    </Modal>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────
function ConfirmModal({ heading, body, confirmLabel = 'Confirm', onCancel, onConfirm }) {
  return (
    <Modal
      heading={heading}
      onClose={onCancel}
      width="420px"
      footer={
        <>
          <button type="button" style={S.btnGhost} onClick={onCancel} autoFocus>
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button type="button" style={S.btnDanger} onClick={onConfirm}>
            <TrashIcon /> <span>{confirmLabel}</span>
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem' }}>{body}</p>
    </Modal>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────
function Modal({ heading, onClose, children, footer, width = '480px' }) {
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modal, width }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{heading}</span>
          <button type="button" onClick={onClose} style={S.iconBtn} aria-label="Close" title="Close">
            <CrossIcon />
          </button>
        </div>
        <div style={S.modalBody}>{children}</div>
        {footer && <div style={S.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Floating-label input (with optional appendIcon) ───────────────────────
function FloatingInput({
  label, value, onChange, placeholder, error,
  type = 'text', appendIcon = null,
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const isFloated = focused || !!value;
  const errored = !!error;
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{ position: 'relative', background: '#fff', borderRadius: '4px' }}
        onClick={() => ref.current?.focus()}
      >
        <fieldset
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            border: errored ? '1.5px solid #dc2626'
                  : focused ? '2px solid #a21caf'
                  : '1px solid #cbd5e1',
            borderRadius: '4px', margin: 0, padding: '0 8px',
            pointerEvents: 'none', textAlign: 'left', minWidth: 0,
          }}
        >
          <legend style={{
            width: isFloated ? 'auto' : 0, maxWidth: '100%',
            padding: isFloated ? '0 4px' : 0,
            fontSize: '0.74rem',
            color: errored ? '#dc2626' : focused ? '#a21caf' : '#475569',
            float: 'unset', height: '11px', visibility: 'visible',
            fontWeight: 500, opacity: isFloated ? 1 : 0,
          }}>{label}</legend>
        </fieldset>
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isFloated ? '' : placeholder || ''}
          autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
          style={{
            position: 'relative', width: '100%',
            padding: appendIcon ? '12px 40px 12px 12px' : '12px',
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.9rem', color: errored ? '#dc2626' : '#0f172a',
            fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
          }}
        />
        {!isFloated && (
          <label style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.9rem',
            color: errored ? '#dc2626' : '#94a3b8',
            pointerEvents: 'none',
          }}>{label}</label>
        )}
        {appendIcon && (
          <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}>
            {appendIcon}
          </span>
        )}
      </div>
      {error && <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    done:      { bg: '#dcfce7', color: '#15803d', label: 'Done' },
    failed:    { bg: '#fee2e2', color: '#b91c1c', label: 'Failed' },
  };
  const v = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.78rem',
      fontWeight: 500,
      background: v.bg, color: v.color,
    }}>
      {v.label}
    </span>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.4 18.4 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8"  x2="12.01" y2="8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CactusSVG() {
  // Approximation of the GWT empty-state cactus.
  return (
    <svg width="96" height="96" viewBox="0 0 120 121" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="60" fill="#F2F2F5" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M74.88 56.38c1.27-.21 2.58.15 3.57.98 1 .83 1.56 2.05 1.56 3.4v2.5c0 5.18-4.2 9.38-9.38 9.38l-3.12 0v4.93H83.75c.69 0 1.25.56 1.25 1.25 0 .69-.56 1.25-1.25 1.25H36.25c-.69 0-1.25-.56-1.25-1.25 0-.69.56-1.25 1.25-1.25h16.25V63.81l-3.12-.07C44.2 63.74 40 59.61 40 54.44v-2.5c0-1.29.57-2.51 1.55-3.34.99-.83 2.3-1.19 3.57-.98 2.15.36 3.63 2.39 3.63 4.56v2.26c0 .34.28.62.63.62h3.12V47.56c0-2.06.85-4.02 2.27-5.44 1.56-1.42 3.58-2.16 5.63-2.05 4.06.21 7.1 3.92 7.1 7.91v15.83h3.12c.34 0 .63-.29.63-.63V60.93c0-2.17 1.49-4.2 3.63-4.55ZM49.38 61.31h3.12v-3.75l-3.12.07c-1.73 0-3.13-1.4-3.13-3.13V52c0-1.04-.84-1.88-1.87-1.88-1.04 0-1.88.84-1.88 1.88v2.5c0 3.73 3.08 6.81 6.88 6.81Zm5.62 16.26h10V47.56c0-2.7-2.24-4.93-5-4.93-2.76 0-5 2.16-5 4.93v30Zm15.62-7.5c3.8 0 6.88-3.08 6.88-6.88V60.69c0-1.03-.84-1.73-1.88-1.73-1.04 0-1.88.77-1.88 1.8v2.5c0 1.73-1.4 3.13-3.12 3.13h-3.12v3.68h3.12Z"
        fill="#BBBBC9"
      />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '20px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  h2: { fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', margin: '20px 0 8px' },

  infoIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '24px', height: '24px',
    background: 'transparent', color: '#0369a1',
    border: '1px solid transparent', borderRadius: '999px',
    cursor: 'pointer',
  },

  divider: { borderBottom: '1px solid #e2e8f0', marginTop: '8px' },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
    marginTop: '8px',
  },
  portalCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '14px 14px 12px',
  },
  portalUrl: {
    fontSize: '0.92rem', fontWeight: 600, color: '#0f172a',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  portalAdded: { fontSize: '0.78rem', color: '#64748b', marginTop: '2px' },

  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', color: '#0f172a' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  thAction: {
    width: '60px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  tdAction: { padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' },

  emptyCell: {
    padding: '40px 12px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  emptyTitle: {
    marginTop: '12px',
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#475569',
  },
  emptyHint: { fontSize: '0.86rem', color: '#94a3b8' },

  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.88rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)', cursor: 'pointer',
    flexShrink: 0,
  },
  btnPrimaryLg: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 18px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.92rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 18px',
    background: 'transparent', color: '#475569',
    border: 'none', borderRadius: '4px',
    fontSize: '0.92rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 18px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.92rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '6px 12px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.82rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },
  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px',
    background: 'transparent', color: '#475569',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  },
  iconBtnDanger: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px',
    background: 'transparent', color: '#dc2626',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
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
    padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
  },
  modalBody: { padding: '20px', overflowY: 'auto' },
  modalFoot: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 18px',
    borderTop: '1px solid #e2e8f0',
    background: '#fff',
  },
};
