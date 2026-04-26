'use client';
import { useMemo, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Constants ------------------------------ */

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

// Mock series mapped from the Angular blueprint chart geometry.
const SERIES = [
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    color: '#9D207B',
    values: [317, 394, 432, 476, 533, 560, 575, 597, 620, 635, 667, 676, 688, 713, 735, 761, 796, 809, 845, 872],
  },
  {
    key: 'personal-books',
    label: 'Personal books',
    color: '#CFB017',
    values: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    key: 'personal-topics',
    label: 'Personal topics',
    color: '#361FAD',
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: 'all-saved-searches',
    label: 'All saved searches',
    color: '#45A191',
    values: [61, 56, 56, 56, 55, 57, 58, 58, 58, 60, 70, 71, 72, 73, 73, 76, 76, 79, 81, 86],
  },
  {
    key: 'saved-searches-with-alerts',
    label: 'Saved searches with alerts',
    color: '#BD0F49',
    values: [45, 41, 44, 44, 46, 48, 49, 49, 49, 51, 61, 62, 63, 64, 64, 65, 65, 67, 69, 73],
  },
  {
    key: 'collections',
    label: 'Collections',
    color: '#7A891A',
    values: [3, 3, 4, 4, 4, 4, 4, 5, 8, 8, 9, 10, 11, 11, 11, 11, 13, 14, 15, 16],
  },
];

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const Y_TICKS_LINEAR = [0, 200, 400, 600, 800, 1000];
const Y_TICKS_LOG = [1, 10, 100, 1000];

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

/* ------------------------------ Page ------------------------------ */

export default function UserAssetsPage() {
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selected, setSelected] = useState(() => new Set(SERIES.map((s) => s.key)));

  const allSelected = selected.size === SERIES.length;
  const noneSelected = selected.size === 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(SERIES.map((s) => s.key)));
  };

  const toggleOne = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = useMemo(
    () => SERIES.filter((s) => selected.has(s.key)),
    [selected],
  );

  return (
    <AnalyticsShell
      active="user-assets"
      breadcrumb={{ prefix: 'Users', title: 'User assets' }}
      feedbackSubject="Feedback about user assets"
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
              Data is based on the types of user assets created in the portal.
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
              <UserAssetChart
                series={visible}
                stacked={stacked}
                logScale={logScale}
                empty={noneSelected}
              />
            </div>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter asset types">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter asset types</h3>
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
              <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && !noneSelected}
                  onChange={toggleAll}
                />
                <span>Select all</span>
              </label>

              <ul style={PS.list}>
                {SERIES.map((s) => (
                  <li key={s.key}>
                    <label style={PS.checkRow}>
                      <Checkbox
                        checked={selected.has(s.key)}
                        onChange={() => toggleOne(s.key)}
                      />
                      <span style={{ ...PS.colorDot, background: s.color }} aria-hidden="true" />
                      <span>{s.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <footer style={PS.drawerFoot}>
              <button type="button" style={PS.applyBtn}>
                Apply
              </button>
            </footer>
          </aside>
        )}
      </div>
    </AnalyticsShell>
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
      {indeterminate ? (
        <span style={CK.dash} />
      ) : checked ? (
        <IconCheck />
      ) : null}
    </span>
  );
}

/* ------------------------------ Chart ------------------------------ */

function UserAssetChart({ series, stacked, logScale, empty }) {
  const width = 1100;
  const height = 360;
  const padL = 70;
  const padR = 24;
  const padT = 36;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yTicks = logScale ? Y_TICKS_LOG : Y_TICKS_LINEAR;

  const transform = (v) => {
    if (logScale) return Math.log10(Math.max(v, 1));
    return v;
  };

  const yMin = logScale ? 0 : 0;
  const yMax = logScale ? Math.log10(yTicks[yTicks.length - 1]) : yTicks[yTicks.length - 1];

  const xStep = innerW / (MONTHS.length - 1);
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => {
    const t = transform(v);
    if (yMax === yMin) return padT + innerH;
    const norm = (t - yMin) / (yMax - yMin);
    return padT + innerH - Math.max(0, Math.min(1, norm)) * innerH;
  };

  const stackedSeries = useMemo(() => {
    if (!stacked) return series;
    const running = MONTHS.map(() => 0);
    return series.map(({ label, color, key, values }) => {
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

  return (
    <div style={CS.wrap}>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          <text x={padL} y={padT - 16} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
            USER ASSET COUNT
          </text>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
              <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
                {t.toLocaleString('en-US')}
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

          <rect x={lastTickX} y={padT - 10} width={ongoingX - lastTickX} height={innerH + 10} fill="rgba(33,150,243,0.06)" />
          <text x={(lastTickX + ongoingX) / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
            Ongoing period
          </text>

          {!empty && stackedSeries.map(({ key, label, color, values }) => {
            const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            return (
              <g key={key}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
                {values.map((v, i) => (
                  <circle
                    key={i}
                    cx={xPos(i)}
                    cy={yPos(v)}
                    r="3.2"
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
              No asset types selected
            </text>
          )}
        </svg>
      </div>

      <div style={CS.legend}>
        {series.map(({ key, label, color }) => (
          <span key={key} style={CS.legendItem}>
            <span style={{ ...CS.legendDot, background: color }} />
            <span>{label}</span>
          </span>
        ))}
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
  drawerTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#0f172a',
  },
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
    padding: '14px 18px 18px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: '8px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 4px',
    fontSize: '0.85rem',
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
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
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
