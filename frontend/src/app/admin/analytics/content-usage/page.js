'use client';
import { useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

const KEY_OPTIONS = [
  { value: 'document',    label: 'Document' },
  { value: 'topic',       label: 'Topic' },
  { value: 'product',     label: 'Product' },
  { value: 'category',    label: 'Category' },
  { value: 'audience',    label: 'Audience' },
  { value: 'language',    label: 'Language' },
  { value: 'release',     label: 'Release' },
  { value: 'author',      label: 'Author' },
  { value: 'tag',         label: 'Tag' },
  { value: 'source',      label: 'Source' },
];

/* ----- Tiny inline icons used by the page (shell-independent) ----- */

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
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
    <line x1="22" y1="18" x2="22" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const IconArrowSnake = () => (
  <svg width="120" height="120" viewBox="0 0 220 220" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path
      d="M195 30 c -25 0 -45 22 -45 50 c 0 30 22 50 50 50 c -30 0 -55 22 -55 55 c 0 22 18 35 35 35 c 0 0 -50 0 -120 0"
      fill="none"
    />
    <polyline points="80 215 60 220 80 235" />
  </svg>
);

/* -------------------------- Right drawer ------------------------- */

let nextLevelId = 1;

function RefineDrawer({ open, onClose, levels, setLevels }) {
  const addLevel = () => {
    setLevels((arr) => [...arr, { id: nextLevelId++, key: '', limit: 100 }]);
  };
  const updateLevel = (id, patch) => {
    setLevels((arr) => arr.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const removeLevel = (id) => {
    setLevels((arr) => arr.filter((l) => l.id !== id));
  };

  return (
    <aside style={{ ...DS.drawer, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
      <header style={DS.drawerHead}>
        <span style={DS.drawerTitle}>Refine analysis</span>
        <button type="button" style={DS.drawerClose} aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </header>

      <section style={DS.drawerBody}>
        <ul style={DS.levelsList}>
          {levels.map((lvl, i) => (
            <li key={lvl.id} style={DS.levelCard}>
              <div style={DS.levelHead}>
                <span style={DS.levelLabel}>Level {i + 1}</span>
                <button type="button" style={DS.levelRemove} aria-label={`Remove level ${i + 1}`} onClick={() => removeLevel(lvl.id)}>
                  <IconClose />
                </button>
              </div>

              <div style={DS.field}>
                <label style={DS.fieldLabel}>Key</label>
                <select
                  value={lvl.key}
                  onChange={(e) => updateLevel(lvl.id, { key: e.target.value })}
                  style={DS.select}
                >
                  <option value="">Select a key</option>
                  {KEY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div style={DS.field}>
                <label style={DS.fieldLabel}>Limit</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={lvl.limit}
                  onChange={(e) => updateLevel(lvl.id, { limit: Number(e.target.value) || 1 })}
                  style={DS.input}
                />
              </div>
            </li>
          ))}
        </ul>

        <button type="button" style={DS.addLevelBtn} onClick={addLevel}>
          <IconPlus />
          <span>Add level</span>
        </button>
      </section>
    </aside>
  );
}

/* --------------------------- Page shell -------------------------- */

function todayRange() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x) => `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()}`;
  return { from: fmt(first), to: fmt(last) };
}

export default function ContentUsagePage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [levels, setLevels] = useState([]);
  const range = useMemo(() => todayRange(), []);

  const isReady = levels.length > 0 && levels.every((l) => l.key);
  const fileInputRef = useRef(null);

  const toolbarExtras = (
    <>
      <div style={TS.dateBadge} title="Date range">
        <span style={TS.dateLabels}>
          <span style={TS.dateLine}>From: {range.from}</span>
          <span style={TS.dateLine}>To: {range.to}</span>
        </span>
        <span style={TS.dateIcon} aria-hidden="true"><IconCalendar /></span>
      </div>
      <button
        type="button"
        style={{ ...TS.iconBtn, color: drawerOpen ? '#1d4ed8' : '#0f172a' }}
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
        title={drawerOpen ? 'Hide filters' : 'Show filters'}
      >
        <IconFilters />
      </button>
    </>
  );

  return (
    <AnalyticsShell
      active="content-usage"
      breadcrumb={{ prefix: 'Knowledge Hub', title: 'Content usage' }}
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times users read a document.
            </span>
            <div style={PS.headActions}>
              <button
                type="button"
                style={{
                  ...PS.iconAction,
                  color: isReady ? '#9D207B' : '#cbd5e1',
                  cursor: isReady ? 'pointer' : 'not-allowed',
                }}
                disabled={!isReady}
                title="Download as XLSX"
                aria-label="Download as XLSX"
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            {isReady ? (
              <ResultsPlaceholder levels={levels} />
            ) : (
              <div style={PS.emptyWrap}>
                <div style={PS.emptyText}>Begin by adding a level and selecting a key.</div>
                <div style={PS.emptyArrow} aria-hidden="true">
                  <IconArrowSnake />
                </div>
              </div>
            )}
          </section>
        </main>

        <RefineDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          levels={levels}
          setLevels={setLevels}
        />
      </div>

      <input ref={fileInputRef} type="file" hidden />
    </AnalyticsShell>
  );
}

function ResultsPlaceholder({ levels }) {
  return (
    <div style={PS.resultsCard}>
      <div style={PS.resultsHeading}>Levels</div>
      <ol style={PS.resultsList}>
        {levels.map((lvl, i) => {
          const opt = KEY_OPTIONS.find((o) => o.value === lvl.key);
          return (
            <li key={lvl.id} style={PS.resultsItem}>
              <span style={PS.levelTag}>Level {i + 1}</span>
              <span style={PS.levelKey}>{opt?.label || lvl.key}</span>
              <span style={PS.levelLimit}>limit: {lvl.limit}</span>
            </li>
          );
        })}
      </ol>
      <p style={PS.resultsNote}>
        Reports are computed once you connect the Fluid Topics analytics backend. The selected drill-down levels will be applied here.
      </p>
    </div>
  );
}

/* -------------------------------- styles -------------------------------- */

const TS = {
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
  },
  dateLabels: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.1,
  },
  dateLine: { fontSize: '0.7rem', fontWeight: 500, color: '#475569' },
  dateIcon: { display: 'inline-flex', color: '#475569' },
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
};

const PS = {
  layout: {
    display: 'flex',
    minHeight: 'calc(100vh - 60px - 56px)',
    background: '#ffffff',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  headTagline: {
    fontSize: '0.85rem',
    color: '#475569',
  },
  headActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  iconAction: {
    width: '38px',
    height: '38px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
  },
  body: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  emptyWrap: {
    width: 'min(720px, 100%)',
    minHeight: '320px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingTop: '24px',
  },
  emptyText: {
    fontSize: '0.95rem',
    color: '#0f172a',
    fontWeight: 500,
    flex: 1,
    textAlign: 'left',
    paddingTop: '6px',
  },
  emptyArrow: {
    color: '#94a3b8',
    flexShrink: 0,
  },
  resultsCard: {
    width: 'min(720px, 100%)',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px 24px',
  },
  resultsHeading: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' },
  resultsList: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' },
  resultsItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f8fafc',
    fontSize: '0.85rem',
  },
  levelTag: {
    padding: '3px 8px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.72rem',
    borderRadius: '999px',
    letterSpacing: '0.02em',
  },
  levelKey: { fontWeight: 600, color: '#0f172a' },
  levelLimit: { color: '#64748b', fontSize: '0.78rem', marginLeft: 'auto' },
  resultsNote: { marginTop: '14px', color: '#64748b', fontSize: '0.82rem' },
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  drawerBody: { padding: '14px 16px 18px', overflowY: 'auto' },
  levelsList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  levelCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px 12px 14px',
    background: '#f8fafc',
  },
  levelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  levelLabel: { fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  levelRemove: {
    width: '24px',
    height: '24px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' },
  fieldLabel: { fontSize: '0.74rem', fontWeight: 600, color: '#475569' },
  select: {
    height: '36px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
  input: {
    height: '36px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
  addLevelBtn: {
    marginTop: '14px',
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    border: '1px solid #1d4ed8',
    color: '#1d4ed8',
    background: '#ffffff',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
