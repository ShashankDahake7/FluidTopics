'use client';
import { useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Constants ------------------------------ */

const MONTHS = [
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025',   'February 2025', 'March 2025',    'April 2025',
  'May 2025',       'June 2025',     'July 2025',     'August 2025',
  'September 2025', 'October 2025',  'November 2025', 'December 2025',
  'January 2026',   'February 2026', 'March 2026',    'April 2026',
];

/*
 * Mock series derived from the Angular blueprint bar heights.
 * Y axis spans 0 → 21,000 (per the rendered chart).
 * Last month is the "ongoing period" — rendered with a lighter fill.
 */
const VALUES = [
  12431, 12899, 13884, 14365, 18103,
  16350, 14905, 15968, 15750, 14500,
  17578, 15524, 15615, 15899, 15620,
  13371, 14455, 14841, 15647, 12022,
];

const X_AXIS_LABELS = [
  'September 2024', 'November 2024', 'January 2025', 'March 2025',
  'May 2025',       'July 2025',     'September 2025', 'November 2025',
  'January 2026',   'March 2026',
];

const Y_TICKS = [0, 3000, 6000, 9000, 12000, 15000, 18000, 21000];

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const BAR_COLOR = '#9D207B';
const BAR_COLOR_ONGOING = '#D395C2';

/* ------------------------------ Icons ------------------------------ */

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function SessionsPage() {
  const [period, setPeriod] = useState('MONTHLY');

  return (
    <AnalyticsShell
      active="sessions"
      breadcrumb={{ prefix: 'Traffic', title: 'Sessions' }}
      feedbackSubject="Feedback about sessions"
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>How many sessions were opened in your portal last year?</span>
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
              <SessionsBarChart values={VALUES} months={MONTHS} />
            </div>
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Chart ------------------------------ */

function SessionsBarChart({ values, months }) {
  const width = 1100;
  const height = 360;
  const padL = 80;
  const padR = 24;
  const padT = 40;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yMax = Y_TICKS[Y_TICKS.length - 1];
  const slotW = innerW / values.length;
  const barW = slotW * 0.62;

  const xCenter = (i) => padL + slotW * (i + 0.5);
  const yPos = (v) => padT + innerH - (v / yMax) * innerH;

  const labelIdx = X_AXIS_LABELS.map((label) => months.indexOf(label)).filter((i) => i >= 0);

  const ongoingX = xCenter(values.length - 1) - slotW / 2;
  const lastTickX = xCenter(values.length - 2) - slotW / 2;

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

      {labelIdx.map((idx) => (
        <g key={idx}>
          <line x1={xCenter(idx)} y1={padT + innerH} x2={xCenter(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
          <text x={xCenter(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
            {months[idx]}
          </text>
        </g>
      ))}

      <rect
        x={lastTickX}
        y={padT - 10}
        width={ongoingX - lastTickX + slotW}
        height={innerH + 10}
        fill="rgba(33,150,243,0.06)"
      />
      <text x={(lastTickX + ongoingX + slotW) / 2 + slotW / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
        Ongoing period
      </text>

      {values.map((v, i) => {
        const isOngoing = i === values.length - 1;
        const x = xCenter(i) - barW / 2;
        const y = yPos(v);
        const h = padT + innerH - y;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={isOngoing ? BAR_COLOR_ONGOING : BAR_COLOR}
              rx={1.5}
            >
              <title>{`${months[i]}: ${v.toLocaleString('en-US')}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
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
  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 18px',
  },
};
