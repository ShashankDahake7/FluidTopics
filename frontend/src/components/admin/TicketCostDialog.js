'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Mirrors the Angular `<app-ticket-cost-dialog>` declared at app-root:
 *   heading           = "Edit the value of an actual ticket"
 *   floating label    = "Individual ticket cost"
 *   helper            = "Value must be between 1 and 10,000"
 *   buttons           = Cancel (outlined, X icon) / Save (primary, save icon)
 *   close behaviour   = closable (X corner) + closeOnEsc + closeOnClickOutside
 *
 * Two ways to consume:
 *   1. Drop-in modal:     <TicketCostDialog open onSave={…} onClose={…} />
 *   2. Global provider:   <TicketCostProvider> + useTicketCost()
 *      The provider mounts the dialog once (mirroring `app-root`)
 *      and exposes `{ ticketCost, openTicketCostDialog, setTicketCost }`
 *      so any descendant analytics page can call openTicketCostDialog().
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'ft_ticket_cost';
const DEFAULT_VALUE = 5;
const MIN = 1;
const MAX = 10000;

/* ------------------------------ Icons ------------------------------ */

const IconClose = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconSave = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/* ------------------------------ Helpers ------------------------------ */

const parseValue = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return NaN;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const isValid = (raw) => {
  const n = parseValue(raw);
  return Number.isFinite(n) && n >= MIN && n <= MAX;
};

/* ------------------------------ Modal ------------------------------ */

export default function TicketCostDialog({
  open,
  initialValue = DEFAULT_VALUE,
  onClose,
  onSave,
}) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState(String(initialValue ?? ''));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue == null ? '' : String(initialValue));
      setTouched(false);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [open]);

  const valid = useMemo(() => isValid(value), [value]);
  const showError = touched && !valid;

  const handleSave = () => {
    setTouched(true);
    if (!valid) return;
    onSave?.(parseValue(value));
  };

  if (!open) return null;

  return (
    <div role="presentation" onClick={onClose} style={S.overlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit the value of an actual ticket"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={S.dialog}
      >
        <header style={S.header}>
          <h2 style={S.heading}>Edit the value of an actual ticket</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={S.closeBtn}
          >
            <IconClose size={18} />
          </button>
        </header>

        <div style={S.body}>
          <div
            style={{
              ...S.field,
              borderColor: showError ? '#dc2626' : (value !== '' ? '#1d4ed8' : '#cbd5e1'),
            }}
          >
            <label
              htmlFor="ft-ticket-cost-input"
              style={{
                ...S.floatingLabel,
                color: showError ? '#dc2626' : (value !== '' ? '#1d4ed8' : '#475569'),
              }}
            >
              Individual ticket cost
            </label>
            <input
              ref={inputRef}
              id="ft-ticket-cost-input"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              aria-describedby="ft-ticket-cost-helper"
              aria-invalid={showError ? 'true' : 'false'}
              style={S.input}
            />
          </div>
          <div
            id="ft-ticket-cost-helper"
            role={showError ? 'alert' : undefined}
            style={{
              ...S.helper,
              color: showError ? '#dc2626' : '#475569',
            }}
          >
            Value must be between 1 and 10,000
          </div>
        </div>

        <footer style={S.footer}>
          <button type="button" onClick={onClose} style={S.cancelBtn}>
            <IconClose size={14} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid}
            style={{
              ...S.saveBtn,
              opacity: valid ? 1 : 0.55,
              cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            <IconSave size={14} />
            <span>Save</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------ Provider / Hook ------------------------------ */

const TicketCostContext = createContext(null);

export function TicketCostProvider({ children }) {
  const [ticketCost, setTicketCostState] = useState(DEFAULT_VALUE);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const n = parseValue(stored);
    if (isValid(n)) setTicketCostState(n);
  }, []);

  const setTicketCost = useCallback((next) => {
    if (!isValid(next)) return;
    setTicketCostState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  }, []);

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  const ctx = useMemo(() => ({
    ticketCost,
    setTicketCost,
    openTicketCostDialog: openDialog,
  }), [ticketCost, setTicketCost, openDialog]);

  return (
    <TicketCostContext.Provider value={ctx}>
      {children}
      <TicketCostDialog
        open={open}
        initialValue={ticketCost}
        onClose={closeDialog}
        onSave={(v) => { setTicketCost(v); closeDialog(); }}
      />
    </TicketCostContext.Provider>
  );
}

export function useTicketCost() {
  const ctx = useContext(TicketCostContext);
  if (!ctx) {
    return {
      ticketCost: DEFAULT_VALUE,
      setTicketCost: () => {},
      openTicketCostDialog: () => {},
    };
  }
  return ctx;
}

/* ------------------------------ Styles ------------------------------ */

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
    padding: '24px',
  },
  dialog: {
    width: 'min(440px, 100%)',
    background: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans), Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px 8px',
  },
  heading: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#0f172a',
    letterSpacing: '-0.005em',
  },
  closeBtn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  body: {
    padding: '12px 20px 6px',
  },
  field: {
    position: 'relative',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '18px 12px 6px',
    background: '#ffffff',
    transition: 'border-color 120ms ease',
  },
  floatingLabel: {
    position: 'absolute',
    top: '4px',
    left: '12px',
    fontSize: '0.72rem',
    fontWeight: 500,
    pointerEvents: 'none',
    background: '#ffffff',
    padding: '0 2px',
  },
  input: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: '0.95rem',
    color: '#0f172a',
    background: 'transparent',
    fontFamily: 'inherit',
  },
  helper: {
    marginTop: '6px',
    fontSize: '0.75rem',
    paddingLeft: '4px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px 18px',
  },
  cancelBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#1f2937',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    border: 'none',
    borderRadius: '6px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
};
