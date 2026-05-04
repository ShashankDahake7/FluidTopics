'use client';
import { useEffect, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Icons ------------------------------ */

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="14" y2="6" />
    <circle cx="17" cy="6" r="2" />
    <line x1="20" y1="6" x2="22" y2="6" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <circle cx="11" cy="12" r="2" />
    <line x1="14" y1="12" x2="22" y2="12" />
    <line x1="4" y1="18" x2="16" y2="18" />
    <circle cx="19" cy="18" r="2" />
  </svg>
);
const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
const IconCaret = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

/* ------------------------------ Constants ------------------------------ */

const RATING_TYPES = [
  { value: 'STARS', label: 'Stars' },
  { value: 'THUMBS', label: 'Thumbs' },
];

/* ------------------------------ Page ------------------------------ */

export default function DocumentRatingsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [ratingType, setRatingType] = useState('STARS');
  const [titleQuery, setTitleQuery] = useState('');

  const handleApply = () => {
    /* No-op for empty state; filters would be applied here once API is wired. */
  };

  const breadcrumb = { prefix: 'Knowledge Hub', title: 'Document ratings' };

  const toolbarExtras = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span style={TS.dateBadge} title="Date range">
        <span style={TS.dateBadgeText}>
          <span>From: 3/1/2026</span>
          <span>To: 3/31/2026</span>
        </span>
        <span style={TS.dateBadgeIcon}><IconCalendar /></span>
      </span>
      <button
        type="button"
        style={{ ...TS.iconBtn, color: drawerOpen ? '#1d4ed8' : '#0f172a' }}
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
        title={drawerOpen ? 'Hide filters' : 'Show filters'}
      >
        <IconFilters />
      </button>
    </span>
  );

  return (
    <AnalyticsShell
      active="document-ratings"
      breadcrumb={breadcrumb}
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times users rate a document.
            </span>
            <button
              type="button"
              style={{ ...PS.downloadBtn, color: '#94a3b8', cursor: 'not-allowed' }}
              title="Download as XLSX"
              aria-label="Download as XLSX"
              disabled
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <p style={PS.emptyMessage}>
              No matching document ratings found during the selected period.
            </p>
          </section>
        </main>

        <aside style={{ ...DS.drawer, transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)' }}>
          <header style={DS.drawerHead}>
            <span style={DS.drawerTitle}>Refine search</span>
            <button type="button" style={DS.drawerClose} aria-label="Close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <section style={DS.drawerBody}>
            <FloatingSelect
              label="Rating type"
              value={ratingType}
              onChange={setRatingType}
              options={RATING_TYPES}
            />
            <FloatingInput label="Search by title" value={titleQuery} onChange={setTitleQuery} />

            <fieldset style={DS.fieldset}>
              <legend style={DS.legend}>Metadata</legend>
              <p style={DS.metaEmpty}>Select a metadata value in the result tags to add a filter.</p>
            </fieldset>
          </section>
          <footer style={DS.drawerFooter}>
            <button type="button" style={DS.applyBtn} onClick={handleApply}>Apply</button>
          </footer>
        </aside>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Helpers ------------------------------ */

function FloatingInput({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const filled = value && String(value).length > 0;
  const floating = focused || filled;
  return (
    <label style={{
      ...IS.wrapper,
      borderColor: focused ? '#1d4ed8' : '#cbd5e1',
      boxShadow: focused ? '0 0 0 1px rgba(29, 78, 216, 0.2)' : 'none',
    }}>
      <span style={{
        ...IS.label,
        top: floating ? '6px' : '50%',
        fontSize: floating ? '0.7rem' : '0.85rem',
        transform: floating ? 'translateY(0)' : 'translateY(-50%)',
        color: focused ? '#1d4ed8' : '#475569',
      }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={IS.input}
      />
    </label>
  );
}

function FloatingSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) || options[0];
  const filled = Boolean(current);
  const floating = open || filled;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...IS.wrapper,
          ...IS.selectButton,
          borderColor: open ? '#1d4ed8' : '#cbd5e1',
          boxShadow: open ? '0 0 0 1px rgba(29, 78, 216, 0.2)' : 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{
          ...IS.label,
          top: floating ? '6px' : '50%',
          fontSize: floating ? '0.7rem' : '0.85rem',
          transform: floating ? 'translateY(0)' : 'translateY(-50%)',
          color: open ? '#1d4ed8' : '#475569',
        }}>{label}</span>
        <span style={IS.selectValue}>{current?.label}</span>
        <span style={IS.selectArrow}><IconCaret /></span>
      </button>
      {open && (
        <ul role="listbox" style={IS.menu}>
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    ...IS.menuItem,
                    background: selected ? '#eff6ff' : 'transparent',
                    color: selected ? '#1d4ed8' : '#0f172a',
                    fontWeight: selected ? 600 : 500,
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}

/* ------------------------------ Styles ------------------------------ */

const TS = {
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
  },
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
  },
  dateBadgeText: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem', color: '#475569' },
  dateBadgeIcon: { display: 'inline-flex', color: '#475569' },
};

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  downloadBtn: {
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  body: {
    flex: 1,
    padding: '24px 22px',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyMessage: {
    margin: '40px 0 0 0',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: '#1f2937',
    textAlign: 'center',
    width: '100%',
  },
};

const IS = {
  wrapper: {
    position: 'relative',
    display: 'block',
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    textAlign: 'left',
  },
  label: {
    position: 'absolute',
    left: '12px',
    pointerEvents: 'none',
    background: '#ffffff',
    padding: '0 4px',
    transform: 'translateY(-50%)',
    transition: 'top 120ms ease, font-size 120ms ease, color 120ms ease',
  },
  input: {
    width: '100%',
    padding: '14px 12px 6px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    color: '#0f172a',
    borderRadius: '6px',
  },
  selectButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 36px 6px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '48px',
  },
  selectValue: {
    fontSize: '0.85rem',
    color: '#0f172a',
    flex: 1,
  },
  selectArrow: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#475569',
    display: 'inline-flex',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)',
    zIndex: 30,
    maxHeight: '220px',
    overflowY: 'auto',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
};

const DS = {
  drawer: {
    width: '330px',
    flexShrink: 0,
    borderLeft: '1px solid #e5e7eb',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 200ms ease',
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  drawerClose: {
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    padding: '16px 18px 12px',
    overflowY: 'visible',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fieldset: {
    border: 'none',
    padding: 0,
    margin: '6px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  legend: { fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', padding: 0 },
  metaEmpty: {
    margin: 0,
    padding: '8px 10px',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
    color: '#475569',
    fontSize: '0.78rem',
  },
  drawerFooter: {
    padding: '12px 18px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  applyBtn: {
    padding: '8px 22px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
