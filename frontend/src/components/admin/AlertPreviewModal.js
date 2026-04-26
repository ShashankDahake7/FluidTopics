'use client';
import { useEffect, useRef, useCallback } from 'react';

/**
 * Centred modal that previews the alert email exactly the way Darwinbox does
 * on /admin/notifications/alerts. Uses a single iframe (sandboxed) to render
 * the supplied `srcDoc`, with From/Subject/To/Reply-To header rows above it.
 */
export default function AlertPreviewModal({
  open,
  onClose,
  srcDoc,
  fromAddr,
  subject,
  toAddr,
  replyTo,
}) {
  const dialogRef = useRef(null);

  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKey]);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { if (open && dialogRef.current) dialogRef.current.focus(); }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={S.overlay}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Preview the email template"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={S.dialog}
      >
        <header style={S.header}>
          <h2 style={S.title}>Preview the email template</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={S.closeBtn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={S.body}>
          <HeaderRow label="From"     value={fromAddr} />
          <HeaderRow label="Subject"  value={subject} />
          <HeaderRow label="To"       value={toAddr} />
          <HeaderRow label="Reply-To" value={replyTo} />

          <div style={S.iframeShell}>
            <iframe
              title="Alert email preview"
              srcDoc={srcDoc}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              style={S.iframe}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderRow({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}:</span>
      <input
        type="text"
        readOnly
        value={value || ''}
        style={S.rowField}
      />
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  dialog: {
    width: 'min(720px, 100%)',
    maxHeight: 'calc(100vh - 48px)',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
    overflow: 'hidden',
    outline: 'none',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
    background: '#fff',
  },
  title: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  closeBtn: {
    width: '32px', height: '32px',
    background: 'transparent', border: 'none', borderRadius: '4px',
    color: '#475569', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '14px 18px 18px',
    display: 'flex', flexDirection: 'column', gap: '8px',
    background: '#fff',
  },
  row: { display: 'flex', alignItems: 'center', gap: '10px' },
  rowLabel: {
    flexShrink: 0, width: '64px',
    fontSize: '0.85rem', color: '#475569', fontWeight: 500,
  },
  rowField: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '0.85rem', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#f8fafc', outline: 'none',
    fontFamily: 'inherit',
  },
  iframeShell: {
    marginTop: '6px', flex: '1 1 auto', minHeight: '420px',
    border: '1px solid #e2e8f0', borderRadius: '4px',
    background: '#fff', overflow: 'hidden',
    display: 'flex',
  },
  iframe: {
    flex: 1, border: 'none', width: '100%',
    minHeight: '420px',
  },
};
