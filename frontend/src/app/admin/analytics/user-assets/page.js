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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconLineChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="M7 16V9l4 4 4-7 5 5" />
  </svg>
);

const IconTable = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

/* ------------------------------ Config (colors aligned with reference) ------------------------------ */

const ASSET_TYPES = [
  { id: 'bookmarks', label: 'Bookmarks', color: '#dc2626' },
  { id: 'personalBooks', label: 'Personal books', color: '#ca8a04' },
  { id: 'personalTopics', label: 'Personal topics', color: '#1e40af' },
  { id: 'savedSearches', label: 'All saved searches', color: '#38bdf8' },
  { id: 'savedSearchesWithAlert', label: 'Saved searches with alerts', color: '#a855f7' },
  { id: 'collections', label: 'Collections', color: '#22c55e' },
];

const DEFAULT_FILTERS = ASSET_TYPES.reduce((acc, t) => {
  acc[t.id] = true;
  return acc;
}, {});

/* ------------------------------ Helpers ------------------------------ */

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

function buildChartRows(results, groupBy) {
  if (!results?.length) return [];
  const byStart = new Map();
  for (const row of results) {
    const type = row.type;
    for (const p of row.periods || []) {
      const key = p.periodStartDate;
      if (!byStart.has(key)) {
        byStart.set(key, {
          name: formatAxisLabel(p.periodStartDate, groupBy),
          periodStart: key,
          periodEnd: p.periodEndDate,
          ongoing: periodIsOngoing(p),
        });
      }
      const pt = byStart.get(key);
      pt[type] = p.count;
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

function selectedTypeIds(filters) {
  return ASSET_TYPES.filter((t) => filters[t.id]).map((t) => t.id);
}

function downloadCsv(chartData, appliedFilters) {
  const types = ASSET_TYPES.filter((t) => appliedFilters[t.id]);
  const header = ['Period', ...types.map((t) => t.label)];
  const lines = [header.join(',')];
  for (const row of chartData) {
    const cells = [JSON.stringify(row.name)];
    for (const t of types) {
      const v = row[t.id];
      cells.push(v === undefined || v === null ? '' : String(v));
    }
    lines.push(cells.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'user-assets.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Page ------------------------------ */

export default function UserAssetsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [groupBy, setGroupBy] = useState('month');
  const [viewMode, setViewMode] = useState('chart');
  const [rawResults, setRawResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [draftFilters, setDraftFilters] = useState(() => ({ ...DEFAULT_FILTERS }));

  const [brushRange, setBrushRange] = useState({ startIndex: undefined, endIndex: undefined });

  const { startDateIso, endDateIso } = useMemo(() => {
    const { start, end } = rangeForGroup(groupBy);
    return { startDateIso: start.toISOString(), endDateIso: end.toISOString() };
  }, [groupBy]);

  const chartData = useMemo(() => buildChartRows(rawResults, groupBy), [rawResults, groupBy]);
  const ongoingBand = useMemo(() => ongoingBandExtents(chartData), [chartData]);

  const openDrawer = useCallback(() => {
    setDraftFilters({ ...appliedFilters });
    setDrawerOpen(true);
  }, [appliedFilters]);

  const fetchData = useCallback(async () => {
    const types = selectedTypeIds(appliedFilters);
    if (types.length === 0) {
      setRawResults([]);
      setLoading(false);
      setErrorMsg(null);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v1/users/assets/time-report', {
        startDate: startDateIso,
        endDate: endDateIso,
        groupByPeriod: groupBy,
        filters: { type: types },
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
  }, [appliedFilters, groupBy, startDateIso, endDateIso]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setBrushRange({ startIndex: undefined, endIndex: undefined });
  }, [groupBy, rawResults]);

  const handleApply = () => {
    if (selectedTypeIds(draftFilters).length === 0) return;
    setAppliedFilters({ ...draftFilters });
    setDrawerOpen(false);
  };

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

  const toggleAllDraft = (checked) => {
    const next = {};
    ASSET_TYPES.forEach((t) => {
      next[t.id] = checked;
    });
    setDraftFilters(next);
  };

  const allDraftChecked = ASSET_TYPES.every((t) => draftFilters[t.id]);
  const applyDisabled = selectedTypeIds(draftFilters).length === 0;

  const chartMarginBottom = { top: 12, right: 28, left: 8, bottom: 36 };

  const visibleTypes = ASSET_TYPES.filter((t) => appliedFilters[t.id]);

  return (
    <AnalyticsShell
      active="user-assets"
      breadcrumb={{ prefix: 'Users', title: 'User assets' }}
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <button
            type="button"
            onClick={() => (drawerOpen ? setDrawerOpen(false) : openDrawer())}
            style={{ ...PS.toolbarIconBtn, color: drawerOpen ? '#1d4ed8' : '#475569' }}
            title={drawerOpen ? 'Hide filters' : 'Filter asset types'}
            aria-label="Filter asset types"
          >
            <IconFilters />
          </button>
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <div style={PS.headLeft}>
              <span style={PS.headTagline}>Data is based on the types of user assets created in the portal.</span>
            </div>
            <div style={PS.headerControls}>
              <div style={PS.toggleGroup}>
                {['day', 'week', 'month'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setGroupBy(period)}
                    style={{
                      ...PS.toggleBtn,
                      ...(groupBy === period ? PS.toggleBtnActive : {}),
                      borderRight: period === 'month' ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
              <div style={PS.iconActions}>
                <button
                  type="button"
                  style={{ ...PS.iconActionBtn, ...(viewMode === 'chart' ? PS.iconActionActive : {}) }}
                  title="Line chart"
                  aria-label="Line chart"
                  onClick={() => setViewMode('chart')}
                >
                  <IconLineChart />
                </button>
                <button
                  type="button"
                  style={{ ...PS.iconActionBtn, ...(viewMode === 'table' ? PS.iconActionActive : {}) }}
                  title="Table"
                  aria-label="Table"
                  onClick={() => setViewMode('table')}
                >
                  <IconTable />
                </button>
                <button
                  type="button"
                  style={PS.iconActionBtn}
                  title="Download CSV"
                  aria-label="Download CSV"
                  onClick={() => {
                    if (!chartData.length || !visibleTypes.length) return;
                    downloadCsv(chartData, appliedFilters);
                  }}
                >
                  <IconDownload />
                </button>
              </div>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
              <div style={PS.loading}>Loading…</div>
            ) : errorMsg ? (
              <div style={PS.errorBox}>Error: {errorMsg}</div>
            ) : selectedTypeIds(appliedFilters).length === 0 ? (
              <div style={PS.emptyBox}>Select at least one asset type and click Apply.</div>
            ) : chartData.length === 0 ? (
              <div style={PS.emptyBox}>No data in this range.</div>
            ) : viewMode === 'table' ? (
              <div style={PS.tableWrap}>
                <table style={PS.table}>
                  <thead>
                    <tr>
                      <th style={PS.th}>Period</th>
                      {visibleTypes.map((t) => (
                        <th key={t.id} style={PS.th}>
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row) => (
                      <tr key={row.periodStart}>
                        <td style={PS.td}>{row.name}</td>
                        {visibleTypes.map((t) => (
                          <td key={t.id} style={PS.tdNum}>
                            {row[t.id] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={PS.chartBlock}>
                <h3 style={PS.chartHeading}>User asset count</h3>
                <div style={PS.chartWrapper}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={chartMarginBottom}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e6f1" />
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
                        tick={{ fontSize: 12, fill: '#6e7079' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e0e6f1' }}
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
                        tick={{ fontSize: 12, fill: '#6e7079' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e0e6f1' }}
                        width={52}
                        label={{
                          value: 'USER ASSET COUNT',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 8,
                          style: { fill: '#64748b', fontSize: 11, fontWeight: 600 },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      {visibleTypes.map((asset) => (
                        <Line
                          key={asset.id}
                          type="monotone"
                          dataKey={asset.id}
                          name={asset.label}
                          stroke={asset.color}
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
            )}
          </section>
        </main>

        <aside
          style={{
            ...PS.drawer,
            width: drawerOpen ? 330 : 0,
            borderLeftWidth: drawerOpen ? 1 : 0,
          }}
          aria-hidden={!drawerOpen}
        >
          <div style={PS.drawerInner}>
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter asset types</h3>
              <button type="button" style={PS.drawerCloseBtn} onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                <IconClose />
              </button>
            </header>
            <div style={PS.drawerScroll}>
              <label style={PS.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={allDraftChecked}
                  onChange={(e) => toggleAllDraft(e.target.checked)}
                  style={PS.checkbox}
                />
                <span style={PS.checkboxLabel}>Select all</span>
              </label>
              <div style={PS.filterList}>
                {ASSET_TYPES.map((asset) => (
                  <label key={asset.id} style={PS.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={!!draftFilters[asset.id]}
                      onChange={(e) => setDraftFilters((prev) => ({ ...prev, [asset.id]: e.target.checked }))}
                      style={PS.checkbox}
                    />
                    <span style={{ ...PS.colorDot, backgroundColor: asset.color }} aria-hidden />
                    <span style={PS.checkboxLabelLight}>{asset.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <footer style={PS.drawerFooter}>
              <button
                type="button"
                style={{
                  ...PS.applyBtn,
                  ...(applyDisabled ? PS.applyBtnDisabled : {}),
                }}
                onClick={handleApply}
                disabled={applyDisabled}
              >
                Apply
              </button>
            </footer>
          </div>
        </aside>
      </div>
    </AnalyticsShell>
  );
}

const PS = {
  layout: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    background: '#ffffff',
  },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  toolbarIconBtn: {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '50%',
  },

  resultHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  headLeft: { flex: '1 1 240px', minWidth: 0 },
  headTagline: { fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 },
  headerControls: { display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 },

  toggleGroup: {
    display: 'flex',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#475569',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  toggleBtnActive: { background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 },

  iconActions: { display: 'flex', alignItems: 'center', gap: '4px' },
  iconActionBtn: {
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '6px',
  },
  iconActionActive: {
    background: '#eff6ff',
    color: '#1d4ed8',
  },

  body: {
    padding: '20px 22px 24px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  loading: { padding: '40px', textAlign: 'center', color: '#64748b' },
  errorBox: { color: '#b91c1c', padding: '16px' },
  emptyBox: { color: '#64748b', padding: '16px' },

  chartBlock: { display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 360, minWidth: 0 },
  chartHeading: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#6e7079',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: 0,
  },
  chartWrapper: { width: '100%', flex: 1, minHeight: 400, minWidth: 0 },

  tableWrap: { flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 600,
    color: '#0f172a',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155' },
  tdNum: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },

  drawer: {
    flexShrink: 0,
    borderLeftStyle: 'solid',
    borderLeftColor: '#e5e7eb',
    background: '#ffffff',
    overflow: 'hidden',
    transition: 'width 200ms ease',
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'stretch',
  },
  drawerInner: {
    width: 330,
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'flex-end',
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  drawerTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0 },
  drawerCloseBtn: {
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  drawerFooter: {
    flexShrink: 0,
    padding: '14px 18px 18px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  applyBtn: {
    width: '100%',
    padding: '12px 14px',
    background: '#2196F3',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  applyBtnDisabled: { opacity: 0.45, cursor: 'not-allowed' },

  checkboxWrap: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#2196F3', flexShrink: 0 },
  checkboxLabel: { fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' },
  checkboxLabelLight: { fontSize: '0.88rem', fontWeight: 500, color: '#334155' },
  colorDot: { width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0 },
  filterList: { display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '4px' },
};
