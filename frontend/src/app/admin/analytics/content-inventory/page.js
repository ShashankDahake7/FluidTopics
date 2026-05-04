'use client';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

import api from '@/lib/api';

/* ---------------------- Series + dataset ---------------------- */

const COLOR = {
  books: '#9D207B',
  unstructured: '#CFB017',
  articles: '#361FAD',
  topics: '#45A191',
  attachments: '#BD0F49',
};

const PERIOD_OPTIONS = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** Align UI validation with your analytics retention policy (days). */
const ANALYTICS_DATA_RETENTION_DAYS = 730;

function toDateInputValue(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInput(str, endOfDay = false) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return isNaN(dt.getTime()) ? null : dt;
}

function defaultRangeForPeriod(period) {
  const end = new Date();
  const start = new Date();
  if (period === 'monthly') start.setMonth(start.getMonth() - 11);
  else if (period === 'weekly') start.setDate(start.getDate() - 12 * 7);
  else start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

const DOC_GROUP = [
  { key: 'books',         label: 'Books',                  color: COLOR.books },
  { key: 'unstructured',  label: 'Unstructured documents', color: COLOR.unstructured },
  { key: 'articles',      label: 'Articles',               color: COLOR.articles },
];
const OTHER_GROUP = [
  { key: 'topics',       label: 'Topics (books only)', color: COLOR.topics },
  { key: 'attachments',  label: 'Attachments',         color: COLOR.attachments },
];

/* ---------------------------- Icons ---------------------------- */

const IconDownload = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="14" y2="6" />
    <circle cx="17" cy="6" r="2" />
    <line x1="20" y1="6" x2="22" y2="6" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <circle cx="11" cy="12" r="2" />
    <line x1="14" y1="12" x2="22" y2="12" />
    <line x1="4" y1="18" x2="16" y2="18" />
    <circle cx="19" cy="18" r="2" />
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/** Line chart — multi-series lines */
const IconChartLine = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 8h7v7" />
  </svg>
);
/** Stacked bars */
const IconChartStacked = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="14" width="4" height="6" rx="1" fill="currentColor" stroke="none" opacity="0.35" />
    <rect x="10" y="10" width="4" height="10" rx="1" fill="currentColor" stroke="none" opacity="0.55" />
    <rect x="16" y="6" width="4" height="14" rx="1" fill="currentColor" stroke="none" opacity="0.85" />
    <path d="M3 21h18" />
  </svg>
);
/** Linear Y-axis */
const IconScaleLinear = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="6" y1="21" x2="6" y2="4" />
    <polyline points="6 4 4 6 8 6" />
    <text x="9" y="10" fontSize="8" fill="currentColor">1</text>
    <text x="9" y="17" fontSize="8" fill="currentColor">2</text>
  </svg>
);
/** Logarithmic Y-axis */
const IconScaleLog = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 21c8-6 10-12 12-17" />
    <text x="14" y="9" fontSize="7" fill="currentColor">log</text>
  </svg>
);
const Tick = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ---------------------------- Period switch ---------------------------- */

function PeriodSwitch({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Group by period" style={SW.wrap}>
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              ...SW.opt,
              color: active ? '#0f172a' : '#475569',
              fontWeight: active ? 700 : 500,
              background: active ? '#ffffff' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------- Checkbox -------------------------- */

function Checkbox({ checked, indeterminate, onChange, label, color, bold = false, dim = false }) {
  return (
    <label style={{ ...CB.row, opacity: dim ? 0.5 : 1, cursor: dim ? 'not-allowed' : 'pointer' }}>
      <span
        style={{
          ...CB.box,
          background: checked || indeterminate ? '#1d4ed8' : '#ffffff',
          borderColor: checked || indeterminate ? '#1d4ed8' : '#94a3b8',
        }}
        aria-hidden="true"
      >
        {checked && <Tick size={12} />}
        {indeterminate && <span style={CB.dash} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={CB.nativeInput}
        disabled={dim}
      />
      {color && <span style={{ ...CB.dot, background: color }} aria-hidden="true" />}
      <span style={{ fontSize: '0.86rem', fontWeight: bold ? 600 : 500, color: '#0f172a' }}>{label}</span>
    </label>
  );
}

/* ---------------------------- Chart ---------------------------- */

const SERIES_ORDER = ['books', 'unstructured', 'articles', 'topics', 'attachments'];

const apiToLocalMap = {
  books: 'books',
  unstructuredDocuments: 'unstructured',
  articles: 'articles',
  topics: 'topics',
  attachments: 'attachments',
};

function buildYTicks(maxY, scaleMode) {
  if (maxY <= 0) return [0];
  if (scaleMode !== 'log') {
    const step = maxY <= 10 ? 1 : maxY <= 50 ? 5 : maxY <= 200 ? 10 : Math.ceil(maxY / 5);
    const out = [];
    for (let v = 0; v <= maxY; v += step) out.push(v);
    return out;
  }
  const ticks = [0];
  let p = 1;
  while (p <= maxY * 1.01) {
    ticks.push(Math.round(p));
    if (p < 10) p *= 2;
    else p *= 2;
  }
  return [...new Set(ticks)].filter((t) => t <= maxY * 1.02).sort((a, b) => a - b);
}

function yFromValue(v, maxY, innerH, scaleMode) {
  if (maxY <= 0) return innerH;
  if (scaleMode === 'log') {
    const vv = Math.max(0, v);
    return innerH - (Math.log(1 + vv) / Math.log(1 + maxY)) * innerH;
  }
  return innerH - (v / maxY) * innerH;
}

function ContentInventoryChart({ data, activeSeries, period, chartMode, scaleMode }) {
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
  const PAD_L = 80;
  const PAD_R = 24;
  const PAD_T = 50;
  const PAD_B = 60;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const dynamicMonths = useMemo(() => {
    if (!data?.results?.length) return [];
    return data.results[0].periods.map((p) => p.periodStartDate);
  }, [data]);

  const dynamicSeries = useMemo(() => {
    const s = {};
    if (!data?.results) return s;
    data.results.forEach((res) => {
      const localKey = apiToLocalMap[res.type];
      if (localKey) {
        s[localKey] = res.periods.map((p) => p.count);
      }
    });
    return s;
  }, [data]);

  const enabled = useMemo(
    () => SERIES_ORDER.filter((k) => activeSeries[k]),
    [activeSeries],
  );

  const N = dynamicMonths.length || 1;
  const slot = N > 1 ? innerW / (N - 1) : innerW;
  const xAt = useCallback((i) => PAD_L + i * slot, [PAD_L, slot]);

  const maxY = useMemo(() => {
    if (!enabled.length) return 10;
    if (chartMode === 'stacked') {
      let peak = 0;
      for (let i = 0; i < N; i++) {
        let sum = 0;
        enabled.forEach((k) => {
          sum += (dynamicSeries[k] || [])[i] || 0;
        });
        peak = Math.max(peak, sum);
      }
      const step = peak <= 10 ? 1 : 5;
      return Math.max(step, Math.ceil((peak * 1.08) / step) * step);
    }
    const peaks = enabled.flatMap((k) => dynamicSeries[k] || []);
    if (peaks.length === 0) return 10;
    const v = Math.max(...peaks);
    const step = v <= 10 ? 1 : v <= 50 ? 5 : v <= 200 ? 10 : Math.ceil(v / 5);
    return Math.max(step, Math.ceil((v * 1.12) / step) * step);
  }, [enabled, dynamicSeries, N, chartMode]);

  const ticks = useMemo(() => buildYTicks(maxY, scaleMode), [maxY, scaleMode]);

  const yAxisPos = useCallback(
    (rawVal) => PAD_T + yFromValue(rawVal, maxY, innerH, scaleMode),
    [maxY, innerH, scaleMode],
  );

  const [hover, setHover] = useState(null);

  const series = useMemo(
    () =>
      enabled.map((k) => ({
        key: k,
        color: COLOR[k],
        label: labelFor(k),
        values: (dynamicSeries[k] || Array(N).fill(0)).map((v) => v || 0),
      })),
    [enabled, dynamicSeries, N],
  );

  const linePoints = useMemo(() => {
    if (chartMode !== 'line') return [];
    return series.map((s) => ({
      ...s,
      points: s.values.map((v, i) => ({
        x: xAt(i),
        y: yAxisPos(v),
        v,
        m: dynamicMonths[i],
      })),
    }));
  }, [series, chartMode, dynamicMonths, yAxisPos, xAt]);

  const stackedBands = useMemo(() => {
    if (chartMode !== 'stacked' || !series.length) return [];
    const bands = [];
    for (let si = 0; si < series.length; si++) {
      const s = series[si];
      const cumBottom = [];
      const cumTop = [];
      for (let i = 0; i < N; i++) {
        let bottom = 0;
        for (let j = 0; j < si; j++) {
          bottom += (dynamicSeries[series[j].key] || [])[i] || 0;
        }
        const seg = (dynamicSeries[s.key] || [])[i] || 0;
        cumBottom.push(bottom);
        cumTop.push(bottom + seg);
      }
      const ptsBottom = cumBottom.map((v, i) => ({
        x: xAt(i),
        y: yAxisPos(v),
        v,
      }));
      const ptsTop = cumTop.map((v, i) => ({
        x: xAt(i),
        y: yAxisPos(v),
        v,
      }));
      bands.push({ key: s.key, color: s.color, label: s.label, ptsBottom, ptsTop, values: s.values });
    }
    return bands;
  }, [chartMode, series, N, dynamicSeries, yAxisPos, xAt]);

  const ongoingX1 = N > 1 ? xAt(N - 2) + slot / 2 : PAD_L;
  const ongoingX2 = N > 1 ? xAt(N - 1) : W - PAD_R;

  const hoverTotals = useMemo(() => {
    if (hover == null) return null;
    const i = hover.idx;
    const rows = series.map((s) => ({ label: s.label, color: s.color, v: s.values[i] || 0 }));
    const total = rows.reduce((a, r) => a + r.v, 0);
    return { rows, total, label: dynamicMonths[i] };
  }, [hover, series, dynamicMonths]);

  if (!data?.results?.length) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
        No chart data. Select at least one content type in the filter drawer and apply.
      </div>
    );
  }

  return (
    <div
      style={CH.wrap}
      ref={containerRef}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        if (px < PAD_L || px > W - PAD_R) {
          setHover(null);
          return;
        }
        const idx = Math.max(0, Math.min(N - 1, Math.round((px - PAD_L) / slot)));
        setHover({ idx, cx: xAt(idx) });
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Content inventory over time" style={{ display: 'block' }}>
        {ticks.map((t) => {
          const y = yAxisPos(t);
          return (
            <g key={`yt-${t}`}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#E0E6F1" />
              <text x={PAD_L - 8} y={y} dominantBaseline="middle" textAnchor="end" fontSize="12" fill="#6E7079">
                {t}
              </text>
            </g>
          );
        })}
        <text x={PAD_L - 36} y={PAD_T + innerH / 2} fontSize="11" fill="#6E7079" textAnchor="middle" transform={`rotate(-90 ${PAD_L - 36} ${PAD_T + innerH / 2})`}>
          CONTENT COUNT
        </text>

        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#6E7079" />
        <text x={W - PAD_R + 6} y={PAD_T + innerH} dominantBaseline="middle" fontSize="12" fill="#6E7079">
          DATE
        </text>

        <rect
          x={ongoingX1}
          y={PAD_T}
          width={Math.max(8, ongoingX2 - ongoingX1)}
          height={innerH}
          fill="#fbe5f2"
          fillOpacity={0.35}
        />
        <text x={(ongoingX1 + ongoingX2) / 2} y={PAD_T - 4} fontSize="11" textAnchor="middle" fill="#64748b">
          Ongoing period
        </text>

        {dynamicMonths.map((m, i) => {
          if (i % Math.max(1, Math.floor(N / 6)) !== 0 && i !== N - 1) return null;
          const cx = xAt(i);
          return (
            <g key={`xl-${m}`}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 18} fontSize="12" fill="#6E7079" textAnchor="middle">
                {period === 'monthly' ? monthLabel(m) : m}
              </text>
            </g>
          );
        })}

        {chartMode === 'line' &&
          linePoints.map((s) => (
            <g key={s.key}>
              <path
                d={s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {s.points.map((p, i) => (
                <circle
                  key={`${s.key}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="#ffffff"
                  stroke={s.color}
                  strokeWidth={2}
                  fillOpacity={i === N - 1 ? 0.85 : 1}
                />
              ))}
            </g>
          ))}

        {chartMode === 'stacked' &&
          stackedBands.map((band) => {
            const dPath = [
              ...band.ptsTop.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`),
              ...[...band.ptsBottom].reverse().map((p, i) => `L ${p.x} ${p.y}`),
              'Z',
            ].join(' ');
            return (
              <path key={band.key} d={dPath} fill={band.color} fillOpacity={0.82} stroke="#ffffff" strokeWidth={0.5} />
            );
          })}

        {chartMode === 'stacked' &&
          stackedBands.map((band) =>
            band.ptsTop.map((p, i) => (
              <circle key={`${band.key}-dot-${i}`} cx={p.x} cy={p.y} r={3} fill={band.color} stroke="#ffffff" strokeWidth={1} />
            )),
          )}

        {hover && (
          <g>
            <line x1={hover.cx} y1={PAD_T} x2={hover.cx} y2={PAD_T + innerH} stroke="#94a3b8" strokeDasharray="4 4" />
            {chartMode === 'line'
              ? linePoints.map((s) => {
                  const p = s.points[hover.idx];
                  return <circle key={`h-${s.key}`} cx={p.x} cy={p.y} r={6} fill={s.color} stroke="#ffffff" strokeWidth={2} />;
                })
              : stackedBands.map((band) => {
                  const p = band.ptsTop[hover.idx];
                  return <circle key={`h-${band.key}`} cx={p.x} cy={p.y} r={5} fill={band.color} stroke="#ffffff" strokeWidth={1.5} />;
                })}
          </g>
        )}
      </svg>

      {hover && hoverTotals && (
        <div
          style={{
            ...CH.tooltip,
            left: `${(hover.cx / W) * 100}%`,
            top: `${(PAD_T - 8) / H * 100}%`,
            transform: 'translate(-50%, -100%)',
            maxWidth: 'min(320px, 90vw)',
            whiteSpace: 'normal',
          }}
        >
          <div style={CH.tooltipTitle}>
            {period === 'monthly' ? monthLabel(hoverTotals.label) : hoverTotals.label}
            <span style={{ fontWeight: 500, marginLeft: 6 }}>· total {hoverTotals.total}</span>
          </div>
          {hoverTotals.rows.map((r) => (
            <div key={r.label} style={CH.tooltipRow}>
              <span style={{ ...CH.tooltipDot, background: r.color }} />
              <span>
                {r.label}: {r.v}
              </span>
            </div>
          ))}
          <div style={{ ...CH.tooltipHint, marginTop: 6 }}>
            Publications (counts) per content type for this period. Totals match the selected filters.
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(key) {
  return ({ books: 'Books', unstructured: 'Unstructured documents', articles: 'Articles', topics: 'Topics (books only)', attachments: 'Attachments' })[key] || key;
}
function monthLabel(m) {
  if (!m) return '';
  const d = new Date(m);
  if (isNaN(d.getTime())) return m;
  const map = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${map[d.getMonth()]} ${d.getFullYear()}`;
}

/* ----------------------------- Page ----------------------------- */

export default function ContentInventoryPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [chartMode, setChartMode] = useState('line');
  const [scaleMode, setScaleMode] = useState('linear');

  const defaultFilters = useMemo(
    () => ({
      books: true,
      unstructured: true,
      articles: true,
      topics: true,
      attachments: true,
    }),
    [],
  );

  const [pending, setPending] = useState(defaultFilters);
  const [applied, setApplied] = useState(() => ({ ...defaultFilters }));

  const [useCustomRange, setUseCustomRange] = useState(false);
  const [rangeStartInput, setRangeStartInput] = useState(() => toDateInputValue(defaultRangeForPeriod('monthly').start));
  const [rangeEndInput, setRangeEndInput] = useState(() => toDateInputValue(new Date()));

  const todayInputMax = useMemo(() => toDateInputValue(new Date()), []);
  const retentionInputMin = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ANALYTICS_DATA_RETENTION_DAYS);
    return toDateInputValue(d);
  }, []);

  const allDoc = ['books', 'unstructured', 'articles'];
  const allOther = ['topics', 'attachments'];

  const isGroupChecked = (keys) => keys.every((k) => pending[k]);
  const isGroupIndeterm = (keys) => keys.some((k) => pending[k]) && !isGroupChecked(keys);
  const allChecked = [...allDoc, ...allOther].every((k) => pending[k]);
  const allIndeterm = [...allDoc, ...allOther].some((k) => pending[k]) && !allChecked;

  const setOne = (k, v) => setPending((s) => ({ ...s, [k]: v }));
  const setGroup = (keys, v) => setPending((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, v])) }));

  const apply = () => setApplied({ ...pending });
  const dirty = JSON.stringify(applied) !== JSON.stringify(pending);

  const [data, setData] = useState(null);

  const typeFilters = useMemo(() => {
    const t = [];
    if (applied.books) t.push('books');
    if (applied.unstructured) t.push('unstructuredDocuments');
    if (applied.articles) t.push('articles');
    if (applied.topics) t.push('topics');
    if (applied.attachments) t.push('attachments');
    return t;
  }, [applied]);

  const rangeBounds = useMemo(() => {
    if (!useCustomRange) {
      const r = defaultRangeForPeriod(period);
      return { ok: true, start: r.start, end: r.end, error: null };
    }
    const s = parseDateInput(rangeStartInput, false);
    const e = parseDateInput(rangeEndInput, true);
    if (!s || !e) {
      return { ok: false, start: null, end: null, error: 'Enter valid start and end dates.' };
    }
    if (s >= e) {
      return { ok: false, start: null, end: null, error: 'End date must be later than start date.' };
    }
    const now = new Date();
    const earliest = new Date(now);
    earliest.setDate(earliest.getDate() - ANALYTICS_DATA_RETENTION_DAYS);
    earliest.setHours(0, 0, 0, 0);
    if (s < earliest) {
      return {
        ok: false,
        start: null,
        end: null,
        error: `Start date must be within the last ${ANALYTICS_DATA_RETENTION_DAYS} days (retention).`,
      };
    }
    if (e > now) {
      return { ok: false, start: null, end: null, error: 'End date cannot be in the future.' };
    }
    return { ok: true, start: s, end: e, error: null };
  }, [useCustomRange, period, rangeStartInput, rangeEndInput]);

  useEffect(() => {
    if (!rangeBounds.ok || typeFilters.length === 0) return;
    let cancelled = false;
    api
      .post('/analytics/v1/khub/time-report', {
        startDate: rangeBounds.start.toISOString(),
        endDate: rangeBounds.end.toISOString(),
        groupByPeriod: period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day',
        filters: { type: typeFilters },
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeBounds, period, typeFilters]);

  const downloadCsv = () => {
    if (!data?.results?.length) return;
    const periods = data.results[0].periods.map((p) => p.periodStartDate);
    const seriesKeys = ['books', 'unstructured', 'articles', 'topics', 'attachments'].filter((k) => applied[k]);
    const header = ['Period', ...seriesKeys.map((k) => labelFor(k))];
    const lines = [header.join(',')];
    periods.forEach((periodStart, i) => {
      const row = [periodStart];
      seriesKeys.forEach((k) => {
        const apiType =
          k === 'unstructured'
            ? 'unstructuredDocuments'
            : k;
        const res = data.results.find((r) => r.type === apiType);
        const n = res?.periods?.[i]?.count ?? '';
        row.push(String(n));
      });
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content-inventory.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toolbarExtras = (
    <button
      type="button"
      style={{ ...TS.iconBtn, color: drawerOpen ? '#1d4ed8' : '#0f172a' }}
      onClick={() => setDrawerOpen((v) => !v)}
      aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
      title={drawerOpen ? 'Hide filters' : 'Show filters'}
    >
      <IconFilters />
    </button>
  );

  return (
    <AnalyticsShell
      active="content-inventory"
      breadcrumb={{ prefix: 'Knowledge Hub', title: 'Content inventory' }}
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the types of content uploaded to the portal.
            </span>
            <div style={PS.headActions}>
              <PeriodSwitch value={period} onChange={setPeriod} />
              <span style={PS.divider} />
              <div style={PS.chartTools} aria-label="Chart export and display">
                <button
                  type="button"
                  style={{ ...PS.iconAction, color: '#9D207B' }}
                  title="Download data as CSV"
                  aria-label="Download data as CSV"
                  onClick={downloadCsv}
                >
                  <IconDownload />
                </button>
                <button
                  type="button"
                  style={{
                    ...PS.iconActionSm,
                    color: chartMode === 'line' ? '#1d4ed8' : '#64748b',
                  }}
                  title={chartMode === 'line' ? 'Showing line chart — switch to stacked' : 'Showing stacked chart — switch to line'}
                  aria-pressed={chartMode === 'stacked'}
                  aria-label={chartMode === 'line' ? 'Switch to stacked chart' : 'Switch to line chart'}
                  onClick={() => setChartMode((m) => (m === 'line' ? 'stacked' : 'line'))}
                >
                  {chartMode === 'line' ? <IconChartStacked size={18} /> : <IconChartLine size={18} />}
                </button>
                <button
                  type="button"
                  style={{
                    ...PS.iconActionSm,
                    color: scaleMode === 'log' ? '#1d4ed8' : '#64748b',
                  }}
                  title={scaleMode === 'linear' ? 'Linear scale — switch to logarithmic' : 'Logarithmic scale — switch to linear'}
                  aria-pressed={scaleMode === 'log'}
                  aria-label={scaleMode === 'linear' ? 'Use logarithmic Y scale' : 'Use linear Y scale'}
                  onClick={() => setScaleMode((s) => (s === 'linear' ? 'log' : 'linear'))}
                >
                  {scaleMode === 'linear' ? <IconScaleLog size={18} /> : <IconScaleLinear size={18} />}
                </button>
              </div>
            </div>
          </header>

          <div style={PS.rangeBar}>
            <label style={PS.rangeLbl}>
              <input
                type="checkbox"
                checked={useCustomRange}
                onChange={(e) => {
                  const on = e.target.checked;
                  if (on) {
                    const r = defaultRangeForPeriod(period);
                    setRangeStartInput(toDateInputValue(r.start));
                    setRangeEndInput(toDateInputValue(r.end));
                  }
                  setUseCustomRange(on);
                }}
                style={{ marginRight: 8 }}
              />
              Custom date range
            </label>
            <input
              type="date"
              value={useCustomRange ? rangeStartInput : toDateInputValue(defaultRangeForPeriod(period).start)}
              onChange={(e) => {
                setUseCustomRange(true);
                setRangeStartInput(e.target.value);
              }}
              min={retentionInputMin}
              max={rangeEndInput || todayInputMax}
              disabled={!useCustomRange}
              style={{ ...PS.dateInp, opacity: useCustomRange ? 1 : 0.65 }}
              aria-label="Start date"
            />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input
              type="date"
              value={useCustomRange ? rangeEndInput : toDateInputValue(defaultRangeForPeriod(period).end)}
              onChange={(e) => {
                setUseCustomRange(true);
                setRangeEndInput(e.target.value);
              }}
              min={rangeStartInput || retentionInputMin}
              max={todayInputMax}
              disabled={!useCustomRange}
              style={{ ...PS.dateInp, opacity: useCustomRange ? 1 : 0.65 }}
              aria-label="End date"
            />
            {useCustomRange && (
              <button type="button" style={PS.linkish} onClick={() => setUseCustomRange(false)}>
                Reset to default range
              </button>
            )}
            <span style={PS.rangeHint}>
              Grouping: {period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day'}. Retention: {ANALYTICS_DATA_RETENTION_DAYS} days.
            </span>
          </div>
          {useCustomRange && !rangeBounds.ok ? (
            <div style={PS.rangeErr} role="alert">
              {rangeBounds.error}
            </div>
          ) : null}

          <details style={PS.tips}>
            <summary style={PS.tipsSum}>Navigation tips</summary>
            <ul style={PS.tipsUl}>
              <li>Holding the pointer over the chart shows exact counts per content type for that period.</li>
              <li>
                Use the graph button (under download) to switch between a line chart and a stacked chart.
              </li>
              <li>Use the scale button to switch the Y-axis between linear and logarithmic.</li>
              <li>Open filters to include or exclude content types. By default, all types are selected.</li>
              <li>
                Use Daily / Weekly / Monthly to change how periods are grouped. For a custom range, dates must fall within
                retention and the end must be after the start.
              </li>
            </ul>
          </details>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              {!rangeBounds.ok ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  Fix the date range to load the chart.
                </div>
              ) : typeFilters.length === 0 ? (
                <ContentInventoryChart
                  data={{ results: [] }}
                  activeSeries={applied}
                  period={period}
                  chartMode={chartMode}
                  scaleMode={scaleMode}
                />
              ) : !data ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="spinner" />
                </div>
              ) : (
                <ContentInventoryChart
                  data={data}
                  activeSeries={applied}
                  period={period}
                  chartMode={chartMode}
                  scaleMode={scaleMode}
                />
              )}
            </div>
            <div style={PS.legend}>
              {[...DOC_GROUP, ...OTHER_GROUP].filter((s) => applied[s.key]).map((s) => (
                <span key={s.key} style={PS.legendItem}>
                  <span style={{ ...PS.legendDot, background: s.color }} />
                  <span>{s.label}</span>
                </span>
              ))}
            </div>
          </section>
        </main>

        <aside style={{ ...DS.drawer, marginRight: drawerOpen ? '0px' : '-330px', visibility: drawerOpen ? 'visible' : 'hidden' }}>
          <header style={DS.drawerHead}>
            <span style={DS.drawerTitle}>Filter content types</span>
            <button type="button" style={DS.drawerClose} aria-label="Close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <section style={DS.drawerBody}>
            <div style={DS.selectAll}>
              <Checkbox
                checked={allChecked}
                indeterminate={allIndeterm}
                onChange={(v) => setGroup([...allDoc, ...allOther], v)}
                label="Select all"
                bold
              />
            </div>

            <div style={DS.group}>
              <Checkbox
                checked={isGroupChecked(allDoc)}
                indeterminate={isGroupIndeterm(allDoc)}
                onChange={(v) => setGroup(allDoc, v)}
                label="Documents"
                bold
              />
              <ul style={DS.list}>
                {DOC_GROUP.map((s) => (
                  <li key={s.key} style={DS.listItem}>
                    <Checkbox
                      checked={!!pending[s.key]}
                      onChange={(v) => setOne(s.key, v)}
                      color={s.color}
                      label={s.label}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div style={DS.group}>
              <Checkbox
                checked={isGroupChecked(allOther)}
                indeterminate={isGroupIndeterm(allOther)}
                onChange={(v) => setGroup(allOther, v)}
                label="Others"
                bold
              />
              <ul style={DS.list}>
                {OTHER_GROUP.map((s) => (
                  <li key={s.key} style={DS.listItem}>
                    <Checkbox
                      checked={!!pending[s.key]}
                      onChange={(v) => setOne(s.key, v)}
                      color={s.color}
                      label={s.label}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <footer style={DS.drawerFoot}>
            <button
              type="button"
              style={{ ...DS.applyBtn, opacity: dirty ? 1 : 0.55, cursor: dirty ? 'pointer' : 'default' }}
              onClick={apply}
              disabled={!dirty}
            >
              Apply
            </button>
          </footer>
        </aside>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ styles ------------------------------ */

const TS = {
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
  },
};

const SW = {
  wrap: {
    display: 'inline-flex',
    background: '#f1f5f9',
    borderRadius: '999px',
    padding: '3px',
    gap: '2px',
  },
  opt: {
    border: 'none',
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 120ms, color 120ms',
  },
};

const CB = {
  row: { display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative', userSelect: 'none' },
  box: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    border: '1.5px solid #94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dash: { width: '8px', height: '2px', background: '#ffffff', borderRadius: '1px' },
  nativeInput: {
    position: 'absolute',
    inset: 0,
    width: '16px',
    height: '16px',
    opacity: 0,
    margin: 0,
    cursor: 'pointer',
  },
  dot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
};

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff', overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
    flexWrap: 'wrap',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1, minWidth: '220px' },
  headActions: { display: 'flex', alignItems: 'center', gap: '6px' },
  chartTools: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    paddingLeft: '4px',
  },
  divider: { width: '1px', height: '22px', background: '#e2e8f0', margin: '0 4px' },
  iconAction: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  iconActionSm: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  rangeBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 22px 0',
    fontSize: '0.82rem',
    color: '#334155',
  },
  rangeLbl: { display: 'inline-flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' },
  dateInp: {
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
  },
  linkish: {
    border: 'none',
    background: 'none',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontSize: '0.82rem',
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },
  rangeHint: { marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' },
  rangeErr: {
    padding: '6px 22px 0',
    fontSize: '0.82rem',
    color: '#b91c1c',
  },
  tips: {
    margin: '0 22px',
    padding: '10px 12px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.8rem',
    color: '#475569',
  },
  tipsSum: { cursor: 'pointer', fontWeight: 600, color: '#0f172a' },
  tipsUl: { margin: '8px 0 0 18px', padding: 0, lineHeight: 1.5 },
  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px 12px 8px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '350px',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
    padding: '4px 8px',
  },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#0f172a' },
  legendDot: { width: '9px', height: '9px', borderRadius: '50%', display: 'inline-block' },

};

const CH = {
  wrap: { position: 'relative', width: '100%', flex: 1, minHeight: '300px' },
  tooltip: {
    position: 'absolute',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#ffffff',
    fontSize: '0.78rem',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(81, 77, 77, 0.8)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 8px rgba(0, 0, 0, 0.18)',
  },
  tooltipTitle: { fontWeight: 600, marginBottom: '4px' },
  tooltipRow: { display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.4 },
  tooltipDot: { width: '9px', height: '9px', borderRadius: '50%', display: 'inline-block' },
  tooltipHint: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.35 },
};

const DS = {
  drawer: {
    width: '330px',
    flexShrink: 0,
    borderLeft: '1px solid #e5e7eb',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-right 200ms ease, visibility 200ms',
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  drawerClose: {
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
  drawerBody: { padding: '14px 18px 14px', overflowY: 'auto', flex: 1 },
  selectAll: { paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '12px' },
  group: { marginBottom: '14px' },
  list: { listStyle: 'none', padding: '4px 0 0 22px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  listItem: { padding: '4px 0' },
  drawerFoot: {
    padding: '12px 18px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  applyBtn: {
    width: '100%',
    padding: '10px 14px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
};
