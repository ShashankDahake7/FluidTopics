'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

const ANALYTICS_DATA_RETENTION_DAYS = 730;
const PAGE_SIZE = 50;
const LOCALE_ALL_LANGUAGES = '__all_languages__';

/* ------------------------------ Date range ------------------------------ */

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

function formatFacetsForXlsx(facets) {
  if (!Array.isArray(facets) || !facets.length) return '';
  return facets.map((f) => `${f.label}: ${f.value}`).join('; ');
}

async function downloadNoResultsXlsx(rows, totalQueries, rangeLabel) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['Queries', 'Term', 'Facets'],
    ...rows.map((r) => [r.queries, r.term, formatFacetsForXlsx(r.facets)]),
  ];
  aoa.push(['Total queries (range)', totalQueries, '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'No results');
  const safe = rangeLabel.replace(/[^\w-]+/g, '_').slice(0, 80);
  XLSX.writeFile(wb, `searches-no-results-${safe}.xlsx`);
}

/* ------------------------------ Icons (same set as search-terms) ------------------------------ */

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

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconFirst = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" />
  </svg>
);

const IconPrev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);

const IconNext = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);

const IconLast = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function SearchesNoResultsPage() {
  const def = useMemo(() => defaultDateRangePreviousMonth(), []);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(def.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(def.end));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => toInputDate(def.start));
  const [customEnd, setCustomEnd] = useState(() => toInputDate(def.end));

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [locale, setLocale] = useState('');
  const [localeOptions, setLocaleOptions] = useState([{ value: '', label: 'All content locales' }]);
  const [allLangEnabled, setAllLangEnabled] = useState(true);
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState([]);
  const [totalQueries, setTotalQueries] = useState(0);
  const [totalDistinctRows, setTotalDistinctRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [langCfg, locData] = await Promise.all([
          api.get('/languages/default').catch(() => ({})),
          api.get('/locales').catch(() => ({})),
        ]);
        if (cancelled) return;
        setAllLangEnabled(langCfg?.searchInAllLanguagesEnabled !== false);
        const list = Array.isArray(locData?.locales) ? locData.locales : [];
        const base = [{ value: '', label: 'All content locales' }];
        if (langCfg?.searchInAllLanguagesEnabled !== false) {
          base.push({
            value: LOCALE_ALL_LANGUAGES,
            label: 'All languages',
          });
        }
        for (const l of list) {
          base.push({
            value: l.code,
            label: l.name && l.code ? `${l.name} (${l.code})` : l.code || l.name,
          });
        }
        setLocaleOptions(base);
      } catch {
        if (!cancelled) {
          setLocaleOptions([
            { value: '', label: 'All content locales' },
            { value: LOCALE_ALL_LANGUAGES, label: 'All languages' },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!startIso || !endIso) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const body = {
        startDate: startIso,
        endDate: endIso,
        page: page + 1,
        pageSize: PAGE_SIZE,
        ...(locale ? { locale } : {}),
      };
      const json = await api.post('/analytics/v2/search/no-results', body);
      if (json?.error) {
        setErrorMsg(json.error);
        setRows([]);
        setTotalQueries(0);
        setTotalDistinctRows(0);
        setTotalPages(1);
        return;
      }
      setRows(
        (json.terms || []).map((t) => ({
          queries: t.queries,
          term: t.term,
          facets: Array.isArray(t.facets) ? t.facets : [],
        }))
      );
      setTotalQueries(typeof json.totalQueries === 'number' ? json.totalQueries : 0);
      setTotalDistinctRows(typeof json.totalDistinctRows === 'number' ? json.totalDistinctRows : 0);
      setTotalPages(Math.max(1, typeof json.totalPages === 'number' ? json.totalPages : 1));
    } catch (e) {
      setErrorMsg(e.message || 'Request failed');
      setRows([]);
      setTotalQueries(0);
      setTotalDistinctRows(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso, locale, page]);

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
    setPage(0);
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
    applyRange(s, e);
  };

  const displayFrom = rangeStart;
  const displayTo = rangeEnd;

  const rangeStartIdx = totalDistinctRows === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEndIdx = Math.min((page + 1) * PAGE_SIZE, totalDistinctRows);

  const goFirst = () => setPage(0);
  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));
  const goLast = () => setPage(Math.max(0, totalPages - 1));

  const atStart = page === 0;
  const atEnd = page >= totalPages - 1 || totalPages <= 1;

  const onLocaleChange = (val) => {
    setLocale(val);
    setPage(0);
  };

  const handleExport = async () => {
    if (!startIso || !endIso) return;
    setExporting(true);
    setErrorMsg(null);
    try {
      const json = await api.post('/analytics/v2/search/no-results', {
        startDate: startIso,
        endDate: endIso,
        page: 1,
        pageSize: 10000,
        export: true,
        ...(locale ? { locale } : {}),
      });
      if (json?.error) {
        setErrorMsg(json.error);
        return;
      }
      const list = (json.terms || []).map((t) => ({
        queries: t.queries,
        term: t.term,
        facets: Array.isArray(t.facets) ? t.facets : [],
      }));
      const total = typeof json.totalQueries === 'number' ? json.totalQueries : 0;
      await downloadNoResultsXlsx(list, total, `${displayFrom}_${displayTo}`);
    } catch (e) {
      setErrorMsg(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnalyticsShell
      active="searches-no-results"
      breadcrumb={{ prefix: 'Search', title: 'Searches with no results' }}
      toolbarExtras={
        <div style={PS.toolbarRight}>
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
                      max={customEnd}
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
                </div>
                <button type="button" style={PS.applyBtn} onClick={applyCustom}>
                  Apply
                </button>
                <p style={PS.retentionHint}>
                  Default range is the previous calendar month. Start date must fall within the last{' '}
                  {ANALYTICS_DATA_RETENTION_DAYS} days.
                </p>
              </div>
            )}
          </div>
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
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          {errorMsg && (
            <div style={PS.errorBanner} role="alert">
              {errorMsg}
            </div>
          )}
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of search events sent to the server by the portal. Queries flagged as
              suspicious (potential injection) are not tracked and do not appear here. &quot;All languages&quot; shows
              only searches run with that option, not a total across locales.
            </span>
            <button
              type="button"
              style={PS.downloadBtn}
              title="Download as XLSX"
              aria-label="Download as XLSX"
              onClick={() => void handleExport()}
              disabled={exporting || loading}
            >
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <div style={PS.tableWrap}>
              {loading ? (
                <p style={PS.loading}>Loading…</p>
              ) : (
                <table style={PS.table}>
                  <colgroup>
                    <col style={{ width: '100px' }} />
                    <col />
                    <col style={{ minWidth: '200px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={PS.thQ}>Queries</th>
                      <th style={PS.thT}>Terms</th>
                      <th style={PS.thF}>Facets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.term}-${i}-${r.queries}`} style={i % 2 === 0 ? PS.trEven : PS.trOdd}>
                        <td style={PS.tdQ}>{r.queries.toLocaleString('en-US')}</td>
                        <td style={PS.tdT}>{r.term}</td>
                        <td style={PS.tdF}>
                          {r.facets?.length ? (
                            <div style={PS.facetChips}>
                              {r.facets.map((f, j) => (
                                <span key={j} style={PS.facetChip} title={`${f.label}: ${f.value}`}>
                                  <span style={PS.facetLab}>{f.label}</span>
                                  {f.value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={PS.facetEmpty}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loading && rows.length === 0 && !errorMsg && (
                <p style={PS.empty}>No zero-result searches in this range.</p>
              )}
            </div>

            <footer style={PS.pager}>
              <span style={PS.totalLabel}>
                Total queries: <strong>{totalQueries.toLocaleString('en-US')}</strong>
              </span>
              <div style={PS.pagerActions}>
                <span style={PS.rangeLabel}>
                  {totalDistinctRows === 0
                    ? '0 – 0 of 0'
                    : `${rangeStartIdx.toLocaleString('en-US')} – ${rangeEndIdx.toLocaleString('en-US')} of ${totalDistinctRows.toLocaleString('en-US')}`}
                </span>
                <button
                  type="button"
                  style={atStart ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goFirst}
                  disabled={atStart || loading}
                  aria-label="First page"
                  title="First page"
                >
                  <IconFirst />
                </button>
                <button
                  type="button"
                  style={atStart ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goPrev}
                  disabled={atStart || loading}
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <IconPrev />
                </button>
                <button
                  type="button"
                  style={atEnd ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goNext}
                  disabled={atEnd || loading}
                  aria-label="Next page"
                  title="Next page"
                >
                  <IconNext />
                </button>
                <button
                  type="button"
                  style={atEnd ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goLast}
                  disabled={atEnd || loading}
                  aria-label="Last page"
                  title="Last page"
                >
                  <IconLast />
                </button>
              </div>
            </footer>
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Refine search">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Refine search</h3>
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
              <FieldSelect
                label="Content Locale"
                value={locale}
                options={localeOptions}
                onChange={onLocaleChange}
              />
              {!allLangEnabled && (
                <p style={PS.drawerHint}>
                  The &quot;All languages&quot; option is hidden because Search in all languages is disabled in site
                  language settings.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

function FieldSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = options.find((o) => o.value === value) || options[0];

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
    <div style={FS.wrap} ref={ref}>
      <span style={FS.label}>{label}</span>
      <button
        type="button"
        style={FS.control}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={FS.value}>{current.label}</span>
        <span style={FS.chevron} aria-hidden="true">
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <ul role="listbox" style={FS.list}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={`${opt.value}-opt`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    ...FS.option,
                    background: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#0f172a',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
  errorBanner: {
    margin: '0 16px',
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '0.85rem',
  },
  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  toolbarWrap: { position: 'relative' },
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
    fontFamily: 'inherit',
  },
  dateLabels: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 },
  dateLine: { fontSize: '0.7rem', color: '#475569' },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8' },
  pickerPanel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 20,
    width: 'min(320px, 92vw)',
    padding: '14px 16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
  },
  pickerTitle: { margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' },
  presetBtn: {
    padding: '6px 10px',
    fontSize: '0.78rem',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#f8fafc',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  customRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
  customLab: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: '#64748b' },
  dateInput: {
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  },
  applyBtn: {
    width: '100%',
    padding: '8px 12px',
    marginTop: '4px',
    border: 'none',
    borderRadius: '6px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  retentionHint: { margin: '10px 0 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 },
  resultHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '18px 22px 14px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
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
  body: { display: 'flex', flexDirection: 'column', flex: 1, padding: '18px 22px 0' },
  loading: { padding: '24px', color: '#64748b', margin: 0 },
  empty: { padding: '24px', color: '#94a3b8', margin: 0 },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#ffffff',
    overflow: 'auto',
    minHeight: '120px',
    maxHeight: 'calc(100vh - 280px)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
  thQ: {
    textAlign: 'right',
    padding: '10px 14px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  thT: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  thF: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  trEven: { background: '#ffffff' },
  trOdd: { background: '#fafbfd' },
  tdQ: {
    padding: '8px 14px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  tdT: {
    padding: '8px 14px',
    textAlign: 'left',
    wordBreak: 'break-word',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  tdF: {
    padding: '8px 14px',
    textAlign: 'left',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  facetChips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  facetChip: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '999px',
    background: '#f1f5f9',
    fontSize: '0.78rem',
    color: '#334155',
    maxWidth: '100%',
  },
  facetLab: { fontWeight: 600, color: '#64748b', marginRight: '2px' },
  facetEmpty: { color: '#94a3b8', fontSize: '0.85rem' },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 6px 24px',
    flexWrap: 'wrap',
  },
  totalLabel: { fontSize: '0.85rem', color: '#475569' },
  pagerActions: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  rangeLabel: { fontSize: '0.8rem', color: '#475569', marginRight: '8px' },
  pagerBtn: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
  },
  pagerBtnDisabled: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#cbd5e1',
    cursor: 'not-allowed',
    opacity: 0.55,
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
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  drawerHint: { margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45 },
};

const FS = {
  wrap: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.72rem', color: '#475569', fontWeight: 500, paddingLeft: '4px' },
  control: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
  },
  value: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chevron: { display: 'inline-flex', color: '#475569', flexShrink: 0 },
  list: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    listStyle: 'none',
    margin: 0,
    padding: '4px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    maxHeight: '260px',
    overflowY: 'auto',
    zIndex: 10,
  },
  option: {
    display: 'block',
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
  },
};
