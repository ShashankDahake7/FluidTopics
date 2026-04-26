'use client';

import { useEffect, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Static data ------------------------------ */

const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'zh-CN', label: 'Chinese (Simplified, China)' },
];

/* ------------------------------ Icons ------------------------------ */

const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2.2" fill="#fff" />
    <circle cx="15" cy="12" r="2.2" fill="#fff" />
    <circle cx="8" cy="18" r="2.2" fill="#fff" />
  </svg>
);

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function FacetsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [locale, setLocale] = useState('en-US');

  return (
    <AnalyticsShell
      active="facets"
      breadcrumb={{ prefix: 'Search', title: 'Facets' }}
      feedbackSubject="Feedback about facets"
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <div style={PS.dateIndicator} title="Date range" aria-label="Date range">
            <span style={PS.dateLabels}>
              <span style={PS.dateLine}>From: 3/1/2026</span>
              <span style={PS.dateLine}>To: 3/31/2026</span>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true"><IconCalendar /></span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            title={drawerOpen ? 'Hide filters' : 'Show filters'}
            aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
            aria-pressed={drawerOpen}
            style={{
              ...PS.toolbarIconBtn,
              background: drawerOpen ? '#eff6ff' : 'transparent',
              color: drawerOpen ? '#1d4ed8' : '#475569',
            }}
          >
            <IconFilters />
          </button>
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of search events sent to the server by the portal.
            </span>
            <button
              type="button"
              style={PS.downloadBtn}
              disabled
              aria-disabled="true"
              title="Download as XLSX"
              aria-label="Download as XLSX"
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <p style={PS.emptyMessage}>
              No matching search facets found during the selected period.
            </p>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Refine search">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Refine search</h3>
              <button
                type="button"
                style={PS.drawerCloseBtn}
                onClick={() => setDrawerOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </header>

            <div style={PS.drawerBody}>
              <FieldSelect
                label="Content Locale"
                value={locale}
                options={LOCALE_OPTIONS}
                onChange={setLocale}
              />
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Field select ------------------------------ */

function FieldSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div style={FS.wrap} ref={ref}>
      <span style={FS.label}>{label}</span>
      <button
        type="button"
        style={FS.control}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={FS.value}>{current.label}</span>
        <span style={FS.chevron} aria-hidden="true"><IconChevronDown /></span>
      </button>
      {open && (
        <ul role="listbox" style={FS.list}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    ...FS.option,
                    background: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#0f172a',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

const PS = {
  layout: {
    position: 'relative',
    display: 'flex',
    minHeight: 'calc(100vh - 60px - 56px)',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    transition: 'margin-right 200ms ease',
  },

  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  toolbarIconBtn: {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  dateIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#475569',
  },
  dateLabels: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 },
  dateLine: { fontSize: '0.7rem', color: '#475569' },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  resultHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '18px 22px 14px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
  downloadBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'not-allowed',
    opacity: 0.55,
  },

  body: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '320px',
    padding: '24px 22px',
  },
  emptyMessage: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#475569',
    textAlign: 'center',
  },

  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '330px',
    background: '#ffffff',
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-2px 0 8px rgba(15, 23, 42, 0.04)',
    zIndex: 5,
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  drawerCloseBtn: {
    width: '30px',
    height: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
};

const FS = {
  wrap: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.72rem', color: '#475569', fontWeight: 500, paddingLeft: '4px' },
  control: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
  },
  value: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chevron: { display: 'inline-flex', color: '#475569' },
  list: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    listStyle: 'none',
    margin: 0,
    padding: '4px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    maxHeight: '260px',
    overflowY: 'auto',
    zIndex: 10,
  },
  option: {
    display: 'block',
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
  },
};
