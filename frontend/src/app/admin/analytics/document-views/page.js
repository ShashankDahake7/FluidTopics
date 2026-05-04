'use client';

import { useEffect, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api, { getStoredUser } from '@/lib/api';

/* ------------------------------ Icons ------------------------------ */

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
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
const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
const IconSortDesc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const IconSortAsc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
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
const IconBook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconArticle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);
const IconUnstructured = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);
const IconKebab = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);
function defaultDateRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatShortDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function roleMustSpecifyUserId(user) {
  const roles = user?.roles || [];
  const elevated = roles.some((r) => ['admin', 'superadmin', 'ANALYTICS_USER'].includes(r));
  return roles.includes('BEHAVIOR_DATA_USER') && !elevated;
}

function TypeIcon({ contentKind }) {
  if (contentKind === 'UNSTRUCTURED') return <IconUnstructured />;
  if (contentKind === 'ARTICLE') return <IconArticle />;
  return <IconBook />;
}

/* ------------------------------ Page ------------------------------ */

export default function DocumentViewsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { start: defaultStart, end: defaultEnd } = defaultDateRange();
  const [rangeStart, setRangeStart] = useState(defaultStart);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd);
  const [appliedRange, setAppliedRange] = useState({ start: defaultStart, end: defaultEnd });

  const [titleQuery, setTitleQuery] = useState('');
  /** Debounced value sent to the API (title filter). */
  const [debouncedTitle, setDebouncedTitle] = useState('');

  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 50;

  const [data, setData] = useState(null);
  const [totalViews, setTotalViews] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeMenuRow, setActiveMenuRow] = useState(null);
  const [titleFilterFocused, setTitleFilterFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedTitle(titleQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [titleQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const u = getStoredUser();
        const filters = {
          titleQuery: debouncedTitle.trim() || undefined,
        };
        if (roleMustSpecifyUserId(u) && u?._id) {
          filters.userId = String(u._id);
        }
        const payload = {
          startDate: appliedRange.start.toISOString(),
          endDate: appliedRange.end.toISOString(),
          sortOrder: sortDesc ? 'desc' : 'asc',
          paging: { page, perPage },
          filters,
        };
        const json = await api.post('/analytics/v2/documents/views-top', payload);
        if (cancelled) return;
        setData(json.results || []);
        setTotalRows(json.paging?.totalCount || 0);
        setTotalViews(json.totalDisplayCount || 0);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setData([]);
          setTotalRows(0);
          setTotalViews(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedRange, debouncedTitle, sortDesc, page]);

  const exportTableCsv = () => {
    if (!data?.length) return;
    const rows = [
      ['Views', 'Title', 'Type', 'Metadata'].join(','),
      ...data.map((r) => {
        const meta = (r.metadata || []).map((m) => m.display || `${m.label}(${m.key}): ${m.values[0]}`).join('; ');
        return [r.displayCount, `"${(r.title || '').replace(/"/g, '""')}"`, r.contentKind || r.type, `"${meta.replace(/"/g, '""')}"`].join(',');
      }),
    ].join('\n');
    downloadBlob(rows, `document-views-${formatShortDate(appliedRange.start).replace(/\//g, '-')}.csv`, 'text/csv;charset=utf-8');
  };

  const breadcrumb = { prefix: 'Knowledge Hub', title: 'Document views' };

  const toolbarExtras = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <button type="button" style={TS.dateBadge} title="Date range" onClick={() => setCalendarOpen(true)}>
        <span style={TS.dateBadgeText}>
          <span>From: {formatShortDate(appliedRange.start)}</span>
          <span>To: {formatShortDate(appliedRange.end)}</span>
        </span>
        <span style={TS.dateBadgeIcon}>
          <IconCalendar />
        </span>
      </button>
      <button
        type="button"
        style={{ ...TS.iconBtn, color: drawerOpen ? '#1d4ed8' : '#0f172a' }}
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
        title={drawerOpen ? 'Hide filters' : 'Show filters'}
      >
        <IconFilters />
      </button>
    </span>
  );

  return (
    <AnalyticsShell
      active="document-views"
      breadcrumb={breadcrumb}
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>Data is based on the number of times users read a document.</span>
            <button type="button" style={PS.downloadBtn} title="Export table as CSV" aria-label="Export table as CSV" onClick={exportTableCsv}>
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <div style={PS.tableCard}>
              <div style={PS.tableScroll}>
              <table style={PS.table}>
                <colgroup>
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '320px' }} />
                  <col />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <thead>
                  <tr style={PS.tableHeadRow}>
                    <th style={PS.th}>
                      <button
                        type="button"
                        style={PS.sortBtn}
                        onClick={() => {
                          setSortDesc((d) => !d);
                          setPage(1);
                        }}
                      >
                        <span style={PS.headerCell}>
                          Views
                          {sortDesc ? <IconSortDesc /> : <IconSortAsc />}
                        </span>
                      </button>
                    </th>
                    <th style={PS.th}>
                      <span style={PS.headerCell}>Title</span>
                    </th>
                    <th style={PS.th}>
                      <span style={PS.headerCell}>Metadata</span>
                    </th>
                    <th style={PS.th} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} style={PS.emptyCell}>
                        Loading…
                      </td>
                    </tr>
                  ) : !data || data.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={PS.emptyCell}>
                        No documents match the current filters.
                      </td>
                    </tr>
                  ) : (
                    data.map((r, idx) => (
                      <tr key={`${r.id}-${idx}`} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.displayCount)}</td>
                        <td style={PS.td}>
                          <span style={PS.titleCell}>
                            <span style={PS.titleIcon}>
                              <TypeIcon contentKind={r.contentKind} />
                            </span>
                            <span style={PS.titleText}>{r.title}</span>
                          </span>
                        </td>
                        <td style={PS.td}>
                          <span style={PS.metaList}>
                            {(r.metadata || []).map((m) => (
                              <span key={`${m.key}-${m.values[0]}`} style={PS.metaChip}>
                                <span style={PS.metaChipInner}>{m.display || `${m.label}(${m.key}): ${m.values[0]}`}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td style={PS.td}>
                          <RowActions
                            open={activeMenuRow === idx}
                            onToggle={() => setActiveMenuRow((v) => (v === idx ? null : idx))}
                            onClose={() => setActiveMenuRow(null)}
                            readerHref={r.link}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>

              <div style={PS.pager}>
                <span style={PS.totalLabel}>
                  Total views:&nbsp;<strong style={{ color: '#0f172a' }}>{formatNum(totalViews)}</strong>
                </span>
                <span style={PS.pagerLabel}>
                  {totalRows > 0 ? `${(page - 1) * perPage + 1} – ${Math.min(page * perPage, totalRows)}` : '0'} of {formatNum(totalRows)}
                </span>
                <div style={PS.pagerBtns}>
                  <PagerBtn disabled={page === 1} aria-label="First page" onClick={() => setPage(1)}>
                    <IconChevDoubleLeft />
                  </PagerBtn>
                  <PagerBtn disabled={page === 1} aria-label="Previous page" onClick={() => setPage((p) => p - 1)}>
                    <IconChevLeft />
                  </PagerBtn>
                  <PagerBtn disabled={page * perPage >= totalRows} aria-label="Next page" onClick={() => setPage((p) => p + 1)}>
                    <IconChevRight />
                  </PagerBtn>
                  <PagerBtn
                    disabled={page * perPage >= totalRows}
                    aria-label="Last page"
                    onClick={() => setPage(Math.max(1, Math.ceil(totalRows / perPage)))}
                  >
                    <IconChevDoubleRight />
                  </PagerBtn>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside style={{ ...DS.drawer, marginRight: drawerOpen ? 0 : -330, visibility: drawerOpen ? 'visible' : 'hidden' }}>
          <header style={DS.drawerHead}>
            <span style={DS.drawerTitle}>Refine search</span>
            <button type="button" style={DS.drawerClose} aria-label="Close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <section style={DS.drawerBody}>
            <label htmlFor="doc-views-title-filter" style={DS.drawerFieldLabel}>
              Document title
            </label>
            <input
              id="doc-views-title-filter"
              type="search"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              autoComplete="off"
              placeholder="Search by title"
              aria-label="Search by document title"
              style={titleFilterFocused ? DS.titleInputFocus : DS.titleInput}
              onFocus={() => setTitleFilterFocused(true)}
              onBlur={() => setTitleFilterFocused(false)}
            />
          </section>
        </aside>

        {calendarOpen && (
          <DateRangeModal
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChangeStart={setRangeStart}
            onChangeEnd={setRangeEnd}
            onApply={() => {
              setAppliedRange({ start: rangeStart, end: rangeEnd });
              setPage(1);
              setCalendarOpen(false);
            }}
            onClose={() => setCalendarOpen(false)}
          />
        )}

      </div>
    </AnalyticsShell>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}

function downloadBlob(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PagerBtn({ children, disabled, ...rest }) {
  return (
    <button
      type="button"
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

function RowActions({ open, onToggle, onClose, readerHref }) {
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
          <button
            type="button"
            style={PS.menuItem}
            role="menuitem"
            onClick={() => {
              onClose();
              if (readerHref) window.open(readerHref, '_blank', 'noopener,noreferrer');
            }}
          >
            Show document
          </button>
        </div>
      )}
    </span>
  );
}

function DateRangeModal({ rangeStart, rangeEnd, onChangeStart, onChangeEnd, onApply, onClose }) {
  const setPreset = (key) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    if (key === 'week') start.setDate(start.getDate() - 7);
    else if (key === 'month') start.setMonth(start.getMonth() - 1);
    else if (key === 'quarter') start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    onChangeStart(start);
    onChangeEnd(end);
  };

  return (
    <div style={DM.backdrop} onClick={onClose} role="presentation">
      <div style={DM.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Date range">
        <div style={DM.head}>
          <span style={DM.title}>Date range</span>
          <button type="button" style={DM.close} aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div style={DM.presets}>
          <button type="button" style={DM.presetBtn} onClick={() => setPreset('week')}>
            Past week
          </button>
          <button type="button" style={DM.presetBtn} onClick={() => setPreset('month')}>
            Past month
          </button>
          <button type="button" style={DM.presetBtn} onClick={() => setPreset('quarter')}>
            Past 3 months
          </button>
        </div>
        <div style={DM.custom}>
          <label style={DM.lab}>
            Start
            <input
              type="date"
              value={rangeStart.toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!Number.isNaN(d.getTime())) {
                  d.setHours(0, 0, 0, 0);
                  onChangeStart(d);
                }
              }}
              style={DM.dateIn}
            />
          </label>
          <label style={DM.lab}>
            End
            <input
              type="date"
              value={rangeEnd.toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!Number.isNaN(d.getTime())) {
                  d.setHours(23, 59, 59, 999);
                  onChangeEnd(d);
                }
              }}
              style={DM.dateIn}
            />
          </label>
        </div>
        <div style={DM.actions}>
          <button type="button" style={DM.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={DM.primary} onClick={onApply}>
            Apply range
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

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
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dateBadgeText: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem', color: '#475569', textAlign: 'left' },
  dateBadgeIcon: { display: 'inline-flex', color: '#475569' },
};

const PS = {
  layout: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    background: '#ffffff',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  main: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  resultHead: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  downloadBtn: {
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    padding: '12px 22px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  tableCard: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  tableScroll: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarGutter: 'stable',
    scrollbarWidth: 'thin',
  },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  tableHeadRow: { background: '#f8fafc', borderBottom: '1px solid #e5e7eb' },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: '#f8fafc',
    boxShadow: '0 1px 0 #e5e7eb',
  },
  sortBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
  },
  headerCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  tableRow: { borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  td: { padding: '12px 14px', fontSize: '0.85rem', color: '#0f172a' },
  emptyCell: { padding: '24px 14px', textAlign: 'center', color: '#475569' },
  titleCell: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  titleIcon: { color: '#94a3b8', display: 'inline-flex' },
  titleText: { color: '#0f172a' },
  metaList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  metaChip: {
    display: 'inline-block',
    padding: '4px 8px',
    fontSize: '0.74rem',
    background: '#f1f5f9',
    borderRadius: '999px',
    color: '#0f172a',
    maxWidth: '100%',
  },
  metaChipInner: { fontWeight: 500 },

  kebabBtn: {
    width: '30px',
    height: '30px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '32px',
    minWidth: '180px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)',
    overflow: 'hidden',
    zIndex: 30,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#0f172a',
    fontSize: '0.82rem',
    textAlign: 'left',
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '18px',
    padding: '10px 14px',
    borderTop: '1px solid #f1f5f9',
    background: '#ffffff',
  },
  totalLabel: { marginRight: 'auto', fontSize: '0.85rem', color: '#475569' },
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

const DS = {
  drawer: {
    width: '330px',
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: 0,
    borderLeft: '1px solid #e5e7eb',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-right 200ms ease, visibility 200ms',
  },
  drawerHead: {
    flexShrink: 0,
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
  drawerBody: { padding: '14px 18px 14px', overflowY: 'auto', flex: 1, minHeight: 0 },
  drawerFieldLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '8px',
  },
  titleInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#0f172a',
    background: '#ffffff',
    fontFamily: 'inherit',
    outline: 'none',
  },
  titleInputFocus: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #1d4ed8',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#0f172a',
    background: '#ffffff',
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: '0 0 0 1px rgba(29, 78, 216, 0.2)',
  },
};

const DM = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.35)',
    zIndex: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
    maxWidth: 400,
    width: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: { fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' },
  close: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 4,
    color: '#64748b',
  },
  presets: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' },
  presetBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
  },
  custom: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' },
  lab: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#475569', fontWeight: 600 },
  dateIn: { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #f1f5f9' },
  secondary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
