'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

/* ------------------------------ Constants ------------------------------ */

const BAR_COLOR = '#9D207B';
const BAR_COLOR_ONGOING = '#D395C2';

const PERIOD_OPTIONS = [
  { value: 'day',   label: 'Daily' },
  { value: 'month', label: 'Monthly' },
];

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
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - (period === 'day' ? 2 : 20));

      const json = await api.post('/analytics/v2/traffic/sessions', {
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        groupByPeriod: period,
      });

      if (json.results) {
        setData(json.results);
      } else if (json.error) {
        setErrorMsg(json.error);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const months = useMemo(
    () =>
      data.map((p) =>
        new Date(p.periodStartDate).toLocaleDateString('en-US', {
          month: period === 'day' ? 'short' : 'long',
          year: 'numeric',
          ...(period === 'day' && { day: 'numeric' }),
        })
      ),
    [data, period]
  );

  const values = useMemo(() => data.map((p) => p.sessionCount), [data]);

  return (
    <AnalyticsShell
      active="sessions"
      breadcrumb={{ prefix: 'Traffic', title: 'Sessions' }}
      feedbackSubject="Feedback about sessions"
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>How many sessions were opened in your portal?</span>
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
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading…</div>
            ) : errorMsg ? (
              <div style={{ padding: '40px', color: '#dc2626' }}>Error: {errorMsg}</div>
            ) : values.length === 0 ? (
              <div style={{ padding: '40px', color: '#64748b' }}>No session data available for the selected period.</div>
            ) : (
              <div style={PS.chartCard}>
                <SessionsBarChart values={values} months={months} />
              </div>
            )}
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Chart ------------------------------ */

function SessionsBarChart({ values, months }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ W: 1100, H: 380 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setDims({ W: width, H: height });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { W, H } = dims;
  const padL = 80;
  const padR = 24;
  const padT = 40;
  const padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Auto-scale Y axis
  const rawMax = Math.max(...values, 1);
  const step = rawMax <= 50 ? 10 : rawMax <= 500 ? 50 : rawMax <= 5000 ? 1000 : 3000;
  const yMax = Math.max(step, Math.ceil((rawMax * 1.15) / step) * step);
  const yTicks = [];
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  const slotW = values.length > 0 ? innerW / values.length : innerW;
  const barW = slotW * 0.62;

  const xCenter = (i) => padL + slotW * (i + 0.5);
  const yPos = (v) => padT + innerH - (v / yMax) * innerH;

  // Show subset of x labels to avoid overlap
  const labelCount = Math.max(1, Math.floor(innerW / 120));
  const labelStep = Math.max(1, Math.ceil(values.length / labelCount));
  const labelIdx = [];
  for (let i = 0; i < values.length; i += labelStep) labelIdx.push(i);

  // "Ongoing period" — last bar is partial
  const ongoingX = values.length > 1 ? xCenter(values.length - 2) - slotW / 2 : padL;
  const ongoingEndX = xCenter(values.length - 1) + slotW / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: '380px', flex: 1 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
          SESSIONS
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

        {labelIdx.map((idx) => (
          <g key={idx}>
            <line x1={xCenter(idx)} y1={padT + innerH} x2={xCenter(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
            <text x={xCenter(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
              {months[idx]}
            </text>
          </g>
        ))}

        {values.length > 1 && (
          <>
            <rect
              x={ongoingX}
              y={padT - 10}
              width={ongoingEndX - ongoingX}
              height={innerH + 10}
              fill="rgba(33,150,243,0.06)"
            />
            <text x={(ongoingX + ongoingEndX) / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
              Ongoing period
            </text>
          </>
        )}

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
                height={Math.max(0, h)}
                fill={isOngoing ? BAR_COLOR_ONGOING : BAR_COLOR}
                rx={1.5}
              >
                <title>{`${months[i]}: ${v.toLocaleString('en-US')}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
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
  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 18px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '380px',
  },
};
