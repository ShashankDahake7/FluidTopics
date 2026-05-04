'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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

/* ------------------------------ Event catalogue (colours match FT blueprint) ------------------------------ */

const EVENT_CATEGORIES = [
  {
    key: 'views',
    label: 'Views',
    events: [
      { key: 'document.start_display', label: 'document.start_display', color: '#8cb860' },
      { key: 'topic.start_display', label: 'topic.start_display', color: '#bd50ae' },
      { key: 'page.display', label: 'page.display', color: '#49c06a' },
    ],
  },
  {
    key: 'searches',
    label: 'Searches',
    events: [
      { key: 'khub.search', label: 'khub.search', color: '#acb839' },
      { key: 'search_page.select', label: 'search_page.select', color: '#6972d7' },
      { key: 'document.search', label: 'document.search', color: '#85ad40' },
    ],
  },
  {
    key: 'interactions',
    label: 'Interactions',
    events: [
      { key: 'link.share', label: 'link.share', color: '#bc81d5' },
      { key: 'feedback.send', label: 'feedback.send', color: '#446b1d' },
      { key: 'document.rate', label: 'document.rate', color: '#d4568b' },
      { key: 'topic.rate', label: 'topic.rate', color: '#46b57c' },
      { key: 'document.unrate', label: 'document.unrate', color: '#892c6a' },
      { key: 'topic.unrate', label: 'topic.unrate', color: '#43c8ac' },
      { key: 'document.print', label: 'document.print', color: '#d54962' },
      { key: 'document.download', label: 'document.download', color: '#6bad66' },
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    events: [
      { key: 'bookmark.delete', label: 'bookmark.delete', color: '#d1972c' },
      { key: 'bookmark.create', label: 'bookmark.create', color: '#d97db9' },
      { key: 'collection.create', label: 'collection.create', color: '#628ed6' },
      { key: 'collection.delete', label: 'collection.delete', color: '#c07b31' },
      { key: 'collection.update', label: 'collection.update', color: '#8f2748' },
      { key: 'personal_book.create', label: 'personal_book.create', color: '#beaa52' },
      { key: 'personal_book.delete', label: 'personal_book.delete', color: '#8f2931' },
      { key: 'personal_book.update', label: 'personal_book.update', color: '#997835' },
      { key: 'personal_topic.create', label: 'personal_topic.create', color: '#d04d4a' },
      { key: 'personal_topic.delete', label: 'personal_topic.delete', color: '#832e15' },
      { key: 'personal_topic.update', label: 'personal_topic.update', color: '#d66c77' },
      { key: 'saved_search.create', label: 'saved_search.create', color: '#c85932' },
      { key: 'saved_search.delete', label: 'saved_search.delete', color: '#db845e' },
      { key: 'saved_search.update', label: 'saved_search.update', color: '#543586' },
    ],
  },
];

const ALL_EVENTS = EVENT_CATEGORIES.flatMap((c) => c.events);
const COLOR_BY_KEY = Object.fromEntries(ALL_EVENTS.map((e) => [e.key, e.color]));

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

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

function ongoingBandExtents(chartData) {
  const ongoing = chartData.filter((d) => d.ongoing);
  if (!ongoing.length) return null;
  return { x1: ongoing[0].name, x2: ongoing[ongoing.length - 1].name };
}

/** Min gap between Y-brush handles (as fraction of axis span). */
const Y_BRUSH_MIN_GAP = 0.02;

/**
 * Vertical range control styled like Recharts <Brush> (track + two travellers + tint).
 * `lowNorm` / `highNorm` are 0–1 from bottom → top of track, mapped to the Y domain in the page.
 */
function VerticalYBrush({ lowNorm, highNorm, onChange, disabled, 'aria-label': ariaLabel = 'Y-axis range' }) {
  const trackRef = useRef(null);

  const clampPair = useCallback((lo, hi) => {
    let low = Math.max(0, Math.min(1, lo));
    let high = Math.max(0, Math.min(1, hi));
    if (high - low < Y_BRUSH_MIN_GAP) {
      const mid = (low + high) / 2;
      low = Math.max(0, mid - Y_BRUSH_MIN_GAP / 2);
      high = Math.min(1, low + Y_BRUSH_MIN_GAP);
      if (high - low < Y_BRUSH_MIN_GAP) {
        low = high - Y_BRUSH_MIN_GAP;
      }
    }
    return { low, high };
  }, []);

  const clientToNorm = useCallback((clientY) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return 0;
    return Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
  }, []);

  const startDrag = useCallback(
    (which) => (e) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.button !== 0) return;
      const move = (ev) => {
        const n = clientToNorm(ev.clientY);
        if (which === 'low') {
          const nl = Math.min(n, highNorm - Y_BRUSH_MIN_GAP);
          onChange(clampPair(nl, highNorm));
        } else {
          const nh = Math.max(n, lowNorm + Y_BRUSH_MIN_GAP);
          onChange(clampPair(lowNorm, nh));
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [disabled, clientToNorm, clampPair, onChange, lowNorm, highNorm],
  );

  const onTrackPointerDown = useCallback(
    (e) => {
      if (disabled || e.button !== 0) return;
      const n = clientToNorm(e.clientY);
      const dLow = Math.abs(n - lowNorm);
      const dHigh = Math.abs(n - highNorm);
      if (dLow <= dHigh) startDrag('low')(e);
      else startDrag('high')(e);
    },
    [disabled, clientToNorm, lowNorm, highNorm, startDrag],
  );

  const travellerStyle = {
    position: 'absolute',
    left: '50%',
    width: '10px',
    height: '16px',
    borderRadius: '2px',
    background: '#cbd5e1',
    border: '1px solid #94a3b8',
    cursor: 'ns-resize',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    padding: '2px 0',
    boxSizing: 'border-box',
    touchAction: 'none',
    transform: 'translate(-50%, 50%)',
    zIndex: 2,
    appearance: 'none',
    WebkitAppearance: 'none',
    margin: 0,
  };

  const lowPct = lowNorm * 100;
  const highPct = highNorm * 100;
  const bandBottom = lowPct;
  const bandHeight = Math.max(highPct - lowPct, 0);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      title="Drag handles to set the visible Y range (like the date brush below)"
      style={{
        width: 22,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        alignSelf: 'stretch',
        minHeight: 0,
        userSelect: 'none',
      }}
    >
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        style={{
          position: 'relative',
          flex: 1,
          width: 20,
          minHeight: 64,
          borderRadius: '4px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          opacity: disabled ? 0.45 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            bottom: `${bandBottom}%`,
            height: `${bandHeight}%`,
            borderRadius: 3,
            background: 'rgba(147, 197, 253, 0.35)',
            pointerEvents: 'none',
          }}
        />
        <button
          type="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Lower Y bound"
          onPointerDown={startDrag('low')}
          style={{
            ...travellerStyle,
            bottom: `${lowPct}%`,
            top: 'auto',
          }}
        >
          <span style={{ width: 5, height: 1, background: '#fff', borderRadius: 1 }} />
          <span style={{ width: 5, height: 1, background: '#fff', borderRadius: 1 }} />
        </button>
        <button
          type="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upper Y bound"
          onPointerDown={startDrag('high')}
          style={{
            ...travellerStyle,
            bottom: `${highPct}%`,
            top: 'auto',
          }}
        >
          <span style={{ width: 5, height: 1, background: '#fff', borderRadius: 1 }} />
          <span style={{ width: 5, height: 1, background: '#fff', borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

/** Max plotted value in the window (linear scale), for Y-axis domain. */
function maxYInWindow(rows, keys, stacked) {
  if (!rows.length || !keys.length) return 0;
  let m = 0;
  for (const row of rows) {
    if (stacked) {
      for (const k of keys) {
        m = Math.max(m, Number(row[`${k}__stack`]) || 0);
      }
    } else {
      for (const k of keys) {
        m = Math.max(m, Number(row[k]) || 0);
      }
    }
  }
  return m;
}

/** Tooltip lists at most this many event types (by count, descending). */
const TOOLTIP_MAX_EVENTS = 20;

function EventsTooltipBody({ active, payload, label, visibleKeys }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || typeof row !== 'object') return null;

  const entries = visibleKeys
    .map((k) => ({
      key: k,
      count: Number(row[k]) || 0,
      color: COLOR_BY_KEY[k] || '#94a3b8',
    }))
    .sort((a, b) => b.count - a.count);

  const total = entries.reduce((s, e) => s + e.count, 0);
  const top = entries.slice(0, TOOLTIP_MAX_EVENTS);
  const hidden = Math.max(0, entries.length - TOOLTIP_MAX_EVENTS);

  return (
    <div
      style={{
        background: 'rgba(31, 41, 55, 0.72)',
        WebkitBackdropFilter: 'blur(10px)',
        backdropFilter: 'blur(10px)',
        color: '#f8fafc',
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        fontSize: '12px',
        lineHeight: 1.35,
        maxWidth: 'min(380px, 92vw)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid #374151',
        }}
      >
        In {label}: {total.toLocaleString('en-US')}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {top.map((e) => (
          <li
            key={e.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '3px 0',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: e.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.key}</span>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#e5e7eb' }}>
              {e.count.toLocaleString('en-US')}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid #374151',
            fontSize: '11px',
            color: '#9ca3af',
          }}
        >
          +{hidden} more event type{hidden === 1 ? '' : 's'} not shown
        </div>
      ) : null}
    </div>
  );
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

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <circle cx="12" cy="7.5" r="0.8" fill="#1d4ed8" stroke="none" />
  </svg>
);

const IconExternal = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
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

/* ------------------------------ CSV ------------------------------ */

function downloadEventsCsv(chartData, keys) {
  if (!chartData.length || !keys.length) return;
  const header = ['Period', ...keys];
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
  a.download = 'events.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Page ------------------------------ */

export default function EventsPage() {
  const [groupBy, setGroupBy] = useState('month');
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [appliedSelected, setAppliedSelected] = useState(() => new Set(ALL_EVENTS.map((e) => e.key)));
  const [pendingSelected, setPendingSelected] = useState(() => new Set(ALL_EVENTS.map((e) => e.key)));

  /** Mirrors brush window for Y-axis math (Recharts Brush drives zoom via internal state). */
  const [brushIdx, setBrushIdx] = useState({ start: 0, end: 0 });
  /** 0–1 along vertical brush track (bottom→top), maps to [low×cap, high×cap] on the Y axis. */
  const [yBrushNorm, setYBrushNorm] = useState({ low: 0, high: 1 });

  const { startDateIso, endDateIso } = useMemo(() => {
    const { start, end } = rangeForGroup(groupBy);
    return { startDateIso: start.toISOString(), endDateIso: end.toISOString() };
  }, [groupBy]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v1/traffic/events/time-series', {
        startDate: startDateIso,
        endDate: endDateIso,
        groupByPeriod: groupBy,
      });
      if (json?.series && json?.periods) {
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
  }, [groupBy, startDateIso, endDateIso]);

  useEffect(() => {
    // Remote chart load on range/granularity change (same pattern as user-traffic).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const baseChartData = useMemo(() => {
    if (!raw?.periods?.length || !raw.series) return [];
    return raw.periods.map((p, i) => {
      const row = {
        name: formatAxisLabel(p.periodStartDate, groupBy),
        periodStart: p.periodStartDate,
        periodEnd: p.periodEndDate,
        ongoing: periodIsOngoing(p),
      };
      for (const e of ALL_EVENTS) {
        const arr = raw.series[e.key];
        row[e.key] = Array.isArray(arr) && arr[i] != null ? arr[i] : 0;
      }
      return row;
    });
  }, [raw, groupBy]);

  const visibleKeys = useMemo(
    () => ALL_EVENTS.map((e) => e.key).filter((k) => appliedSelected.has(k)),
    [appliedSelected],
  );

  const chartData = useMemo(() => {
    if (!baseChartData.length) return [];
    if (!stacked) return baseChartData;
    return baseChartData.map((row) => {
      const next = { ...row };
      let run = 0;
      for (const k of visibleKeys) {
        run += row[k] || 0;
        next[`${k}__stack`] = run;
      }
      return next;
    });
  }, [baseChartData, stacked, visibleKeys]);

  const displayData = useMemo(() => {
    if (!logScale) return chartData;
    return chartData.map((row) => {
      const next = { ...row };
      const keysToPlot = stacked ? visibleKeys.map((k) => `${k}__stack`) : visibleKeys;
      for (const rawKey of stacked ? visibleKeys : visibleKeys) {
        const v = stacked ? row[`${rawKey}__stack`] : row[rawKey];
        const num = v || 0;
        next[`${rawKey}__lg`] = Math.log10(Math.max(num, 1));
      }
      return next;
    });
  }, [chartData, logScale, stacked, visibleKeys]);

  useEffect(() => {
    if (!displayData.length) return;
    setBrushIdx({ start: 0, end: displayData.length - 1 });
    setYBrushNorm({ low: 0, high: 1 });
  }, [groupBy, raw, displayData.length]);

  const ongoingBand = useMemo(() => ongoingBandExtents(displayData.length ? displayData : chartData), [displayData, chartData]);

  const noneSelected = visibleKeys.length === 0;

  const handleBrushChange = useCallback((range) => {
    if (!range || typeof range.startIndex !== 'number' || typeof range.endIndex !== 'number') return;
    setBrushIdx({
      start: range.startIndex,
      end: Math.min(range.endIndex, displayData.length ? displayData.length - 1 : 0),
    });
  }, [displayData.length]);

  const windowedForY = useMemo(() => {
    if (!displayData.length) return [];
    const end = Math.min(brushIdx.end, displayData.length - 1);
    const start = Math.max(0, Math.min(brushIdx.start, end));
    return displayData.slice(start, end + 1);
  }, [displayData, brushIdx.start, brushIdx.end]);

  const dataMaxY = useMemo(() => {
    if (!windowedForY.length || logScale) return null;
    return maxYInWindow(windowedForY, visibleKeys, stacked);
  }, [windowedForY, visibleKeys, stacked, logScale]);

  const naturalYCap = useMemo(() => {
    if (dataMaxY == null) return 1;
    return Math.max(1, Math.ceil(dataMaxY * 1.08));
  }, [dataMaxY]);

  const yDomainMinLin = useMemo(() => yBrushNorm.low * naturalYCap, [yBrushNorm.low, naturalYCap]);
  const yDomainMaxLin = useMemo(() => yBrushNorm.high * naturalYCap, [yBrushNorm.high, naturalYCap]);

  const yDomainLinear = useMemo(() => {
    if (logScale) return null;
    const lo = yDomainMinLin;
    const hi = yDomainMaxLin;
    const eps = Math.max(1e-6, (naturalYCap || 1) * 1e-9);
    return [lo, Math.max(hi, lo + eps)];
  }, [logScale, yDomainMinLin, yDomainMaxLin, naturalYCap]);

  const handleYBrushChange = useCallback((next) => {
    setYBrushNorm(next);
  }, []);

  const allCount = ALL_EVENTS.length;

  const tooltipContent = useCallback(
    (props) => <EventsTooltipBody {...props} visibleKeys={visibleKeys} />,
    [visibleKeys],
  );

  const toggleAllPending = () => {
    setPendingSelected((prev) => {
      if (prev.size === allCount) return new Set();
      return new Set(ALL_EVENTS.map((e) => e.key));
    });
  };

  const toggleOnePending = (key) => {
    setPendingSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategoryPending = (cat) => {
    const keys = cat.events.map((e) => e.key);
    const everyOn = keys.every((k) => pendingSelected.has(k));
    setPendingSelected((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const applyFilters = () => {
    setAppliedSelected(new Set(pendingSelected));
  };

  const chartMargin = { top: 8, right: 6, left: 2, bottom: 4 };
  const chartMarginBottom = { ...chartMargin, bottom: 24 };

  return (
    <AnalyticsShell
      active="events"
      breadcrumb={{ prefix: 'Traffic', title: 'Events' }}
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
            <span style={PS.headTagline}>Events help you track trends in user engagement.</span>
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
                onClick={() => downloadEventsCsv(chartData, visibleKeys)}
                disabled={noneSelected || !chartData.length}
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              {loading ? (
                <div style={{ ...PS.loading, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                  Loading events…
                </div>
              ) : errorMsg ? (
                <div style={{ ...PS.errorBox, flex: 1, display: 'flex', alignItems: 'center', minHeight: 200 }}>{errorMsg}</div>
              ) : noneSelected ? (
                <div style={{ ...PS.loading, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                  No events selected — use the filter panel and Apply.
                </div>
              ) : displayData.length === 0 ? (
                <div style={{ ...PS.loading, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                  No data in this range.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 2,
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
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
                        width={52}
                        domain={logScale ? ['auto', 'auto'] : yDomainLinear}
                        allowDataOverflow={!logScale}
                        label={{
                          value: 'EVENTS',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#6E7079',
                          fontSize: 11,
                          offset: 10,
                        }}
                      />
                      <Tooltip
                        content={tooltipContent}
                        wrapperStyle={{ outline: 'none', pointerEvents: 'none' }}
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      {visibleKeys.map((k) => {
                        const color = COLOR_BY_KEY[k] || '#64748b';
                        const dataKey = logScale ? `${k}__lg` : stacked ? `${k}__stack` : k;
                        return (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={dataKey}
                            name={logScale ? `${k}__lg` : k}
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
                        height={24}
                        stroke="#cbd5e1"
                        fill="#f8fafc"
                        gap={1}
                        onChange={handleBrushChange}
                        travellerWidth={8}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                  {!logScale && (
                    <VerticalYBrush
                      lowNorm={yBrushNorm.low}
                      highNorm={yBrushNorm.high}
                      onChange={handleYBrushChange}
                      disabled={noneSelected}
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter events">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter events</h3>
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
              <div style={PS.notice} role="note">
                <span style={PS.noticeIcon}>
                  <IconInfo />
                </span>
                <span style={PS.noticeText}>
                  See{' '}
                  <a
                    href="https://doc.fluidtopics.com/r/Fluid-Topics-Analytics-Guide/Analytics-events"
                    target="_blank"
                    rel="noreferrer noopener"
                    style={PS.noticeLink}
                  >
                    Events documentation
                    <span style={{ marginLeft: '4px', display: 'inline-flex' }}>
                      <IconExternal />
                    </span>
                  </a>
                  . Deletes, unrates, and personal-book topic edits are counted from server telemetry; global search hit clicks are counted when users leave this portal’s search results page.
                </span>
              </div>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={pendingSelected.size === allCount}
                    indeterminate={pendingSelected.size > 0 && pendingSelected.size < allCount}
                    onChange={toggleAllPending}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {EVENT_CATEGORIES.map((cat) => {
                const keys = cat.events.map((e) => e.key);
                const onCount = keys.filter((k) => pendingSelected.has(k)).length;
                const catChecked = onCount === keys.length;
                const catIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={cat.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={catChecked}
                          indeterminate={catIndeterminate}
                          onChange={() => toggleCategoryPending(cat)}
                        />
                        <span>{cat.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {cat.events.map((e) => (
                        <li key={e.key}>
                          <label style={PS.checkRow}>
                            <Checkbox
                              checked={pendingSelected.has(e.key)}
                              onChange={() => toggleOnePending(e.key)}
                            />
                            <span style={{ ...PS.colorDot, background: e.color }} aria-hidden="true" />
                            <span style={PS.eventName}>{e.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <footer style={PS.drawerFoot}>
              <button type="button" style={PS.applyBtn} onClick={applyFilters}>
                Apply
              </button>
            </footer>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

const PS = {
  layout: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
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
  body: {
    flex: 1,
    minHeight: 0,
    padding: '10px 16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  chartCard: {
    flex: 1,
    minHeight: 0,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '10px 12px 8px',
    display: 'flex',
    flexDirection: 'column',
  },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' },
  errorBox: { padding: '24px', color: '#b91c1c', fontSize: '0.9rem' },

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
    gap: '10px',
    alignItems: 'flex-start',
    padding: '10px 12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    color: '#1e3a8a',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    marginBottom: '12px',
  },
  noticeIcon: { display: 'inline-flex', flexShrink: 0, paddingTop: '1px' },
  noticeText: { flex: 1 },
  noticeLink: {
    color: '#1d4ed8',
    fontWeight: 600,
    textDecoration: 'underline',
    display: 'inline-flex',
    alignItems: 'center',
  },

  selectAllRow: {
    paddingBottom: '10px',
    marginBottom: '8px',
    borderBottom: '1px solid #e5e7eb',
  },

  categoryGroup: { padding: '8px 0' },
  categoryHeader: { paddingBottom: '4px' },

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
    fontSize: '0.82rem',
    color: '#1f2937',
    cursor: 'pointer',
    userSelect: 'none',
  },
  eventName: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.78rem',
  },
  colorDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '2px',
    flexShrink: 0,
  },
  drawerFoot: {
    borderTop: '1px solid #e5e7eb',
    padding: '12px 18px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  applyBtn: {
    padding: '8px 22px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: 600,
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
  dash: { width: '10px', height: '2px', background: '#ffffff', borderRadius: '1px' },
};
