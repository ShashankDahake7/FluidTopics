'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: 'date', label: 'Session start (UTC)' },
  { key: 'duration', label: 'Active duration' },
  { key: 'userId', label: 'User ID' },
  { key: 'uniqueQueries', label: 'Unique search queries' },
  { key: 'uniqueQueriesNoResults', label: 'Unique search queries with no results' },
  { key: 'docSearches', label: 'Searches in doc' },
  { key: 'docSearchesNoResults', label: 'Searches in doc with no results' },
  { key: 'documentViews', label: 'Document views' },
  { key: 'topicViews', label: 'Topic views' },
];

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
];

const AUTH_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'authenticated', label: 'Authenticated' },
  { value: 'unauthenticated', label: 'Unauthenticated' },
];

function defaultDateRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
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

function formatSessionStartUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(ms) {
  if (ms == null || ms <= 0) return '< 1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) {
    const parts = [`${h}h`];
    if (min > 0) parts.push(`${min}min`);
    if (sec > 0) parts.push(`${sec}s`);
    return parts.join(' ');
  }
  if (sec > 0) return `${min}min ${sec}s`;
  return `${min}min`;
}

function downloadCsv(rows) {
  if (!rows?.length) return;
  const headers = [
    'Session start (UTC)',
    'Active duration (ms)',
    'User ID',
    'Unique search queries',
    'Unique search queries with no results',
    'Searches in doc',
    'Searches in doc with no results',
    'Document views',
    'Topic views',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        JSON.stringify(r.sessionStartFormatted),
        r.durationMs,
        JSON.stringify(r.userIdDisplay),
        r.uniqueQueries,
        r.uniqueQueriesNoResults,
        r.docSearches,
        r.docSearchesNoResults,
        r.documentViews,
        r.topicViews,
      ].join(',')
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'session-list.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

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

const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
    <circle cx="12" cy="17" r="0.8" fill="#1d4ed8" stroke="none" />
  </svg>
);

const IconSortAsc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 15 12 9 18 15" />
  </svg>
);

const IconSortDesc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconSortNone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" opacity="0.55">
    <polyline points="8 9 12 5 16 9" />
    <polyline points="8 15 12 19 16 15" />
  </svg>
);

const IconCaret = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function SessionListPage() {
  const def = useMemo(() => defaultDateRange(), []);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(def.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(def.end));

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showInfo, setShowInfo] = useState(false);
  const [language, setLanguage] = useState('all');
  const [authStatus, setAuthStatus] = useState('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [debouncedUserFilter, setDebouncedUserFilter] = useState('');
  const lastDebouncedUserTrimmed = useRef(undefined);
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = userIdFilter.trim();
      if (lastDebouncedUserTrimmed.current === undefined) {
        lastDebouncedUserTrimmed.current = next;
        setDebouncedUserFilter(next);
        return;
      }
      if (next !== lastDebouncedUserTrimmed.current) {
        lastDebouncedUserTrimmed.current = next;
        setDebouncedUserFilter(next);
        setPage(0);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [userIdFilter]);

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
      const json = await api.post('/analytics/v2/traffic/session-list', {
        startDate: startIso,
        endDate: endIso,
        page: page + 1,
        perPage: PAGE_SIZE,
        sortBy: sortKey,
        sortDir,
        authStatus,
        interfaceLanguage: language,
        userIdContains: debouncedUserFilter,
      });
      if (json?.results) {
        const mapped = json.results.map((r) => ({
          ...r,
          sessionStartFormatted: formatSessionStartUtc(r.sessionStart),
          durationLabel: formatDuration(r.durationMs),
          userIdDisplay: r.userId || 'Unauthenticated',
        }));
        setRows(mapped);
        setTotal(typeof json.total === 'number' ? json.total : 0);
      } else if (json?.error) {
        setErrorMsg(json.error);
        setRows([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    startIso,
    endIso,
    page,
    sortKey,
    sortDir,
    authStatus,
    language,
    debouncedUserFilter,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch analytics when query inputs change
    void fetchData();
  }, [fetchData]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'desc');
    }
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo = total === 0 ? 0 : Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <AnalyticsShell
      active="session-list"
      breadcrumb={{ prefix: 'Traffic', title: 'Session list' }}
      breadcrumbTrailing={
        <SessionInfoPopover open={showInfo} onToggle={() => setShowInfo((v) => !v)} onClose={() => setShowInfo(false)} />
      }
      toolbarExtras={
        <>
          <div style={PS.dateIndicator} title="Date range (local)" aria-label="Date range">
            <span style={PS.dateLabels}>
              <label style={PS.dateLine}>
                From:{' '}
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => {
                    setRangeStart(e.target.value);
                    setPage(0);
                  }}
                  style={PS.dateInput}
                  aria-label="From date"
                />
              </label>
              <label style={PS.dateLine}>
                To:{' '}
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => {
                    setRangeEnd(e.target.value);
                    setPage(0);
                  }}
                  style={PS.dateInput}
                  aria-label="To date"
                />
              </label>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true">
              <IconCalendar />
            </span>
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
        </>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Key metrics on user sessions, session journeys, and user interactions on the portal.
            </span>
            <div style={PS.headControls}>
              <button
                type="button"
                style={{ ...PS.iconBtn, color: '#1d4ed8' }}
                title="Download current page as CSV"
                aria-label="Download current page as CSV"
                onClick={() => downloadCsv(rows)}
                disabled={!rows.length}
              >
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
              <div style={PS.loading}>Loading sessions…</div>
            ) : errorMsg ? (
              <div style={PS.error}>Error: {errorMsg}</div>
            ) : (
              <div style={PS.tableCard}>
                <div style={PS.tableScroll}>
                  <table style={PS.table} role="table" aria-label="Session list">
                    <thead>
                      <tr style={PS.headerRow}>
                        {COLUMNS.map((col) => {
                          const isActive = sortKey === col.key;
                          return (
                            <th
                              key={col.key}
                              style={PS.th}
                              scope="col"
                              aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                              <span style={PS.thInner}>
                                <span style={PS.thLabel}>{col.label}</span>
                                <button
                                  type="button"
                                  style={{
                                    ...PS.sortBtn,
                                    color: isActive ? '#1d4ed8' : '#64748b',
                                  }}
                                  onClick={() => handleSort(col.key)}
                                  aria-label={
                                    isActive
                                      ? `Sort ${col.label} in ${sortDir === 'asc' ? 'descending' : 'ascending'} order`
                                      : `Sort ${col.label}`
                                  }
                                  title={
                                    isActive
                                      ? `Sort in ${sortDir === 'asc' ? 'descending' : 'ascending'} order`
                                      : 'Sort'
                                  }
                                >
                                  {!isActive ? <IconSortNone /> : sortDir === 'asc' ? <IconSortAsc /> : <IconSortDesc />}
                                </button>
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={`${row.sessionKey}-${i}`}
                          style={PS.row}
                          tabIndex={0}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <td style={{ ...PS.td, whiteSpace: 'nowrap' }}>{row.sessionStartFormatted}</td>
                          <td style={PS.td}>{row.durationLabel}</td>
                          <td style={{ ...PS.td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.78rem' }}>
                            {row.userIdDisplay}
                          </td>
                          <td style={PS.td}>{row.uniqueQueries}</td>
                          <td style={PS.td}>{row.uniqueQueriesNoResults}</td>
                          <td style={PS.td}>{row.docSearches}</td>
                          <td style={PS.td}>{row.docSearchesNoResults}</td>
                          <td style={PS.td}>{row.documentViews}</td>
                          <td style={PS.td}>{row.topicViews}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!loading && !rows.length && !errorMsg && (
                  <div style={PS.emptyBanner}>No sessions in this date range with the current filters.</div>
                )}

                <div style={PS.pager}>
                  <div style={PS.pagerRange} aria-live="polite">
                    {total === 0 ? '0' : `${rangeFrom} – ${rangeTo}`} of {total.toLocaleString('en-US')}
                  </div>
                  <div style={PS.pagerActions}>
                    <PagerBtn label="First page" disabled={page === 0} onClick={() => setPage(0)}>
                      <PagerArrowFirst />
                    </PagerBtn>
                    <PagerBtn label="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      <PagerArrowPrev />
                    </PagerBtn>
                    <PagerBtn
                      label="Next page"
                      disabled={page >= totalPages - 1 || total === 0}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      <PagerArrowNext />
                    </PagerBtn>
                    <PagerBtn
                      label="Last page"
                      disabled={page >= totalPages - 1 || total === 0}
                      onClick={() => setPage(totalPages - 1)}
                    >
                      <PagerArrowLast />
                    </PagerBtn>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter sessions">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter sessions</h3>
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
              <p style={PS.drawerHint}>
                Interface language filters events that recorded <code style={PS.code}>filters.lang</code> / locale on analytics payloads; leave All if clients do not send it.
              </p>
              <FieldSelect
                label="Interface language"
                value={language}
                onChange={(v) => {
                  setLanguage(v);
                  setPage(0);
                }}
                options={LANGUAGE_OPTIONS}
              />
              <FieldSelect
                label="Authentication status"
                value={authStatus}
                onChange={(v) => {
                  setAuthStatus(v);
                  setPage(0);
                }}
                options={AUTH_OPTIONS}
              />
              <FieldText label="User ID" value={userIdFilter} onChange={setUserIdFilter} />
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Popover ------------------------------ */

function SessionInfoPopover({ open, onToggle, onClose }) {
  const ref = useRef(null);
  return (
    <span style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        title="What is a session?"
        aria-label="What is a session?"
        aria-expanded={open}
        style={PS.infoBtn}
      >
        <IconHelp />
      </button>
      {open && (
        <>
          <span onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <div role="tooltip" style={PS.popover}>
            A row is one “visit” session: we use a 30-minute inactivity timeout. That applies even when a browser session id is present, so a long gap starts a new row (avoiding multi-day “durations” from the same tab id).
            If no session id was stored, we group by user (or IP if anonymous) with the same rule.
            Active duration is from first to last event in that row, within the selected date range.
            Metrics cover only activity in that range.
            <br />
            <br />
            Session journey drill-down may be added later.
          </div>
        </>
      )}
    </span>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div style={FS.field}>
      <label style={FS.label}>{label}</label>
      <button
        type="button"
        style={FS.selectBtn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <IconCaret open={open} />
      </button>
      {open && (
        <>
          <span onClick={() => setOpen(false)} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <ul role="listbox" style={FS.menu}>
            {options.map((opt) => {
              const isSel = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      ...FS.option,
                      background: isSel ? '#eff6ff' : 'transparent',
                      color: isSel ? '#1d4ed8' : '#1f2937',
                      fontWeight: isSel ? 600 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FieldText({ label, value, onChange }) {
  return (
    <div style={FS.field}>
      <label style={FS.label}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={FS.input}
        aria-label={label}
        placeholder="Substring match"
      />
    </div>
  );
}

function PagerBtn({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        ...PS.pagerBtn,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const PagerArrowFirst = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" />
  </svg>
);
const PagerArrowPrev = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
  </svg>
);
const PagerArrowNext = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);
const PagerArrowLast = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z" />
  </svg>
);

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
  infoBtn: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
  },
  popover: {
    position: 'absolute',
    top: '34px',
    left: '-12px',
    zIndex: 20,
    width: '320px',
    padding: '12px 14px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: '#0f172a',
    fontWeight: 400,
    whiteSpace: 'normal',
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
  dateLabels: { display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.15 },
  dateLine: { fontSize: '0.72rem', color: '#475569', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' },
  dateInput: {
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '0.72rem',
    fontFamily: 'inherit',
    color: '#0f172a',
  },
  dateCalendar: { display: 'inline-flex', color: '#1d4ed8', flexShrink: 0 },

  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b' },
  error: { padding: '40px', color: '#dc2626' },
  tableCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  headerRow: {
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontWeight: 600,
    color: '#0f172a',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e5e7eb',
  },
  thInner: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  thLabel: { fontWeight: 600 },
  sortBtn: {
    width: '22px',
    height: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: 0,
  },
  row: {
    background: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  },
  td: {
    padding: '9px 14px',
    color: '#1f2937',
    fontSize: '0.78rem',
    verticalAlign: 'middle',
  },
  emptyBanner: {
    padding: '16px 18px',
    fontSize: '0.85rem',
    color: '#64748b',
    borderTop: '1px solid #f1f5f9',
  },

  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '10px 18px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  pagerRange: {
    fontSize: '0.78rem',
    color: '#475569',
  },
  pagerActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  pagerBtn: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
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
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  drawerHint: {
    fontSize: '0.72rem',
    color: '#64748b',
    lineHeight: 1.45,
    margin: 0,
  },
  code: {
    fontSize: '0.68rem',
    background: '#f1f5f9',
    padding: '1px 5px',
    borderRadius: '4px',
  },
};

const FS = {
  field: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: {
    fontSize: '0.72rem',
    color: '#475569',
    fontWeight: 500,
    paddingLeft: '2px',
  },
  selectBtn: {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '9px 12px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    margin: 0,
    padding: '4px 0',
    listStyle: 'none',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    zIndex: 20,
    maxHeight: '240px',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    fontSize: '0.84rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
};
