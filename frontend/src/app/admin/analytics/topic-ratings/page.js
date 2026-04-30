'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Static data ------------------------------ */



/* All 18 rows mirror the Angular blueprint exactly. Each row has the
 * average star rating, the number of ratings collected, the topic + document
 * titles, and a list of metadata key/value chips that's rendered in the
 * Metadata column. */
const TYPE_BOOK = 'BOOK_PLAIN';
const TYPE_UNSTRUCTURED = 'UNSTRUCTURED_DOC';

const RATING_TYPE_OPTIONS = [
  { value: 'Stars', label: 'Stars' },
  { value: 'Like', label: 'Like' },
  { value: 'Dichotomous', label: 'Dichotomous' },
];

const SORT_ORDER_OPTIONS = [
  { value: 'bestFirst', label: 'Best rated' },
  { value: 'worstFirst', label: 'Worst rated' },
];

const COLOR = {
  books: '#9D207B',
  unstructured: '#CFB017',
  articles: '#361FAD',
  topics: '#45A191',
  attachments: '#BD0F49',
};

const DOC_GROUP = [
  { key: 'books',         label: 'Books',                  color: COLOR.books },
  { key: 'unstructured',  label: 'Unstructured documents', color: COLOR.unstructured },
  { key: 'articles',      label: 'Articles',               color: COLOR.articles },
];
const OTHER_GROUP = [
  { key: 'topics',       label: 'Topics (books only)', color: COLOR.topics },
  { key: 'attachments',  label: 'Attachments',         color: COLOR.attachments },
];

const Tick = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function Checkbox({ checked, indeterminate, onChange, label, color, bold = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative', userSelect: 'none', cursor: 'pointer' }}>
      <span
        style={{
          width: '16px', height: '16px', borderRadius: '3px',
          border: '1.5px solid #94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: checked || indeterminate ? '#1d4ed8' : '#ffffff',
          borderColor: checked || indeterminate ? '#1d4ed8' : '#94a3b8',
        }}
        aria-hidden="true"
      >
        {checked && <Tick size={12} />}
        {indeterminate && <span style={{ width: '8px', height: '2px', background: '#ffffff', borderRadius: '1px' }} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', inset: 0, width: '16px', height: '16px', opacity: 0, margin: 0, cursor: 'pointer' }}
      />
      {color && <span style={{ width: '9px', height: '9px', borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: color }} aria-hidden="true" />}
      <span style={{ fontSize: '0.86rem', fontWeight: bold ? 600 : 500, color: '#0f172a' }}>{label}</span>
    </label>
  );
}

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

const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.6l3.09 6.26 6.91 1L17 14.74l1.18 6.88L12 18.38 5.82 21.62 7 14.74 2 9.86l6.91-1z" />
  </svg>
);

const IconBook = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const IconUnstructured = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconKebab = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
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

export default function TopicRatingsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [ratingType, setRatingType] = useState('Stars');
  const [topicQuery, setTopicQuery] = useState('');
  const [docQuery, setDocQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('bestFirst');
  
  const [pending, setPending] = useState({ books: true, unstructured: true, articles: true, topics: false, attachments: false });
  const [applied, setApplied] = useState({ books: true, unstructured: true, articles: true, topics: false, attachments: false });

  const [appliedTopicQuery, setAppliedTopicQuery] = useState('');
  const [appliedDocQuery, setAppliedDocQuery] = useState('');
  const [activeMenuRow, setActiveMenuRow] = useState(null);

  const allDoc = ['books', 'unstructured', 'articles'];
  const allOther = ['topics', 'attachments'];

  const isGroupChecked = (keys) => keys.every((k) => pending[k]);
  const isGroupIndeterm = (keys) => keys.some((k) => pending[k]) && !isGroupChecked(keys);
  const allChecked = [...allDoc, ...allOther].every((k) => pending[k]);
  const allIndeterm = [...allDoc, ...allOther].some((k) => pending[k]) && !allChecked;

  const setOne = (k, v) => setPending(s => ({ ...s, [k]: v }));
  const setGroup = (keys, v) => setPending((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, v])) }));

  const [data, setData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const typeFilters = [];
      if (applied.books) typeFilters.push('books');
      if (applied.unstructured) typeFilters.push('unstructuredDocuments');
      if (applied.articles) typeFilters.push('articles');
      if (applied.topics) typeFilters.push('topics');
      if (applied.attachments) typeFilters.push('attachments');

      const payload = {
        startDate: '2024-01-01',
        endDate: '2026-12-31',
        paging: { page, perPage },
        ratingType,
        sortOrder,
        filters: {
          type: typeFilters,
          titleContains: appliedTopicQuery.trim(),
          document: {
            titleContains: appliedDocQuery.trim()
          }
        }
      };

      const res = await fetch('/api/analytics/v1/topics/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.results) {
        setData(json.results);
        setTotalRows(json.paging?.totalCount || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, applied, ratingType, sortOrder]);

  const handleApply = () => {
    setApplied({ ...pending });
    setAppliedTopicQuery(topicQuery);
    setAppliedDocQuery(docQuery);
    setPage(1);
  };

  const tableMenuRef = useRef(null);
  useEffect(() => {
    if (activeMenuRow === null) return;
    const onDoc = (e) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target)) {
        setActiveMenuRow(null);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setActiveMenuRow(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeMenuRow]);

  const rangeStart = totalRows === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, totalRows);

  return (
    <AnalyticsShell
      active="topic-ratings"
      breadcrumb={{ prefix: 'Knowledge Hub', title: 'Topic ratings' }}
      feedbackSubject="Feedback about topic rating"
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <div style={PS.dateIndicator} title="Date range" aria-label="Date range">
            <span style={PS.dateLabels}>
              <span style={PS.dateLine}>From: 3/1/2026</span>
              <span style={PS.dateLine}>To: 3/31/2026</span>
            </span>
            <span style={PS.dateCalendar} aria-hidden="true"><IconCalendar /></span>
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
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the information about the most rated topics in a selected period.
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
            <div style={PS.tableWrap} ref={tableMenuRef}>
              <table style={PS.table}>
                <colgroup>
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '20%' }} />
                  <col />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={PS.thStars}>
                      <button
                        type="button"
                        style={PS.sortHeader}
                        onClick={() => setSortOrder((o) => (o === 'bestFirst' ? 'worstFirst' : 'bestFirst'))}
                        aria-label="Sort by stars"
                      >
                        <span>Stars (</span>
                        <span style={PS.starGlyph} aria-hidden="true"><IconStar /></span>
                        <span>)</span>
                        <span style={PS.sortGlyph}>{sortOrder === 'worstFirst' ? '↑' : '↓'}</span>
                      </button>
                    </th>
                    <th style={PS.thNum}>Ratings</th>
                    <th style={PS.thLeft}>Topic Title</th>
                    <th style={PS.thLeft}>Document Title</th>
                    <th style={PS.thLeft}>Metadata</th>
                    <th style={PS.thAction} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={PS.emptyCell}>Loading ratings...</td></tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={PS.emptyCell}>
                        No matching topic ratings found during the selected period.
                      </td>
                    </tr>
                  ) : (
                    data.map((r, i) => (
                      <tr key={r.id || i} style={i % 2 === 0 ? PS.trEven : PS.trOdd}>
                        <td style={PS.tdStars}>
                          <span style={PS.starsValue}>{r.rating.average.toFixed(1)}</span>
                          <span style={PS.starsSuffix}>/5</span>
                        </td>
                        <td style={PS.tdNum}>{r.rating.totalCount}</td>
                        <td style={PS.tdTopic}>
                           <span style={PS.titleCell}>
                             <span style={{ color: '#94a3b8', display: 'inline-flex' }}>
                               {r.document?.type === 'UNSTRUCTURED_DOCUMENT' ? <IconUnstructured /> : <IconBook />}
                             </span>
                             <span>{r.title}</span>
                           </span>
                        </td>
                        <td style={PS.tdDoc}>
                          <span>{r.document?.title}</span>
                        </td>
                        <td style={PS.tdMeta}>
                          <div style={PS.chipStack}>
                            {r.document?.metadata?.map((m, idx) => (
                              <span key={idx} style={PS.chip} title={`${m.key}: ${m.values[0]}`}>
                                <span style={PS.chipKey}>{m.key}:&nbsp;</span>
                                <span style={PS.chipValue}>{m.values[0]}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={PS.tdAction}>
                          <div style={PS.menuWrap}>
                            <button
                              type="button"
                              style={PS.kebabBtn}
                              onClick={() => setActiveMenuRow((cur) => (cur === i ? null : i))}
                              aria-haspopup="menu"
                              aria-expanded={activeMenuRow === i}
                              aria-label="Row actions"
                              title="Row actions"
                            >
                              <IconKebab />
                            </button>
                            {activeMenuRow === i && (
                              <div
                                role="menu"
                                style={{
                                  ...PS.menuPanel,
                                  ...(i >= data.length - 2 ? PS.menuPanelUp : PS.menuPanelDown),
                                }}
                              >
                                <button type="button" role="menuitem" style={PS.menuItem} onClick={() => setActiveMenuRow(null)}>
                                  Show topic
                                </button>
                                <button type="button" role="menuitem" style={PS.menuItem} onClick={() => setActiveMenuRow(null)}>
                                  Show document
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <footer style={PS.pager}>
              <span />
              <div style={PS.pagerActions}>
                <span style={PS.rangeLabel}>
                  {rangeStart} – {rangeEnd} of {totalRows}
                </span>
                <button type="button" style={page === 1 ? PS.pagerBtnDisabled : PS.pagerBtn} onClick={() => setPage(1)} disabled={page === 1} aria-label="First page" title="First page">
                  <IconFirst />
                </button>
                <button type="button" style={page === 1 ? PS.pagerBtnDisabled : PS.pagerBtn} onClick={() => setPage(p => p - 1)} disabled={page === 1} aria-label="Previous page" title="Previous page">
                  <IconPrev />
                </button>
                <button type="button" style={rangeEnd >= totalRows ? PS.pagerBtnDisabled : PS.pagerBtn} onClick={() => setPage(p => p + 1)} disabled={rangeEnd >= totalRows} aria-label="Next page" title="Next page">
                  <IconNext />
                </button>
                <button type="button" style={rangeEnd >= totalRows ? PS.pagerBtnDisabled : PS.pagerBtn} onClick={() => setPage(Math.ceil(totalRows / perPage))} disabled={rangeEnd >= totalRows} aria-label="Last page" title="Last page">
                  <IconLast />
                </button>
              </div>
            </footer>
          </section>
        </main>

          <aside style={{ ...PS.drawer, marginRight: drawerOpen ? 0 : -330, visibility: drawerOpen ? 'visible' : 'hidden' }} aria-label="Refine search">
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
 
            <form
              style={PS.drawerBody}
              onSubmit={(e) => { e.preventDefault(); handleApply(); }}
              noValidate
            >
              <div style={PS.selectAll}>
                <Checkbox
                  label="All types"
                  bold
                  checked={allChecked}
                  indeterminate={allIndeterm}
                  onChange={(v) => { setOne('books', v); setOne('unstructured', v); setOne('articles', v); setOne('topics', v); setOne('attachments', v); }}
                />
              </div>

              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 16px 0' }}>
                <legend className="sr-only">Document types</legend>
                <div style={PS.group}>
                  <Checkbox
                    label="All documents"
                    bold
                    checked={isGroupChecked(allDoc)}
                    indeterminate={isGroupIndeterm(allDoc)}
                    onChange={(v) => setGroup(allDoc, v)}
                  />
                  <ul style={PS.list}>
                    {DOC_GROUP.map((s) => (
                      <li key={s.key} style={PS.listItem}>
                        <Checkbox
                          label={s.label}
                          color={s.color}
                          checked={pending[s.key]}
                          onChange={(v) => setOne(s.key, v)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </fieldset>

              <FieldSelect
                label="Rating type"
                value={ratingType}
                options={RATING_TYPE_OPTIONS}
                onChange={setRatingType}
              />

              <FieldSelect
                label="Sort order"
                value={sortOrder}
                options={SORT_ORDER_OPTIONS}
                onChange={setSortOrder}
              />

              <FieldInput
                label="Search by topic title"
                value={topicQuery}
                onChange={setTopicQuery}
              />

              <FieldInput
                label="Search by document title"
                value={docQuery}
                onChange={setDocQuery}
              />

              <fieldset style={PS.metaFieldset}>
                <legend style={PS.metaLegend}>Metadata</legend>
                <p style={PS.metaEmpty}>
                  Select a metadata value in the result tags to add a filter.
                </p>
              </fieldset>

              <div style={PS.drawerSpace} />
              <div style={PS.drawerFooter}>
                <button type="submit" style={PS.applyBtn}>Apply</button>
              </div>
            </form>
          </aside>
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Form fields ------------------------------ */

function FieldInput({ label, value, onChange }) {
  return (
    <label style={FI.wrap}>
      <span style={FI.label}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={FI.input}
      />
    </label>
  );
}

function FieldSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
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
        <span style={FS.chevron} aria-hidden="true"><IconChevronDown /></span>
      </button>
      {open && (
        <ul role="listbox" style={FS.list}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
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
    transition: 'margin-right 200ms ease, visibility 200ms',
    overflow: 'hidden',
  },
  drawer: {
    width: '330px',
    flexShrink: 0,
    borderLeft: '1px solid #e5e7eb',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-right 200ms ease, visibility 200ms',
  },
  selectAll: { paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '12px' },
  group: { marginBottom: '14px' },
  list: { listStyle: 'none', padding: '4px 0 0 22px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  listItem: { padding: '4px 0' },

  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
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

  body: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '18px 22px 0',
  },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#ffffff',
    overflow: 'visible',
    position: 'relative',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
  },

  thStars: {
    textAlign: 'left',
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
  },
  thNum: {
    textAlign: 'left',
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
  },
  thLeft: {
    textAlign: 'left',
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
  },
  thAction: {
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    width: '60px',
  },
  sortHeader: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  starGlyph: { display: 'inline-flex', alignItems: 'center', color: '#f59e0b' },
  sortGlyph: { marginLeft: '4px', color: '#1d4ed8', fontWeight: 700 },

  trEven: { background: '#ffffff' },
  trOdd: { background: '#fafbfd' },

  emptyCell: {
    padding: '40px 18px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.9rem',
    background: '#ffffff',
  },

  tdStars: {
    padding: '10px 18px',
    color: '#0f172a',
    fontWeight: 500,
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    fontVariantNumeric: 'tabular-nums',
  },
  starsValue: { color: '#0f172a', fontWeight: 600 },
  starsSuffix: { color: '#64748b', fontWeight: 500, marginLeft: '2px' },

  tdNum: {
    padding: '10px 18px',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    fontVariantNumeric: 'tabular-nums',
  },
  tdTopic: {
    padding: '10px 18px',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    wordBreak: 'break-word',
  },
  tdDoc: {
    padding: '10px 18px',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    wordBreak: 'break-word',
  },
  docIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#475569',
    opacity: 0.6,
    marginRight: '8px',
    verticalAlign: 'middle',
  },
  tdMeta: {
    padding: '10px 18px',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  tdAction: {
    padding: '6px 8px',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    textAlign: 'center',
    overflow: 'visible',
  },

  chipStack: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '4px' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '999px',
    fontSize: '0.74rem',
    color: '#1e293b',
    maxWidth: '100%',
  },
  chipKey: { color: '#475569', fontWeight: 500 },
  chipValue: { color: '#0f172a', fontWeight: 600 },

  menuWrap: { position: 'relative', display: 'inline-flex' },
  kebabBtn: {
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
  menuPanel: {
    position: 'absolute',
    right: 0,
    minWidth: '160px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    padding: '4px',
    zIndex: 20,
  },
  menuPanelDown: { top: 'calc(100% + 4px)' },
  menuPanelUp: { bottom: 'calc(100% + 4px)' },
  menuItem: {
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
    color: '#0f172a',
  },

  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 6px 24px',
    flexWrap: 'wrap',
  },
  pagerActions: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  rangeLabel: { fontSize: '0.8rem', color: '#475569', marginRight: '8px' },
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
    width: '330px',
    flexShrink: 0,
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
  drawerSpace: { flex: 1 },
  drawerFooter: {
    display: 'flex',
    justifyContent: 'flex-start',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  applyBtn: {
    width: '100%',
    padding: '10px 14px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  metaFieldset: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: 0,
    padding: 0,
    border: 'none',
  },
  metaLegend: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
    padding: 0,
    marginBottom: '4px',
  },
  metaEmpty: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#64748b',
    lineHeight: 1.4,
  },
};

const FI = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.72rem', color: '#475569', fontWeight: 500, paddingLeft: '4px' },
  input: {
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#0f172a',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
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
  chevron: { display: 'inline-flex', color: '#475569' },
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
