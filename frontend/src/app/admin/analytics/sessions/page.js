'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from 'recharts';

/* ------------------------------ Constants ------------------------------ */

const BAR_COLOR = '#9D207B';
const BAR_COLOR_ONGOING = '#D395C2';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
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

/* ------------------------------ Helpers (aligned with user-traffic / events) ------------------------------ */

function rangeForGroup(groupBy) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (groupBy === 'day') {
    start.setDate(start.getDate() - 90);
  } else if (groupBy === 'week') {
    start.setDate(start.getDate() - 52 * 7);
  } else {
    start.setMonth(start.getMonth() - 18);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatAxisLabel(iso, groupBy) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (groupBy === 'month') {
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodIsOngoing(p) {
  const now = Date.now();
  const s = new Date(p.periodStartDate).getTime();
  const e = new Date(p.periodEndDate).getTime();
  return now >= s && now < e;
}

function ongoingBandExtents(chartData) {
  const ongoing = chartData.filter((d) => d.ongoing);
  if (!ongoing.length) return null;
  return { x1: ongoing[0].name, x2: ongoing[ongoing.length - 1].name };
}

function downloadSessionsCsv(rows) {
  if (!rows?.length) return;
  const lines = ['Period,Session count'];
  for (const row of rows) {
    lines.push(`${JSON.stringify(row.name)},${row.sessionCount ?? ''}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sessions.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function SessionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const n = row?.sessionCount;
  const label = row?.name ?? '';
  const num = typeof n === 'number' ? n.toLocaleString('en-US') : n;
  const suffix = row?.ongoing ? ' (ongoing partial period)' : '';
  return (
    <div
      style={{
        background: '#111827',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#f9fafb',
        fontSize: '0.85rem',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
      }}
    >
      {`${num} sessions opened in ${label}${suffix}`}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function SessionsPage() {
  const [period, setPeriod] = useState('month');
  const [rawResults, setRawResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const { startDateIso, endDateIso } = useMemo(() => {
    const { start, end } = rangeForGroup(period);
    return { startDateIso: start.toISOString(), endDateIso: end.toISOString() };
  }, [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/traffic/sessions', {
        startDate: startDateIso,
        endDate: endDateIso,
        groupByPeriod: period,
      });

      if (json?.results) {
        setRawResults(json.results);
      } else if (json?.error) {
        setErrorMsg(json.error);
        setRawResults([]);
      } else {
        setErrorMsg('Unexpected response from server');
        setRawResults([]);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
      setRawResults([]);
    } finally {
      setLoading(false);
    }
  }, [period, startDateIso, endDateIso]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const chartData = useMemo(() => {
    if (!rawResults?.length) return [];
    return rawResults.map((p) => ({
      name: formatAxisLabel(p.periodStartDate, period),
      sessionCount: p.sessionCount ?? 0,
      periodStart: p.periodStartDate,
      periodEnd: p.periodEndDate,
      ongoing: periodIsOngoing(p),
    }));
  }, [rawResults, period]);

  const ongoingBand = useMemo(() => ongoingBandExtents(chartData), [chartData]);

  const chartMargin = { top: 12, right: 16, left: 4, bottom: 8 };
  const chartMarginBottom = { ...chartMargin, bottom: 36 };

  return (
    <AnalyticsShell
      active="sessions"
      breadcrumb={{ prefix: 'Traffic', title: 'Sessions' }}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              How many sessions were opened in your portal last year?
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
                title="Download as CSV"
                aria-label="Download as CSV"
                onClick={() => downloadSessionsCsv(chartData)}
                disabled={!chartData.length}
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
              <div style={PS.loading}>Loading sessions…</div>
            ) : errorMsg ? (
              <div style={PS.error}>Error: {errorMsg}</div>
            ) : chartData.length === 0 ? (
              <div style={PS.empty}>No session data in this range. Sessions are derived from analytics events with a session id.</div>
            ) : (
              <div style={PS.chartCard}>
                <div style={{ width: '100%', height: 440 }}>
                  <ResponsiveContainer
                    key={`${period}-${startDateIso}-${endDateIso}-${rawResults?.length ?? 0}`}
                    width="100%"
                    height="100%"
                  >
                    <BarChart data={chartData} margin={chartMarginBottom}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      {ongoingBand && (
                        <ReferenceArea
                          x1={ongoingBand.x1}
                          x2={ongoingBand.x2}
                          fill="#93c5fd"
                          fillOpacity={0.18}
                          strokeOpacity={0}
                          ifOverflow="visible"
                          label={{
                            value: 'Ongoing period',
                            position: 'insideTop',
                            fill: '#64748b',
                            fontSize: 11,
                          }}
                        />
                      )}
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#94a3b8' }}
                        minTickGap={20}
                        label={{
                          value: 'DATE',
                          position: 'insideBottomRight',
                          offset: -6,
                          fill: '#6E7079',
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        label={{
                          value: 'SESSIONS',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#6E7079',
                          fontSize: 11,
                          offset: 8,
                        }}
                      />
                      <Tooltip content={(p) => <SessionTooltip {...p} />} cursor={{ fill: 'rgba(157, 32, 123, 0.08)' }} />
                      <Bar dataKey="sessionCount" radius={[2, 2, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.periodStart}-${index}`}
                            fill={entry.ongoing ? BAR_COLOR_ONGOING : BAR_COLOR}
                          />
                        ))}
                      </Bar>
                      <Brush dataKey="name" height={28} stroke="#cbd5e1" fill="#f8fafc" travellerWidth={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p style={PS.hint}>
                  Distinct sessions per period use a 30‑minute inactivity timeout (same as Session list): repeated browser{' '}
                  <code style={PS.code}>sessionId</code> after a gap counts as a new session; without an id, grouping is by user or IP.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

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
  headControls: { display: 'inline-flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
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
  body: {
    padding: '18px 22px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
  },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b' },
  error: { padding: '40px', color: '#dc2626' },
  empty: { padding: '40px', color: '#64748b', fontSize: '0.9rem', maxWidth: '520px', lineHeight: 1.5 },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '420px',
  },
  hint: {
    margin: '12px 4px 0',
    fontSize: '0.75rem',
    color: '#64748b',
    lineHeight: 1.45,
  },
  code: {
    fontSize: '0.72rem',
    background: '#f1f5f9',
    padding: '1px 6px',
    borderRadius: '4px',
  },
};
