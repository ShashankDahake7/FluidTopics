'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';
import { isoToFlagEmoji } from '@/data/countryCentroids';

/** Natural Earth–based TopoJSON (via world-atlas), loaded client-side. */
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const MAP_WIDTH = 980;
const MAP_HEIGHT = 480;

const formatShare = (v) => (v < 0.01 ? '<0.01%' : `${v.toFixed(2)}%`);

/** Same rule for CSV export as for the list (countries under 0.01% shown as &lt;0.01%). */
const formatShareCsv = formatShare;

function isoFromGeoProperties(props) {
  if (!props) return '';
  const raw = props.ISO_A2 ?? props.WB_A2 ?? '';
  const s = String(raw).trim().toUpperCase();
  if (s.length !== 2 || s === '-99') return '';
  return s;
}

function hexLerp(t, from, to) {
  const pa = parseInt(from.slice(1), 16);
  const pb = parseInt(to.slice(1), 16);
  const ra = (pa >> 16) & 255;
  const ga = (pa >> 8) & 255;
  const ba = pa & 255;
  const rb = (pb >> 16) & 255;
  const gb = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const b = Math.round(ba + (bb - ba) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Choropleth fill: higher share → deeper purple (matches list bars). */
function fillForShare(share, maxShare) {
  if (share == null || share <= 0 || maxShare <= 0) return '#ebe4e8';
  const t = Math.min(1, share / maxShare);
  return hexLerp(t, '#f5eef3', '#7d1860');
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

const IconGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 0 0 20 15 15 0 0 0 0-20" />
    <path d="M4 8c3 1 5 1 8 1s5 0 8-1M4 16c3-1 5-1 8-1s5 0 8 1" />
  </svg>
);

const IconExternal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <path d="M21 3l-9 9" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

/** Default = previous calendar month (Fluid Topics “last month”). */
function defaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  end.setHours(23, 59, 59, 999);
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

function downloadCountriesCsv(rows, total) {
  if (!rows?.length) return;
  const lines = [['Country', 'ISO', 'Events', 'Share %'].join(',')];
  for (const r of rows) {
    lines.push(
      [
        JSON.stringify(r.name),
        JSON.stringify(r.code === 'ZZ' ? '' : r.code),
        r.count,
        JSON.stringify(formatShareCsv(r.share)),
      ].join(',')
    );
  }
  lines.push(['Total events', '', total, '100'].join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'countries-traffic.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Page ------------------------------ */

export default function CountriesPage() {
  const def = useMemo(() => defaultDateRange(), []);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(def.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(def.end));
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [methodology, setMethodology] = useState(null);

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

  const fetchData = useCallback(async () => {
    if (!startIso || !endIso) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/traffic/countries', {
        startDate: startIso,
        endDate: endIso,
      });
      if (json?.countries) {
        setRows(json.countries);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when range changes
    void fetchData();
  }, [fetchData]);

  const maxShare = useMemo(() => {
    if (!rows.length) return 0;
    return Math.max(...rows.map((r) => r.share), 0.01);
  }, [rows]);

  /** Scale map coloring by top known country — Unknown is omitted from the map. */
  const maxShareForMap = useMemo(() => {
    const known = rows.filter((r) => r.code !== 'ZZ');
    if (!known.length) return 0.01;
    return Math.max(...known.map((r) => r.share), 0.01);
  }, [rows]);

  /** ISO alpha-2 → traffic share % (Unknown excluded — not shown on map). */
  const shareByIso = useMemo(() => {
    const m = Object.create(null);
    for (const r of rows) {
      if (r.code && r.code !== 'ZZ') {
        m[r.code] = r.share;
      }
    }
    return m;
  }, [rows]);

  return (
    <AnalyticsShell
      active="countries"
      breadcrumb={{ prefix: 'Traffic', title: 'Countries' }}
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <div style={PS.dateIndicator} title="Date range (local)" aria-label="Date range">
            <span style={PS.dateLabels}>
              <label style={PS.dateLine}>
                From:{' '}
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  style={PS.dateInput}
                  aria-label="From date"
                />
              </label>
              <label style={PS.dateLine}>
                To:{' '}
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  style={PS.dateInput}
                  aria-label="To date"
                />
              </label>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true">
              <IconCalendar />
            </span>
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
              title="Download as CSV"
              aria-label="Download as CSV"
              onClick={() => downloadCountriesCsv(rows, total)}
              disabled={!rows.length}
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            {loading ? (
              <div style={PS.loading}>Loading country traffic…</div>
            ) : errorMsg ? (
              <div style={PS.errorBox}>{errorMsg}</div>
            ) : (
              <>
                <div style={{ ...PS.mapCard, ...(mapExpanded ? PS.mapCardExpanded : {}) }}>
                  <button
                    type="button"
                    style={PS.expandBtn}
                    title={mapExpanded ? 'Exit full screen' : 'Expand map'}
                    aria-label={mapExpanded ? 'Exit full screen' : 'Expand map'}
                    onClick={() => setMapExpanded((v) => !v)}
                  >
                    <IconExpand />
                  </button>
                  <ChoroplethMap shareByIso={shareByIso} maxShare={maxShareForMap} />
                </div>

                <div style={PS.barsCard}>
                  <CountriesBars rows={rows} maxShare={maxShare} total={total} methodology={methodology} />
                </div>
              </>
            )}
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
        style={{
          ...IP.btn,
          background: open ? '#eff6ff' : 'transparent',
        }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open help: Countries analytics"
        aria-expanded={open}
        title="Countries analytics"
      >
        <IconInfo />
      </button>
      {open && (
        <div role="dialog" aria-label="Countries analytics" style={IP.panel}>
          <div style={IP.panelHead}>
            <h4 style={IP.panelTitle}>Countries</h4>
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
              Authorized users can view where traffic originates. The page has a world map and a list of countries with
              the percentage of traffic each represents. Countries with no traffic in the range are not listed.
            </p>
            <p style={IP.paragraph}>
              Traffic is based on the number of HTTP requests represented as analytics events—sent from browsers or via the
              API. In the list and in the downloaded CSV, countries representing less than 0.01% are shown as &lt;0.01%.
            </p>
            <p style={IP.paragraph}>
              Unknown is not shown on the map; as a result, percentages shown on the map may not add up to 100%. Unknown
              traffic or an unusually large share from one country can come from users on an internal network, VPN, or
              proxy.
            </p>
            <p style={IP.paragraph}>
              Country attribution uses IP geolocation and may not always reflect the exact origin of requests. This data
              is for informational use only, and should not be relied upon for security or forensic purposes.
            </p>
            <h5 style={IP.subTitle}>Modify date range</h5>
            <p style={IP.paragraph}>
              By default, data is shown for the previous calendar month. Use the From / To controls to change the range.
            </p>
            <h5 style={IP.subTitle}>Calculation method</h5>
            <p style={IP.paragraph}>
              From January 2024 onward (applied here to all ranges), the calculation excludes static resources—such as
              scripts, stylesheets, fonts, images, and framework chunks. That can reduce event counts compared with counting
              every raw HTTP request by up to about 30%, depending on traffic mix.
            </p>
            <p style={IP.linkLine}>
              <span>See also </span>
              <a
                href="https://doc.fluidtopics.com/r/Fluid-Topics-Glossary/Definitions/H/HTTP-request"
                target="_blank"
                rel="noopener noreferrer"
                style={IP.link}
              >
                <span>HTTP requests</span>
                <span style={IP.linkIcon} aria-hidden="true">
                  <IconExternal />
                </span>
              </a>
            </p>
          </div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------ Choropleth map ------------------------------ */

function ChoroplethMap({ shareByIso, maxShare }) {
  return (
    <div style={MAP.wrap}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 148,
          center: [0, 22],
        }}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        style={MAP.svg}
        role="img"
        aria-label="World map with countries shaded by traffic share"
      >
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f7f1f5" />
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const iso = isoFromGeoProperties(geo.properties);
              const share = iso ? shareByIso[iso] : undefined;
              const fill = fillForShare(share, maxShare);
              const name =
                geo.properties?.NAME ??
                geo.properties?.NAME_EN ??
                geo.properties?.name ??
                iso ??
                '—';
              const label =
                share != null && share > 0
                  ? `${name} — ${formatShare(share)}`
                  : `${name} — no traffic in range`;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#c9b8c2"
                  strokeWidth={0.35}
                  style={{
                    default: { outline: 'none' },
                    hover: {
                      outline: 'none',
                      fill: share != null && share > 0 ? hexLerp(0.92, fill, '#7d1860') : '#ddd5dc',
                    },
                    pressed: { outline: 'none' },
                  }}
                >
                  <title>{label}</title>
                </Geography>
              );
            })
          }
        </Geographies>
      </ComposableMap>

      <div style={MAP.legend}>
        <span style={MAP.legendTitle}>
          Known-country share (vs top country in range; Unknown is not shown on the map)
        </span>
        <div style={MAP.legendRow}>
          <span style={MAP.legendEnd}>lower</span>
          <div style={MAP.legendGradient} aria-hidden="true">
            <span style={MAP.legendGradientBar} />
          </div>
          <span style={MAP.legendEnd}>higher</span>
        </div>
        <p style={MAP.mapNote}>
          Map shading reflects only countries with a known code. The percentages on the map do not include Unknown
          traffic, so they may not add up to 100%.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Country bars ------------------------------ */

function CountriesBars({ rows, maxShare, total, methodology }) {
  return (
    <ul style={CB.list}>
      {rows.map((c) => {
        const widthPct = maxShare === 0 ? 0 : Math.max(0.4, (c.share / maxShare) * 100);
        const flag = c.code && c.code !== 'ZZ' ? isoToFlagEmoji(c.code) : '';
        return (
          <li key={`${c.code}-${c.name}`} style={CB.row}>
            <div style={CB.label}>
              <span>{c.name}</span>
              {flag ? (
                <span style={CB.flag} aria-hidden="true">
                  {flag}
                </span>
              ) : c.code === 'ZZ' ? (
                <span style={CB.globe} aria-hidden="true" title="Unattributed location">
                  <IconGlobe />
                </span>
              ) : null}
            </div>
            <div style={CB.barTrack}>
              <div
                style={{
                  ...CB.barFill,
                  width: `${widthPct}%`,
                }}
                title={`${c.name} — ${formatShare(c.share)} (${c.count.toLocaleString()} events)`}
              />
              <span style={CB.barValue}>{formatShare(c.share)}</span>
            </div>
          </li>
        );
      })}
      <li style={CB.totalRow}>
        <span title="Count of qualifying analytics events in the selected range (static resources excluded).">
          Total events
        </span>
        <span>{total.toLocaleString('en-US')}</span>
      </li>
      {methodology?.excludesStaticResources ? (
        <li style={CB.methodNote}>
          Traffic is based on HTTP requests recorded as analytics events (browser and API). Counts exclude static
          resources (e.g. JS, CSS, fonts, images, Next.js chunks) — methodology aligned with Jan 2024+ and may be lower
          than raw request totals.
        </li>
      ) : null}
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
  dateLabels: { display: 'inline-flex', flexDirection: 'column', gap: '6px', lineHeight: 1.1 },
  dateLine: { fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' },
  dateInput: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    color: '#0f172a',
  },
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: '18px',
    padding: '18px 22px 28px',
  },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b' },
  errorBox: { padding: '24px', color: '#b91c1c', fontSize: '0.9rem' },

  mapCard: {
    position: 'relative',
    flex: '2 1 420px',
    minWidth: 0,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    overflow: 'hidden',
  },
  mapCardExpanded: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    borderRadius: 0,
    overflow: 'auto',
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
    flex: '1 1 280px',
    minWidth: 0,
    maxWidth: '100%',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px 18px 14px',
    maxHeight: 'min(72vh, 640px)',
    overflowY: 'auto',
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
    width: 'min(400px, 92vw)',
    maxHeight: 'min(80vh, 520px)',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
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
    overflowY: 'auto',
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
    height: 'auto',
    maxWidth: '100%',
    display: 'block',
    background: '#f7f1f5',
    borderRadius: '8px',
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '0.75rem',
    color: '#475569',
    paddingTop: '4px',
  },
  legendTitle: { fontWeight: 600, color: '#0f172a' },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    maxWidth: '420px',
  },
  legendEnd: { color: '#64748b', fontSize: '0.72rem', flexShrink: 0 },
  legendGradient: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' },
  legendGradientBar: {
    width: '100%',
    height: '10px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #f5eef3 0%, #7d1860 100%)',
    border: '1px solid rgba(15,23,42,0.08)',
  },
  mapNote: {
    margin: '4px 0 0',
    fontSize: '0.72rem',
    color: '#64748b',
    lineHeight: 1.45,
    maxWidth: '520px',
  },
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
  globe: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
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
  methodNote: {
    listStyle: 'none',
    padding: '10px 4px 0',
    margin: '8px 0 0',
    borderTop: '1px solid #f1f5f9',
    fontSize: '0.72rem',
    color: '#64748b',
    lineHeight: 1.45,
  },
};
