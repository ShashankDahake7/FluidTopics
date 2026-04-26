'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ----------------------------- Data ----------------------------- */

const INTERACTION_TYPES = [
  { key: 'doc-views',         label: 'Document views' },
  { key: 'link-shares',       label: 'Link shares' },
  { key: 'bookmark-creations',label: 'Bookmark creations' },
  { key: 'doc-downloads',     label: 'Document downloads' },
  { key: 'doc-prints',        label: 'Document prints' },
  { key: 'feedback',          label: 'Feedback submissions' },
  { key: 'doc-ratings',       label: 'Document ratings' },
  { key: 'topic-ratings',     label: 'Topic ratings' },
  { key: 'searches-in-doc',   label: 'Searches in document' },
];

const QUADRANT_GUIDE = [
  { idx: 1, title: 'Less recently updated & high engagement', position: '(Top left)',     advice: 'Review and evaluate maintenance needs.' },
  { idx: 2, title: 'Recently updated & high engagement',      position: '(Top right)',    advice: 'Likely meeting current user needs.' },
  { idx: 3, title: 'Less recently updated & low engagement',  position: '(Bottom left)',  advice: 'Evaluate relevance and consider removing.' },
  { idx: 4, title: 'Recently updated & low engagement',       position: '(Bottom right)', advice: 'Investigate lack of use and consider promoting.' },
];

// Generate ~96 deterministic scatter points spread across the plot (May 2023 → Apr 2026).
function buildScatter() {
  const start = new Date(2023, 4, 1).getTime();
  const end   = new Date(2026, 3, 26).getTime();
  let s = 1;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const points = [];
  // 80 docs with realistic spread (heavy concentration in late 2025–early 2026 + scattered older docs).
  const titles = [
    'Release Notes Feb 2026', 'Company', 'Darwinbox FAQs Articles',
    'Darwinbox Troubleshooting Articles', 'Recruitment', 'Performance', 'Leave',
    'Reports Builder', 'Import', 'Payroll', 'Attendance', 'Release Notes Nov 2025',
    'Darwinbox Studio', 'HR Documents', 'Release Notes May 2025', 'Employees',
    'Workflow: Custom Workflow', 'Onboarding', 'Best Practices', 'Release Notes May 2023',
    'Release Notes Feb 2025', 'Form Builder', 'Permissions', 'Release Notes August 2025',
    'My Access', 'Talent Management', 'Workflow: Standard Workflow',
    'Release Notes November 2024', 'People Analytics', '100 Features',
    'Asset Management', 'Travel & Expense', 'Compensation', 'Goals',
    'Survey Module', 'Helpdesk', 'Letters', 'Document Management',
    'Org Chart', 'Time Off', 'Shift Roster', 'Geo Attendance',
    'Mobile App Guide', 'Admin Setup', 'API Documentation', 'Webhooks',
    'SSO Configuration', 'Audit Logs', 'Custom Reports', 'Bulk Upload',
  ];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const ts = start + rand() * (end - start);
    // Bias towards higher Y (high interactions) — log distribution.
    const u = rand();
    const interactions = Math.max(1, Math.floor(Math.pow(10, 0.4 + u * 4.2)));
    const title = titles[i % titles.length] + (i >= titles.length ? ` (v${Math.floor(i / titles.length) + 1})` : '');
    points.push({
      id: `doc-${i}`,
      title,
      lastUpdate: ts,
      interactions,
    });
  }
  // Anchor an obvious peak point near the upper-right matching the reference (~42,710).
  points.push({ id: 'doc-peak', title: 'Release Notes Feb 2026', lastUpdate: new Date(2026, 1, 28).getTime(), interactions: 42710 });
  return points;
}

const SCATTER = buildScatter();
const X_MIN = new Date(2023, 4, 1).getTime();
const X_MAX = new Date(2026, 3, 26).getTime();
const Y_MIN = 1;
const Y_MAX = 50000;

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

/* ---------------------------- Tick (checkbox) --------------------------- */

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
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
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
                <span style={HS.zoneTitleText}>
                  {q.title}
                </span>
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
      {/* axes labels */}
      <text x="186" y="218" fontSize="10" textAnchor="middle" fill="#475569">Doc. last update →</text>
      <text x="-110" y="14" transform="rotate(-90)" fontSize="10" textAnchor="middle" fill="#475569">Interactions ↑</text>
    </svg>
  );
}

/* ----------------------------- Scatter plot ----------------------------- */

function ScatterPlot({ points, onSelect }) {
  const W = 1180;
  const H = 320;
  const PAD_L = 92;
  const PAD_R = 40;
  const PAD_T = 30;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xAt = (t) => PAD_L + ((t - X_MIN) / (X_MAX - X_MIN)) * innerW;
  // Logarithmic Y axis (1 → 50,000).
  const log = (v) => Math.log10(Math.max(1, v));
  const yAt = (v) => PAD_T + innerH - (log(v) / log(Y_MAX)) * innerH;

  const yTicks = [1, 10, 100, 1000, 10000, Y_MAX];
  const xTicks = [
    new Date(2023, 4, 1).getTime(),
    new Date(2024, 9, 1).getTime(),
    new Date(2026, 1, 1).getTime(),
    X_MAX,
  ];

  // Quadrant boundaries: vertical at midpoint of x range, horizontal at "high engagement" threshold (~5000).
  const splitX = xAt((X_MIN + X_MAX) / 2);
  const splitY = yAt(5000);

  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);

  const onPointEnter = (p) => setHover(p);
  const onPointLeave = () => setHover(null);

  return (
    <div style={CHS.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Document engagement scatter plot">
        {/* Quadrant backgrounds */}
        <rect x={PAD_L} y={PAD_T} width={splitX - PAD_L} height={splitY - PAD_T} fill="#FEFAE9" />
        <rect x={splitX} y={PAD_T} width={PAD_L + innerW - splitX} height={splitY - PAD_T} fill="#F6F9EC" />
        <rect x={PAD_L} y={splitY} width={splitX - PAD_L} height={PAD_T + innerH - splitY} fill="#F9EBED" />
        <rect x={splitX} y={splitY} width={PAD_L + innerW - splitX} height={PAD_T + innerH - splitY} fill="#EBF6F9" />

        {/* Quadrant divider lines */}
        <line x1={splitX} y1={PAD_T} x2={splitX} y2={PAD_T + innerH} stroke="#cbd5e1" strokeDasharray="4 4" />
        <line x1={PAD_L} y1={splitY} x2={PAD_L + innerW} y2={splitY} stroke="#cbd5e1" strokeDasharray="4 4" />

        {/* Y axis */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="#6E7079" />
        <text x={PAD_L} y={PAD_T - 14} fontSize="12" fill="#6E7079" textAnchor="middle">INTERACTIONS</text>
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

        {/* X axis */}
        <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} stroke="#6E7079" />
        <text x={W - PAD_R + 6} y={PAD_T + innerH - 12} fontSize="12" fill="#6E7079">DOC.</text>
        <text x={W - PAD_R + 6} y={PAD_T + innerH} dominantBaseline="middle" fontSize="12" fill="#6E7079">LAST</text>
        <text x={W - PAD_R + 6} y={PAD_T + innerH + 12} fontSize="12" fill="#6E7079">UPDATE</text>
        {xTicks.map((t) => {
          const cx = xAt(t);
          return (
            <g key={t}>
              <line x1={cx} y1={PAD_T + innerH} x2={cx} y2={PAD_T + innerH + 5} stroke="#6E7079" />
              <text x={cx} y={PAD_T + innerH + 16} fontSize="12" fill="#6E7079" textAnchor="middle">{formatDateShort(t)}</text>
            </g>
          );
        })}

        {/* Scatter points */}
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
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onPointEnter({ ...p, x: xAt(p.lastUpdate), y: yAt(p.interactions) })}
            onMouseLeave={onPointLeave}
            onClick={() => onSelect && onSelect([p.id])}
          />
        ))}
      </svg>

      {hover && (
        <div
          style={{
            ...CHS.tooltip,
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <div style={{ fontWeight: 600 }}>{hover.title}</div>
          <div>Interactions: {formatNum(hover.interactions)}</div>
          <div>Last update: {formatDateLong(hover.lastUpdate)}</div>
        </div>
      )}
    </div>
  );
}

function formatNum(n) {
  return n.toLocaleString('en-US');
}
function formatDateShort(t) {
  const d = new Date(t);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
}
function formatDateLong(t) {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ----------------------------- Page ----------------------------- */

export default function DocEngagementPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [filters, setFilters] = useState(() => Object.fromEntries(INTERACTION_TYPES.map((t) => [t.key, true])));
  const [sort, setSort] = useState({ col: 'interactions', dir: 'desc' });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedIds, setSelectedIds] = useState([]);

  const allChecked = INTERACTION_TYPES.every((t) => filters[t.key]);
  const allIndeterm = INTERACTION_TYPES.some((t) => filters[t.key]) && !allChecked;
  const setAll = (v) => setFilters(Object.fromEntries(INTERACTION_TYPES.map((t) => [t.key, v])));
  const setOne = (k, v) => setFilters((s) => ({ ...s, [k]: v }));

  const selectedRows = useMemo(() => SCATTER.filter((p) => selectedIds.includes(p.id)), [selectedIds]);
  const sortedRows = useMemo(() => {
    const rows = [...selectedRows];
    rows.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.col === 'interactions') return (a.interactions - b.interactions) * dir;
      if (sort.col === 'lastUpdate')   return (a.lastUpdate - b.lastUpdate) * dir;
      if (sort.col === 'title')        return a.title.localeCompare(b.title) * dir;
      return 0;
    });
    return rows;
  }, [selectedRows, sort]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const stop  = Math.min(total, page * pageSize);
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col) => {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));
  };

  const sortIcon = (col) => {
    if (sort.col !== col) return <IconSortNone />;
    return sort.dir === 'asc' ? <IconSortAsc /> : <IconSortDesc />;
  };

  const breadcrumb = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
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
      feedbackSubject="Feedback about document engagement"
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Document distribution by date of last update and number of interactions.
            </span>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              <ScatterPlot
                points={SCATTER}
                onSelect={(ids) => { setSelectedIds(ids); setPage(1); }}
              />
            </div>

            <div style={PS.tableCard}>
              <table style={PS.table}>
                <thead>
                  <tr style={PS.tableHeadRow}>
                    <th style={PS.th}><HeaderCell label="Interactions" sortIcon={sortIcon('interactions')} onClick={() => toggleSort('interactions')} /></th>
                    <th style={PS.th}><HeaderCell label="Title" sortIcon={sortIcon('title')} onClick={() => toggleSort('title')} /></th>
                    <th style={PS.th}><HeaderCell label="Doc. last update" sortIcon={sortIcon('lastUpdate')} onClick={() => toggleSort('lastUpdate')} /></th>
                    <th style={PS.th}><HeaderCell label="Metadata" /></th>
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
                          <span>Select a single document by clicking a dot on the chart, or click and drag to select multiple documents.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.id} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.interactions)}</td>
                        <td style={{ ...PS.td, color: '#1d4ed8', fontWeight: 600 }}>{r.title}</td>
                        <td style={PS.td}>{formatDateLong(r.lastUpdate)}</td>
                        <td style={{ ...PS.td, color: '#64748b' }}>—</td>
                        <td style={PS.td}>
                          <button
                            type="button"
                            style={PS.linkBtn}
                            onClick={() => setSelectedIds((arr) => arr.filter((id) => id !== r.id))}
                            title="Remove"
                          >
                            <IconClose />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={PS.pager}>
                <span style={PS.pagerLabel}>{total === 0 ? '0 of 0' : `${start} – ${stop} of ${total}`}</span>
                <div style={PS.pagerBtns}>
                  <PagerBtn disabled={page === 1} onClick={() => setPage(1)} aria-label="First page"><IconChevDoubleLeft /></PagerBtn>
                  <PagerBtn disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page"><IconChevLeft /></PagerBtn>
                  <PagerBtn disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page"><IconChevRight /></PagerBtn>
                  <PagerBtn disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page"><IconChevDoubleRight /></PagerBtn>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside style={{ ...DS.drawer, transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)' }}>
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
                  <Checkbox
                    checked={!!filters[t.key]}
                    onChange={(v) => setOne(t.key, v)}
                    label={t.label}
                  />
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
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  body: { padding: '16px 22px 28px', display: 'flex', flexDirection: 'column', gap: '14px' },

  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px 14px 8px',
  },

  tableCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '4px 0 0',
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
  td: { padding: '10px 14px', fontSize: '0.85rem', color: '#0f172a' },
  emptyCell: { padding: '24px 14px', textAlign: 'center' },
  emptyCellInner: { color: '#475569', fontSize: '0.85rem', display: 'flex', flexDirection: 'column' },
  linkBtn: {
    width: '24px',
    height: '24px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '50%',
  },

  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '8px 14px',
    borderTop: '1px solid #f1f5f9',
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
  wrap: { position: 'relative', width: '100%' },
  tooltip: {
    position: 'absolute',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#ffffff',
    fontSize: '0.78rem',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(81, 77, 77, 0.8)',
    pointerEvents: 'none',
    boxShadow: '0 1px 8px rgba(0, 0, 0, 0.18)',
    lineHeight: 1.45,
    minWidth: '180px',
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
    borderLeft: '1px solid #e5e7eb',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 200ms ease',
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
