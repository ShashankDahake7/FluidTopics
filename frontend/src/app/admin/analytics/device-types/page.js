'use client';

import { useMemo, useState } from 'react';
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

const Y_TICKS = [0, 2000, 4000, 6000, 8000, 10000, 12000];

const PERIOD_OPTIONS = [
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

/* ------------------------------ Device data ------------------------------ */

const DEVICES = [
  { key: 'desktop', label: 'Desktop', color: '#9D207B' },
  { key: 'tablet',  label: 'Tablet',  color: '#CFB017' },
  { key: 'mobile',  label: 'Mobile',  color: '#361FAD' },
];

/* Mock monthly sessions per device, calibrated to the visible curves and
 * tooltip values from the Angular blueprint (e.g. November 2024:
 * Desktop 7,590 / Tablet 5,521 / Mobile 167). */
const SERIES = {
  desktop: [6303, 6658, 7590, 8089, 10191, 9127, 8693, 8919, 8486, 7728, 9323, 8007, 7727, 7866, 7958, 6895, 7533, 7646, 8257, 6134],
  tablet:  [5429, 5326, 5521, 5588, 6975, 6453, 5560, 6247, 6443, 5991, 7268, 6434, 6881, 6711, 6442, 5556, 5814, 5922, 6312, 4937],
  mobile:  [151, 164, 167, 191, 153, 124, 165, 160, 171, 173, 218, 236, 151, 222, 178, 147, 146, 150, 158, 148],
};

const TABS = [
  { value: 'EVOLUTION',    label: 'Evolution',    icon: 'line' },
  { value: 'DISTRIBUTION', label: 'Distribution', icon: 'bar'  },
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

const IconLineChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 17 9 11 13 15 21 7" />
  </svg>
);

const IconBarNormalized = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="3" y="4" width="4" height="6" fill="currentColor" stroke="none" />
    <rect x="3" y="10" width="4" height="5" fill="currentColor" opacity="0.55" stroke="none" />
    <rect x="3" y="15" width="4" height="5" fill="currentColor" opacity="0.3" stroke="none" />
    <rect x="10" y="4" width="4" height="9" fill="currentColor" stroke="none" />
    <rect x="10" y="13" width="4" height="4" fill="currentColor" opacity="0.55" stroke="none" />
    <rect x="10" y="17" width="4" height="3" fill="currentColor" opacity="0.3" stroke="none" />
    <rect x="17" y="4" width="4" height="11" fill="currentColor" stroke="none" />
    <rect x="17" y="15" width="4" height="3" fill="currentColor" opacity="0.55" stroke="none" />
    <rect x="17" y="18" width="4" height="2" fill="currentColor" opacity="0.3" stroke="none" />
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

const IconInfoCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconExternal = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <line x1="10" y1="14" x2="21" y2="3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function DeviceTypesPage() {
  const [tab, setTab] = useState('EVOLUTION');
  const [period, setPeriod] = useState('MONTHLY');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selected, setSelected] = useState(() => new Set(DEVICES.map((d) => d.key)));

  const allOn = selected.size === DEVICES.length;
  const noneOn = selected.size === 0;

  const toggleAll = () => {
    setSelected(allOn ? new Set() : new Set(DEVICES.map((d) => d.key)));
  };
  const toggleOne = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleDevices = useMemo(
    () => DEVICES.filter((d) => selected.has(d.key)),
    [selected],
  );

  return (
    <AnalyticsShell
      active="device-types"
      breadcrumb={{ prefix: 'Traffic', title: 'Device types' }}
      feedbackSubject="Feedback about device types evolution"
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
          <nav role="tablist" aria-label="Device types view" style={PS.tabBar}>
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  style={{
                    ...PS.tab,
                    color: active ? '#1d4ed8' : '#475569',
                    borderBottomColor: active ? '#1d4ed8' : 'transparent',
                  }}
                >
                  <span style={PS.tabIcon}>
                    {t.icon === 'line' ? <IconLineChart /> : <IconBarNormalized />}
                  </span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {tab === 'EVOLUTION' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>
                  Evolution of sessions per device type.
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
                  <EvolutionChart devices={visibleDevices} empty={noneOn} />
                </div>
              </section>
            </>
          )}

          {tab === 'DISTRIBUTION' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>
                  Distribution of sessions per device type.
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
                  <DistributionChart devices={visibleDevices} empty={noneOn} />
                </div>
              </section>
            </>
          )}
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter device types">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter device types</h3>
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
              <div style={PS.notice}>
                <span style={PS.noticeIcon} aria-hidden="true"><IconInfoCircle /></span>
                <span style={PS.noticeBody}>
                  See{' '}
                  <a
                    href="https://doc.fluidtopics.com/access?ft:originId=device-categorization"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={PS.noticeLink}
                  >
                    <span>Device types documentation</span>
                    <IconExternal />
                  </a>
                </span>
              </div>

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

              <ul style={PS.list}>
                {DEVICES.map((d) => (
                  <li key={d.key}>
                    <label style={PS.checkRow}>
                      <Checkbox
                        checked={selected.has(d.key)}
                        onChange={() => toggleOne(d.key)}
                      />
                      <span style={{ ...PS.colorDot, background: d.color }} aria-hidden="true" />
                      <span>{d.label}</span>
                    </label>
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

/* ------------------------------ Evolution chart ------------------------------ */

function EvolutionChart({ devices, empty }) {
  const width = 1200;
  const height = 320;
  const padL = 80;
  const padR = 28;
  const padT = 38;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yMax = Y_TICKS[Y_TICKS.length - 1];
  const xStep = innerW / (MONTHS.length - 1);
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => padT + innerH - (v / yMax) * innerH;

  const labelTickIdx = useMemo(
    () => MONTH_LABELS.map((label) => MONTHS.indexOf(label)).filter((i) => i >= 0),
    [],
  );

  const ongoingX = xPos(MONTHS.length - 1);
  const lastTickX = xPos(MONTHS.length - 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
        SESSIONS
      </text>

      {Y_TICKS.map((t) => (
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

      {!empty && devices.map(({ key, label, color }) => {
        const values = SERIES[key];
        const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
        return (
          <g key={key}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={xPos(i)}
                cy={yPos(v)}
                r="3.5"
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
          No device types selected
        </text>
      )}
    </svg>
  );
}

/* ------------------------------ Distribution chart ------------------------------ */

function DistributionChart({ devices, empty }) {
  const width = 1200;
  const height = 320;
  const padL = 80;
  const padR = 28;
  const padT = 36;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const labelTickIdx = useMemo(
    () => MONTH_LABELS.map((label) => MONTHS.indexOf(label)).filter((i) => i >= 0),
    [],
  );

  /* For each month compute the share of selected device types so each bar
   * stacks to 100%. */
  const bars = useMemo(() => {
    return MONTHS.map((_m, monthIdx) => {
      const totals = devices.map((d) => SERIES[d.key][monthIdx]);
      const sum = totals.reduce((s, v) => s + v, 0) || 1;
      let cursor = 0;
      const segs = devices.map((d, i) => {
        const v = SERIES[d.key][monthIdx];
        const frac = v / sum;
        const seg = { device: d, value: v, frac, start: cursor };
        cursor += frac;
        seg.end = cursor;
        return seg;
      });
      return { idx: monthIdx, segs, total: sum };
    });
  }, [devices]);

  const PCT_TICKS = [0, 25, 50, 75, 100];
  const yPos = (pct) => padT + innerH * (1 - pct / 100);

  /* Bar layout: ~12px wide bars with gap. */
  const barCount = MONTHS.length;
  const barW = Math.min(28, (innerW / barCount) * 0.6);
  const xCentre = (i) => padL + ((i + 0.5) / barCount) * innerW;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
        SHARE
      </text>

      {PCT_TICKS.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
          <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
            {t}%
          </text>
        </g>
      ))}

      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6e7079" />
      <text x={padL + innerW + 6} y={padT + innerH + 3} fontSize="11" fill="#6E7079" fontFamily="Inter, sans-serif">
        DATE
      </text>

      {labelTickIdx.map((idx) => (
        <g key={idx}>
          <line x1={xCentre(idx)} y1={padT + innerH} x2={xCentre(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
          <text x={xCentre(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
            {MONTHS[idx]}
          </text>
        </g>
      ))}

      {!empty && bars.map(({ idx, segs, total }) => (
        <g key={idx}>
          {segs.map((seg) => (
            <rect
              key={seg.device.key}
              x={xCentre(idx) - barW / 2}
              y={padT + innerH * seg.start}
              width={barW}
              height={Math.max(0.5, innerH * (seg.end - seg.start))}
              fill={seg.device.color}
            >
              <title>
                {`${seg.device.label} — ${MONTHS[idx]}: ${seg.value.toLocaleString('en-US')} (${(seg.frac * 100).toFixed(1)}%)`}
              </title>
            </rect>
          ))}
        </g>
      ))}

      {empty && (
        <text x={padL + innerW / 2} y={padT + innerH / 2} fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="Inter, sans-serif">
          No device types selected
        </text>
      )}
    </svg>
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

  tabBar: {
    display: 'flex',
    gap: '4px',
    padding: '4px 16px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
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

  notice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    color: '#0c4a6e',
    fontSize: '0.82rem',
    lineHeight: 1.45,
  },
  noticeIcon: { color: '#1d4ed8', display: 'inline-flex', flexShrink: 0, marginTop: '1px' },
  noticeBody: { color: '#1f2937' },
  noticeLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#1d4ed8',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '2px',
    fontWeight: 500,
  },

  selectAllRow: { paddingTop: '14px', paddingBottom: '6px', marginBottom: '4px' },
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
    flexShrink: 0,
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
