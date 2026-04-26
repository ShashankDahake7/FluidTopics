'use client';
import { useMemo, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Constants ------------------------------ */

const MONTHS = [
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025',   'February 2025', 'March 2025',    'April 2025',
  'May 2025',       'June 2025',     'July 2025',     'August 2025',
  'September 2025', 'October 2025',  'November 2025', 'December 2025',
  'January 2026',   'February 2026', 'March 2026',    'April 2026',
];

const MONTH_LABELS = [
  'September 2024', 'December 2024', 'March 2025', 'June 2025',
  'September 2025', 'December 2025', 'March 2026',
];

/*
 * Event categories — colour & key match the Angular blueprint exactly.
 * Mock value series are calibrated to mirror the blueprint chart shape:
 *   — Views are the dominant series (10k–100k range)
 *   — Searches are mid-range (1k–25k)
 *   — Interactions/Assets stay near zero with occasional small spikes
 * See the rendered tooltip in the blueprint:
 *   "In November 2024: 226,002 — topic.start_display: 83,493, page.display: 78,651, …"
 */
const CATEGORIES = [
  {
    key: 'views',
    label: 'Views',
    events: [
      {
        key: 'document.start_display',
        label: 'document.start_display',
        color: '#8cb860',
        values: [35100, 26500, 29671, 31500, 39100, 35800, 32650, 31870, 33430, 29490, 38200, 31100, 31650, 31040, 31350, 26750, 26980, 28430, 29970, 21720],
      },
      {
        key: 'topic.start_display',
        label: 'topic.start_display',
        color: '#bd50ae',
        values: [96900, 82600, 83493, 87900, 103000, 91500, 79850, 86650, 81300, 75800, 99400, 83000, 77900, 84600, 83400, 74550, 73180, 76000, 76450, 56000],
      },
      {
        key: 'page.display',
        label: 'page.display',
        color: '#49c06a',
        values: [85100, 70400, 78651, 86100, 99350, 89640, 89110, 90650, 91020, 78110, 99180, 72800, 72330, 71060, 71290, 63320, 63880, 67540, 74470, 51500],
      },
    ],
  },
  {
    key: 'searches',
    label: 'Searches',
    events: [
      {
        key: 'khub.search',
        label: 'khub.search',
        color: '#acb839',
        values: [30700, 20570, 21563, 25240, 28130, 24500, 25940, 22560, 22950, 19660, 26530, 21040, 24910, 20620, 19980, 20130, 18380, 18340, 18380, 15080],
      },
      {
        key: 'search_page.select',
        label: 'search_page.select',
        color: '#6972d7',
        values: [14180, 9640, 10996, 13200, 14930, 13160, 14430, 11990, 12520, 11140, 15240, 11760, 14230, 11320, 11000, 11300, 10370, 10280, 10470, 8430],
      },
      {
        key: 'document.search',
        label: 'document.search',
        color: '#85ad40',
        values: [630, 1230, 1476, 6320, 2530, 1730, 5130, 1690, 1190, 1430, 2620, 1100, 820, 1200, 1330, 4180, 1740, 1240, 1310, 850],
      },
    ],
  },
  {
    key: 'interactions',
    label: 'Interactions',
    events: [
      { key: 'link.share',        label: 'link.share',        color: '#bc81d5', values: Array(20).fill(0) },
      { key: 'feedback.send',     label: 'feedback.send',     color: '#446b1d', values: [12, 23, 30, 21, 28, 41, 41, 56, 21, 23, 14, 14, 17, 13, 21, 21, 14, 25, 14, 13] },
      { key: 'document.rate',     label: 'document.rate',     color: '#d4568b', values: Array(20).fill(0) },
      { key: 'topic.rate',        label: 'topic.rate',        color: '#46b57c', values: [9, 31, 25, 26, 23, 31, 21, 14, 27, 50, 20, 24, 8, 50, 16, 9, 22, 31, 14, 16] },
      { key: 'document.unrate',   label: 'document.unrate',   color: '#892c6a', values: Array(20).fill(0) },
      { key: 'topic.unrate',      label: 'topic.unrate',      color: '#43c8ac', values: Array(20).fill(0) },
      { key: 'document.print',    label: 'document.print',    color: '#d54962', values: Array(20).fill(0) },
      { key: 'document.download', label: 'document.download', color: '#6bad66', values: [3, 4, 6, 10, 5, 4, 2, 37, 9, 18, 9, 4, 5, 10, 10, 31, 44, 10, 47, 13] },
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    events: [
      { key: 'bookmark.delete',     label: 'bookmark.delete',     color: '#d1972c', values: [10, 1, 11, 8, 6, 14, 2, 7, 13, 3, 5, 2, 7, 4, 4, 3, 7, 4, 2, 4] },
      { key: 'bookmark.create',     label: 'bookmark.create',     color: '#d97db9', values: [82, 85, 57, 67, 71, 41, 26, 47, 45, 26, 47, 25, 32, 35, 25, 28, 41, 19, 36, 32] },
      { key: 'collection.create',   label: 'collection.create',   color: '#628ed6', values: [5, 0, 2, 3, 0, 0, 0, 1, 5, 0, 1, 1, 2, 0, 0, 0, 2, 1, 1, 3] },
      { key: 'collection.delete',   label: 'collection.delete',   color: '#c07b31', values: [3, 0, 1, 2, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1] },
      { key: 'collection.update',   label: 'collection.update',   color: '#8f2748', values: [0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { key: 'personal_book.create', label: 'personal_book.create', color: '#beaa52', values: [4, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
      { key: 'personal_book.delete', label: 'personal_book.delete', color: '#8f2931', values: Array(20).fill(0) },
      { key: 'personal_book.update', label: 'personal_book.update', color: '#997835', values: Array(20).fill(0) },
      { key: 'personal_topic.create', label: 'personal_topic.create', color: '#d04d4a', values: Array(20).fill(0) },
      { key: 'personal_topic.delete', label: 'personal_topic.delete', color: '#832e15', values: Array(20).fill(0) },
      { key: 'personal_topic.update', label: 'personal_topic.update', color: '#d66c77', values: Array(20).fill(0) },
      { key: 'saved_search.create', label: 'saved_search.create', color: '#c85932', values: [4, 4, 11, 4, 5, 7, 4, 4, 5, 4, 24, 6, 13, 6, 1, 4, 2, 4, 4, 8] },
      { key: 'saved_search.delete', label: 'saved_search.delete', color: '#db845e', values: [0, 2, 4, 2, 1, 2, 2, 3, 3, 1, 9, 1, 6, 1, 0, 2, 2, 0, 3, 3] },
      { key: 'saved_search.update', label: 'saved_search.update', color: '#543586', values: [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
];

const ALL_EVENTS = CATEGORIES.flatMap((c) => c.events);

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const Y_TICKS_LINEAR = [0, 20000, 40000, 60000, 80000, 100000, 120000];
const Y_TICKS_LOG = [1, 10, 100, 1000, 10000, 100000];

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

/* ------------------------------ Page ------------------------------ */

export default function EventsPage() {
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selected, setSelected] = useState(() => new Set(ALL_EVENTS.map((e) => e.key)));

  const allCount = ALL_EVENTS.length;
  const allSelected = selected.size === allCount;
  const noneSelected = selected.size === 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(ALL_EVENTS.map((e) => e.key)));
  };

  const toggleOne = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat) => {
    const keys = cat.events.map((e) => e.key);
    const everyOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const visible = useMemo(
    () => ALL_EVENTS.filter((e) => selected.has(e.key)),
    [selected],
  );

  return (
    <AnalyticsShell
      active="events"
      breadcrumb={{ prefix: 'Traffic', title: 'Events' }}
      feedbackSubject="Feedback about events"
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
                title="Download as XLSX"
                aria-label="Download as XLSX"
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            <div style={PS.chartCard}>
              <EventsChart
                series={visible}
                stacked={stacked}
                logScale={logScale}
                empty={noneSelected}
              />
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
                <span style={PS.noticeIcon}><IconInfo /></span>
                <span style={PS.noticeText}>
                  See{' '}
                  <a
                    href="https://doc.fluidtopics.com/r/Fluid-Topics-Analytics-Guide/Analytics-events"
                    target="_blank"
                    rel="noreferrer noopener"
                    style={PS.noticeLink}
                  >
                    Events documentation
                    <span style={{ marginLeft: '4px', display: 'inline-flex' }}><IconExternal /></span>
                  </a>
                </span>
              </div>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && !noneSelected}
                    onChange={toggleAll}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {CATEGORIES.map((cat) => {
                const keys = cat.events.map((e) => e.key);
                const onCount = keys.filter((k) => selected.has(k)).length;
                const catChecked = onCount === keys.length;
                const catIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={cat.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={catChecked}
                          indeterminate={catIndeterminate}
                          onChange={() => toggleCategory(cat)}
                        />
                        <span>{cat.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {cat.events.map((e) => (
                        <li key={e.key}>
                          <label style={PS.checkRow}>
                            <Checkbox
                              checked={selected.has(e.key)}
                              onChange={() => toggleOne(e.key)}
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
              <button type="button" style={PS.applyBtn}>Apply</button>
            </footer>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Checkbox ------------------------------ */

function Checkbox({ checked, indeterminate, onChange }) {
  const filled = checked || indeterminate;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
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

/* ------------------------------ Chart ------------------------------ */

function EventsChart({ series, stacked, logScale, empty }) {
  const width = 1100;
  const height = 360;
  const padL = 80;
  const padR = 24;
  const padT = 40;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yTicks = logScale ? Y_TICKS_LOG : Y_TICKS_LINEAR;

  const transform = (v) => (logScale ? Math.log10(Math.max(v, 1)) : v);

  const yMin = 0;
  const yMax = logScale ? Math.log10(yTicks[yTicks.length - 1]) : yTicks[yTicks.length - 1];

  const xStep = innerW / (MONTHS.length - 1);
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => {
    const t = transform(v);
    if (yMax === yMin) return padT + innerH;
    const norm = (t - yMin) / (yMax - yMin);
    return padT + innerH - Math.max(0, Math.min(1, norm)) * innerH;
  };

  const stackedSeries = useMemo(() => {
    if (!stacked) return series;
    const running = MONTHS.map(() => 0);
    return series.map(({ label, color, key, values }) => {
      const stackedVals = values.map((v, i) => {
        running[i] += v;
        return running[i];
      });
      return { key, label, color, values: stackedVals };
    });
  }, [series, stacked]);

  const labelTickIdx = useMemo(
    () => MONTH_LABELS.map((label) => MONTHS.indexOf(label)).filter((i) => i >= 0),
    [],
  );

  const ongoingX = xPos(MONTHS.length - 1);
  const lastTickX = xPos(MONTHS.length - 2);

  const formatY = (v) => {
    if (v >= 1000) return v.toLocaleString('en-US');
    return String(v);
  };

  return (
    <div style={CS.wrap}>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
            EVENTS
          </text>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
              <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
                {formatY(t)}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6e7079" />
          <text x={padL + innerW + 6} y={padT + innerH + 3} fontSize="11" fill="#6E7079" fontFamily="Inter, sans-serif">
            DATE
          </text>

          {labelTickIdx.map((idx) => (
            <g key={idx}>
              <line x1={xPos(idx)} y1={padT + innerH} x2={xPos(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
              <text x={xPos(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
                {MONTHS[idx]}
              </text>
            </g>
          ))}

          <rect x={lastTickX} y={padT - 10} width={ongoingX - lastTickX} height={innerH + 10} fill="rgba(33,150,243,0.06)" />
          <text x={(lastTickX + ongoingX) / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
            Ongoing period
          </text>

          {!empty && stackedSeries.map(({ key, label, color, values }) => {
            const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            const isFlatZero = values.every((v) => v === 0);
            return (
              <g key={key} opacity={isFlatZero ? 0.55 : 1}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
                {values.map((v, i) => (
                  <circle
                    key={i}
                    cx={xPos(i)}
                    cy={yPos(v)}
                    r="2.6"
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth="1"
                    opacity={i === values.length - 1 ? 0.55 : 1}
                  >
                    <title>{`${label} — ${MONTHS[i]}: ${v.toLocaleString('en-US')}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {empty && (
            <text x={padL + innerW / 2} y={padT + innerH / 2} fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="Inter, sans-serif">
              No events selected
            </text>
          )}
        </svg>
      </div>

      <div style={CS.legend}>
        {series.map(({ key, label, color }) => (
          <span key={key} style={CS.legendItem}>
            <span style={{ ...CS.legendDot, background: color }} />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
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
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
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

const CS = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  svgWrap: { width: '100%' },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 14px',
    marginTop: '6px',
    padding: '8px 4px 0',
    borderTop: '1px solid #f1f5f9',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.72rem',
    color: '#334155',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  legendDot: { width: '9px', height: '9px', borderRadius: '50%', display: 'inline-block' },
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
