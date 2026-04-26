'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Sankey data ------------------------------ */

/* Source-side nodes (left). Values mirror the relative band heights from the
 * Angular blueprint (March 2026 monthly snapshot). My Account / My Library /
 * Viewer page have negligible real values and are clamped for visibility. */
const SOURCE_NODES = [
  { key: 'src-search',     label: 'Search page',  color: '#7A891A', value: 92 },
  { key: 'src-reader',     label: 'Reader pages', color: '#1980B2', value: 79 },
  { key: 'src-homepages',  label: 'Homepages',    color: '#BD0F49', value: 71 },
  { key: 'src-custom',     label: 'Custom pages', color: '#33CC7F', value: 16 },
  { key: 'src-viewer',     label: 'Viewer page',  color: '#B4643C', value: 2 },
  { key: 'src-myaccount',  label: 'My Account',   color: '#9D207B', value: 1 },
  { key: 'src-mylibrary',  label: 'My Library',   color: '#CFB017', value: 1 },
];

const TARGET_NODES = [
  { key: 'tgt-reader',     label: 'Reader pages', color: '#1980B2', value: 122 },
  { key: 'tgt-search',     label: 'Search page',  color: '#7A891A', value: 88 },
  { key: 'tgt-viewer',     label: 'Viewer page',  color: '#B4643C', value: 9 },
  { key: 'tgt-homepages',  label: 'Homepages',    color: '#BD0F49', value: 27 },
  { key: 'tgt-custom',     label: 'Custom pages', color: '#33CC7F', value: 16 },
];

const FLOWS = [
  { source: 'src-search',     target: 'tgt-reader',    value: 73 },
  { source: 'src-search',     target: 'tgt-search',    value: 15 },
  { source: 'src-search',     target: 'tgt-homepages', value: 3 },
  { source: 'src-search',     target: 'tgt-viewer',    value: 1 },
  { source: 'src-search',     target: 'tgt-custom',    value: 1 },

  { source: 'src-reader',     target: 'tgt-search',    value: 34 },
  { source: 'src-reader',     target: 'tgt-reader',    value: 18 },
  { source: 'src-reader',     target: 'tgt-homepages', value: 18 },
  { source: 'src-reader',     target: 'tgt-viewer',    value: 7 },
  { source: 'src-reader',     target: 'tgt-custom',    value: 2 },

  { source: 'src-homepages',  target: 'tgt-search',    value: 36 },
  { source: 'src-homepages',  target: 'tgt-reader',    value: 17 },
  { source: 'src-homepages',  target: 'tgt-custom',    value: 13 },
  { source: 'src-homepages',  target: 'tgt-homepages', value: 4 },
  { source: 'src-homepages',  target: 'tgt-viewer',    value: 1 },

  { source: 'src-custom',     target: 'tgt-reader',    value: 13 },
  { source: 'src-custom',     target: 'tgt-homepages', value: 1 },
  { source: 'src-custom',     target: 'tgt-search',    value: 1 },
  { source: 'src-custom',     target: 'tgt-custom',    value: 1 },

  { source: 'src-viewer',     target: 'tgt-search',    value: 1 },
  { source: 'src-viewer',     target: 'tgt-reader',    value: 1 },

  { source: 'src-myaccount',  target: 'tgt-reader',    value: 0.5 },
  { source: 'src-myaccount',  target: 'tgt-search',    value: 0.5 },

  { source: 'src-mylibrary',  target: 'tgt-reader',    value: 0.5 },
  { source: 'src-mylibrary',  target: 'tgt-search',    value: 0.5 },
];

/* ------------------------------ Filter data ------------------------------ */

const LANGUAGE_OPTIONS = [
  { value: 'all',   label: 'All' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
];

const AUTH_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'authenticated',   label: 'Authenticated' },
  { value: 'unauthenticated', label: 'Unauthenticated' },
];

const TARGET_GROUPS = [
  {
    key: 'homepages',
    label: 'Homepages',
    items: [
      { key: 'home-classic',   label: 'Classic Homepage' },
      { key: 'home-default',   label: 'Default homepage' },
      { key: 'home-default-2', label: 'Default homepage 2', suffix: ' - Italian (Italy)' },
      { key: 'homepage-en',    label: 'Homepage',           suffix: ' - English (United States)' },
    ],
  },
  {
    key: 'custom-pages',
    label: 'Custom pages',
    items: [
      { key: 'p-askdarwin',    label: 'Ask Darwin',          url: '/p/askdarwin' },
      { key: 'p-comingsoon',   label: 'Coming Soon',         url: '/p/comingsoon' },
      { key: 'p-countryguide', label: 'countryguide',        url: '/p/countryguide' },
      { key: 'p-faqs',         label: 'FAQs',                url: '/p/faqs' },
      { key: 'p-prem23',       label: 'HomepagePrem23april', url: '/p/HomepagePrem23april' },
      { key: 'p-legalchanges', label: 'Legal Changes',       url: '/p/legalchanges' },
      { key: 'p-releasenotes', label: 'Release Notes',       url: '/p/ReleaseNotes' },
      { key: 'p-testhome',     label: 'Test Home',           url: '/p/testhome' },
      { key: 'p-testbga',      label: 'TestBGA',             url: '/p/testbga' },
      { key: 'p-upcoming',     label: "What's Upcoming",     url: '/p/upcoming' },
    ],
  },
  {
    key: 'search-pages',
    label: 'Search pages',
    items: [
      { key: 'search-classic', label: 'Classic Search page' },
      { key: 'search-default', label: 'Default search' },
    ],
  },
  {
    key: 'reader-pages',
    label: 'Reader pages',
    items: [
      { key: 'reader-classic', label: 'Classic Reader page' },
      { key: 'reader-default', label: 'Default reader' },
    ],
  },
  {
    key: 'viewer-pages',
    label: 'Viewer pages',
    items: [
      { key: 'viewer-page', label: 'Viewer page' },
    ],
  },
];

const ALL_TARGET_KEYS = TARGET_GROUPS.flatMap((g) => g.items.map((it) => it.key));

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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 12 10 18 20 6" />
  </svg>
);

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function InternalNavigationPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [language, setLanguage] = useState('en-US');
  const [authStatus, setAuthStatus] = useState('all');
  const [selectedTargets, setSelectedTargets] = useState(
    () => new Set(ALL_TARGET_KEYS),
  );

  const allTargetsOn = selectedTargets.size === ALL_TARGET_KEYS.length;
  const noneTargets  = selectedTargets.size === 0;

  const toggleAllTargets = () => {
    setSelectedTargets(allTargetsOn ? new Set() : new Set(ALL_TARGET_KEYS));
  };

  const toggleTargetGroup = (group) => {
    const keys = group.items.map((it) => it.key);
    const everyOn = keys.every((k) => selectedTargets.has(k));
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const toggleTarget = (key) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <AnalyticsShell
      active="internal-navigation"
      breadcrumb={{ prefix: 'Traffic', title: 'Internal navigation' }}
      feedbackSubject="Feedback about internal navigation"
      toolbarExtras={
        <>
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
        </>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              How do users navigate from one page to another inside your portal?
            </span>
            <button
              type="button"
              style={PS.iconBtn}
              title="Download as XLSX"
              aria-label="Download as XLSX"
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              <div style={PS.chartLegendRow}>
                <span style={PS.chartLegendLabel}>Sources</span>
                <span style={PS.chartLegendLabel}>Targets</span>
              </div>
              <NavigationSankey />
            </div>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter pages">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter pages</h3>
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
                label="Interface language"
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
              />

              <FieldSelect
                label="Authentication status"
                value={authStatus}
                onChange={setAuthStatus}
                options={AUTH_OPTIONS}
              />

              <div style={PS.categoryTitleRow}>
                <span style={PS.categoryTitle}>Target pages</span>
              </div>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allTargetsOn}
                    indeterminate={!allTargetsOn && !noneTargets}
                    onChange={toggleAllTargets}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {TARGET_GROUPS.map((group) => {
                const keys = group.items.map((it) => it.key);
                const onCount = keys.filter((k) => selectedTargets.has(k)).length;
                const groupChecked = onCount === keys.length;
                const groupIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={group.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={groupChecked}
                          indeterminate={groupIndeterminate}
                          onChange={() => toggleTargetGroup(group)}
                        />
                        <span>{group.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {group.items.map((it) => (
                        <li key={it.key}>
                          <label style={PS.checkRow}>
                            <Checkbox
                              checked={selectedTargets.has(it.key)}
                              onChange={() => toggleTarget(it.key)}
                            />
                            <span>
                              <span>{it.label}</span>
                              {it.suffix && <span style={PS.targetSuffix}>{it.suffix}</span>}
                            </span>
                          </label>
                          {it.url && <div style={PS.targetUrl}>{it.url}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <footer style={PS.drawerFoot}>
              <button type="button" style={PS.applyBtn}>Apply</button>
            </footer>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Sankey diagram ------------------------------ */

function NavigationSankey() {
  const width = 1200;
  const height = 400;
  const padT = 24;
  const padB = 16;
  const padL = 90;   /* room for source labels */
  const padR = 130;  /* room for target labels */
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const nodeWidth = 18;
  const gap = 6;

  const totalSrc = SOURCE_NODES.reduce((s, n) => s + n.value, 0);
  const totalTgt = TARGET_NODES.reduce((s, n) => s + n.value, 0);
  const srcGapTotal = (SOURCE_NODES.length - 1) * gap;
  const tgtGapTotal = (TARGET_NODES.length - 1) * gap;
  const srcScale = (innerH - srcGapTotal) / totalSrc;
  const tgtScale = (innerH - tgtGapTotal) / totalTgt;

  const layout = useMemo(() => {
    const sources = {};
    let sCur = padT;
    SOURCE_NODES.forEach((n, i) => {
      const h = n.value * srcScale;
      sources[n.key] = { ...n, idx: i, top: sCur, height: h, cursor: sCur };
      sCur += h + gap;
    });

    const targets = {};
    let tCur = padT;
    TARGET_NODES.forEach((n, i) => {
      const h = n.value * tgtScale;
      targets[n.key] = { ...n, idx: i, top: tCur, height: h, cursor: tCur };
      tCur += h + gap;
    });

    /* Order each source's outflows by the target's vertical position to
     * minimise crossings. Sort each target's inflows by the source's index. */
    const flows = FLOWS.map((f, i) => ({ ...f, id: `flow-${i}` }));

    const srcGroups = SOURCE_NODES.map((s) =>
      flows
        .filter((f) => f.source === s.key)
        .sort((a, b) => targets[a.target].idx - targets[b.target].idx),
    );
    const tgtGroups = TARGET_NODES.map((t) =>
      flows
        .filter((f) => f.target === t.key)
        .sort((a, b) => sources[a.source].idx - sources[b.source].idx),
    );

    srcGroups.forEach((group) => {
      group.forEach((f) => {
        const src = sources[f.source];
        const h = f.value * srcScale;
        f.leftTop = src.cursor;
        f.leftBot = src.cursor + h;
        src.cursor += h;
      });
    });
    tgtGroups.forEach((group) => {
      group.forEach((f) => {
        const tgt = targets[f.target];
        const h = f.value * tgtScale;
        f.rightTop = tgt.cursor;
        f.rightBot = tgt.cursor + h;
        tgt.cursor += h;
      });
    });

    return { sources, targets, flows };
  }, [srcScale, tgtScale, padT, gap]);

  const xLeft = padL;
  const xLeftEdge = padL + nodeWidth;
  const xRightEdge = padL + innerW - nodeWidth;
  const xRight = padL + innerW;

  /* Pre-compute the unique gradient pairs so we don't emit dozens of identical
   * <linearGradient> defs. */
  const gradients = useMemo(() => {
    const seen = new Map();
    layout.flows.forEach((f) => {
      const src = layout.sources[f.source];
      const tgt = layout.targets[f.target];
      const id = `nav-${src.color.replace('#', '')}-${tgt.color.replace('#', '')}`;
      if (!seen.has(id)) seen.set(id, { id, from: src.color, to: tgt.color });
    });
    return Array.from(seen.values());
  }, [layout]);

  const gradientId = (srcColor, tgtColor) =>
    `nav-${srcColor.replace('#', '')}-${tgtColor.replace('#', '')}`;

  const ribbonPath = (f) => {
    const cx1 = xLeftEdge + (xRightEdge - xLeftEdge) * 0.45;
    const cx2 = xLeftEdge + (xRightEdge - xLeftEdge) * 0.55;
    return [
      `M ${xLeftEdge} ${f.leftTop}`,
      `C ${cx1} ${f.leftTop}, ${cx2} ${f.rightTop}, ${xRightEdge} ${f.rightTop}`,
      `L ${xRightEdge} ${f.rightBot}`,
      `C ${cx2} ${f.rightBot}, ${cx1} ${f.leftBot}, ${xLeftEdge} ${f.leftBot}`,
      'Z',
    ].join(' ');
  };

  return (
    <div style={CS.svgWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Internal navigation Sankey diagram">
        <defs>
          {gradients.map((g) => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={g.from} />
              <stop offset="100%" stopColor={g.to} />
            </linearGradient>
          ))}
        </defs>

        {layout.flows.map((f) => {
          const src = layout.sources[f.source];
          const tgt = layout.targets[f.target];
          return (
            <path
              key={f.id}
              d={ribbonPath(f)}
              fill={`url(#${gradientId(src.color, tgt.color)})`}
              fillOpacity="0.28"
              stroke="none"
            >
              <title>{`${src.label} → ${tgt.label}: ${f.value.toLocaleString('en-US')}`}</title>
            </path>
          );
        })}

        {Object.values(layout.sources).map((n) => (
          <g key={n.key}>
            <rect x={xLeft} y={n.top} width={nodeWidth} height={n.height} fill={n.color} rx="1" />
            <text
              x={xLeft - 8}
              y={n.top + n.height / 2 + 4}
              fontSize="12"
              fontWeight="500"
              textAnchor="end"
              fill="#333333"
              fontFamily="Inter, sans-serif"
            >
              {n.label}
            </text>
          </g>
        ))}

        {Object.values(layout.targets).map((n) => (
          <g key={n.key}>
            <rect x={xRightEdge} y={n.top} width={nodeWidth} height={n.height} fill={n.color} rx="1" />
            <text
              x={xRight + 8}
              y={n.top + n.height / 2 + 4}
              fontSize="12"
              fontWeight="500"
              textAnchor="start"
              fill="#333333"
              fontFamily="Inter, sans-serif"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------ FieldSelect ------------------------------ */

function FieldSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div style={FS.field} ref={ref}>
      <label style={FS.label}>{label}</label>
      <button
        type="button"
        style={FS.input}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <span style={FS.caret}><IconChevron /></span>
      </button>
      {open && (
        <ul style={FS.menu} role="listbox">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  style={{
                    ...FS.option,
                    background: selected ? '#eff6ff' : 'transparent',
                    color: selected ? '#1d4ed8' : '#0f172a',
                    fontWeight: selected ? 600 : 500,
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ Checkbox ------------------------------ */

function Checkbox({ checked, indeterminate, onChange }) {
  const filled = checked || indeterminate;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
      style={{
        ...CK.box,
        background: filled ? '#1d4ed8' : '#ffffff',
        borderColor: filled ? '#1d4ed8' : '#94a3b8',
      }}
    >
      {indeterminate ? <span style={CK.dash} /> : checked ? <IconCheck /> : null}
    </span>
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

  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
  },
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
    padding: '4px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
  },
  dateLabels: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  dateLine: { fontSize: '0.7rem', color: '#475569', fontWeight: 500 },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px 18px 18px',
  },
  chartLegendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 6px 6px',
  },
  chartLegendLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#475569',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
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
  drawerBody: { flex: 1, overflowY: 'auto', padding: '14px 16px 18px' },

  categoryTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    margin: '14px 0 6px',
  },
  categoryTitle: { fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' },

  selectAllRow: { paddingBottom: '6px', marginBottom: '4px' },
  categoryGroup: { padding: '6px 0' },
  categoryHeader: { paddingBottom: '2px' },

  list: {
    listStyle: 'none',
    padding: '0 0 0 28px',
    margin: '4px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '5px 4px',
    fontSize: '0.83rem',
    color: '#1f2937',
    cursor: 'pointer',
    userSelect: 'none',
  },
  targetSuffix: { color: '#1f2937' },
  targetUrl: {
    fontSize: '0.72rem',
    color: '#64748b',
    paddingLeft: '32px',
    marginTop: '-2px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  drawerFoot: {
    borderTop: '1px solid #e5e7eb',
    padding: '12px 18px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  applyBtn: {
    padding: '8px 22px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const FS = {
  field: { position: 'relative', marginBottom: '14px' },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  caret: { color: '#64748b', display: 'inline-flex' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    margin: 0,
    padding: '4px',
    listStyle: 'none',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
    zIndex: 10,
    maxHeight: '220px',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    padding: '7px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const CS = {
  svgWrap: { width: '100%' },
};

const CK = {
  box: {
    width: '18px',
    height: '18px',
    border: '2px solid #94a3b8',
    borderRadius: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  dash: {
    width: '10px',
    height: '2px',
    background: '#ffffff',
    borderRadius: '1px',
  },
};
