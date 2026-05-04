'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';

/* ------------------------------ Icons ------------------------------ */

const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconStackedChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const IconChevLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ------------------------------ Helpers ------------------------------ */

const REALM_COLORS = {
  internal: '#9D207B',
  sso: '#CFB017',
  ldap: '#361FAD',
  oidc: '#45A191',
};

const REALM_LABELS = {
  internal: 'internal',
  sso: 'sso',
  ldap: 'ldap',
  oidc: 'oidc',
};

function strokeForRealm(realm) {
  return REALM_COLORS[realm] || '#3b82f6';
}

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
  if (groupBy === 'week') {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodIsOngoing(p) {
  const now = Date.now();
  const s = new Date(p.periodStartDate).getTime();
  const e = new Date(p.periodEndDate).getTime();
  return now >= s && now < e;
}

function buildChartRows(results, groupBy) {
  if (!results?.length) return [];
  const byStart = new Map();
  for (const realm of results) {
    for (const p of realm.periods || []) {
      const key = p.periodStartDate;
      if (!byStart.has(key)) {
        byStart.set(key, {
          name: formatAxisLabel(p.periodStartDate, groupBy),
          periodStart: key,
          periodEnd: p.periodEndDate,
          ongoing: periodIsOngoing(p),
        });
      }
      const row = byStart.get(key);
      row[`${realm.realm}_active`] = p.activeCount;
      row[`${realm.realm}_total`] = p.totalCount;
    }
  }
  return Array.from(byStart.values()).sort(
    (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
  );
}

function ongoingBandExtents(chartData) {
  const ongoing = chartData.filter((d) => d.ongoing);
  if (!ongoing.length) return null;
  return { x1: ongoing[0].name, x2: ongoing[ongoing.length - 1].name };
}

function downloadUserTrafficCsv(chartData, realms) {
  const header = ['Period'];
  for (const r of realms) {
    const label = REALM_LABELS[r] || r;
    header.push(`${label}_active`, `${label}_total`);
  }
  const lines = [header.join(',')];
  for (const row of chartData) {
    const cells = [JSON.stringify(row.name)];
    for (const r of realms) {
      const a = row[`${r}_active`];
      const t = row[`${r}_total`];
      cells.push(
        a === undefined || a === null ? '' : String(a),
        t === undefined || t === null ? '' : String(t)
      );
    }
    lines.push(cells.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'user-traffic.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Legend ------------------------------ */

const LEGEND_PER_PAGE = 4;

function PaginatedRealmLegend({ realms, page, setPage, colorFn, labelFn }) {
  const totalPages = Math.max(1, Math.ceil(realms.length / LEGEND_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = realms.slice(safePage * LEGEND_PER_PAGE, (safePage + 1) * LEGEND_PER_PAGE);

  return (
    <div style={PS.legendBar}>
      <div style={PS.legendItems}>
        {slice.map((realm) => (
          <div key={realm} style={PS.legendItem}>
            <span
              style={{
                ...PS.legendSwatch,
                borderColor: colorFn(realm),
              }}
              aria-hidden
            />
            <span style={PS.legendText}>{labelFn(realm)}</span>
          </div>
        ))}
      </div>
      {realms.length > LEGEND_PER_PAGE && (
        <div style={PS.legendPager}>
          <button
            type="button"
            style={{
              ...PS.legendPagerBtn,
              ...(safePage === 0 ? PS.legendPagerBtnDisabled : {}),
            }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label="Previous legend page"
          >
            <IconChevLeft />
          </button>
          <span style={PS.legendPagerIdx}>
            {safePage + 1}/{totalPages}
          </span>
          <button
            type="button"
            style={{
              ...PS.legendPagerBtn,
              ...(safePage >= totalPages - 1 ? PS.legendPagerBtnDisabled : {}),
            }}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            aria-label="Next legend page"
          >
            <IconChevRight />
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function UserTrafficPage() {
  const [groupBy, setGroupBy] = useState('month');
  const [rawResults, setRawResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [legendPage, setLegendPage] = useState(0);
  const [brushRange, setBrushRange] = useState({ startIndex: undefined, endIndex: undefined });

  const { startDateIso, endDateIso } = useMemo(() => {
    const { start, end } = rangeForGroup(groupBy);
    return { startDateIso: start.toISOString(), endDateIso: end.toISOString() };
  }, [groupBy]);

  const chartData = useMemo(() => buildChartRows(rawResults, groupBy), [rawResults, groupBy]);
  const realms = useMemo(() => rawResults.map((r) => r.realm).filter(Boolean), [rawResults]);
  const ongoingBand = useMemo(() => ongoingBandExtents(chartData), [chartData]);

  useEffect(() => {
    setLegendPage(0);
    setBrushRange({ startIndex: undefined, endIndex: undefined });
  }, [groupBy, rawResults]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v1/traffic/user-activity', {
        startDate: startDateIso,
        endDate: endDateIso,
        groupByPeriod: groupBy,
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
  }, [groupBy, startDateIso, endDateIso]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBrush = useCallback((range) => {
    if (!range) return;
    setBrushRange({
      startIndex: range.startIndex,
      endIndex: range.endIndex,
    });
  }, []);

  const brushProps =
    brushRange.startIndex != null && brushRange.endIndex != null
      ? { startIndex: brushRange.startIndex, endIndex: brushRange.endIndex }
      : {};

  const tooltipFormatter = (value, name) => {
    if (typeof name === 'string' && name.endsWith('_active')) {
      const realm = name.replace(/_active$/, '');
      return [value, `${REALM_LABELS[realm] || realm} (active)`];
    }
    if (typeof name === 'string' && name.endsWith('_total')) {
      const realm = name.replace(/_total$/, '');
      return [value, `${REALM_LABELS[realm] || realm} (total)`];
    }
    return [value, name];
  };

  const chartMargin = { top: 8, right: 24, left: 4, bottom: 8 };
  const chartMarginBottom = { ...chartMargin, bottom: 28 };

  return (
    <AnalyticsShell
      active="user-traffic"
      breadcrumb={{ prefix: 'Users', title: 'User traffic' }}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <div style={PS.headLeft}>
              <span style={PS.headTagline}>
                Data is based on the number of authenticated users who accessed the portal or a public API.
              </span>
            </div>
            <div style={PS.headerControls}>
              <div style={PS.toggleGroup}>
                {['day', 'week', 'month'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    style={{
                      ...PS.toggleBtn,
                      ...(groupBy === period ? PS.toggleBtnActive : {}),
                      borderRight: period === 'month' ? 'none' : '1px solid #cbd5e1',
                    }}
                    onClick={() => setGroupBy(period)}
                  >
                    {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
              <button type="button" style={PS.iconBtn} title="Chart style (line)" aria-label="Chart style">
                <IconStackedChart />
              </button>
              <button
                type="button"
                style={PS.iconBtn}
                title="Download CSV (both series)"
                aria-label="Download CSV"
                onClick={() => {
                  if (!chartData.length || !realms.length) return;
                  downloadUserTrafficCsv(chartData, realms);
                }}
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
              <div style={PS.loading}>Loading charts…</div>
            ) : errorMsg ? (
              <div style={PS.errorBox}>Error: {errorMsg}</div>
            ) : rawResults.length === 0 || chartData.length === 0 ? (
              <div style={PS.emptyBox}>No data in this range.</div>
            ) : (
              <>
                <div style={PS.block}>
                  <h3 style={PS.chartTitle}>Active users</h3>
                  <PaginatedRealmLegend
                    realms={realms}
                    page={legendPage}
                    setPage={setLegendPage}
                    colorFn={strokeForRealm}
                    labelFn={(r) => REALM_LABELS[r] || r}
                  />
                  <div style={PS.chartWrapper}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        {ongoingBand && (
                          <ReferenceArea
                            x1={ongoingBand.x1}
                            x2={ongoingBand.x2}
                            fill="#93c5fd"
                            fillOpacity={0.22}
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
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                        />
                        <Tooltip
                          formatter={tooltipFormatter}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        {realms.map((realm) => (
                          <Line
                            key={`${realm}_active`}
                            type="monotone"
                            dataKey={`${realm}_active`}
                            name={`${realm}_active`}
                            stroke={strokeForRealm(realm)}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                        <Brush
                          dataKey="name"
                          height={30}
                          stroke="#cbd5e1"
                          fill="#f8fafc"
                          {...brushProps}
                          onChange={handleBrush}
                          travellerWidth={8}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={PS.block}>
                  <h3 style={PS.chartTitle}>Total users</h3>
                  <PaginatedRealmLegend
                    realms={realms}
                    page={legendPage}
                    setPage={setLegendPage}
                    colorFn={strokeForRealm}
                    labelFn={(r) => REALM_LABELS[r] || r}
                  />
                  <div style={PS.chartWrapper}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={chartMarginBottom}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        {ongoingBand && (
                          <ReferenceArea
                            x1={ongoingBand.x1}
                            x2={ongoingBand.x2}
                            fill="#93c5fd"
                            fillOpacity={0.22}
                            strokeOpacity={0}
                            ifOverflow="visible"
                          />
                        )}
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                          label={{
                            value: 'DATE',
                            position: 'insideBottomRight',
                            offset: 2,
                            fill: '#64748b',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                        />
                        <Tooltip
                          formatter={tooltipFormatter}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        {realms.map((realm) => (
                          <Line
                            key={`${realm}_total`}
                            type="monotone"
                            dataKey={`${realm}_total`}
                            name={`${realm}_total`}
                            stroke={strokeForRealm(realm)}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                        <Brush
                          dataKey="name"
                          height={30}
                          stroke="#cbd5e1"
                          fill="#f8fafc"
                          {...brushProps}
                          onChange={handleBrush}
                          travellerWidth={8}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff', position: 'relative' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },

  resultHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  headLeft: { flex: '1 1 280px', minWidth: 0 },
  headTagline: { fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 },
  headerControls: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },

  toggleGroup: {
    display: 'flex',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: '6px 16px',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#475569',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: '#f1f5f9',
    color: '#0f172a',
    fontWeight: 600,
  },

  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '50%',
  },

  body: { padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '40px', flex: 1, overflowY: 'auto' },
  loading: { textAlign: 'center', padding: '40px', color: '#64748b' },
  errorBox: { color: '#b91c1c', padding: '20px' },
  emptyBox: { color: '#64748b', padding: '20px' },

  block: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 },
  chartTitle: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  chartWrapper: { width: '100%', height: '420px', minWidth: 0 },

  legendBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '12px 20px',
    padding: '4px 0',
  },
  legendItems: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendSwatch: {
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    borderWidth: '3px',
    borderStyle: 'solid',
    background: '#fff',
    flexShrink: 0,
  },
  legendText: { fontSize: '0.8rem', color: '#475569', fontWeight: 500 },

  legendPager: { display: 'flex', alignItems: 'center', gap: '6px' },
  legendPagerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#fff',
    color: '#475569',
    cursor: 'pointer',
  },
  legendPagerBtnDisabled: { opacity: 0.4, cursor: 'default' },
  legendPagerIdx: { fontSize: '0.75rem', color: '#64748b', minWidth: '2.5rem', textAlign: 'center' },
};
