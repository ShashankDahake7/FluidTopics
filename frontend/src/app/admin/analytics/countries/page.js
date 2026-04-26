'use client';

import { useEffect, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Country data ------------------------------ */

/* Each row in the Angular blueprint's bar chart, in descending share order.
 * `share` is the numeric percentage value used both to draw the bar width and
 * to size the world-map bubble. `display` mirrors the rounded label that the
 * blueprint shows beside each bar (anything below 0.01% becomes "<0.01%").
 * Latitude / longitude are approximate centroids used for the world-map
 * bubbles; rows without coordinates (e.g. "Unknown") simply don't get a
 * bubble plotted. */
const COUNTRIES = [
  { name: 'India',                flag: '🇮🇳', share: 72.39, lat: 21,    lng: 78 },
  { name: 'Indonesia',            flag: '🇮🇩', share: 5.96,  lat: -2,    lng: 118 },
  { name: 'USA',                  flag: '🇺🇸', share: 5.41,  lat: 39,    lng: -97 },
  { name: 'Singapore',            flag: '🇸🇬', share: 5.40,  lat: 1.3,   lng: 103.8 },
  { name: 'Philippines',          flag: '🇵🇭', share: 4.21,  lat: 12,    lng: 122 },
  { name: 'France',               flag: '🇫🇷', share: 2.23,  lat: 46,    lng: 2 },
  { name: 'United Arab Emirates', flag: '🇦🇪', share: 0.87,  lat: 24,    lng: 54 },
  { name: 'Malaysia',             flag: '🇲🇾', share: 0.85,  lat: 4,     lng: 102 },
  { name: 'Thailand',             flag: '🇹🇭', share: 0.69,  lat: 15,    lng: 100 },
  { name: 'United Kingdom',       flag: '🇬🇧', share: 0.27,  lat: 54,    lng: -2 },
  { name: 'Germany',              flag: '🇩🇪', share: 0.18,  lat: 51,    lng: 10 },
  { name: 'Australia',            flag: '🇦🇺', share: 0.16,  lat: -25,   lng: 134 },
  { name: 'Japan',                flag: '🇯🇵', share: 0.14,  lat: 36,    lng: 138 },
  { name: 'Ireland',              flag: '🇮🇪', share: 0.13,  lat: 53,    lng: -8 },
  { name: 'Sri Lanka',            flag: '🇱🇰', share: 0.13,  lat: 7,     lng: 81 },
  { name: 'Hong Kong',            flag: '🇭🇰', share: 0.09,  lat: 22,    lng: 114 },
  { name: 'Canada',               flag: '🇨🇦', share: 0.08,  lat: 60,    lng: -110 },
  { name: 'China',                flag: '🇨🇳', share: 0.07,  lat: 35,    lng: 105 },
  { name: 'Nigeria',              flag: '🇳🇬', share: 0.07,  lat: 9,     lng: 8 },
  { name: 'Unknown',              flag: '',    share: 0.07 },
  { name: 'Netherlands',          flag: '🇳🇱', share: 0.05,  lat: 52,    lng: 5 },
  { name: 'Vietnam',              flag: '🇻🇳', share: 0.05,  lat: 16,    lng: 107 },
  { name: 'Poland',               flag: '🇵🇱', share: 0.05,  lat: 52,    lng: 19 },
  { name: 'Egypt',                flag: '🇪🇬', share: 0.03,  lat: 27,    lng: 30 },
  { name: 'South Korea',          flag: '🇰🇷', share: 0.03,  lat: 37,    lng: 128 },
  { name: 'Spain',                flag: '🇪🇸', share: 0.03,  lat: 40,    lng: -4 },
  { name: 'Switzerland',          flag: '🇨🇭', share: 0.03,  lat: 47,    lng: 8 },
  { name: 'Brazil',               flag: '🇧🇷', share: 0.03,  lat: -10,   lng: -55 },
  { name: 'Romania',              flag: '🇷🇴', share: 0.03,  lat: 46,    lng: 25 },
  { name: 'Mexico',               flag: '🇲🇽', share: 0.03,  lat: 23,    lng: -102 },
  { name: 'Costa Rica',           flag: '🇨🇷', share: 0.03,  lat: 10,    lng: -84 },
  { name: 'Israel',               flag: '🇮🇱', share: 0.02,  lat: 31,    lng: 35 },
  { name: 'Italy',                flag: '🇮🇹', share: 0.02,  lat: 42,    lng: 12 },
  { name: 'Czechia',              flag: '🇨🇿', share: 0.02,  lat: 50,    lng: 15 },
  { name: 'Andorra',              flag: '🇦🇩', share: 0.02,  lat: 42.5,  lng: 1.5 },
  { name: 'Saudi Arabia',         flag: '🇸🇦', share: 0.02,  lat: 24,    lng: 45 },
  { name: 'South Africa',         flag: '🇿🇦', share: 0.01,  lat: -29,   lng: 25 },
  { name: 'Belgium',              flag: '🇧🇪', share: 0.01,  lat: 50.5,  lng: 4 },
  { name: 'Sweden',               flag: '🇸🇪', share: 0.01,  lat: 60,    lng: 18 },
  { name: 'Kenya',                flag: '🇰🇪', share: 0.01,  lat: 1,     lng: 38 },
  { name: 'Hungary',              flag: '🇭🇺', share: 0.01,  lat: 47,    lng: 19 },
  { name: 'Finland',              flag: '🇫🇮', share: 0.01,  lat: 64,    lng: 26 },
  { name: 'Bangladesh',           flag: '🇧🇩', share: 0.005, lat: 24,    lng: 90 },
  { name: 'Bahrain',              flag: '🇧🇭', share: 0.005, lat: 26,    lng: 50.5 },
  { name: 'Norway',               flag: '🇳🇴', share: 0.005, lat: 62,    lng: 10 },
  { name: 'Palestine',            flag: '🇵🇸', share: 0.005, lat: 32,    lng: 35.2 },
  { name: 'Portugal',             flag: '🇵🇹', share: 0.005, lat: 39,    lng: -8 },
  { name: 'Turkey',               flag: '🇹🇷', share: 0.005, lat: 39,    lng: 35 },
  { name: 'Serbia',               flag: '🇷🇸', share: 0.005, lat: 44,    lng: 21 },
  { name: 'Colombia',             flag: '🇨🇴', share: 0.005, lat: 4,     lng: -74 },
  { name: 'Guyana',               flag: '🇬🇾', share: 0.005, lat: 5,     lng: -58 },
  { name: 'Bulgaria',             flag: '🇧🇬', share: 0.005, lat: 43,    lng: 25 },
  { name: 'Jordan',               flag: '🇯🇴', share: 0.005, lat: 31,    lng: 36 },
  { name: 'Malta',                flag: '🇲🇹', share: 0.005, lat: 36,    lng: 14 },
  { name: 'Ukraine',              flag: '🇺🇦', share: 0.005, lat: 49,    lng: 32 },
  { name: 'Belarus',              flag: '🇧🇾', share: 0.005, lat: 53,    lng: 28 },
  { name: 'Austria',              flag: '🇦🇹', share: 0.005, lat: 47.5,  lng: 14 },
  { name: 'Croatia',              flag: '🇭🇷', share: 0.005, lat: 45,    lng: 15.5 },
  { name: 'Latvia',               flag: '🇱🇻', share: 0.005, lat: 57,    lng: 25 },
  { name: 'Argentina',            flag: '🇦🇷', share: 0.005, lat: -38,   lng: -64 },
  { name: 'Taiwan',               flag: '🇹🇼', share: 0.005, lat: 24,    lng: 121 },
  { name: 'Morocco',              flag: '🇲🇦', share: 0.005, lat: 32,    lng: -6 },
  { name: 'Iceland',              flag: '🇮🇸', share: 0.005, lat: 65,    lng: -19 },
  { name: 'Greece',               flag: '🇬🇷', share: 0.005, lat: 39,    lng: 22 },
  { name: 'Chile',                flag: '🇨🇱', share: 0.005, lat: -33,   lng: -71 },
  { name: 'Slovakia',             flag: '🇸🇰', share: 0.005, lat: 48.5,  lng: 19.5 },
  { name: 'Cyprus',               flag: '🇨🇾', share: 0.005, lat: 35,    lng: 33 },
  { name: 'New Zealand',          flag: '🇳🇿', share: 0.005, lat: -42,   lng: 174 },
  { name: 'Estonia',              flag: '🇪🇪', share: 0.005, lat: 59,    lng: 26 },
  { name: 'Russia',               flag: '🇷🇺', share: 0.005, lat: 60,    lng: 100 },
  { name: 'Pakistan',             flag: '🇵🇰', share: 0.005, lat: 30,    lng: 70 },
  { name: 'Lithuania',            flag: '🇱🇹', share: 0.005, lat: 55,    lng: 24 },
  { name: 'Iraq',                 flag: '🇮🇶', share: 0.005, lat: 33,    lng: 44 },
  { name: 'Albania',              flag: '🇦🇱', share: 0.005, lat: 41,    lng: 20 },
  { name: 'Venezuela',            flag: '🇻🇪', share: 0.005, lat: 8,     lng: -66 },
  { name: 'Uzbekistan',           flag: '🇺🇿', share: 0.005, lat: 41,    lng: 64 },
  { name: 'Qatar',                flag: '🇶🇦', share: 0.005, lat: 25,    lng: 51 },
  { name: 'Denmark',              flag: '🇩🇰', share: 0.005, lat: 56,    lng: 10 },
  { name: "Côte d'Ivoire",        flag: '🇨🇮', share: 0.005, lat: 7.5,   lng: -5 },
  { name: 'Bolivia',              flag: '🇧🇴', share: 0.005, lat: -17,   lng: -65 },
  { name: 'Syria',                flag: '🇸🇾', share: 0.005, lat: 35,    lng: 38 },
  { name: 'Senegal',              flag: '🇸🇳', share: 0.005, lat: 14,    lng: -14 },
  { name: 'Myanmar',              flag: '🇲🇲', share: 0.005, lat: 22,    lng: 96 },
  { name: 'Lebanon',              flag: '🇱🇧', share: 0.005, lat: 33.8,  lng: 35.8 },
  { name: 'Honduras',             flag: '🇭🇳', share: 0.005, lat: 15,    lng: -86.5 },
  { name: 'Dominica',             flag: '🇩🇲', share: 0.005, lat: 15.5,  lng: -61 },
  { name: 'Azerbaijan',           flag: '🇦🇿', share: 0.005, lat: 40,    lng: 47.5 },
];

const TOTAL_SHARE = COUNTRIES.reduce((sum, c) => sum + c.share, 0);
const MAX_SHARE = COUNTRIES[0].share;

const formatShare = (v) => (v < 0.01 ? '<0.01%' : `${v.toFixed(2)}%`);

/* ------------------------------ World map ------------------------------ */

/* Simplified equirectangular world map. Each continent is described as a
 * very low-poly polygon in (lng, lat) pairs which we project into the SVG
 * coordinate system at render time. The shapes don't try to be cartographic
 * — they're just enough to read as a world map under the bubble overlay. */

const MAP_WIDTH = 880;
const MAP_HEIGHT = 440;

const projX = (lng) => ((lng + 180) / 360) * MAP_WIDTH;
const projY = (lat) => ((90 - lat) / 180) * MAP_HEIGHT;

const polyToPath = (pts) => {
  const [first, ...rest] = pts;
  const move = `M ${projX(first[0]).toFixed(1)},${projY(first[1]).toFixed(1)}`;
  const lines = rest.map(([lng, lat]) => `L ${projX(lng).toFixed(1)},${projY(lat).toFixed(1)}`).join(' ');
  return `${move} ${lines} Z`;
};

const CONTINENTS = [
  /* North America (mainland) */
  [
    [-168, 65], [-140, 70], [-95, 80], [-70, 78], [-55, 60], [-65, 45],
    [-80, 30], [-95, 17], [-105, 22], [-115, 32], [-125, 40], [-130, 55],
    [-160, 64],
  ],
  /* Greenland (separate blob) */
  [
    [-55, 80], [-30, 80], [-22, 70], [-40, 60], [-55, 70],
  ],
  /* Central America link */
  [
    [-95, 17], [-77, 8], [-82, 13], [-100, 22],
  ],
  /* South America */
  [
    [-80, 12], [-60, 12], [-48, 0], [-35, -5], [-40, -25], [-55, -35],
    [-68, -55], [-75, -45], [-78, -25], [-80, -10],
  ],
  /* Europe */
  [
    [-10, 60], [12, 70], [30, 70], [40, 56], [40, 45], [25, 38],
    [10, 36], [-5, 38], [-10, 44], [-12, 52],
  ],
  /* Africa */
  [
    [-17, 32], [10, 36], [25, 32], [35, 22], [50, 12], [42, 0],
    [38, -10], [30, -25], [20, -35], [10, -22], [-5, -10], [-15, 5],
    [-17, 20],
  ],
  /* Middle East / Arabia */
  [
    [35, 42], [55, 38], [60, 25], [50, 12], [42, 14], [35, 24],
  ],
  /* Asia (large polygon — Russia/China/India shape) */
  [
    [40, 70], [80, 78], [140, 70], [160, 60], [150, 45], [125, 35],
    [115, 22], [108, 8], [95, 5], [85, 18], [78, 30], [60, 30],
    [50, 38], [40, 50],
  ],
  /* Indian subcontinent (extra bump) */
  [
    [70, 30], [88, 28], [88, 8], [76, 8], [72, 18],
  ],
  /* SE Asia / Indonesia archipelago (rough blob) */
  [
    [95, 8], [110, 5], [125, 0], [140, -2], [140, -10], [120, -10],
    [105, -8], [95, 0],
  ],
  /* Philippines (small blob) */
  [
    [118, 18], [125, 18], [127, 5], [120, 5],
  ],
  /* Japan (small blob) */
  [
    [130, 42], [142, 45], [145, 35], [136, 32], [131, 36],
  ],
  /* Australia */
  [
    [115, -12], [130, -12], [145, -15], [153, -28], [148, -38],
    [120, -35], [112, -25],
  ],
  /* New Zealand */
  [
    [170, -36], [178, -38], [177, -46], [170, -45],
  ],
  /* Antarctica strip */
  [
    [-180, -65], [180, -65], [180, -85], [-180, -85],
  ],
];

const isHighlighted = (share) => share >= 0.05;

/* The blueprint's choropleth uses a soft pink/purple palette where the
 * darkest cells correspond to the country with the largest share. We mimic
 * the same "intensity by share" feel for our bubble overlay. */
const bubbleColor = (share) => {
  if (share >= 5)  return '#7d1860';
  if (share >= 1)  return '#9d207b';
  if (share >= 0.1)  return '#b53d8e';
  if (share >= 0.01) return '#d18ab8';
  return '#e8c4d8';
};

/* Bubble radius scales sub-linearly with share so India isn't comically
 * large compared to the long tail. */
const bubbleRadius = (share) => {
  const min = 3.5;
  const max = 26;
  const norm = Math.min(1, Math.sqrt(share) / Math.sqrt(MAX_SHARE));
  return min + (max - min) * norm;
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

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="12" y1="7" x2="12" y2="8" />
  </svg>
);

const IconExpand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const IconExternal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <path d="M21 3l-9 9" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function CountriesPage() {
  return (
    <AnalyticsShell
      active="countries"
      breadcrumb={{ prefix: 'Traffic', title: 'Countries' }}
      feedbackSubject="Feedback about countries"
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <div style={PS.dateIndicator} title="Date range" aria-label="Date range">
            <span style={PS.dateLabels}>
              <span style={PS.dateLine}>From: 3/1/2026</span>
              <span style={PS.dateLine}>To: 3/31/2026</span>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true"><IconCalendar /></span>
          </div>
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              <span>Traffic share per country.</span>
              <InfoPopover />
            </span>
            <button
              type="button"
              style={PS.downloadBtn}
              title="Download as XLSX"
              aria-label="Download as XLSX"
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <div style={PS.mapCard}>
              <button
                type="button"
                style={PS.expandBtn}
                title="Expand map"
                aria-label="Expand map"
              >
                <IconExpand />
              </button>
              <WorldMap />
            </div>

            <div style={PS.barsCard}>
              <CountriesBars />
            </div>
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ InfoPopover ------------------------------ */

function InfoPopover() {
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
        style={{
          ...IP.btn,
          background: open ? '#eff6ff' : 'transparent',
        }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open help: How is traffic measured?"
        aria-expanded={open}
        title="Open help: How is traffic measured?"
      >
        <IconInfo />
      </button>
      {open && (
        <div role="dialog" aria-label="How is traffic measured?" style={IP.panel}>
          <div style={IP.panelHead}>
            <h4 style={IP.panelTitle}>How is traffic measured?</h4>
            <button
              type="button"
              style={IP.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="close info"
              title="close info"
            >
              <IconClose />
            </button>
          </div>
          <div style={IP.panelBody}>
            <p style={IP.paragraph}>
              Traffic is measured by the number of HTTP requests sent to the server by browsers or via the API.
            </p>
            <p style={IP.linkLine}>
              <span>See </span>
              <a
                href="https://doc.fluidtopics.com/r/Fluid-Topics-Glossary/Definitions/H/HTTP-request"
                target="_blank"
                rel="noopener noreferrer"
                style={IP.link}
              >
                <span>HTTP requests definition</span>
                <span style={IP.linkIcon} aria-hidden="true"><IconExternal /></span>
              </a>
            </p>
            <h5 style={IP.subTitle}>How is traffic categorized?</h5>
            <p style={IP.paragraph}>
              Country attribution relies on IP geolocation providers, and may not always reflect the exact origin of requests due to differences in provider data.
            </p>
            <p style={IP.paragraph}>
              This data is for informational use only, and should not be relied upon for security or forensic purposes.
            </p>
          </div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------ World map ------------------------------ */

function WorldMap() {
  const plotted = COUNTRIES.filter((c) => c.lat !== undefined && c.lng !== undefined);

  return (
    <div style={MAP.wrap}>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={MAP.svg}
        role="img"
        aria-label="World map showing traffic share per country"
      >
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f7f1f5" />

        {CONTINENTS.map((poly, i) => (
          <path
            key={i}
            d={polyToPath(poly)}
            fill="#f0dbea"
            stroke="#cfb3c5"
            strokeWidth="0.6"
          />
        ))}

        {plotted.map((c) => {
          const r = bubbleRadius(c.share);
          const cx = projX(c.lng);
          const cy = projY(c.lat);
          const highlight = isHighlighted(c.share);
          return (
            <g key={c.name}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={bubbleColor(c.share)}
                fillOpacity={highlight ? 0.85 : 0.55}
                stroke="#ffffff"
                strokeWidth="1"
              >
                <title>{`${c.name} ${c.flag} — ${formatShare(c.share)}`}</title>
              </circle>
              {c.share >= 1 && (
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#ffffff"
                  fontFamily="Inter, sans-serif"
                  pointerEvents="none"
                >
                  {c.flag}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={MAP.legend}>
        <span style={MAP.legendTitle}>Traffic share</span>
        <div style={MAP.legendScale}>
          <span style={{ ...MAP.legendDot, background: '#e8c4d8' }} aria-hidden="true" />
          <span style={MAP.legendLabel}>&lt;0.01%</span>
          <span style={{ ...MAP.legendDot, background: '#d18ab8' }} aria-hidden="true" />
          <span style={MAP.legendLabel}>0.01%</span>
          <span style={{ ...MAP.legendDot, background: '#b53d8e' }} aria-hidden="true" />
          <span style={MAP.legendLabel}>0.1%</span>
          <span style={{ ...MAP.legendDot, background: '#9d207b' }} aria-hidden="true" />
          <span style={MAP.legendLabel}>1%</span>
          <span style={{ ...MAP.legendDot, background: '#7d1860' }} aria-hidden="true" />
          <span style={MAP.legendLabel}>5%+</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Country bars ------------------------------ */

function CountriesBars() {
  return (
    <ul style={CB.list}>
      {COUNTRIES.map((c) => {
        const widthPct = MAX_SHARE === 0
          ? 0
          : Math.max(0.4, (c.share / MAX_SHARE) * 100);
        return (
          <li key={c.name} style={CB.row}>
            <div style={CB.label}>
              <span>{c.name}</span>
              {c.flag && <span style={CB.flag} aria-hidden="true">{c.flag}</span>}
            </div>
            <div style={CB.barTrack}>
              <div
                style={{
                  ...CB.barFill,
                  width: `${widthPct}%`,
                }}
                title={`${c.name} ${c.flag} — ${formatShare(c.share)}`}
              />
              <span style={CB.barValue}>{formatShare(c.share)}</span>
            </div>
          </li>
        );
      })}
      <li style={CB.totalRow}>
        <span>Total share displayed</span>
        <span>{formatShare(TOTAL_SHARE)}</span>
      </li>
    </ul>
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
  },

  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  dateIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#475569',
  },
  dateLabels: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 },
  dateLine: { fontSize: '0.7rem', color: '#475569' },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },

  resultHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '18px 22px 14px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: '#475569',
    flex: 1,
  },
  downloadBtn: {
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

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px 22px 28px',
  },

  mapCard: {
    position: 'relative',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    overflow: 'hidden',
  },
  expandBtn: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: '#ffffff',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
    zIndex: 2,
  },
  barsCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px 18px 14px',
  },
};

const IP = {
  wrap: { position: 'relative', display: 'inline-flex', flexShrink: 0 },
  btn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    color: '#1d4ed8',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '340px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)',
    zIndex: 60,
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  panelTitle: { margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' },
  subTitle: { margin: '4px 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' },
  closeBtn: {
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
    flexShrink: 0,
  },
  panelBody: {
    padding: '10px 12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.8rem',
    color: '#1e293b',
    lineHeight: 1.5,
  },
  paragraph: { margin: 0 },
  linkLine: { margin: 0, fontSize: '0.8rem', color: '#475569' },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#1d4ed8',
    textDecoration: 'underline',
    fontWeight: 500,
  },
  linkIcon: { display: 'inline-flex', color: '#1d4ed8' },
};

const MAP = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  svg: {
    width: '100%',
    aspectRatio: '2 / 1',
    display: 'block',
    background: '#f7f1f5',
    borderRadius: '8px',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '0.75rem',
    color: '#475569',
    paddingTop: '4px',
  },
  legendTitle: { fontWeight: 600, color: '#0f172a' },
  legendScale: { display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block',
    border: '1px solid rgba(15,23,42,0.08)',
  },
  legendLabel: { color: '#475569', marginRight: '4px' },
};

const CB = {
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 220px) 1fr',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 0',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'flex-end',
    fontSize: '0.78rem',
    color: '#475569',
    fontFamily: 'Inter, sans-serif',
  },
  flag: { fontSize: '1rem', lineHeight: 1 },
  barTrack: {
    position: 'relative',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  barFill: {
    height: '14px',
    minWidth: '2px',
    background: '#9d207b',
    borderRadius: '2px',
  },
  barValue: {
    fontSize: '0.78rem',
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 4px 4px',
    marginTop: '8px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '0.78rem',
    color: '#475569',
    fontWeight: 500,
  },
};
