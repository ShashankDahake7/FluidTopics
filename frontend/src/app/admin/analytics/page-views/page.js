'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Time axis ------------------------------ */

const MONTHS = [
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025',   'February 2025', 'March 2025',    'April 2025',
  'May 2025',       'June 2025',     'July 2025',     'August 2025',
  'September 2025', 'October 2025',  'November 2025', 'December 2025',
  'January 2026',   'February 2026', 'March 2026',    'April 2026',
];

const MONTH_LABELS = [
  'September 2024', 'December 2024', 'March 2025', 'June 2025',
  'September 2025', 'December 2025', 'March 2026',
];

const Y_TICKS_LINEAR = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000];
const Y_TICKS_LOG = [1, 10, 100, 1000, 10000, 100000];

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

/* ------------------------------ Page groups ------------------------------ */

/* Colors mirror the dot palette from the Angular blueprint's filter drawer
 * (color-chart-1..N base values). Each page has a distinct color so it can be
 * picked out from the filter and matched to a series in the chart. */
const PAGE_GROUPS = [
  {
    key: 'homepages',
    label: 'Homepages',
    items: [
      { key: 'home-classic',   label: 'Classic Homepage', color: '#9D207B' },
      { key: 'home-default',   label: 'Default homepage', color: '#CFB017' },
      { key: 'home-default-2', label: 'Default homepage 2', suffix: ' - Italian (Italy)', color: '#361FAD' },
      { key: 'homepage-en',    label: 'Homepage', suffix: ' - English (United States)', color: '#45A191' },
    ],
  },
  {
    key: 'custom-pages',
    label: 'Custom pages',
    items: [
      { key: 'p-askdarwin',    label: 'Ask Darwin',          url: '/p/askdarwin',          color: '#BD0F49' },
      { key: 'p-comingsoon',   label: 'Coming Soon',         url: '/p/comingsoon',         color: '#7A891A' },
      { key: 'p-countryguide', label: 'countryguide',        url: '/p/countryguide',       color: '#1980B2' },
      { key: 'p-faqs',         label: 'FAQs',                url: '/p/faqs',               color: '#B4643C' },
      { key: 'p-prem23',       label: 'HomepagePrem23april', url: '/p/HomepagePrem23april', color: '#33CC7F' },
      { key: 'p-legalchanges', label: 'Legal Changes',       url: '/p/legalchanges',       color: '#71718E' },
      { key: 'p-releasenotes', label: 'Release Notes',       url: '/p/ReleaseNotes',       color: '#9D207B' },
      { key: 'p-testhome',     label: 'Test Home',           url: '/p/testhome',           color: '#CFB017' },
      { key: 'p-testbga',      label: 'TestBGA',             url: '/p/testbga',            color: '#361FAD' },
      { key: 'p-upcoming',     label: "What's Upcoming",     url: '/p/upcoming',           color: '#45A191' },
    ],
  },
  {
    key: 'search-pages',
    label: 'Search pages',
    items: [
      { key: 'search-classic', label: 'Classic Search page', color: '#BD0F49' },
      { key: 'search-default', label: 'Default search',      color: '#7A891A' },
    ],
  },
  {
    key: 'reader-pages',
    label: 'Reader pages',
    items: [
      { key: 'reader-classic', label: 'Classic Reader page', color: '#1980B2' },
      { key: 'reader-default', label: 'Default reader',      color: '#B4643C' },
    ],
  },
  {
    key: 'viewer-pages',
    label: 'Viewer pages',
    items: [
      { key: 'viewer-page', label: 'Viewer page', color: '#33CC7F' },
    ],
  },
];

const ALL_PAGES = PAGE_GROUPS.flatMap((g) => g.items);
const PAGE_BY_KEY = Object.fromEntries(ALL_PAGES.map((p) => [p.key, p]));
const ALL_PAGE_KEYS = ALL_PAGES.map((p) => p.key);

/* Mock value series for each page (length === MONTHS.length). The non-trivial
 * series mirror the visible curves and tooltip values shown in the Angular
 * blueprint (e.g. "Default reader" peaks at ~74k, "Homepage" sits ~14k, etc.).
 * Pages with no recorded views are kept at zero — they still appear in the
 * legend / filter so the user can toggle them on. */
const SERIES_VALUES = {
  'reader-default':  [49531, 50983, 57071, 65514, 74481, 66051, 68250, 66527, 68429, 58272, 74816, 51860, 51650, 49418, 49914, 44366, 44598, 46273, 52128, 36547],
  'homepage-en':     [14652, 14215, 15083, 15075, 18182, 16898, 15185, 16685, 15716, 13952, 17452, 14933, 15483, 14600, 14503, 12964, 13272, 13995, 14884, 11255],
  'p-releasenotes':  [1852, 1384, 2168, 2322, 1711, 2046, 1905, 1753, 1809, 1719, 2071, 1963, 1542, 1408, 1633, 1784, 1352, 1411, 1774, 1013],
  'p-upcoming':      [397, 1400, 1287, 445, 1589, 1193, 523, 1835, 878, 604, 1331, 1056, 539, 1597, 1024, 405, 1287, 1762, 1031, 559],
  'viewer-page':     [720, 818, 882, 1547, 1773, 1414, 1675, 1545, 1290, 1041, 1382, 1218, 996, 1158, 1239, 1144, 1156, 1340, 1454, 1010],
  'p-askdarwin':     [16287, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'reader-classic':  [4, 0, 0, 0, 0, 6, 6, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
};

/* Build the canonical SERIES list in the order pages appear in the filter. */
const SERIES = ALL_PAGES.map((p) => ({
  key: p.key,
  label: p.label,
  color: p.color,
  values: SERIES_VALUES[p.key] || new Array(MONTHS.length).fill(0),
}));

/* ------------------------------ Filter selects ------------------------------ */

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

const IconStacked = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="14" width="4" height="7" />
    <rect x="10" y="9" width="4" height="12" />
    <rect x="17" y="4" width="4" height="17" />
  </svg>
);

const IconLine = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 17 9 11 13 15 21 7" />
  </svg>
);

const IconLog = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <text x="3" y="16" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">log</text>
    <text x="14" y="11" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">10</text>
    <line x1="3" y1="20" x2="21" y2="20" />
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

export default function PageViewsPage() {
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [language, setLanguage] = useState('en-US');
  const [authStatus, setAuthStatus] = useState('all');

  const [selectedPages, setSelectedPages] = useState(() => new Set(ALL_PAGE_KEYS));

  const allPagesOn = selectedPages.size === ALL_PAGE_KEYS.length;
  const nonePages  = selectedPages.size === 0;

  const toggleAllPages = () => {
    setSelectedPages(allPagesOn ? new Set() : new Set(ALL_PAGE_KEYS));
  };

  const toggleGroup = (group) => {
    const keys = group.items.map((it) => it.key);
    const everyOn = keys.every((k) => selectedPages.has(k));
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const togglePage = (key) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleSeries = useMemo(
    () => SERIES.filter((s) => selectedPages.has(s.key)),
    [selectedPages],
  );

  return (
    <AnalyticsShell
      active="page-views"
      breadcrumb={{ prefix: 'Traffic', title: 'Page views' }}
      feedbackSubject="Feedback about page views"
      toolbarExtras={
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
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times an end-user views a page.
            </span>
            <div style={PS.headControls}>
              <div role="radiogroup" aria-label="Group by period" style={PS.switch}>
                {PERIOD_OPTIONS.map((opt) => {
                  const active = period === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPeriod(opt.value)}
                      style={{
                        ...PS.switchOption,
                        background: active ? '#1d4ed8' : 'transparent',
                        color: active ? '#ffffff' : '#0f172a',
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                style={PS.iconBtn}
                title={stacked ? 'Switch to line graph' : 'Switch to stacked graph'}
                aria-label={stacked ? 'Switch to line graph' : 'Switch to stacked graph'}
                onClick={() => setStacked((v) => !v)}
              >
                {stacked ? <IconLine /> : <IconStacked />}
              </button>
              <button
                type="button"
                style={{
                  ...PS.iconBtn,
                  background: logScale ? '#eff6ff' : 'transparent',
                  color: logScale ? '#1d4ed8' : '#475569',
                }}
                title={logScale ? 'Switch to linear scale' : 'Switch to logarithmic scale'}
                aria-label={logScale ? 'Switch to linear scale' : 'Switch to logarithmic scale'}
                aria-pressed={logScale}
                onClick={() => setLogScale((v) => !v)}
              >
                <IconLog />
              </button>
              <button
                type="button"
                style={{ ...PS.iconBtn, color: '#1d4ed8' }}
                title="Download as XLSX"
                aria-label="Download as XLSX"
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              <PageViewsChart
                series={visibleSeries}
                stacked={stacked}
                logScale={logScale}
                empty={nonePages}
              />
            </div>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter page views">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter page views</h3>
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

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allPagesOn}
                    indeterminate={!allPagesOn && !nonePages}
                    onChange={toggleAllPages}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {PAGE_GROUPS.map((group) => {
                const keys = group.items.map((it) => it.key);
                const onCount = keys.filter((k) => selectedPages.has(k)).length;
                const groupChecked = onCount === keys.length;
                const groupIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={group.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={groupChecked}
                          indeterminate={groupIndeterminate}
                          onChange={() => toggleGroup(group)}
                        />
                        <span>{group.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {group.items.map((it) => (
                        <li key={it.key}>
                          <label style={PS.checkRow}>
                            <Checkbox
                              checked={selectedPages.has(it.key)}
                              onChange={() => togglePage(it.key)}
                            />
                            <span style={{ ...PS.colorDot, background: it.color }} aria-hidden="true" />
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

/* ------------------------------ Chart ------------------------------ */

function PageViewsChart({ series, stacked, logScale, empty }) {
  const width = 1200;
  const height = 380;
  const padL = 80;
  const padR = 28;
  const padT = 38;
  const padB = 70; /* extra room for the data-zoom strip */
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yTicks = logScale ? Y_TICKS_LOG : Y_TICKS_LINEAR;
  const transform = (v) => (logScale ? Math.log10(Math.max(v, 1)) : v);

  const yMin = 0;
  const yMax = logScale
    ? Math.log10(yTicks[yTicks.length - 1])
    : yTicks[yTicks.length - 1];

  const xStep = innerW / (MONTHS.length - 1);
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => {
    const t = transform(v);
    if (yMax === yMin) return padT + innerH;
    const norm = (t - yMin) / (yMax - yMin);
    return padT + innerH - Math.max(0, Math.min(1, norm)) * innerH;
  };

  /* Stacked = running cumulative across the selected series, in render order. */
  const renderedSeries = useMemo(() => {
    if (!stacked) return series;
    const running = MONTHS.map(() => 0);
    return series.map(({ key, label, color, values }) => {
      const stackedVals = values.map((v, i) => {
        running[i] += v;
        return running[i];
      });
      return { key, label, color, values: stackedVals };
    });
  }, [series, stacked]);

  const labelTickIdx = useMemo(
    () => MONTH_LABELS.map((label) => MONTHS.indexOf(label)).filter((i) => i >= 0),
    [],
  );

  const ongoingX = xPos(MONTHS.length - 1);
  const lastTickX = xPos(MONTHS.length - 2);

  const formatY = (v) => (v >= 1000 ? v.toLocaleString('en-US') : String(v));

  /* Stylised zoom strip below the X axis. Mirrors the silhouette of the
   * dominant series so it reads as a miniature overview. */
  const stripTop = padT + innerH + 28;
  const stripH = 22;
  const dominantSeries = SERIES_VALUES['reader-default'];
  const stripMax = Math.max(...dominantSeries);
  const stripPath = useMemo(() => {
    const points = dominantSeries.map((v, i) => {
      const x = padL + (i / (MONTHS.length - 1)) * innerW;
      const y = stripTop + stripH - (v / stripMax) * (stripH - 4);
      return `${x},${y}`;
    });
    return [
      `M ${padL},${stripTop + stripH}`,
      `L ${points.join(' L ')}`,
      `L ${padL + innerW},${stripTop + stripH} Z`,
    ].join(' ');
  }, [innerW, stripMax, dominantSeries, stripTop]);

  return (
    <div style={CS.wrap}>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
            PAGE VIEWS
          </text>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
              <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
                {formatY(t)}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6e7079" />
          <text x={padL + innerW + 6} y={padT + innerH + 3} fontSize="11" fill="#6E7079" fontFamily="Inter, sans-serif">
            DATE
          </text>

          {labelTickIdx.map((idx) => (
            <g key={idx}>
              <line x1={xPos(idx)} y1={padT + innerH} x2={xPos(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
              <text x={xPos(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
                {MONTHS[idx]}
              </text>
            </g>
          ))}

          {/* Ongoing-period band */}
          <rect
            x={lastTickX}
            y={padT - 10}
            width={ongoingX - lastTickX}
            height={innerH + 10}
            fill="rgba(33,150,243,0.06)"
          />
          <text x={(lastTickX + ongoingX) / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
            Ongoing period
          </text>

          {!empty && renderedSeries.map(({ key, label, color, values }) => {
            const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            const isFlatZero = values.every((v) => v === 0);
            return (
              <g key={key} opacity={isFlatZero ? 0.45 : 1}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
                {values.map((v, i) => (
                  <circle
                    key={i}
                    cx={xPos(i)}
                    cy={yPos(v)}
                    r="3"
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth="1"
                    opacity={i === values.length - 1 ? 0.55 : 1}
                  >
                    <title>{`${label} — ${MONTHS[i]}: ${v.toLocaleString('en-US')}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {empty && (
            <text x={padL + innerW / 2} y={padT + innerH / 2} fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="Inter, sans-serif">
              No pages selected
            </text>
          )}

          {/* Data zoom strip (visual only) */}
          <rect
            x={padL}
            y={stripTop}
            width={innerW}
            height={stripH}
            fill="#f5f8ff"
            stroke="#d2dbee"
            rx="4"
          />
          <path d={stripPath} fill="rgba(135,175,255,0.45)" stroke="#8fb0f7" strokeWidth="0.6" />
          <rect x={padL} y={stripTop} width={innerW} height={stripH} fill="rgba(135,175,255,0.18)" rx="4" />
          {/* Two small grip handles to suggest a brushable range */}
          <g transform={`translate(${padL + 4}, ${stripTop + stripH / 2})`}>
            <circle r="6" fill="#ffffff" stroke="#acb8d1" strokeWidth="0.8" />
            <line x1="-2" y1="-2" x2="-2" y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="0"  y1="-2" x2="0"  y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="2"  y1="-2" x2="2"  y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
          </g>
          <g transform={`translate(${padL + innerW - 4}, ${stripTop + stripH / 2})`}>
            <circle r="6" fill="#ffffff" stroke="#acb8d1" strokeWidth="0.8" />
            <line x1="-2" y1="-2" x2="-2" y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="0"  y1="-2" x2="0"  y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="2"  y1="-2" x2="2"  y2="2" stroke="#acb8d1" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <div style={CS.legend}>
        {series.map(({ key, label, color, values }) => {
          const isFlatZero = values.every((v) => v === 0);
          return (
            <span key={key} style={{ ...CS.legendItem, opacity: isFlatZero ? 0.55 : 1 }}>
              <span style={{ ...CS.legendDot, background: color }} />
              <span>{label}</span>
            </span>
          );
        })}
      </div>
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

  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
  headControls: { display: 'inline-flex', alignItems: 'center', gap: '12px' },
  switch: {
    display: 'inline-flex',
    padding: '3px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#ffffff',
  },
  switchOption: {
    padding: '5px 14px',
    fontSize: '0.78rem',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#475569',
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

  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 18px',
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

  selectAllRow: { paddingTop: '10px', paddingBottom: '6px', marginBottom: '4px' },
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
  colorDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '2px',
    flexShrink: 0,
  },
  targetSuffix: { color: '#1f2937' },
  targetUrl: {
    fontSize: '0.72rem',
    color: '#64748b',
    paddingLeft: '42px',
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
  wrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  svgWrap: { width: '100%' },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 18px',
    marginTop: '6px',
    padding: '6px 4px 0',
    borderTop: '1px solid #f1f5f9',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.76rem',
    color: '#334155',
  },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
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
