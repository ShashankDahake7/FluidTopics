'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/* ------------------------------ Path → bucket (first match wins) ------------------------------ */

function normalizePath(raw) {
  if (raw == null || typeof raw !== 'string') return '(unknown)';
  let x = raw.trim();
  if (!x.startsWith('/')) x = `/${x}`;
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x || '/';
}

/** Ordered rules — most specific prefixes first. */
const PAGE_RULES = [
  { key: 'admin', label: 'Administration', group: 'Admin', color: '#64748b', url: '/admin', match: (p) => p.startsWith('/admin') },
  { key: 'dashboard-file', label: 'File viewer', group: 'Portal', color: '#33CC7F', url: '/dashboard/file', match: (p) => p.startsWith('/dashboard/file') },
  { key: 'dashboard-docs', label: 'Document reader', group: 'Portal', color: '#1980B2', url: '/dashboard/docs', match: (p) => p.startsWith('/dashboard/docs') },
  { key: 'dashboard-templates', label: 'Templates', group: 'Portal', color: '#B4643C', url: '/dashboard/templates', match: (p) => p.startsWith('/dashboard/templates') },
  { key: 'dashboard-home', label: 'Dashboard', group: 'Portal', color: '#9D207B', url: '/dashboard', match: (p) => p === '/dashboard' },
  { key: 'search', label: 'Search', group: 'Portal', color: '#BD0F49', url: '/search', match: (p) => p === '/search' },
  { key: 'reader-pretty', label: 'Reader (pretty URL)', group: 'Reader', color: '#361FAD', url: '/r/…', match: (p) => p.startsWith('/r/') || p === '/r' },
  { key: 'collections', label: 'Collections', group: 'Library', color: '#CFB017', url: '/mylibrary/collections', match: (p) => p.startsWith('/mylibrary/collections') },
  { key: 'mylibrary', label: 'My Library', group: 'Library', color: '#45A191', url: '/mylibrary', match: (p) => p.startsWith('/mylibrary') },
  { key: 'profile', label: 'Profile', group: 'Account', color: '#7A891A', url: '/profile', match: (p) => p.startsWith('/profile') },
  { key: 'login', label: 'Login', group: 'Account', color: '#71718E', url: '/login', match: (p) => p.startsWith('/login') },
  {
    key: 'auth-password',
    label: 'Password reset',
    group: 'Account',
    color: '#b8860b',
    url: '/forgot-password',
    match: (p) => p.startsWith('/forgot-password') || p.startsWith('/reset-password'),
  },
  { key: 'other', label: 'Other routes', group: 'Other', color: '#94a3b8', url: '…', match: () => true },
];

function pageKeyForPath(path) {
  const p = normalizePath(path);
  for (const r of PAGE_RULES) {
    if (r.key === 'other') break;
    if (r.match(p)) return r.key;
  }
  return 'other';
}

const ALL_PAGE_KEYS = PAGE_RULES.map((r) => r.key);
const COLOR_BY_KEY = Object.fromEntries(PAGE_RULES.map((r) => [r.key, r.color]));
const LABEL_BY_KEY = Object.fromEntries(PAGE_RULES.map((r) => [r.key, r.label]));

const PAGE_GROUPS = (() => {
  const by = new Map();
  for (const r of PAGE_RULES) {
    if (!by.has(r.group)) by.set(r.group, []);
    by.get(r.group).push(r);
  }
  return Array.from(by.entries()).map(([label, items]) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    items: items.map((r) => ({
      key: r.key,
      label: r.label,
      color: r.color,
      url: r.url,
    })),
  }));
})();

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

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

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

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

function downloadPageViewsCsv(chartData, keys) {
  if (!chartData.length || !keys.length) return;
  const header = ['Period', ...keys.map((k) => LABEL_BY_KEY[k] || k)];
  const lines = [header.join(',')];
  for (const row of chartData) {
    const cells = [JSON.stringify(row.name)];
    for (const k of keys) {
      const v = row[k];
      cells.push(v === undefined || v === null ? '' : String(v));
    }
    lines.push(cells.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'page-views.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
];

const AUTH_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'authenticated', label: 'Authenticated' },
  { value: 'unauthenticated', label: 'Unauthenticated' },
];

/* ------------------------------ Page ------------------------------ */

export default function PageViewsPage() {
  const [groupBy, setGroupBy] = useState('month');
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [language, setLanguage] = useState('all');
  const [authStatus, setAuthStatus] = useState('all');

  const [selectedPages, setSelectedPages] = useState(() => new Set(ALL_PAGE_KEYS));

  const { startDateIso, endDateIso } = useMemo(() => {
    const { start, end } = rangeForGroup(groupBy);
    return { startDateIso: start.toISOString(), endDateIso: end.toISOString() };
  }, [groupBy]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/traffic/page-views', {
        startDate: startDateIso,
        endDate: endDateIso,
        groupByPeriod: groupBy,
        authStatus,
        interfaceLanguage: language,
      });
      if (json?.periods && json?.pathCounts) {
        setRaw(json);
      } else if (json?.error) {
        setErrorMsg(json.error);
        setRaw(null);
      } else {
        setErrorMsg('Unexpected response from server');
        setRaw(null);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [startDateIso, endDateIso, groupBy, authStatus, language]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load chart when query inputs change
    void fetchData();
  }, [fetchData]);

  const seriesByKey = useMemo(() => {
    const pc = raw?.pathCounts || {};
    const n = raw?.periods?.length || 0;
    const out = {};
    for (const k of ALL_PAGE_KEYS) out[k] = new Array(n).fill(0);
    for (const [path, counts] of Object.entries(pc)) {
      const key = pageKeyForPath(path);
      for (let i = 0; i < n; i++) {
        out[key][i] += counts[i] || 0;
      }
    }
    return out;
  }, [raw]);

  const chartData = useMemo(() => {
    if (!raw?.periods?.length) return [];
    return raw.periods.map((per, idx) => {
      const row = {
        name: formatAxisLabel(per.periodStartDate, groupBy),
        ongoing: periodIsOngoing(per),
      };
      for (const k of ALL_PAGE_KEYS) {
        const v = seriesByKey[k][idx] ?? 0;
        row[k] = v;
        row[`${k}__lg`] = v > 0 ? Math.log10(v) : null;
      }
      return row;
    });
  }, [raw, seriesByKey, groupBy]);

  const stackedData = useMemo(() => {
    if (!stacked) return chartData;
    const keys = ALL_PAGE_KEYS.filter((k) => selectedPages.has(k));
    return chartData.map((row) => {
      const next = { ...row };
      let run = 0;
      for (const k of keys) {
        run += row[k] || 0;
        next[`${k}__stack`] = run;
        next[`${k}__stack__lg`] = run > 0 ? Math.log10(run) : null;
      }
      return next;
    });
  }, [chartData, stacked, selectedPages]);

  const displayData = stacked ? stackedData : chartData;

  const visibleKeys = useMemo(
    () => ALL_PAGE_KEYS.filter((k) => selectedPages.has(k)),
    [selectedPages],
  );

  const noneSelected = visibleKeys.length === 0;

  const ongoingBand = useMemo(() => ongoingBandExtents(displayData), [displayData]);

  const tooltipFormatter = (value, name) => {
    const label = LABEL_BY_KEY[name] || name;
    if (logScale) {
      const real = value != null && value !== '' ? Math.round(10 ** Number(value)) : 0;
      return [real.toLocaleString('en-US'), label];
    }
    return [typeof value === 'number' ? value.toLocaleString('en-US') : value, label];
  };

  const allPagesOn = selectedPages.size === ALL_PAGE_KEYS.length;
  const nonePages = selectedPages.size === 0;

  const toggleAllPages = () => {
    setSelectedPages(allPagesOn ? new Set() : new Set(ALL_PAGE_KEYS));
  };

  const toggleGroup = (group) => {
    const keys = group.items.map((it) => it.key);
    const everyOn = keys.every((k) => selectedPages.has(k));
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const togglePage = (key) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chartMargin = { top: 12, right: 16, left: 4, bottom: 8 };
  const chartMarginBottom = { ...chartMargin, bottom: 32 };

  return (
    <AnalyticsShell
      active="page-views"
      breadcrumb={{ prefix: 'Traffic', title: 'Page views' }}
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
              Data is based on the number of times an end-user views a page (<code style={PS.code}>page.display</code>).
            </span>
            <div style={PS.headControls}>
              <div role="radiogroup" aria-label="Group by period" style={PS.switch}>
                {PERIOD_OPTIONS.map((opt) => {
                  const active = groupBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setGroupBy(opt.value)}
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
                title="Download as CSV"
                aria-label="Download as CSV"
                onClick={() => downloadPageViewsCsv(chartData, visibleKeys)}
                disabled={noneSelected || !chartData.length}
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              {loading ? (
                <div style={PS.loading}>Loading page views…</div>
              ) : errorMsg ? (
                <div style={PS.errorBox}>{errorMsg}</div>
              ) : noneSelected ? (
                <div style={PS.loading}>No page categories selected.</div>
              ) : displayData.length === 0 ? (
                <div style={PS.loading}>No data in this range. Navigate the portal to record page views.</div>
              ) : (
                <div style={{ width: '100%', height: 420 }}>
                  <ResponsiveContainer
                    key={`${groupBy}-${raw?.startDate || ''}-${raw?.endDate || ''}`}
                    width="100%"
                    height="100%"
                  >
                    <LineChart data={displayData} margin={chartMarginBottom}>
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
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#6e7079' }}
                        minTickGap={24}
                        label={{
                          value: 'DATE',
                          position: 'insideBottomRight',
                          offset: -4,
                          fill: '#6E7079',
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        label={{
                          value: 'PAGE VIEWS',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#6E7079',
                          fontSize: 11,
                          offset: 10,
                        }}
                      />
                      <Tooltip formatter={tooltipFormatter} labelFormatter={(l) => l} />
                      {visibleKeys.map((k) => {
                        const color = COLOR_BY_KEY[k] || '#64748b';
                        let dataKey = k;
                        if (stacked && logScale) dataKey = `${k}__stack__lg`;
                        else if (stacked) dataKey = `${k}__stack`;
                        else if (logScale) dataKey = `${k}__lg`;
                        return (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={dataKey}
                            name={k}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 2.5, fill: '#fff', strokeWidth: 1 }}
                            isAnimationActive={false}
                            connectNulls
                          />
                        );
                      })}
                      <Brush
                        dataKey="name"
                        height={28}
                        stroke="#cbd5e1"
                        fill="#f8fafc"
                        travellerWidth={8}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {!loading && !errorMsg && visibleKeys.length > 0 && (
              <div style={PS.legend}>
                {visibleKeys.map((k) => (
                  <span key={k} style={PS.legendItem}>
                    <span style={{ ...PS.legendDot, background: COLOR_BY_KEY[k] }} />
                    <span>{LABEL_BY_KEY[k]}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter page views">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter page views</h3>
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
              <FieldSelect label="Interface language" value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} />
              <FieldSelect label="Authentication status" value={authStatus} onChange={setAuthStatus} options={AUTH_OPTIONS} />
              <p style={PS.filterHint}>
                Interface language filters rows only when <code style={PS.code}>page.display</code> events include matching{' '}
                <code style={PS.code}>data.filters</code> (optional future enrichment).
              </p>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allPagesOn}
                    indeterminate={!allPagesOn && !nonePages}
                    onChange={toggleAllPages}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {PAGE_GROUPS.map((group) => {
                const keys = group.items.map((it) => it.key);
                const onCount = keys.filter((k) => selectedPages.has(k)).length;
                const groupChecked = onCount === keys.length;
                const groupIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={group.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={groupChecked}
                          indeterminate={groupIndeterminate}
                          onChange={() => toggleGroup(group)}
                        />
                        <span>{group.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {group.items.map((it) => (
                        <li key={it.key}>
                          <label style={PS.checkRow}>
                            <Checkbox checked={selectedPages.has(it.key)} onChange={() => togglePage(it.key)} />
                            <span style={{ ...PS.colorDot, background: it.color }} aria-hidden="true" />
                            <span>{it.label}</span>
                          </label>
                          {it.url && <div style={PS.targetUrl}>{it.url}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div style={FS.field} ref={ref}>
      <label style={FS.label}>{label}</label>
      <button
        type="button"
        style={FS.input}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <span style={FS.caret}>
          <IconChevron />
        </span>
      </button>
      {open && (
        <ul style={FS.menu} role="listbox">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    ...FS.option,
                    background: selected ? '#eff6ff' : 'transparent',
                    color: selected ? '#1d4ed8' : '#0f172a',
                    fontWeight: selected ? 600 : 500,
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
  code: { fontSize: '0.8rem', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  headControls: { display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
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
  loading: { padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' },
  errorBox: { padding: '24px', color: '#b91c1c', fontSize: '0.9rem' },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 18px',
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
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
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
  filterHint: { fontSize: '0.72rem', color: '#64748b', margin: '0 0 12px', lineHeight: 1.45 },
  selectAllRow: { paddingTop: '10px', paddingBottom: '6px', marginBottom: '4px' },
  categoryGroup: { padding: '6px 0' },
  categoryHeader: { paddingBottom: '2px' },
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
    fontSize: '0.83rem',
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
  targetUrl: {
    fontSize: '0.72rem',
    color: '#64748b',
    paddingLeft: '42px',
    marginTop: '-2px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
};

const FS = {
  field: { position: 'relative', marginBottom: '14px' },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  caret: { color: '#64748b', display: 'inline-flex' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    margin: 0,
    padding: '4px',
    listStyle: 'none',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
    zIndex: 10,
    maxHeight: '220px',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    padding: '7px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
