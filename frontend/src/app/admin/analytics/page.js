'use client';
import { useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

const TOP_DOCUMENTS = [
  { views: 6106, title: 'Release Notes Feb 2026' },
  { views: 1709, title: 'Company' },
  { views: 1700, title: 'Darwinbox FAQs Articles' },
  { views: 1333, title: 'Darwinbox Troubleshooting Articles' },
  { views: 1018, title: 'Recruitment' },
  { views: 1013, title: 'Performance' },
  { views: 907,  title: 'Leave' },
  { views: 879,  title: 'Reports Builder' },
  { views: 834,  title: 'Import' },
  { views: 833,  title: 'Payroll' },
  { views: 798,  title: 'Attendance' },
  { views: 733,  title: 'Release Notes Nov 2025' },
  { views: 666,  title: 'Darwinbox Studio' },
  { views: 630,  title: 'HR Documents' },
  { views: 579,  title: 'Release Notes May 2025' },
  { views: 579,  title: 'Employees' },
  { views: 570,  title: 'Workflow: Custom Workflow' },
  { views: 490,  title: 'Onboarding' },
  { views: 448,  title: 'Best Practices' },
  { views: 432,  title: 'Release Notes May 2023' },
  { views: 387,  title: 'Release Notes Feb 2025' },
  { views: 366,  title: 'Form Builder' },
  { views: 357,  title: 'Permissions' },
  { views: 345,  title: 'Release Notes August 2025' },
  { views: 317,  title: 'My Access' },
  { views: 299,  title: 'Talent Management' },
  { views: 292,  title: 'Workflow: Standard Workflow' },
  { views: 258,  title: 'Release Notes November 2024' },
  { views: 255,  title: 'People Analytics' },
  { views: 250,  title: '100 Features' },
];

// 20 monthly data points covering Sep 2024 → Apr 2026 (current month, semi-transparent).
const SESSIONS = [
  { month: 'Sep 2024', value: 12433 },
  { month: 'Oct 2024', value: 12901 },
  { month: 'Nov 2024', value: 13886 },
  { month: 'Dec 2024', value: 14367 },
  { month: 'Jan 2025', value: 18106 },
  { month: 'Feb 2025', value: 16353 },
  { month: 'Mar 2025', value: 14907 },
  { month: 'Apr 2025', value: 15974 },
  { month: 'May 2025', value: 15756 },
  { month: 'Jun 2025', value: 14500 },
  { month: 'Jul 2025', value: 17581 },
  { month: 'Aug 2025', value: 15529 },
  { month: 'Sep 2025', value: 15620 },
  { month: 'Oct 2025', value: 15904 },
  { month: 'Nov 2025', value: 15625 },
  { month: 'Dec 2025', value: 13375 },
  { month: 'Jan 2026', value: 14456 },
  { month: 'Feb 2026', value: 14844 },
  { month: 'Mar 2026', value: 15652 },
  { month: 'Apr 2026', value: 12017 },
];

const formatNumber = (n) => n.toLocaleString('en-US');

function TrendCard({ label, value, trend }) {
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.trendRow}>
        <span style={S.trendValue}>{formatNumber(value)}</span>
        <span style={{ ...S.trendArrow, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>{trend >= 0 ? '↗' : '↘'}</span>
        <span style={{ ...S.trendDelta, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>{trend >= 0 ? `+${trend}%` : `${trend}%`}</span>
      </div>
    </div>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function MostViewedDocsCard() {
  return (
    <div style={{ ...S.card, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 8px' }}>
        <div style={S.cardLabel}>Most viewed documents</div>
      </div>
      <div style={S.docsScroll}>
        <table style={S.docsTable}>
          <tbody>
            {TOP_DOCUMENTS.map((d, i) => (
              <tr key={i} style={S.docsRow}>
                <td style={S.docsViews}>{formatNumber(d.views)}</td>
                <td style={S.docsIconCell}><BookIcon /></td>
                <td style={S.docsTitle}>{d.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={S.docsFooter}>
        <button type="button" style={S.viewAllBtn}>View All</button>
      </div>
    </div>
  );
}

function SessionsChart() {
  const chartRef = useRef(null);
  const [hover, setHover] = useState(null);

  // Inner padding inside the SVG viewbox.
  const W = 760;
  const H = 360;
  const PAD_L = 60;
  const PAD_R = 24;
  const PAD_T = 32;
  const PAD_B = 40;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const max = useMemo(() => {
    const v = Math.max(...SESSIONS.map((s) => s.value));
    // Round up to nearest 3000 multiple, with extra headroom — produces 21,000 for the dataset.
    const step = 3000;
    return Math.ceil((v * 1.16) / step) * step;
  }, []);

  const ticks = useMemo(() => {
    const step = 3000;
    const out = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  }, [max]);

  const N = SESSIONS.length;
  const slot = innerW / N;
  const barW = slot * 0.7;
  const labelMonths = ['Sep 2024', 'Jan 2025', 'May 2025', 'Sep 2025', 'Jan 2026'];

  return (
    <div style={S.chartWrap} ref={chartRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Monthly sessions chart">
        {/* y-axis ticks + grid */}
        {ticks.map((t) => {
          const y = PAD_T + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#E0E6F1" />
              <text x={PAD_L - 8} y={y} dominantBaseline="middle" textAnchor="end" fontSize="12" fill="#6E7079">
                {t === 0 ? '0' : formatNumber(t)}
              </text>
            </g>
          );
        })}

        {/* y-axis title */}
        <text x={PAD_L} y={PAD_T - 18} fontSize="12" fill="#6E7079" textAnchor="middle">SESSIONS</text>

        {/* x-axis baseline */}
        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#6E7079" />

        {/* x-axis title */}
        <text x={W - PAD_R + 6} y={PAD_T + innerH} dominantBaseline="middle" fontSize="12" fill="#6E7079">DATE</text>

        {/* Bars */}
        {SESSIONS.map((s, i) => {
          const h = (s.value / max) * innerH;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + innerH - h;
          const isLast = i === SESSIONS.length - 1;
          return (
            <g
              key={s.month}
              onMouseEnter={() => setHover({ i, x: x + barW / 2, y, value: s.value, month: s.month })}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="#9D207B"
                fillOpacity={isLast ? 0.5 : 1}
                style={{ cursor: 'pointer' }}
              />
              <rect
                x={x - 1}
                y={PAD_T}
                width={barW + 2}
                height={innerH}
                fill="rgba(0,0,0,0)"
                onMouseEnter={() => setHover({ i, x: x + barW / 2, y, value: s.value, month: s.month })}
              />
            </g>
          );
        })}

        {/* x-axis labels (every ~4th month) */}
        {SESSIONS.map((s, i) => {
          if (!labelMonths.includes(s.month)) return null;
          const cx = PAD_L + i * slot + slot / 2;
          return (
            <g key={`lbl-${s.month}`}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 18} fontSize="12" fill="#6E7079" textAnchor="middle">
                {s.month.replace(/^(\w+) (\d+)$/, (_m, mn, yr) => `${monthName(mn)} ${yr}`)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          style={{
            ...S.tooltip,
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
          }}
        >
          {formatNumber(hover.value)} session{hover.value === 1 ? '' : 's'} opened in {monthFull(hover.month)}
        </div>
      )}
    </div>
  );
}

function monthName(short) {
  const map = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
  return map[short] || short;
}
function monthFull(label) {
  const [mn, yr] = label.split(' ');
  return `${monthName(mn)} ${yr}`;
}

export default function AnalyticsHomePage() {
  const currentMonth = useMemo(() => {
    const m = new Date().toLocaleString('en-US', { month: 'long' });
    return m;
  }, []);

  return (
    <AnalyticsShell active="home" breadcrumb="Home">
      <div style={S.dashboard}>
        <div style={S.row}>
          <div style={S.recapColumn}>
            <div style={S.colTitle}>Views in {currentMonth}</div>
            <TrendCard label="Document views" value={29982} trend={5} />
            <TrendCard label="Topic views" value={76468} trend={1} />
            <MostViewedDocsCard />
          </div>

          <div style={S.chartColumn}>
            <div style={S.colTitle}>Sessions</div>
            <div style={{ ...S.card, padding: '14px 18px 18px' }}>
              <SessionsChart />
            </div>
          </div>
        </div>
      </div>
    </AnalyticsShell>
  );
}

const S = {
  dashboard: {
    padding: '20px 22px 28px',
    minHeight: '100%',
    background: '#f8fafc',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 360px) 1fr',
    gap: '20px',
    alignItems: 'flex-start',
  },
  recapColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 0,
  },
  chartColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
  },
  colTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 18px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  cardLabel: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  trendRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginTop: '6px',
  },
  trendValue: { fontSize: '1.7rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' },
  trendArrow: { fontSize: '1.05rem', fontWeight: 700 },
  trendDelta: { fontSize: '0.85rem', fontWeight: 600 },

  docsScroll: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '420px',
    padding: '0 6px 6px',
  },
  docsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  docsRow: { borderBottom: '1px solid #f1f5f9' },
  docsViews: {
    padding: '8px 10px 8px 18px',
    color: '#0f172a',
    fontWeight: 600,
    width: '64px',
    textAlign: 'right',
  },
  docsIconCell: {
    padding: '8px 4px',
    width: '24px',
    color: '#475569',
  },
  docsTitle: {
    padding: '8px 10px',
    color: '#1d4ed8',
    cursor: 'pointer',
  },
  docsFooter: {
    borderTop: '1px solid #e2e8f0',
    padding: '8px 0',
    display: 'flex',
    justifyContent: 'center',
  },
  viewAllBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    color: '#1d4ed8',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  chartWrap: {
    position: 'relative',
    width: '100%',
  },
  tooltip: {
    position: 'absolute',
    transform: 'translate(-50%, calc(-100% - 10px))',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#ffffff',
    fontSize: '0.78rem',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(81, 77, 77, 0.8)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 8px rgba(0, 0, 0, 0.18)',
  },
};
