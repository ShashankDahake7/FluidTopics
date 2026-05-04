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

const Y_TICKS = [0, 100000, 200000, 300000, 400000, 500000, 600000];

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const TABS = [
  { key: 'evolution', label: 'Evolution' },
  { key: 'details',   label: 'Details' },
];

/* ------------------------------ Calling apps ------------------------------ */

/* The order of this list controls both the legend and the bottom→top
 * stacking order in the bar chart. Colors mirror the dot palette from the
 * Angular blueprint's filter drawer. */
const CALLING_APPS = [
  { key: 'undefined',                label: 'undefined',                color: '#9D207B', info: 'undefined' },
  { key: 'beacon',                   label: 'Beacon',                   color: '#CFB017' },
  { key: 'crawler',                  label: 'crawler',                  color: '#361FAD', info: 'crawler' },
  { key: 'darwinbox-custom-reader',  label: 'Darwinbox-Custom-Reader',  color: '#45A191' },
  { key: 'docteam',                  label: 'docteam',                  color: '#BD0F49' },
  { key: 'internaltestingdb',        label: 'internaltestingdb',        color: '#7A891A' },
  { key: 'page-designer',            label: 'page-designer',            color: '#1980B2' },
  { key: 'prem',                     label: 'prem',                     color: '#B4643C' },
  { key: 'readercustom',             label: 'ReaderCustom',             color: '#33CC7F' },
  { key: 'support',                  label: 'Support',                  color: '#71718E' },
  { key: 'your-calling-app',         label: 'Your-Calling-App',         color: '#9D207B' },
];

const ALL_KEYS = CALLING_APPS.map((a) => a.key);

/* Mock monthly counts. Series with significant volume (`undefined`,
 * `Beacon`, `Darwinbox-Custom-Reader`) follow the visual silhouette of the
 * Angular blueprint's chart. Quieter series (`crawler`, …) sit just above
 * zero so they're still selectable in the filter and visible on hover. */
const SERIES_VALUES = {
  'undefined':                [30000, 139000, 246000, 263000, 199000, 28000, 27000, 27000, 31000, 28000, 31000, 28000, 30000, 26000, 13000, 10000, 11000, 10000, 11000, 13000],
  'beacon':                   [0,         0,      0,   5600,   1300, 18000, 15000, 16000,  6000, 10000, 41000, 52000, 66000, 64000, 94000, 82000, 62000, 30000, 28000,  5000],
  'crawler':                  [150,     150,    150,    160,    120,   140,   150,   145,    95,   150,   160,   155,   150,   145,   160,   210,   190,   170,   195,   165],
  'darwinbox-custom-reader':  [338000, 301000, 325000, 325000, 372000, 338000, 318000, 329000, 306000, 274000, 367000, 309000, 278000, 321000, 318000, 273000, 279000, 287000, 299000, 212000],
  'docteam':                  [0,         0,      0,      0,     11,    10,     0,     0,     0,     0,     0,     0,     0,     0,     0,     8,     0,     0,     0,     0],
  'internaltestingdb':        [0,         0,      0,      0,    115,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0],
  'page-designer':            [867,      140,      0,    122,    46,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0],
  'prem':                     [0,         0,      0,      0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     4,     0,     0,     0,     0],
  'readercustom':             [0,         0,      0,      0,     0,     0,     0,     1,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0],
  'support':                  [0,         0,      0,      0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     0,     2,     0,     0,     0,     0],
  'your-calling-app':         [0,        12,      0,     10,    39,    54,     9,     1,     5,     0,    28,    43,     7,     5,     1,     2,     0,     0,     0,     0],
};

const SERIES = CALLING_APPS.map((a) => ({
  key: a.key,
  label: a.label,
  color: a.color,
  values: SERIES_VALUES[a.key] || new Array(MONTHS.length).fill(0),
}));

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

const IconGrouped = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3"  y="11" width="3" height="10" />
    <rect x="7"  y="6"  width="3" height="15" />
    <rect x="13" y="14" width="3" height="7" />
    <rect x="17" y="9"  width="3" height="12" />
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

const IconChartTab = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="20" x2="21" y2="20" />
    <rect x="6"  y="11" width="3" height="9" />
    <rect x="11" y="6"  width="3" height="14" />
    <rect x="16" y="14" width="3" height="6" />
  </svg>
);

const IconBarsTab = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3"  y="6"  width="14" height="3" rx="1" />
    <rect x="3"  y="11" width="18" height="3" rx="1" />
    <rect x="3"  y="16" width="10" height="3" rx="1" />
  </svg>
);

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="12" y1="7"  x2="12" y2="8" />
  </svg>
);

const IconExternal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <path d="M21 3l-9 9" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function ApiCallsPage() {
  const [activeTab, setActiveTab] = useState('evolution');
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selected, setSelected] = useState(() => new Set(ALL_KEYS));

  const allOn  = selected.size === ALL_KEYS.length;
  const noneOn = selected.size === 0;

  const toggleAll = () => {
    setSelected(allOn ? new Set() : new Set(ALL_KEYS));
  };
  const toggleApp = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleSeries = useMemo(
    () => SERIES.filter((s) => selected.has(s.key)),
    [selected],
  );

  return (
    <AnalyticsShell
      active="api-calls"
      breadcrumb={{ prefix: 'Traffic', title: 'API calls' }}
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
          <nav style={PS.tabs} role="tablist" aria-label="API calls view">
            {TABS.map((t) => {
              const isActive = activeTab === t.key;
              const Icon = t.key === 'evolution' ? IconChartTab : IconBarsTab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    ...PS.tab,
                    color: isActive ? '#1d4ed8' : '#475569',
                    borderBottomColor: isActive ? '#1d4ed8' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <span style={PS.tabIcon} aria-hidden="true"><Icon /></span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {activeTab === 'evolution' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>
                  <span>Number of public API calls, including custom portal configuration, categorized by calling app.</span>
                  <InfoPopover
                    label="What is a calling app?"
                    title="What is a calling app?"
                    body={[
                      'A calling app is an application or service that sends API calls to the Fluid Topics APIs.',
                      'API calls are categorized by calling app to illustrate how API activity is distributed among systems and integrations.',
                    ]}
                    linkLabel="Calling apps definition"
                    linkHref="https://doc.fluidtopics.com/r/Fluid-Topics-Glossary/Definitions/C/Calling-app"
                    placement="below"
                  />
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
                    title={stacked ? 'Switch to unstacked graph' : 'Switch to stacked graph'}
                    aria-label={stacked ? 'Switch to unstacked graph' : 'Switch to stacked graph'}
                    onClick={() => setStacked((v) => !v)}
                  >
                    {stacked ? <IconGrouped /> : <IconStacked />}
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
                  <ApiCallsChart
                    series={visibleSeries}
                    stacked={stacked}
                    empty={noneOn}
                  />
                </div>
              </section>
            </>
          )}

          {activeTab === 'details' && (
            <section style={PS.detailsBody}>
              <p style={PS.detailsEmpty}>
                Detailed table view will be available shortly.
              </p>
            </section>
          )}
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter calling apps">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter calling apps</h3>
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
              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allOn}
                    indeterminate={!allOn && !noneOn}
                    onChange={toggleAll}
                  />
                  <span>Select all</span>
                </label>
              </div>

              <ul style={PS.appList}>
                {CALLING_APPS.map((app) => (
                  <li key={app.key} style={PS.appRow}>
                    <label style={PS.checkRow}>
                      <Checkbox
                        checked={selected.has(app.key)}
                        onChange={() => toggleApp(app.key)}
                      />
                      <span style={{ ...PS.colorDot, background: app.color }} aria-hidden="true" />
                      <span>{app.label}</span>
                    </label>
                    {app.info === 'undefined' && (
                      <InfoPopover
                        label="undefined API calls"
                        title="Why are some API calls categorized as 'undefined'?"
                        body={[
                          "API calls are categorized under 'undefined' calling app when the calling app header or query parameter is missing or empty.",
                        ]}
                        linkLabel="Fluid Topics calling app documentation"
                        linkHref="https://doc.fluidtopics.com/r/Fluid-Topics-API-Reference-Guide/Introduction-to-Fluid-Topics-web-services/Fluid-Topics-calling-app"
                        placement="left"
                      />
                    )}
                    {app.info === 'crawler' && (
                      <InfoPopover
                        label="crawler API calls"
                        title="Why ‘crawler’ API calls may decrease since Feb 1, 2026"
                        body={[
                          'Previously, API calls without a calling app and identified as crawler activity where automatically assigned the "crawler" calling app.',
                          'Since Feb 1, 2026:',
                        ]}
                        bullets={[
                          'API calls related to public crawlers and generic AI bots not operated by your organization are excluded from the API calls count.',
                          'All other API calls without a calling app are categorized as "undefined".',
                        ]}
                        linkLabel="list of official public crawlers and generic AI bots"
                        linkHref="https://docs.fluidtopics.com/r/Fluid-Topics-Analytics-Guide/Analytics-dashboard/Traffic/API-calls/List-of-official-public-crawlers-and-generic-AI-bots"
                        placement="left"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ InfoPopover ------------------------------ */

function InfoPopover({ label, title, body = [], bullets = [], linkLabel, linkHref, placement = 'below' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span style={IP.wrap} ref={ref}>
      <button
        type="button"
        style={{
          ...IP.btn,
          background: open ? '#eff6ff' : 'transparent',
          color: open ? '#1d4ed8' : '#1d4ed8',
        }}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Open help: ${label}`}
        aria-expanded={open}
        title={`Open help: ${label}`}
      >
        <IconInfo />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          style={{
            ...IP.panel,
            ...(placement === 'left' ? IP.panelLeft : IP.panelBelow),
          }}
        >
          <div style={IP.panelHead}>
            <h4 style={IP.panelTitle}>{title}</h4>
            <button
              type="button"
              style={IP.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="close info"
              title="close info"
            >
              <IconClose />
            </button>
          </div>
          <div style={IP.panelBody}>
            {body.map((paragraph, i) => (
              <p key={i} style={IP.paragraph}>{paragraph}</p>
            ))}
            {bullets.length > 0 && (
              <ul style={IP.bullets}>
                {bullets.map((b, i) => <li key={i} style={IP.bulletItem}>{b}</li>)}
              </ul>
            )}
            {linkHref && (
              <p style={IP.linkLine}>
                <span>See </span>
                <a href={linkHref} target="_blank" rel="noopener noreferrer" style={IP.link}>
                  <span>{linkLabel}</span>
                  <span style={IP.linkIcon} aria-hidden="true"><IconExternal /></span>
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </span>
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

function ApiCallsChart({ series, stacked, empty }) {
  const width  = 1200;
  const height = 380;
  const padL   = 80;
  const padR   = 40;
  const padT   = 38;
  const padB   = 70;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yMax = Y_TICKS[Y_TICKS.length - 1];
  const yPos = (v) => {
    const norm = Math.max(0, Math.min(1, v / yMax));
    return padT + innerH - norm * innerH;
  };

  const labelTickIdx = useMemo(
    () => MONTH_LABELS.map((label) => MONTHS.indexOf(label)).filter((i) => i >= 0),
    [],
  );

  /* Bar geometry: each month gets a slot wider than the bar so there's visual
   * breathing room. In stacked mode the slot holds one bar; in grouped mode
   * the slot is split evenly across the visible series. */
  const slotW = innerW / MONTHS.length;
  const stackedBarW = Math.min(36, slotW * 0.7);
  const gap = stackedBarW * 0.3;
  const barOffset = (slotW - stackedBarW) / 2;

  const groupedBarW = series.length > 0
    ? Math.min(stackedBarW / series.length - 1, 12)
    : stackedBarW;

  const formatY = (v) => v.toLocaleString('en-US');

  /* Mini overview strip below the X axis, shaped from the dominant series
   * silhouette so it reads like a brushable range selector. */
  const stripTop = padT + innerH + 28;
  const stripH   = 22;
  const dominantTotals = useMemo(() => {
    return MONTHS.map((_, i) =>
      SERIES.reduce((acc, s) => acc + s.values[i], 0),
    );
  }, []);
  const stripMax = Math.max(...dominantTotals, 1);
  const stripPath = useMemo(() => {
    const points = dominantTotals.map((v, i) => {
      const x = padL + (i / (MONTHS.length - 1)) * innerW;
      const y = stripTop + stripH - (v / stripMax) * (stripH - 4);
      return `${x},${y}`;
    });
    return [
      `M ${padL},${stripTop + stripH}`,
      `L ${points.join(' L ')}`,
      `L ${padL + innerW},${stripTop + stripH} Z`,
    ].join(' ');
  }, [dominantTotals, stripMax, innerW, stripTop]);

  const lastIdx = MONTHS.length - 1;

  return (
    <div style={CS.wrap}>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
            CALLS
          </text>

          {Y_TICKS.map((t) => (
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

          {labelTickIdx.map((idx) => {
            const cx = padL + idx * slotW + slotW / 2;
            return (
              <g key={idx}>
                <line x1={cx} y1={padT + innerH} x2={cx} y2={padT + innerH + 5} stroke="#6e7079" />
                <text x={cx} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
                  {MONTHS[idx]}
                </text>
              </g>
            );
          })}

          {!empty && MONTHS.map((_, i) => {
            const x0 = padL + i * slotW + barOffset;
            const isLast = i === lastIdx;
            const opacity = isLast ? 0.5 : 1;

            if (stacked) {
              let runningY = padT + innerH;
              return (
                <g key={i} opacity={opacity}>
                  {series.map(({ key, label, color, values }) => {
                    const v = values[i];
                    if (!v) return null;
                    const h = (v / yMax) * innerH;
                    const yTop = runningY - h;
                    const rect = (
                      <rect
                        key={key}
                        x={x0}
                        y={yTop}
                        width={stackedBarW}
                        height={h}
                        fill={color}
                      >
                        <title>{`${label} — ${MONTHS[i]}: ${v.toLocaleString('en-US')}`}</title>
                      </rect>
                    );
                    runningY = yTop;
                    return rect;
                  })}
                </g>
              );
            }

            return (
              <g key={i} opacity={opacity}>
                {series.map(({ key, label, color, values }, sIdx) => {
                  const v = values[i];
                  if (!v) return null;
                  const h = (v / yMax) * innerH;
                  const xj = x0 + sIdx * (groupedBarW + 1);
                  return (
                    <rect
                      key={key}
                      x={xj}
                      y={(padT + innerH) - h}
                      width={Math.max(2, groupedBarW)}
                      height={h}
                      fill={color}
                    >
                      <title>{`${label} — ${MONTHS[i]}: ${v.toLocaleString('en-US')}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}

          {empty && (
            <text x={padL + innerW / 2} y={padT + innerH / 2} fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="Inter, sans-serif">
              No calling apps selected
            </text>
          )}

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

  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    transition: 'color 120ms ease, border-color 120ms ease',
  },
  tabIcon: { display: 'inline-flex' },

  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: '#475569',
    flex: 1,
  },
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

  detailsBody: { padding: '40px 22px', display: 'flex', justifyContent: 'center' },
  detailsEmpty: { fontSize: '0.9rem', color: '#64748b', margin: 0 },

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

  selectAllRow: { paddingTop: '4px', paddingBottom: '6px', marginBottom: '4px' },

  appList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  appRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    paddingRight: '4px',
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
    flex: 1,
    minWidth: 0,
  },
  colorDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '2px',
    flexShrink: 0,
  },
};

const IP = {
  wrap: { position: 'relative', display: 'inline-flex', flexShrink: 0 },
  btn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
  },
  panel: {
    position: 'absolute',
    width: '320px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)',
    zIndex: 60,
  },
  panelBelow: { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
  panelLeft:  { top: '50%', right: 'calc(100% + 6px)', transform: 'translateY(-50%)' },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  panelTitle: { margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.35 },
  closeBtn: {
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
  },
  panelBody: {
    padding: '10px 12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.8rem',
    color: '#1e293b',
    lineHeight: 1.5,
  },
  paragraph: { margin: 0 },
  bullets: {
    margin: 0,
    paddingLeft: '20px',
    listStyleType: 'circle',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bulletItem: { color: '#1e293b' },
  linkLine: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#475569',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#1d4ed8',
    textDecoration: 'underline',
    fontWeight: 500,
  },
  linkIcon: { display: 'inline-flex', color: '#1d4ed8' },
};

const CK = {
  box: {
    width: '16px',
    height: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #94a3b8',
    borderRadius: '4px',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  dash: {
    width: '8px',
    height: '2px',
    background: '#ffffff',
    borderRadius: '1px',
  },
};

const CS = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '14px' },
  svgWrap: { width: '100%', overflow: 'hidden' },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px 22px',
    padding: '0 8px',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    color: '#1e293b',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
};
