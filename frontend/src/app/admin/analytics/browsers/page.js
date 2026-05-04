'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

/** Align with backend default and Traffic analytics retention policy. */
const ANALYTICS_DATA_RETENTION_DAYS = 730;

const SLICE_COLORS = [
  '#D395C2',
  '#EBCF47',
  '#A193EC',
  '#82C9BD',
  '#F4719D',
  '#A3B823',
  '#63BCE9',
  '#D9A68C',
  '#85E0B2',
  '#BBBBC9',
];

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

/** Rolling ~90 days ending today (Fluid Topics “last 3 months” style). */
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

const fmtCount = (n) => n.toLocaleString('en-US');
const formatShare = (v) => (v < 0.01 ? '<0.01%' : `${v.toFixed(2)}%`);
const fmtPctDisplay = (pct) => {
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct < 0.01) return '<0.01%';
  return `${pct.toFixed(2)}%`;
};

function downloadBrowsersCsv(rows, total) {
  if (!rows?.length) return;
  const lines = [['Browser', 'Events', 'Share %'].join(',')];
  for (const r of rows) {
    lines.push([JSON.stringify(r.name), r.count, JSON.stringify(formatShare(r.share))].join(','));
  }
  lines.push(['Total events', total, '100'].join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'browsers-traffic.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Icons ------------------------------ */

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconExternal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <line x1="10" y1="14" x2="21" y2="3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function BrowsersPage() {
  const def = useMemo(() => defaultDateRangePreviousMonth(), []);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(def.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(def.end));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => toInputDate(def.start));
  const [customEnd, setCustomEnd] = useState(() => toInputDate(def.end));
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
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

  const chartData = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.name,
      value: r.count,
      share: r.share,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));
  }, [rows]);

  const fetchData = useCallback(async () => {
    if (!startIso || !endIso) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/traffic/browsers', {
        startDate: startIso,
        endDate: endIso,
      });
      if (json?.browsers) {
        setRows(json.browsers);
        setTotal(typeof json.total === 'number' ? json.total : 0);
        setMethodology(json.methodology ?? null);
      } else if (json?.error) {
        setErrorMsg(json.error);
        setRows([]);
        setTotal(0);
        setMethodology(null);
      } else {
        setErrorMsg('Unexpected response');
        setRows([]);
        setTotal(0);
        setMethodology(null);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
      setRows([]);
      setTotal(0);
      setMethodology(null);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso]);

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

  const displayFrom = rangeStart;
  const displayTo = rangeEnd;

  return (
    <AnalyticsShell
      active="browsers"
      breadcrumb={{ prefix: 'Traffic', title: 'Browsers' }}
      toolbarExtras={
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
                <button type="button" style={PS.applyBtn} onClick={applyCustom}>
                  Apply
                </button>
              </div>
              <p style={PS.retentionHint}>
                Start date must be within the last {ANALYTICS_DATA_RETENTION_DAYS} days (retention). End must be after
                start.
              </p>
            </div>
          )}
        </div>
      }
    >
      <main style={PS.main}>
        <header style={PS.resultHead}>
          <span style={PS.headTitle}>
            <span style={PS.tagline}>Traffic share per browser.</span>
            <BrowsersInfoPopover />
          </span>
          <button
            type="button"
            style={PS.iconBtn}
            title="Download as CSV"
            aria-label="Download as CSV"
            onClick={() => downloadBrowsersCsv(rows, total)}
            disabled={!rows.length}
          >
            <IconDownload />
          </button>
        </header>

        <section style={PS.body}>
          {loading ? (
            <div style={PS.loading}>Loading browser traffic…</div>
          ) : errorMsg && !rows.length ? (
            <div style={PS.errorBox}>{errorMsg}</div>
          ) : (
            <>
              {errorMsg ? <div style={PS.warnBox}>{errorMsg}</div> : null}
              <BrowsersDonut data={chartData} total={total} methodology={methodology} />
            </>
          )}
        </section>
      </main>
    </AnalyticsShell>
  );
}

/* ------------------------------ Help popover ------------------------------ */

function BrowsersInfoPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span style={IP.wrap} ref={ref}>
      <button
        type="button"
        style={{ ...IP.trigger, background: open ? '#eff6ff' : 'transparent' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Browsers analytics help"
        title="Browsers analytics"
      >
        <IconInfo />
      </button>
      {open && (
        <div role="dialog" aria-label="Browsers analytics" style={IP.popover}>
          <header style={IP.head}>
            <span style={IP.heading}>Browsers</span>
            <button type="button" style={IP.close} onClick={() => setOpen(false)} aria-label="close">
              <IconClose />
            </button>
          </header>
          <div style={IP.bodyScroll}>
            <p style={IP.p}>
              Selecting Browsers under Analytics shows traffic for the portal broken down by browser. A pie chart gives
              an at-a-glance view of each browser; each slice is one browser family derived from the User-Agent.
            </p>
            <p style={IP.p}>
              Traffic is based on the number of HTTP requests represented as analytics events—sent from browsers or via
              the API.
            </p>
            <h4 style={IP.h4}>Modify date range</h4>
            <p style={IP.p}>
              By default, the previous calendar month is selected. Open the calendar control to choose the last week, the
              last three months (rolling 90 days), the previous month, or a custom range. The pie chart updates when you
              apply a new range. The start date must fall within the analytics retention period, and the end date must be
              later than the start date.
            </p>
            <h4 style={IP.h4}>Calculation method</h4>
            <p style={IP.p}>
              From January 2024 onward (applied here to all ranges), the calculation excludes static resources. That can
              reduce event counts by up to about 30% compared with counting every raw HTTP request, depending on traffic
              mix.
            </p>
            <p style={IP.linkLine}>
              <span>See </span>
              <a
                href="https://doc.fluidtopics.com/r/Fluid-Topics-Glossary/Definitions/H/HTTP-request"
                target="_blank"
                rel="noopener noreferrer"
                style={IP.link}
              >
                <span>HTTP requests</span>
                <IconExternal />
              </a>
            </p>
          </div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------ Donut chart ------------------------------ */

function BrowsersDonut({ data, total, methodology }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 156;
  const innerR = 92;

  const slices = useMemo(() => {
    if (!data.length || !total) return [];
    let cursor = 0;
    return data.map((b) => {
      const frac = b.value / total;
      const start = cursor;
      const end = cursor + frac * Math.PI * 2;
      cursor = end;
      const mid = (start + end) / 2;
      const sweep = end - start;
      return { ...b, frac, start, end, mid, sweep };
    });
  }, [data, total]);

  const pointAt = (angle, r) => {
    const x = cx + Math.sin(angle) * r;
    const y = cy - Math.cos(angle) * r;
    return [x, y];
  };

  const slicePath = (s) => {
    const [x1o, y1o] = pointAt(s.start, outerR);
    const [x2o, y2o] = pointAt(s.end, outerR);
    const [x2i, y2i] = pointAt(s.end, innerR);
    const [x1i, y1i] = pointAt(s.start, innerR);
    const largeArc = s.sweep > Math.PI ? 1 : 0;
    return [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x2i} ${y2i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i}`,
      'Z',
    ].join(' ');
  };

  const LABEL_MIN_SWEEP = (12 * Math.PI) / 180;
  const [hover, setHover] = useState(null);

  if (!slices.length) {
    return (
      <div style={DC.empty}>No browser data in this range.</div>
    );
  }

  return (
    <div style={DC.wrap}>
      <div style={DC.chartCol}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label="Browsers traffic share pie chart"
        >
          {slices.map((s, i) => (
            <g key={s.name}>
              <path
                d={slicePath(s)}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth="1"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                opacity={hover === null || hover === i ? 1 : 0.55}
              >
                <title>{`${s.name}: ${fmtCount(s.value)} (${fmtPctDisplay(s.frac * 100)})`}</title>
              </path>
              {s.sweep >= LABEL_MIN_SWEEP && (
                (() => {
                  const labelR = (innerR + outerR) / 2;
                  const [lx, ly] = pointAt(s.mid, labelR);
                  return (
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="12"
                      fontWeight="700"
                      fill="#282832"
                      fontFamily="Inter, sans-serif"
                      pointerEvents="none"
                    >
                      {s.name}
                    </text>
                  );
                })()
              )}
            </g>
          ))}

          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="Inter, sans-serif">
            Total events
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">
            {fmtCount(total)}
          </text>
        </svg>
        {methodology?.excludesStaticResources ? (
          <p style={DC.chartFoot}>
            Counts exclude static resources (scripts, styles, fonts, images, framework chunks). Methodology aligned with
            Jan 2024+.
          </p>
        ) : null}
      </div>

      <div style={DC.legendCol} aria-label="Browser legend">
        <div style={DC.legendHead}>
          <span>Browser</span>
          <span style={{ display: 'flex', gap: '24px' }}>
            <span style={{ width: '70px', textAlign: 'right' }}>Events</span>
            <span style={{ width: '52px', textAlign: 'right' }}>Share</span>
          </span>
        </div>
        <ul style={DC.legendList}>
          {slices.map((s, i) => (
            <li
              key={s.name}
              style={{
                ...DC.legendItem,
                background: hover === i ? '#f1f5f9' : 'transparent',
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span style={DC.legendLabel}>
                <span style={{ ...DC.swatch, background: s.color }} aria-hidden="true" />
                <span>{s.name}</span>
              </span>
              <span style={{ display: 'flex', gap: '24px' }}>
                <span style={{ ...DC.legendValue, width: '70px' }}>{fmtCount(s.value)}</span>
                <span style={{ ...DC.legendValue, width: '52px', color: '#475569' }}>
                  {fmtPctDisplay(s.frac * 100)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

const PS = {
  toolbarWrap: { position: 'relative', display: 'inline-flex' },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
  },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTitle: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  tagline: { fontSize: '0.85rem', color: '#475569' },
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
  },
  dateIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#475569',
    cursor: 'pointer',
    font: 'inherit',
  },
  dateLabels: { display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' },
  dateLine: { fontSize: '0.72rem', color: '#475569', fontWeight: 500 },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  pickerPanel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 'min(360px, 92vw)',
    padding: '14px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
    zIndex: 40,
  },
  pickerTitle: { margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' },
  presetBtn: {
    padding: '6px 10px',
    fontSize: '0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#f8fafc',
    cursor: 'pointer',
    color: '#0f172a',
  },
  customRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '10px',
    marginBottom: '8px',
  },
  customLab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.72rem',
    color: '#475569',
  },
  dateInput: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    color: '#0f172a',
  },
  applyBtn: {
    padding: '6px 14px',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    background: '#1d4ed8',
    color: '#ffffff',
    cursor: 'pointer',
  },
  retentionHint: { margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 },

  body: {
    padding: '24px 22px 32px',
    display: 'flex',
    justifyContent: 'center',
  },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b' },
  errorBox: { padding: '24px', color: '#b91c1c', fontSize: '0.9rem', maxWidth: '560px', margin: '0 auto' },
  warnBox: {
    padding: '10px 14px',
    marginBottom: '16px',
    maxWidth: '900px',
    marginLeft: 'auto',
    marginRight: 'auto',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '8px',
    fontSize: '0.82rem',
    color: '#92400e',
  },
};

const IP = {
  wrap: { position: 'relative', display: 'inline-flex' },
  trigger: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    color: '#1d4ed8',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(400px, 92vw)',
    maxHeight: 'min(80vh, 480px)',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
    flexShrink: 0,
  },
  heading: { fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' },
  close: {
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  bodyScroll: {
    padding: '10px 12px 14px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.8rem',
    color: '#1e293b',
    lineHeight: 1.5,
  },
  p: { margin: 0 },
  h4: { margin: '4px 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' },
  linkLine: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#1d4ed8',
    textDecoration: 'underline',
    fontWeight: 500,
  },
};

const DC = {
  empty: { padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' },
  wrap: {
    display: 'flex',
    gap: '32px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '1080px',
  },
  chartCol: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  chartFoot: {
    margin: 0,
    maxWidth: '380px',
    fontSize: '0.72rem',
    color: '#64748b',
    lineHeight: 1.45,
    textAlign: 'center',
  },
  legendCol: {
    flex: '1 1 360px',
    minWidth: '320px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#ffffff',
    overflow: 'hidden',
  },
  legendHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  legendList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxHeight: '360px',
    overflowY: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 14px',
    fontSize: '0.83rem',
    color: '#1f2937',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 120ms ease',
    cursor: 'default',
  },
  legendLabel: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  swatch: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    display: 'inline-block',
    flexShrink: 0,
  },
  legendValue: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    fontSize: '0.82rem',
  },
};
