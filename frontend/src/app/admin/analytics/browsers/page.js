'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Mock data ------------------------------ */

/* Traffic share per browser. Values are HTTP request counts for the period
 * (March 1 → March 31, 2026). Mirrors the dominant Chrome / Edge split shown
 * in the Angular blueprint, with a long-tail of micro-share clients. */
const BROWSERS = [
  { name: 'Chrome',                 value: 1_834_210, color: '#D395C2' },
  { name: 'Edge',                   value: 1_138_504, color: '#EBCF47' },
  { name: 'Firefox',                value:    38_120, color: '#A193EC' },
  { name: 'Safari',                 value:    25_407, color: '#82C9BD' },
  { name: 'Mobile Safari',          value:    11_865, color: '#F4719D' },
  { name: 'Chrome Mobile',          value:     7_932, color: '#A3B823' },
  { name: 'Samsung Internet',       value:     4_614, color: '#63BCE9' },
  { name: 'Opera',                  value:     2_801, color: '#D9A68C' },
  { name: 'Brave',                  value:     1_745, color: '#85E0B2' },
  { name: 'Internet Explorer',      value:     1_038, color: '#BBBBC9' },
  { name: 'Vivaldi',                value:       612, color: '#D395C2' },
  { name: 'Yandex Browser',         value:       418, color: '#EBCF47' },
  { name: 'DuckDuckGo',             value:       279, color: '#A193EC' },
  { name: 'UC Browser',             value:       154, color: '#82C9BD' },
  { name: 'Headless Chrome',        value:        96, color: '#F4719D' },
  { name: 'Postman',                value:        78, color: '#A3B823' },
  { name: 'curl',                   value:        51, color: '#63BCE9' },
  { name: 'Slack',                  value:        37, color: '#D9A68C' },
  { name: 'Microsoft Outlook',      value:        29, color: '#85E0B2' },
  { name: 'Mobile Chrome iOS',      value:        18, color: '#BBBBC9' },
  { name: 'Other / Unknown',        value:        15, color: '#D395C2' },
];

const TOTAL = BROWSERS.reduce((s, b) => s + b.value, 0);

const fmtCount = (n) => n.toLocaleString('en-US');
const fmtPct = (pct) => {
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1)  return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
};

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
  return (
    <AnalyticsShell
      active="browsers"
      breadcrumb={{ prefix: 'Traffic', title: 'Browsers' }}
      feedbackSubject="Feedback about browsers"
      toolbarExtras={
        <div style={PS.dateIndicator} title="Date range" aria-label="Date range">
          <span style={PS.dateLabels}>
            <span style={PS.dateLine}>From: 3/1/2026</span>
            <span style={PS.dateLine}>To: 3/31/2026</span>
          </span>
          <span style={PS.dateCalendar} aria-hidden="true"><IconCalendar /></span>
        </div>
      }
    >
      <main style={PS.main}>
        <header style={PS.resultHead}>
          <span style={PS.headTitle}>
            <span style={PS.tagline}>Traffic share per browser.</span>
            <InfoPopover
              heading="How is traffic measured?"
              body="Traffic is measured by the number of HTTP requests sent to the server by browsers or via the API."
              linkLabel="HTTP requests documentation"
              linkHref="https://doc.fluidtopics.com/r/Fluid-Topics-Glossary/Definitions/H/HTTP-request"
            />
          </span>
          <button
            type="button"
            style={PS.iconBtn}
            title="Download as XLSX"
            aria-label="Download as XLSX"
          >
            <IconDownload />
          </button>
        </header>

        <section style={PS.body}>
          <BrowsersDonut data={BROWSERS} total={TOTAL} />
        </section>
      </main>
    </AnalyticsShell>
  );
}

/* ------------------------------ Info popover ------------------------------ */

function InfoPopover({ heading, body, linkLabel, linkHref }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
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
        style={IP.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Open help: ${heading}`}
        title={`Open help: ${heading}`}
      >
        <IconInfo />
      </button>
      {open && (
        <div role="dialog" aria-label={heading} style={IP.popover}>
          <header style={IP.head}>
            <span style={IP.heading}>{heading}</span>
            <button
              type="button"
              style={IP.close}
              onClick={() => setOpen(false)}
              aria-label="close info"
            >
              <IconClose />
            </button>
          </header>
          <p style={IP.body}>{body}</p>
          <p style={IP.linkLine}>
            <span>See </span>
            <a href={linkHref} target="_blank" rel="noopener noreferrer" style={IP.link}>
              <span>{linkLabel}</span>
              <IconExternal />
            </a>
          </p>
        </div>
      )}
    </span>
  );
}

/* ------------------------------ Donut chart ------------------------------ */

function BrowsersDonut({ data, total }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 156;
  const innerR = 92;

  /* Pre-compute slice geometry. Angles run clockwise from the top (12 o'clock). */
  const slices = useMemo(() => {
    let cursor = 0; /* radians, 0 = top */
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
    /* angle = 0 at top, going clockwise */
    const x = cx + Math.sin(angle) * r;
    const y = cy - Math.cos(angle) * r;
    return [x, y];
  };

  const slicePath = (s) => {
    const [x1o, y1o] = pointAt(s.start, outerR);
    const [x2o, y2o] = pointAt(s.end,   outerR);
    const [x2i, y2i] = pointAt(s.end,   innerR);
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

  /* Slices wide enough to fit a label inline. Anything narrower than ~12° gets
   * just a hover tooltip. */
  const LABEL_MIN_SWEEP = (12 * Math.PI) / 180;

  const [hover, setHover] = useState(null);

  return (
    <div style={DC.wrap}>
      <div style={DC.chartCol}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label="Browsers traffic share donut chart"
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
                <title>{`${s.name}: ${fmtCount(s.value)} (${fmtPct(s.frac * 100)})`}</title>
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

          {/* Centre summary */}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="Inter, sans-serif">
            Total HTTP requests
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">
            {fmtCount(total)}
          </text>
        </svg>
      </div>

      <div style={DC.legendCol} aria-label="Browser legend">
        <div style={DC.legendHead}>
          <span>Browser</span>
          <span style={{ display: 'flex', gap: '24px' }}>
            <span style={{ width: '70px', textAlign: 'right' }}>Requests</span>
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
                  {fmtPct(s.frac * 100)}
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
    padding: '4px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
  },
  dateLabels: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  dateLine: { fontSize: '0.7rem', color: '#475569', fontWeight: 500 },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  body: {
    padding: '24px 22px 32px',
    display: 'flex',
    justifyContent: 'center',
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
    background: 'transparent',
    color: '#1d4ed8',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '-12px',
    width: '320px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
    padding: '12px 14px 14px',
    zIndex: 20,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '6px',
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
  body: { margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 },
  linkLine: {
    margin: '8px 0 0',
    fontSize: '0.82rem',
    color: '#334155',
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
    textDecorationThickness: '1px',
    textUnderlineOffset: '2px',
  },
};

const DC = {
  wrap: {
    display: 'flex',
    gap: '32px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '1080px',
  },
  chartCol: { flex: '0 0 auto' },
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
