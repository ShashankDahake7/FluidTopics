'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Align with backend default and Traffic analytics retention policy. */
const ANALYTICS_DATA_RETENTION_DAYS = 730;

const PERIOD_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const DEVICES = [
  { key: 'mobile', label: 'Mobile', color: '#361FAD' },
  { key: 'tablet', label: 'Tablet', color: '#CFB017' },
  { key: 'desktop', label: 'Desktop', color: '#9D207B' },
  { key: 'unknown', label: 'Unknown', color: '#94a3b8' },
];

const TABS = [
  { value: 'EVOLUTION', label: 'Evolution', icon: 'line' },
  { value: 'DISTRIBUTION', label: 'Distribution', icon: 'bar' },
];

/* ------------------------------ Date range (match Browsers) ------------------------------ */

function defaultDateRangePreviousMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function presetLastWeek() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function presetLast3Months() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function toInputDate(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseInputDate(s) {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function earliestAllowedStart() {
  const d = new Date();
  d.setDate(d.getDate() - ANALYTICS_DATA_RETENTION_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ------------------------------ XLSX export ------------------------------ */

async function downloadDeviceTypesXlsx(evolution, distribution, totalSessions, granularityLabel) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const evoRows = [
    ['Period', 'Granularity', 'Mobile sessions', 'Tablet sessions', 'Desktop sessions', 'Unknown sessions', 'Total'],
    ...evolution.map((r) => [
      r.label,
      r.granularity,
      r.mobile,
      r.tablet,
      r.desktop,
      r.unknown,
      r.total,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(evoRows), 'Evolution');

  const dist = distribution || {};
  const distTotal = totalSessions || 1;
  const distRows = [
    ['Device', 'Sessions', 'Share %'],
    ['Mobile', dist.mobile ?? 0, `${(((dist.mobile ?? 0) / distTotal) * 100).toFixed(2)}%`],
    ['Tablet', dist.tablet ?? 0, `${(((dist.tablet ?? 0) / distTotal) * 100).toFixed(2)}%`],
    ['Desktop', dist.desktop ?? 0, `${(((dist.desktop ?? 0) / distTotal) * 100).toFixed(2)}%`],
    ['Unknown', dist.unknown ?? 0, `${(((dist.unknown ?? 0) / distTotal) * 100).toFixed(2)}%`],
    ['Total', totalSessions ?? 0, '100%'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distRows), 'Distribution');

  const safe = granularityLabel.replace(/\s+/g, '-').toLowerCase();
  XLSX.writeFile(wb, `device-types-traffic-${safe}.xlsx`);
}

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

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function DeviceTypesPage() {
  const def = useMemo(() => defaultDateRangePreviousMonth(), []);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(def.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(def.end));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => toInputDate(def.start));
  const [customEnd, setCustomEnd] = useState(() => toInputDate(def.end));

  const [tab, setTab] = useState('EVOLUTION');
  const [period, setPeriod] = useState('MONTHLY');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selected, setSelected] = useState(() => new Set(DEVICES.map((d) => d.key)));

  const [evolution, setEvolution] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [matchedPageDisplayEvents, setMatchedPageDisplayEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [methodology, setMethodology] = useState(null);

  const pickerRef = useRef(null);

  const startIso = useMemo(() => {
    const d = parseInputDate(rangeStart);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [rangeStart]);

  const endIso = useMemo(() => {
    const d = parseInputDate(rangeEnd);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [rangeEnd]);

  const granularity = period === 'WEEKLY' ? 'week' : 'month';

  const fetchData = useCallback(async () => {
    if (!startIso || !endIso) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/traffic/device-types', {
        startDate: startIso,
        endDate: endIso,
        granularity,
      });
      if (json?.error) {
        setErrorMsg(json.error);
        setEvolution([]);
        setDistribution(null);
        setTotalSessions(0);
        setMatchedPageDisplayEvents(0);
        setMethodology(null);
        return;
      }
      setEvolution(Array.isArray(json.evolution) ? json.evolution : []);
      setDistribution(json.distribution ?? null);
      setTotalSessions(typeof json.totalSessions === 'number' ? json.totalSessions : 0);
      setMatchedPageDisplayEvents(
        typeof json.matchedPageDisplayEvents === 'number' ? json.matchedPageDisplayEvents : 0,
      );
      setMethodology(json.methodology ?? null);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || 'Request failed');
      setEvolution([]);
      setDistribution(null);
      setTotalSessions(0);
      setMatchedPageDisplayEvents(0);
      setMethodology(null);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso, granularity]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const applyRange = (start, end) => {
    setErrorMsg(null);
    setRangeStart(toInputDate(start));
    setRangeEnd(toInputDate(end));
    setCustomStart(toInputDate(start));
    setCustomEnd(toInputDate(end));
    setPickerOpen(false);
  };

  const applyPreset = (key) => {
    if (key === 'prevMonth') {
      const { start, end } = defaultDateRangePreviousMonth();
      applyRange(start, end);
      return;
    }
    if (key === 'lastWeek') {
      const { start, end } = presetLastWeek();
      applyRange(start, end);
      return;
    }
    if (key === 'last3mo') {
      const { start, end } = presetLast3Months();
      applyRange(start, end);
    }
  };

  const applyCustom = () => {
    const s = parseInputDate(customStart);
    const e = parseInputDate(customEnd);
    if (!s || !e || s > e) {
      setErrorMsg('End date must be after start date.');
      return;
    }
    if (s < earliestAllowedStart()) {
      setErrorMsg(
        `Start date must be within the analytics retention period (${ANALYTICS_DATA_RETENTION_DAYS} days).`
      );
      return;
    }
    setErrorMsg(null);
    applyRange(s, e);
  };

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

  const visibleDevices = useMemo(() => DEVICES.filter((d) => selected.has(d.key)), [selected]);

  const lineData = useMemo(() => {
    if (!evolution?.length) return [];
    return evolution.map((row) => {
      const o = { label: row.label, key: row.key, ongoing: row.ongoing };
      for (const d of DEVICES) {
        o[d.key] = row[d.key] ?? 0;
      }
      return o;
    });
  }, [evolution]);

  const stackedDistData = useMemo(() => {
    const keys = DEVICES.filter((d) => selected.has(d.key)).map((d) => d.key);
    if (!evolution?.length || keys.length === 0) return [];
    return evolution.map((row) => {
      const out = { label: row.label, key: row.key, ongoing: row.ongoing };
      let sum = keys.reduce((s, k) => s + (row[k] || 0), 0);
      if (sum === 0) sum = 1;
      for (const k of keys) {
        out[k] = (100 * (row[k] || 0)) / sum;
      }
      return out;
    });
  }, [evolution, selected]);

  const ongoingArea = useMemo(() => {
    const on = evolution.filter((r) => r.ongoing);
    if (!on.length) return null;
    return { x1: on[0].label, x2: on[on.length - 1].label };
  }, [evolution]);

  const handleDownload = () => {
    void downloadDeviceTypesXlsx(evolution, distribution, totalSessions, period === 'WEEKLY' ? 'weekly' : 'monthly');
  };

  const displayFrom = rangeStart;
  const displayTo = rangeEnd;

  return (
    <AnalyticsShell
      active="device-types"
      breadcrumb={{ prefix: 'Traffic', title: 'Device types' }}
      toolbarExtras={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={PS.toolbarWrap} ref={pickerRef}>
            <button
              type="button"
              style={PS.dateIndicator}
              title="Change date range"
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
              onClick={() => setPickerOpen((v) => !v)}
            >
              <span style={PS.dateLabels}>
                <span style={PS.dateLine}>
                  From: {displayFrom ? new Date(`${displayFrom}T12:00:00`).toLocaleDateString() : '—'}
                </span>
                <span style={PS.dateLine}>
                  To: {displayTo ? new Date(`${displayTo}T12:00:00`).toLocaleDateString() : '—'}
                </span>
              </span>
              <span style={PS.dateCalendar} aria-hidden="true">
                <IconCalendar />
              </span>
            </button>
            {pickerOpen && (
              <div role="dialog" aria-label="Date range" style={PS.pickerPanel}>
                <p style={PS.pickerTitle}>Quick ranges</p>
                <div style={PS.presetRow}>
                  <button type="button" style={PS.presetBtn} onClick={() => applyPreset('lastWeek')}>
                    Last week
                  </button>
                  <button type="button" style={PS.presetBtn} onClick={() => applyPreset('last3mo')}>
                    Last 3 months
                  </button>
                  <button type="button" style={PS.presetBtn} onClick={() => applyPreset('prevMonth')}>
                    Previous month
                  </button>
                </div>
                <p style={PS.pickerTitle}>Custom range</p>
                <div style={PS.customRow}>
                  <label style={PS.customLab}>
                    From
                    <input
                      type="date"
                      value={customStart}
                      min={toInputDate(earliestAllowedStart())}
                      max={customEnd}
                      onChange={(e) => setCustomStart(e.target.value)}
                      style={PS.dateInput}
                    />
                  </label>
                  <label style={PS.customLab}>
                    To
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      style={PS.dateInput}
                    />
                  </label>
                </div>
                <button type="button" style={PS.applyBtn} onClick={applyCustom}>
                  Apply
                </button>
                <p style={PS.retentionHint}>
                  Start date must be within the last {ANALYTICS_DATA_RETENTION_DAYS} days (retention). Default range is
                  the previous calendar month.
                </p>
              </div>
            )}
          </div>
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
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          {errorMsg && (
            <div style={PS.errorBanner} role="alert">
              {errorMsg}
            </div>
          )}

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
                  <span style={PS.tabIcon}>{t.icon === 'line' ? <IconLineChart /> : <IconBarNormalized />}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {!loading && !errorMsg && totalSessions === 0 && (
            <div style={PS.zeroSessionsBanner} role="status">
              <strong style={{ display: 'block', marginBottom: '6px', color: '#0f172a', fontSize: '0.88rem' }}>
                No sessions in this date range
              </strong>
              {matchedPageDisplayEvents === 0 ? (
                <span style={{ color: '#475569', lineHeight: 1.5, fontSize: '0.85rem' }}>
                  The database has <strong>no</strong> <code style={PS.code}>page.display</code> analytics rows between your
                  start and end dates (after excluding static assets). Usual causes: the range still ends{' '}
                  <strong>before</strong> days when you actually used the app (for example range ends in April but you only
                  browsed in May), the browser never successfully called <code style={PS.code}>POST /api/analytics/track</code>{' '}
                  (check Network → filter &quot;track&quot; → should be 200), or the API is writing to a different MongoDB than
                  you expect. In development, failed track calls log a warning in the browser console.
                </span>
              ) : (
                <span style={{ color: '#475569', lineHeight: 1.5, fontSize: '0.85rem' }}>
                  Found {matchedPageDisplayEvents} raw <code style={PS.code}>page.display</code> hit(s) in range but no
                  sessions rolled up—contact support if this persists.
                </span>
              )}
            </div>
          )}

          {tab === 'EVOLUTION' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>Evolution of sessions per device type.</span>
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
                    onClick={handleDownload}
                    disabled={loading || !lineData.length}
                  >
                    <IconDownload />
                  </button>
                </div>
              </header>

              <section style={PS.body}>
                <div style={PS.chartCard}>
                  {loading ? (
                    <p style={PS.muted}>Loading…</p>
                  ) : (
                    <div style={{ width: '100%', height: 380 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} margin={{ top: 8, right: 16, left: 4, bottom: period === 'MONTHLY' ? 48 : 56 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e6f1" />
                          {ongoingArea && (
                            <ReferenceArea
                              x1={ongoingArea.x1}
                              x2={ongoingArea.x2}
                              strokeOpacity={0}
                              fill="rgba(33,150,243,0.08)"
                            />
                          )}
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            interval={0}
                            angle={lineData.length > 10 ? -35 : 0}
                            textAnchor={lineData.length > 10 ? 'end' : 'middle'}
                            height={lineData.length > 10 ? 70 : 36}
                            label={{ value: 'DATE', position: 'insideBottomRight', offset: -4, fill: '#6E7079', fontSize: 11 }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                              value: 'SESSIONS',
                              angle: -90,
                              position: 'insideLeft',
                              fill: '#6E7079',
                              fontSize: 11,
                              style: { textAnchor: 'middle' },
                            }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                            formatter={(value, name) => [Number(value).toLocaleString('en-US'), name]}
                          />
                          <Legend wrapperStyle={{ paddingTop: 8 }} />
                          {!noneOn &&
                            visibleDevices.map((d) => (
                              <Line
                                key={d.key}
                                type="monotone"
                                dataKey={d.key}
                                name={d.label}
                                stroke={d.color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                                activeDot={{ r: 4 }}
                              />
                            ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {ongoingArea && !loading && (
                    <p style={PS.ongoingCaption}>Shaded region: ongoing period (incomplete).</p>
                  )}
                  {!loading && noneOn && <p style={PS.muted}>No device types selected.</p>}
                  {!loading && !noneOn && lineData.length === 0 && <p style={PS.muted}>No sessions in this range.</p>}
                </div>

                <DeviceTypesFootnote methodology={methodology} />
              </section>
            </>
          )}

          {tab === 'DISTRIBUTION' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>
                  Distribution of sessions per device type (percentage within each period; filtered categories
                  renormalized to 100%).
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
                    onClick={handleDownload}
                    disabled={loading || !stackedDistData.length}
                  >
                    <IconDownload />
                  </button>
                </div>
              </header>

              <section style={PS.body}>
                <div style={PS.chartCard}>
                  {loading ? (
                    <p style={PS.muted}>Loading…</p>
                  ) : (
                    <div style={{ width: '100%', height: 380 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stackedDistData} margin={{ top: 8, right: 16, left: 4, bottom: stackedDistData.length > 10 ? 56 : 48 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e6f1" />
                          {ongoingArea && (
                            <ReferenceArea
                              x1={ongoingArea.x1}
                              x2={ongoingArea.x2}
                              strokeOpacity={0}
                              fill="rgba(33,150,243,0.08)"
                            />
                          )}
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            interval={0}
                            angle={stackedDistData.length > 10 ? -35 : 0}
                            textAnchor={stackedDistData.length > 10 ? 'end' : 'middle'}
                            height={stackedDistData.length > 10 ? 70 : 36}
                            label={{ value: 'DATE', position: 'insideBottomRight', offset: -4, fill: '#6E7079', fontSize: 11 }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                              value: 'SHARE',
                              angle: -90,
                              position: 'insideLeft',
                              fill: '#6E7079',
                              fontSize: 11,
                            }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                          />
                          <Legend wrapperStyle={{ paddingTop: 8 }} />
                          {!noneOn &&
                            visibleDevices.map((d) => (
                              <Bar key={d.key} dataKey={d.key} name={d.label} stackId="a" fill={d.color} />
                            ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {!loading && totalSessions > 0 && distribution && (
                    <p style={PS.summaryLine}>
                      Overall ({displayFrom}–{displayTo}):{' '}
                      {DEVICES.map((d) => (
                        <span key={d.key} style={{ marginRight: '12px' }}>
                          {d.label}{' '}
                          <strong>
                            {(((distribution[d.key] ?? 0) / totalSessions) * 100).toFixed(1)}%
                          </strong>
                        </span>
                      ))}
                    </p>
                  )}
                  {!loading && noneOn && <p style={PS.muted}>No device types selected.</p>}
                  {!loading && !noneOn && stackedDistData.length === 0 && (
                    <p style={PS.muted}>No sessions in this range.</p>
                  )}
                </div>

                <DeviceTypesFootnote methodology={methodology} />
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
                <span style={PS.noticeIcon} aria-hidden="true">
                  <IconInfoCircle />
                </span>
                <span style={PS.noticeBody}>
                  Device type is derived from viewport width and height on each{' '}
                  <code style={PS.code}>page.display</code> event (first viewport in the session). See{' '}
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
                  <Checkbox checked={allOn} indeterminate={!allOn && !noneOn} onChange={toggleAll} />
                  <span>Select all</span>
                </label>
              </div>

              <ul style={PS.list}>
                {DEVICES.map((d) => (
                  <li key={d.key}>
                    <label style={PS.checkRow}>
                      <Checkbox checked={selected.has(d.key)} onChange={() => toggleOne(d.key)} />
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

function DeviceTypesFootnote({ methodology }) {
  return (
    <div style={PS.footnote}>
      <p style={PS.footnoteP}>
        <strong>Categorization</strong> (viewport): Mobile — portrait width ≤480px or landscape ≤768px; Tablet —
        portrait 481–1024px or landscape 769–1280px; Desktop — portrait ≥1025px or landscape ≥1281px. Uses the first{' '}
        <code style={PS.code}>page.display</code> in a session that includes viewport dimensions.
      </p>
      {methodology?.excludesStaticResources ? (
        <p style={PS.footnoteP}>
          Static resources (JS/CSS/fonts/images, <code style={PS.code}>/_next/</code>, etc.) are excluded from counts
          where possible (methodology from {methodology.staticExclusionEffectiveFrom || '2024'}).
        </p>
      ) : null}
    </div>
  );
}

function Checkbox({ checked, indeterminate, onChange }) {
  const filled = checked || indeterminate;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange();
        }
      }}
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

  errorBanner: {
    margin: '0 16px',
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '0.85rem',
  },

  zeroSessionsBanner: {
    margin: '0 16px 12px',
    padding: '12px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
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
    flexWrap: 'wrap',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: '1 1 200px' },
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
  muted: { margin: 0, color: '#94a3b8', fontSize: '0.9rem' },
  ongoingCaption: { margin: '10px 0 0', fontSize: '0.75rem', color: '#64748b' },
  summaryLine: { margin: '12px 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 },
  footnote: {
    padding: '12px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.78rem',
    color: '#475569',
    lineHeight: 1.55,
  },
  footnoteP: { margin: '0 0 8px 0' },
  code: { fontSize: '0.85em', background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' },

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

  toolbarWrap: { position: 'relative' },
  dateIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    color: '#0f172a',
  },
  dateLabels: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', textAlign: 'left' },
  dateLine: { display: 'block', lineHeight: 1.35 },
  dateCalendar: { color: '#64748b', display: 'inline-flex' },
  pickerPanel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 20,
    width: 'min(320px, 92vw)',
    padding: '14px 16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
  },
  pickerTitle: { margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' },
  presetBtn: {
    padding: '6px 10px',
    fontSize: '0.78rem',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#f8fafc',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  customRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
  customLab: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: '#64748b' },
  dateInput: {
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  },
  applyBtn: {
    width: '100%',
    padding: '8px 12px',
    marginTop: '4px',
    border: 'none',
    borderRadius: '6px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  retentionHint: { margin: '10px 0 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 },
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
