'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

/* ----------------------------- Config ----------------------------- */

const ANALYTICS_RETENTION_DAYS = 730;

const INTERACTION_TYPES = [
  { key: 'doc-views', label: 'Document views' },
  { key: 'link-shares', label: 'Link shares' },
  { key: 'bookmark-creations', label: 'Bookmark creations' },
  { key: 'doc-downloads', label: 'Document downloads' },
  { key: 'doc-prints', label: 'Document prints' },
  { key: 'feedback', label: 'Feedback submissions' },
  { key: 'doc-ratings', label: 'Document ratings' },
  { key: 'topic-ratings', label: 'Topic ratings' },
  { key: 'searches-in-doc', label: 'Searches in document' },
];

const QUADRANT_GUIDE = [
  { idx: 1, title: 'Less recently updated & high engagement', position: '(Top left)', advice: 'Review and evaluate maintenance needs.' },
  { idx: 2, title: 'Recently updated & high engagement', position: '(Top right)', advice: 'Likely meeting current user needs.' },
  { idx: 3, title: 'Less recently updated & low engagement', position: '(Bottom left)', advice: 'Evaluate relevance and consider removing.' },
  { idx: 4, title: 'Recently updated & low engagement', position: '(Bottom right)', advice: 'Investigate lack of use and consider promoting.' },
];

function sumBreakdown(breakdown, filterMap) {
  if (!breakdown) return 0;
  let s = 0;
  for (const t of INTERACTION_TYPES) {
    if (filterMap[t.key]) s += breakdown[t.key] || 0;
  }
  return s;
}

/* ----------------------------- Icons ----------------------------- */

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
const IconQuestion = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconFlask = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 2v6.6a4 4 0 0 1-.6 2.1L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-4.4-8.3a4 4 0 0 1-.6-2.1V2" />
    <path d="M8.5 2h7" />
    <path d="M7 16h10" />
  </svg>
);
const IconSortAsc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconSortDesc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const IconSortNone = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="7 9 12 4 17 9" />
    <polyline points="7 15 12 20 17 15" />
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
const IconChevDoubleLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="11 18 5 12 11 6" />
    <polyline points="19 18 13 12 19 6" />
  </svg>
);
const IconChevDoubleRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5 18 11 12 5 6" />
    <polyline points="13 18 19 12 13 6" />
  </svg>
);
const IconKebab = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);

const Tick = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function Checkbox({ checked, indeterminate, onChange, label, bold = false }) {
  return (
    <label style={CB.row}>
      <span
        style={{
          ...CB.box,
          background: checked || indeterminate ? '#1d4ed8' : '#ffffff',
          borderColor: checked || indeterminate ? '#1d4ed8' : '#94a3b8',
        }}
        aria-hidden="true"
      >
        {checked && <Tick />}
        {indeterminate && <span style={CB.dash} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={CB.nativeInput}
      />
      <span style={{ fontSize: '0.86rem', fontWeight: bold ? 600 : 500, color: '#0f172a' }}>{label}</span>
    </label>
  );
}

/* ----------------------------- Help popover ----------------------------- */

function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} ref={ref}>
      <button
        type="button"
        style={HS.openBtn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Open help: How to read this chart"
        aria-label="Open help: How to read this chart"
      >
        <IconQuestion />
      </button>
      {open && (
        <div role="dialog" style={HS.panel}>
          <div style={HS.intro}>For a quick assessment, think of the chart in four zones:</div>
          {QUADRANT_GUIDE.map((q) => (
            <div key={q.idx} style={HS.zone}>
              <div style={HS.zoneTitle}>
                <span style={HS.zoneNum}>{q.idx}.</span>
                <span style={HS.zoneTitleText}>{q.title}</span>
              </div>
              <div style={HS.zonePos}>{q.position}</div>
              <div style={HS.zoneAdvice}>{q.advice}</div>
            </div>
          ))}
          <div style={HS.illustration} aria-hidden="true">
            <QuadrantIllustration />
          </div>
        </div>
      )}
    </span>
  );
}

function QuadrantIllustration() {
  return (
    <svg viewBox="0 0 376 220" width="100%" height="auto" role="img" aria-label="Document engagement zones">
      <rect x="6" y="6" width="180" height="100" fill="#FEFAE9" stroke="#e2e8f0" />
      <rect x="190" y="6" width="180" height="100" fill="#F6F9EC" stroke="#e2e8f0" />
      <rect x="6" y="110" width="180" height="100" fill="#F9EBED" stroke="#e2e8f0" />
      <rect x="190" y="110" width="180" height="100" fill="#EBF6F9" stroke="#e2e8f0" />
      <text x="20" y="32" fontSize="13" fontWeight="600" fill="#0f172a">1</text>
      <text x="38" y="32" fontSize="11" fill="#475569">High engagement</text>
      <text x="38" y="48" fontSize="11" fill="#475569">Less recent</text>
      <text x="204" y="32" fontSize="13" fontWeight="600" fill="#0f172a">2</text>
      <text x="222" y="32" fontSize="11" fill="#475569">High engagement</text>
      <text x="222" y="48" fontSize="11" fill="#475569">Recently updated</text>
      <text x="20" y="136" fontSize="13" fontWeight="600" fill="#0f172a">3</text>
      <text x="38" y="136" fontSize="11" fill="#475569">Low engagement</text>
      <text x="38" y="152" fontSize="11" fill="#475569">Less recent</text>
      <text x="204" y="136" fontSize="13" fontWeight="600" fill="#0f172a">4</text>
      <text x="222" y="136" fontSize="11" fill="#475569">Low engagement</text>
      <text x="222" y="152" fontSize="11" fill="#475569">Recently updated</text>
      <text x="186" y="218" fontSize="10" textAnchor="middle" fill="#475569">Doc. last update →</text>
      <text x="-110" y="14" transform="rotate(-90)" fontSize="10" textAnchor="middle" fill="#475569">Interactions ↑</text>
    </svg>
  );
}

/* ----------------------------- Scatter plot ----------------------------- */

function formatXAxisLabel(t, rangeMs) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  if (rangeMs <= 2 * 86400000) {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (rangeMs <= 120 * 86400000) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
}

function buildXTickValues(xMin, xMax) {
  const rangeMs = xMax - xMin || 1;
  const candidates = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + rangeMs * f);
  const out = [];
  const seen = new Set();
  for (const t of candidates) {
    const lab = formatXAxisLabel(t, rangeMs);
    if (lab && !seen.has(lab)) {
      seen.add(lab);
      out.push(t);
    }
  }
  if (out.length >= 2) return out;
  const trip = [xMin, (xMin + xMax) / 2, xMax];
  const out2 = [];
  const seen2 = new Set();
  for (const t of trip) {
    const lab = formatXAxisLabel(t, rangeMs);
    if (lab && !seen2.has(lab)) {
      seen2.add(lab);
      out2.push(t);
    }
  }
  return out2.length ? out2 : [xMin];
}

function ScatterPlot({ points, xMin, xMax, yMax, onSelectOne }) {
  const W = 1180;
  const H = 340;
  const PAD_L = 92;
  const PAD_R = 44;
  const PAD_T = 36;
  const PAD_B = 52;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const [hover, setHover] = useState(null);

  const xAt = useCallback((t) => PAD_L + ((t - xMin) / (xMax - xMin || 1)) * innerW, [xMin, xMax, innerW]);
  const log = (v) => Math.log10(Math.max(1, v));
  const yAt = useCallback(
    (v) => PAD_T + innerH - (log(v) / log(Math.max(10, yMax))) * innerH,
    [yMax, innerH],
  );

  const yTicks = useMemo(() => {
    const maxL = Math.log10(Math.max(10, yMax));
    const out = [1, 10, 100, 1000, 10000, 100000, 1000000];
    return out.filter((t) => log(t) <= maxL * 1.02).slice(0, 8);
  }, [yMax]);

  const xTicks = useMemo(() => buildXTickValues(xMin, xMax), [xMin, xMax]);
  const xRangeMs = xMax - xMin || 1;

  const splitX = xAt((xMin + xMax) / 2);
  const splitY = yAt(Math.max(10, Math.min(yMax, 5000)));
  const yAxisLabelX = 18;
  const yAxisLabelY = PAD_T + innerH / 2;

  return (
    <div style={CHS.wrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Document engagement scatter plot"
        onMouseLeave={() => setHover(null)}
      >
        <rect x={PAD_L} y={PAD_T} width={splitX - PAD_L} height={splitY - PAD_T} fill="#FEFAE9" />
        <rect x={splitX} y={PAD_T} width={PAD_L + innerW - splitX} height={splitY - PAD_T} fill="#F6F9EC" />
        <rect x={PAD_L} y={splitY} width={splitX - PAD_L} height={PAD_T + innerH - splitY} fill="#F9EBED" />
        <rect x={splitX} y={splitY} width={PAD_L + innerW - splitX} height={PAD_T + innerH - splitY} fill="#EBF6F9" />

        <line x1={splitX} y1={PAD_T} x2={splitX} y2={PAD_T + innerH} stroke="#cbd5e1" strokeDasharray="4 4" />
        <line x1={PAD_L} y1={splitY} x2={PAD_L + innerW} y2={splitY} stroke="#cbd5e1" strokeDasharray="4 4" />

        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="#6E7079" />
        <text
          x={yAxisLabelX}
          y={yAxisLabelY}
          fontSize="11"
          fill="#6E7079"
          textAnchor="middle"
          transform={`rotate(-90 ${yAxisLabelX} ${yAxisLabelY})`}
        >
          INTERACTIONS
        </text>
        {yTicks.map((t) => {
          const y = yAt(t);
          return (
            <g key={t}>
              <line x1={PAD_L - 5} y1={y} x2={PAD_L} y2={y} stroke="#6E7079" />
              <text x={PAD_L - 8} y={y} dominantBaseline="middle" textAnchor="end" fontSize="12" fill="#6E7079">
                {formatNum(t)}
              </text>
            </g>
          );
        })}

        <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} stroke="#6E7079" />
        {xTicks.map((t) => {
          const cx = xAt(t);
          const label = formatXAxisLabel(t, xRangeMs);
          return (
            <g key={`${t}-${label}`}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 16} fontSize="11" fill="#6E7079" textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
        <text
          x={PAD_L + innerW / 2}
          y={H - 10}
          fontSize="11"
          fill="#6E7079"
          textAnchor="middle"
        >
          Doc. last update
        </text>

        {points.map((p) => (
          <circle
            key={p.id}
            cx={xAt(p.lastUpdate)}
            cy={yAt(p.interactions)}
            r={5}
            fill="#9D207B"
            fillOpacity={0.5}
            stroke="#9D207B"
            strokeOpacity={0.8}
            strokeWidth={0.5}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHover({
                ...p,
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            onMouseMove={(e) => {
              e.stopPropagation();
              setHover((h) => {
                if (!h || h.id !== p.id) return h;
                return { ...h, clientX: e.clientX, clientY: e.clientY };
              });
            }}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectOne(p.id);
            }}
          />
        ))}
      </svg>

      {hover && typeof hover.clientX === 'number' && (
        <div
          style={{
            ...CHS.tooltip,
            position: 'fixed',
            left: hover.clientX,
            top: hover.clientY,
            transform:
              hover.clientY < 110
                ? 'translate(-50%, 14px)'
                : 'translate(-50%, calc(-100% - 12px))',
            maxWidth: 'min(360px, min(92vw, calc(100vw - 24px)))',
          }}
        >
          <div style={{ fontWeight: 600 }}>{hover.title}</div>
          <div>Interactions (filtered): {formatNum(hover.interactions)}</div>
          <div>Last update: {formatDateLong(hover.lastUpdate)}</div>
          {hover.metadata?.length ? (
            <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 6 }}>
              {hover.metadata.slice(0, 6).map((m) => (
                <div key={m.key}>
                  {m.label}: {m.values?.join(', ') ?? '—'}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}
function formatDateLong(t) {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ----------------------------- Row menu ----------------------------- */

function RowActions({ open, onToggle, onClose, onShowDoc }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" style={PS.kebabBtn} onClick={onToggle} aria-haspopup="true" aria-expanded={open}>
        <IconKebab />
      </button>
      {open && (
        <div role="menu" style={PS.menu}>
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onShowDoc}>
            Show document
          </button>
        </div>
      )}
    </span>
  );
}

/* ----------------------------- Page ----------------------------- */

export default function DocEngagementPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [filters, setFilters] = useState(() => Object.fromEntries(INTERACTION_TYPES.map((t) => [t.key, true])));
  const [sort, setSort] = useState({ col: 'interactions', dir: 'desc' });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedIds, setSelectedIds] = useState([]);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post('/analytics/v1/khub/document-engagement', {
          retentionDays: ANALYTICS_RETENTION_DAYS,
        });
        if (!cancelled) setRaw(res);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRaw(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo(() => {
    if (!raw?.documents?.length) return [];
    return raw.documents.map((d) => ({
      id: d.id,
      title: d.title,
      lastUpdate: d.lastUpdateMs,
      interactions: sumBreakdown(d.breakdown, filters),
      metadata: d.metadata || [],
      kind: d.kind,
      breakdown: d.breakdown,
      link: d.link,
    }));
  }, [raw, filters]);

  const dataSpan = useMemo(() => {
    if (!points.length) {
      return { min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) };
    }
    const ts = points.map((p) => p.lastUpdate);
    return { min: Math.min(...ts), max: Math.max(...ts) };
  }, [points]);

  const xMin = dataSpan.min;
  const xMax = dataSpan.max;

  const yMax = useMemo(() => {
    const m = points.reduce((a, p) => Math.max(a, p.interactions), 1);
    const step = m <= 10 ? 1 : m <= 100 ? 10 : m <= 1000 ? 100 : m <= 10000 ? 1000 : 10000;
    return Math.max(10, Math.ceil((m * 1.12) / step) * step);
  }, [points]);

  const allChecked = INTERACTION_TYPES.every((t) => filters[t.key]);
  const allIndeterm = INTERACTION_TYPES.some((t) => filters[t.key]) && !allChecked;
  const setAll = (v) => setFilters(Object.fromEntries(INTERACTION_TYPES.map((t) => [t.key, v])));
  const setOne = (k, v) => setFilters((s) => ({ ...s, [k]: v }));

  const byId = useMemo(() => Object.fromEntries(points.map((p) => [p.id, p])), [points]);

  const selectedRows = useMemo(() => selectedIds.map((id) => byId[id]).filter(Boolean), [selectedIds, byId]);

  const sortedRows = useMemo(() => {
    const rows = [...selectedRows];
    rows.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.col === 'interactions') return (a.interactions - b.interactions) * dir;
      if (sort.col === 'lastUpdate') return (a.lastUpdate - b.lastUpdate) * dir;
      if (sort.col === 'title') return a.title.localeCompare(b.title) * dir;
      return 0;
    });
    return rows;
  }, [selectedRows, sort]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const stop = Math.min(total, page * pageSize);
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col) => {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));
  };

  const sortIcon = (col) => {
    if (sort.col !== col) return <IconSortNone />;
    return sort.dir === 'asc' ? <IconSortAsc /> : <IconSortDesc />;
  };

  const breadcrumb = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500 }}>Knowledge Hub&nbsp;&gt;&nbsp;</span>
      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Document engagement</span>
      <HelpPopover />
      <span style={BetaChip.chip}>
        <IconFlask />
        <span>Beta</span>
      </span>
    </span>
  );

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
      active="doc-engagement"
      breadcrumb={breadcrumb}
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Document distribution by date of last update and number of interactions. Data reflects the last {ANALYTICS_RETENTION_DAYS} days
              (retention).
            </span>
          </header>

          <details style={PS.tips}>
            <summary style={PS.tipsSum}>Navigation tips</summary>
            <ul style={PS.tipsUl}>
              <li>Hover a dot to see the document name, interaction total (for selected filters), last update, and metadata.</li>
              <li>Click a dot to select that document in the table below.</li>
              <li>Open the filter button (top right) to choose interaction types in the side panel. All types are selected by default.</li>
              <li>Documents are sorted by last edition metadata when loaded.</li>
            </ul>
          </details>

          <section style={PS.body}>
            <div
              style={{
                ...PS.chartCard,
                ...(drawerOpen ? {} : PS.chartCardExpanded),
              }}
            >
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" />
                </div>
              ) : (
                <>
                  <div style={{ ...PS.chartPlotWrap, ...(drawerOpen ? {} : PS.chartPlotExpanded) }}>
                    <ScatterPlot
                      points={points}
                      xMin={xMin}
                      xMax={xMax}
                      yMax={yMax}
                      onSelectOne={(id) => {
                        setSelectedIds([id]);
                        setPage(1);
                      }}
                    />
                  </div>
                  {points.length > 0 ? (
                    <div style={PS.rangeBar}>
                      <span style={PS.rangeLabel}>Last update span in chart</span>
                      <span style={PS.rangeValue}>
                        {formatDateLong(xMin)} — {formatDateLong(xMax)}
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div style={PS.tableCard}>
              <div style={PS.tableScroll}>
                <table style={PS.table}>
                <thead>
                  <tr style={PS.tableHeadRow}>
                    <th style={PS.th}>
                      <HeaderCell label="Interactions" sortIcon={sortIcon('interactions')} onClick={() => toggleSort('interactions')} />
                    </th>
                    <th style={PS.th}>
                      <HeaderCell label="Title" sortIcon={sortIcon('title')} onClick={() => toggleSort('title')} />
                    </th>
                    <th style={PS.th}>
                      <HeaderCell label="Doc. last update" sortIcon={sortIcon('lastUpdate')} onClick={() => toggleSort('lastUpdate')} />
                    </th>
                    <th style={PS.th}>
                      <HeaderCell label="Metadata" />
                    </th>
                    <th style={{ ...PS.th, width: '56px' }} />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={PS.emptyCell}>
                        <div style={PS.emptyCellInner}>
                          <span>No documents selected.</span>
                          <span>&nbsp;</span>
                          <span>
                            Select a document by clicking a dot on the chart.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.id} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.interactions)}</td>
                        <td style={{ ...PS.td, color: '#1d4ed8', fontWeight: 600 }}>{r.title}</td>
                        <td style={PS.td}>{formatDateLong(r.lastUpdate)}</td>
                        <td style={{ ...PS.tdMeta }}>
                          {r.metadata?.length ? (
                            <ul style={PS.metaUl}>
                              {r.metadata.slice(0, 5).map((m) => (
                                <li key={m.key}>
                                  <strong>{m.label}:</strong> {m.values?.join(', ')}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={PS.td}>
                          <RowActions
                            open={activeMenu === r.id}
                            onToggle={() => setActiveMenu((x) => (x === r.id ? null : r.id))}
                            onClose={() => setActiveMenu(null)}
                            onShowDoc={() => {
                              setActiveMenu(null);
                              window.open(r.link, '_blank', 'noopener,noreferrer');
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>

              <div style={PS.pager}>
                <span style={PS.pagerLabel}>{total === 0 ? '0 of 0' : `${start} – ${stop} of ${total}`}</span>
                <div style={PS.pagerBtns}>
                  <PagerBtn disabled={page === 1} onClick={() => setPage(1)} aria-label="First page">
                    <IconChevDoubleLeft />
                  </PagerBtn>
                  <PagerBtn disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                    <IconChevLeft />
                  </PagerBtn>
                  <PagerBtn disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                    <IconChevRight />
                  </PagerBtn>
                  <PagerBtn disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
                    <IconChevDoubleRight />
                  </PagerBtn>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside
          style={{
            ...DS.drawer,
            marginRight: drawerOpen ? '0px' : '-330px',
            visibility: drawerOpen ? 'visible' : 'hidden',
          }}
        >
          <header style={DS.drawerHead}>
            <span style={DS.drawerTitle}>Filter interaction types</span>
            <button type="button" style={DS.drawerClose} aria-label="Close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <section style={DS.drawerBody}>
            <div style={DS.selectAll}>
              <Checkbox
                checked={allChecked}
                indeterminate={allIndeterm}
                onChange={(v) => setAll(v)}
                label="Select all"
                bold
              />
            </div>
            <ul style={DS.list}>
              {INTERACTION_TYPES.map((t) => (
                <li key={t.key} style={DS.listItem}>
                  <Checkbox checked={!!filters[t.key]} onChange={(v) => setOne(t.key, v)} label={t.label} />
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

    </AnalyticsShell>
  );
}

function HeaderCell({ label, sortIcon, onClick }) {
  return (
    <span style={PS.headerCell}>
      <span>{label}</span>
      {sortIcon && (
        <button type="button" style={PS.sortBtn} onClick={onClick} aria-label={`Sort ${label}`}>
          {sortIcon}
        </button>
      )}
    </span>
  );
}

function PagerBtn({ children, disabled, onClick, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...PS.pagerBtn,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#94a3b8' : '#0f172a',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Styles ----------------------------- */

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

const BetaChip = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#0c4a6e',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    borderRadius: '999px',
  },
};

const HS = {
  openBtn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(420px, 90vw)',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
    padding: '18px 20px',
    zIndex: 50,
  },
  intro: { fontSize: '0.85rem', color: '#0f172a', marginBottom: '12px' },
  zone: { marginBottom: '12px' },
  zoneTitle: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  zoneNum: { width: '19px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' },
  zoneTitleText: { fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' },
  zonePos: { paddingLeft: '25px', fontSize: '0.78rem', color: '#475569' },
  zoneAdvice: { paddingLeft: '25px', fontSize: '0.78rem', color: '#0f172a' },
  illustration: { marginTop: '14px', padding: '10px 0', borderTop: '1px solid #f1f5f9' },
};

const PS = {
  layout: {
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    background: '#ffffff',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  tips: {
    margin: '0 22px',
    padding: '10px 12px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.8rem',
    color: '#475569',
    flexShrink: 0,
  },
  tipsSum: { cursor: 'pointer', fontWeight: 600, color: '#0f172a' },
  tipsUl: { margin: '8px 0 0 18px', padding: 0, lineHeight: 1.5 },
  body: {
    flex: 1,
    minHeight: 0,
    padding: '16px 22px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflow: 'hidden',
  },

  chartCard: {
    flex: '1 1 52%',
    minHeight: '280px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px 14px 8px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chartPlotWrap: {
    flex: 1,
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  chartCardExpanded: {
    flex: '1 1 62%',
    minHeight: '320px',
  },
  chartPlotExpanded: {
    minHeight: '300px',
  },
  rangeBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 4px 4px',
    borderTop: '1px solid #f1f5f9',
    marginTop: '8px',
    flexShrink: 0,
  },
  rangeLabel: { fontSize: '0.78rem', color: '#64748b' },
  rangeValue: { fontSize: '0.78rem', color: '#0f172a', marginLeft: 'auto' },

  tableCard: {
    flex: '1 1 48%',
    minHeight: '200px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '4px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tableScroll: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeadRow: { background: '#f8fafc', borderBottom: '1px solid #e5e7eb' },
  th: { padding: '10px 14px', textAlign: 'left' },
  headerCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  sortBtn: {
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  tableRow: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', fontSize: '0.85rem', color: '#0f172a', verticalAlign: 'top' },
  tdMeta: { padding: '10px 14px', fontSize: '0.78rem', color: '#334155', verticalAlign: 'top', maxWidth: '280px' },
  metaUl: { margin: 0, paddingLeft: '16px', lineHeight: 1.45 },
  emptyCell: { padding: '24px 14px', textAlign: 'center' },
  emptyCellInner: { color: '#475569', fontSize: '0.85rem', display: 'flex', flexDirection: 'column' },
  kebabBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
    minWidth: '160px',
    zIndex: 20,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    border: 'none',
    background: 'none',
    fontSize: '0.85rem',
    cursor: 'pointer',
    color: '#0f172a',
  },

  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '8px 14px',
    borderTop: '1px solid #f1f5f9',
    flexShrink: 0,
  },
  pagerLabel: { fontSize: '0.78rem', color: '#475569' },
  pagerBtns: { display: 'inline-flex', gap: '2px' },
  pagerBtn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
  },
};

const CHS = {
  wrap: {
    position: 'relative',
    width: '100%',
    flex: 1,
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
  },
  tooltip: {
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#ffffff',
    fontSize: '0.78rem',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(81, 77, 77, 0.8)',
    pointerEvents: 'none',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
    lineHeight: 1.45,
    minWidth: '200px',
    zIndex: 200,
  },
};

const CB = {
  row: { display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative', userSelect: 'none', cursor: 'pointer' },
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
};

const DS = {
  drawer: {
    width: '330px',
    flexShrink: 0,
    alignSelf: 'stretch',
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
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  listItem: { padding: '4px 0' },
};
