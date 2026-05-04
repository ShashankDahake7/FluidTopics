'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

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

function MostViewedDocsCard({ docs = [] }) {
  return (
    <div style={{ ...S.card, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 8px' }}>
        <div style={S.cardLabel}>Most viewed documents</div>
      </div>
      <div style={S.docsScroll}>
        <table style={S.docsTable}>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} style={S.docsRow}>
                <td style={S.docsViews}>{formatNumber(d.viewCount || 0)}</td>
                <td style={S.docsIconCell}><BookIcon /></td>
                <td style={S.docsTitle}>{d.title}</td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No document views yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={S.docsFooter}>
        <button type="button" style={S.viewAllBtn}>View All</button>
      </div>
    </div>
  );
}

function SessionsChart({ statsData = [], type = 'daily' }) {
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
    if (!statsData.length) return 10;
    const v = Math.max(...statsData.map((s) => s.views));
    if (v === 0) return 10;
    // Round up with headroom
    const step = Math.max(10, Math.pow(10, Math.floor(Math.log10(v || 1))));
    return Math.max(10, Math.ceil((v * 1.2) / step) * step);
  }, [statsData]);

  const ticks = useMemo(() => {
    const step = max / 4;
    const out = [];
    for (let v = 0; v <= max; v += step) out.push(Math.round(v));
    return out;
  }, [max]);

  const N = Math.max(7, statsData.length);
  const slot = innerW / N;
  const barW = slot * 0.7;

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
        {statsData.map((s, i) => {
          const h = (s.views / max) * innerH;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + innerH - h;
          const isLast = i === statsData.length - 1;
          const label = type === 'daily' ? s.date : s.month;
          return (
            <g
              key={label}
              onMouseEnter={() => setHover({ i, x: x + barW / 2, y, value: s.views, label })}
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
                onMouseEnter={() => setHover({ i, x: x + barW / 2, y, value: s.views, label })}
              />
            </g>
          );
        })}

        {/* x-axis labels */}
        {statsData.map((s, i) => {
          if (i % Math.max(1, Math.floor(N / 6)) !== 0 && i !== N - 1) return null;
          const cx = PAD_L + i * slot + slot / 2;
          
          let displayLabel = '';
          if (type === 'daily') {
            displayLabel = s.date.substring(5); // MM-DD
          } else {
            // s.month is YYYY-MM
            const [yr, mn] = s.month.split('-');
            const shortMn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(mn, 10) - 1];
            displayLabel = `${shortMn} ${yr}`;
          }

          return (
            <g key={`lbl-${type === 'daily' ? s.date : s.month}`}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 18} fontSize="12" fill="#6E7079" textAnchor="middle">
                {displayLabel}
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
          {formatNumber(hover.value)} views on {hover.label}
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
  const [stats, setStats] = useState(null);
  const [chartType, setChartType] = useState('daily'); // 'daily' or 'monthly'

  useEffect(() => {
    api.get('/analytics/dashboard?days=30').then(setStats).catch(() => {});
  }, []);

  const currentMonth = useMemo(() => {
    const m = new Date().toLocaleString('en-US', { month: 'long' });
    return m;
  }, []);

  return (
    <AnalyticsShell active="home" breadcrumb="Home">
      <div style={S.dashboard}>
        <Link href="/admin/analytics/posthog" style={S.posthogBanner}>
          <div>
            <div style={S.posthogBannerTitle}>PostHog</div>
            <div style={S.posthogBannerText}>
              Live product analytics, sessions, and funnels — open the PostHog dashboard.
            </div>
          </div>
          <span style={S.posthogBannerCta}>Open →</span>
        </Link>
        <div style={S.row}>
          <div style={S.recapColumn}>
            <div style={S.colTitle}>Views in last 30 days</div>
            <TrendCard label="Document views" value={stats?.documentViews || 0} trend={0} />
            <TrendCard label="Topic views" value={stats?.totalViews || 0} trend={0} />
            <MostViewedDocsCard docs={stats?.topViewedDocuments || []} />
          </div>

          <div style={S.chartColumn}>
            <div style={S.chartHeader}>
              <div style={S.colTitle}>Sessions</div>
              <div style={S.toggleWrapper}>
                <button
                  style={{ ...S.toggleBtn, ...(chartType === 'daily' ? S.toggleBtnActive : {}) }}
                  onClick={() => setChartType('daily')}
                >
                  Daily
                </button>
                <button
                  style={{ ...S.toggleBtn, ...(chartType === 'monthly' ? S.toggleBtnActive : {}) }}
                  onClick={() => setChartType('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div style={{ ...S.card, padding: '14px 18px 18px' }}>
              <SessionsChart
                statsData={chartType === 'daily' ? (stats?.dailyStats || []) : (stats?.monthlyStats || [])}
                type={chartType}
              />
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
  posthogBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '20px',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    border: '1px solid #ddd6fe',
    borderRadius: '12px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'box-shadow 0.15s ease',
    boxShadow: '0 1px 2px rgba(91, 33, 182, 0.06)',
  },
  posthogBannerTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#5b21b6',
    marginBottom: '4px',
  },
  posthogBannerText: {
    fontSize: '0.88rem',
    color: '#6d28d9',
    lineHeight: 1.45,
    maxWidth: '520px',
  },
  posthogBannerCta: {
    flexShrink: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#7c3aed',
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
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleWrapper: {
    display: 'flex',
    background: '#e2e8f0',
    borderRadius: '6px',
    padding: '2px',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    padding: '4px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
};
