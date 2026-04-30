'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
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

function ContentInventoryChart({ data, activeSeries, period }) {
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
  const PAD_B = 60; // Reduced padding
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const apiToLocalMap = {
    books: 'books',
    unstructuredDocuments: 'unstructured',
    articles: 'articles',
    topics: 'topics',
    attachments: 'attachments',
  };
  const localToApiMap = {
    books: 'books',
    unstructured: 'unstructuredDocuments',
    articles: 'articles',
    topics: 'topics',
    attachments: 'attachments',
  };

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

  const enabled = useMemo(() => Object.entries(activeSeries).filter(([, v]) => v).map(([k]) => k), [activeSeries]);

  const max = useMemo(() => {
    const peaks = enabled.flatMap((k) => dynamicSeries[k] || []);
    if (peaks.length === 0) return 70;
    const v = Math.max(...peaks);
    const step = 10;
    return Math.max(step, Math.ceil((v * 1.12) / step) * step);
  }, [enabled, dynamicSeries]);

  const ticks = useMemo(() => {
    const out = [];
    const step = max <= 70 ? 10 : Math.ceil(max / 5);
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  }, [max]);

  const N = dynamicMonths.length || 1;
  const slot = N > 1 ? innerW / (N - 1) : innerW;
  const xAt = (i) => PAD_L + i * slot;
  const yAt = (v) => PAD_T + innerH - (v / max) * innerH;

  const [hover, setHover] = useState(null);

  const series = enabled.map((k) => ({
    key: k,
    color: COLOR[k],
    label: labelFor(k),
    points: (dynamicSeries[k] || Array(N).fill(0)).map((v, i) => ({ x: xAt(i), y: yAt(v), v, m: dynamicMonths[i] })),
  }));

  // "Ongoing period" — soft pink overlay across the last slot.
  const ongoingX1 = N > 1 ? xAt(N - 2) + slot / 2 : PAD_L;
  const ongoingX2 = N > 1 ? xAt(N - 1) : W - PAD_R;

  return (
    <div style={CH.wrap}
      ref={containerRef}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        if (px < PAD_L || px > W - PAD_R) { setHover(null); return; }
        const idx = Math.max(0, Math.min(N - 1, Math.round((px - PAD_L) / slot)));
        setHover({ idx, cx: xAt(idx), cy: PAD_T + innerH / 2 });
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Content inventory over time" style={{ display: 'block' }}>
        {/* y grid + ticks */}
        {ticks.map((t) => {
          const y = yAt(t);
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#E0E6F1" />
              <text x={PAD_L - 8} y={y} dominantBaseline="middle" textAnchor="end" fontSize="12" fill="#6E7079">
                {t}
              </text>
            </g>
          );
        })}
        <text x={PAD_L} y={PAD_T - 16} fontSize="12" fill="#6E7079" textAnchor="middle">CONTENT COUNT</text>

        {/* x baseline */}
        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#6E7079" />
        <text x={W - PAD_R + 6} y={PAD_T + innerH} dominantBaseline="middle" fontSize="12" fill="#6E7079">DATE</text>

        {/* Ongoing-period overlay */}
        <rect
          x={ongoingX1}
          y={PAD_T}
          width={Math.max(8, ongoingX2 - ongoingX1)}
          height={innerH}
          fill="#fbe5f2"
          fillOpacity={0.45}
        />
        <text x={(ongoingX1 + ongoingX2) / 2} y={PAD_T - 4} fontSize="11" textAnchor="middle" fill="#333">Ongoing period</text>

        {/* x labels */}
        {dynamicMonths.map((m, i) => {
          if (i % Math.max(1, Math.floor(N / 6)) !== 0 && i !== N - 1) return null;
          const cx = xAt(i);
          return (
            <g key={`xl-${m}`}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 18} fontSize="12" fill="#6E7079" textAnchor="middle">{period === 'monthly' ? monthLabel(m) : m}</text>
            </g>
          );
        })}

        {/* Series lines */}
        {series.map((s) => (
          <g key={s.key}>
            <path
              d={s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="bevel"
            />
            {s.points.map((p, i) => (
              <circle
                key={`${s.key}-${i}`}
                cx={p.x}
                cy={p.y}
                r={4}
                fill="#ffffff"
                stroke={s.color}
                strokeOpacity={i === N - 1 ? 0.5 : 1}
                fillOpacity={i === N - 1 ? 0.6 : 1}
              />
            ))}
          </g>
        ))}

        {/* Hover guide line */}
        {hover && (
          <g>
            <line x1={hover.cx} y1={PAD_T} x2={hover.cx} y2={PAD_T + innerH} stroke="#94a3b8" strokeDasharray="3 3" />
            {series.map((s) => {
              const p = s.points[hover.idx];
              return <circle key={`h-${s.key}`} cx={p.x} cy={p.y} r={5.5} fill={s.color} stroke="#ffffff" strokeWidth={1.5} />;
            })}
          </g>
        )}
      </svg>

      {hover && (
        <div
          style={{
            ...CH.tooltip,
            left: `${(hover.cx / W) * 100}%`,
            top: `${(PAD_T - 6) / H * 100}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div style={CH.tooltipTitle}>
            In {period === 'monthly' ? monthLabel(dynamicMonths[hover.idx]) : dynamicMonths[hover.idx]}: {series.reduce((sum, s) => sum + s.points[hover.idx].v, 0)}
          </div>
          {series.map((s) => (
            <div key={s.key} style={CH.tooltipRow}>
              <span style={{ ...CH.tooltipDot, background: s.color }} />
              <span>{s.label}: {s.points[hover.idx].v}</span>
            </div>
          ))}
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
  const [pending, setPending] = useState({
    books: true, unstructured: true, articles: true, topics: false, attachments: false,
  });
  const [applied, setApplied] = useState(pending);

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



  useEffect(() => {
    const end = new Date();
    const start = new Date();
    if (period === 'monthly') start.setMonth(start.getMonth() - 11);
    else if (period === 'weekly') start.setDate(start.getDate() - 12 * 7);
    else start.setDate(start.getDate() - 30);
    
    const typeFilters = [];
    if (applied.books) typeFilters.push('books');
    if (applied.unstructured) typeFilters.push('unstructuredDocuments');
    if (applied.articles) typeFilters.push('articles');
    if (applied.topics) typeFilters.push('topics');
    if (applied.attachments) typeFilters.push('attachments');

    api.post('/analytics/v1/khub/time-report', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      groupByPeriod: period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day',
      filters: { type: typeFilters }
    }).then(setData).catch(console.error);
  }, [period, applied]);

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
      feedbackSubject="Feedback about content inventory"
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
              <button
                type="button"
                style={{ ...PS.iconAction, color: '#9D207B' }}
                title="Download as XLSX"
                aria-label="Download as XLSX"
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              {data ? <ContentInventoryChart data={data} activeSeries={applied} period={period} /> : <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>}
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
