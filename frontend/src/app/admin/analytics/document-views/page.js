'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Data ------------------------------ */

const TYPE_BOOK = 'BOOK_PLAIN';
const TYPE_UNSTRUCTURED = 'UNSTRUCTURED_DOC';



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

/* ------------------------------ Page ------------------------------ */

export default function DocumentViewsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [heatmapDoc, setHeatmapDoc] = useState(null);
  const [titleQuery, setTitleQuery] = useState('');
  const [userId, setUserId] = useState('');
  
  const [pending, setPending] = useState({ books: true, unstructured: true, articles: true, topics: false, attachments: false });
  const [applied, setApplied] = useState({ books: true, unstructured: true, articles: true, topics: false, attachments: false });

  const [appliedTitleQuery, setAppliedTitleQuery] = useState('');
  const [activeMenuRow, setActiveMenuRow] = useState(null);

  const allDoc = ['books', 'unstructured', 'articles'];
  const allOther = ['topics', 'attachments'];

  const isGroupChecked = (keys) => keys.every((k) => pending[k]);
  const isGroupIndeterm = (keys) => keys.some((k) => pending[k]) && !isGroupChecked(keys);
  const allChecked = [...allDoc, ...allOther].every((k) => pending[k]);
  const allIndeterm = [...allDoc, ...allOther].some((k) => pending[k]) && !allChecked;

  const setOne = (k, v) => setPending(s => ({ ...s, [k]: v }));
  const setGroup = (keys, v) => setPending((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, v])) }));
  
  const handleApply = () => {
    setApplied({ ...pending });
    setAppliedTitleQuery(titleQuery);
  };

  const [data, setData] = useState(null);
  const [totalViews, setTotalViews] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 50;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
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
           filters: {
             type: typeFilters
           }
        };
        if (userId.trim()) payload.filters.userId = userId.trim();

        const res = await fetch('/api/analytics/v2/documents/views-top', {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (active && json.results) {
           setData(json.results);
           setTotalRows(json.paging?.totalCount || 0);
           setTotalViews(json.totalDisplayCount || 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [page, applied, userId]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = appliedTitleQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => r.title.toLowerCase().includes(q));
  }, [data, appliedTitleQuery]);

  const breadcrumb = { prefix: 'Knowledge Hub', title: 'Document views' };

  const toolbarExtras = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span style={TS.dateBadge} title="Date range">
        <span style={TS.dateBadgeText}>
          <span>From: 3/1/2026</span>
          <span>To: 3/31/2026</span>
        </span>
        <span style={TS.dateBadgeIcon}><IconCalendar /></span>
      </span>
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
      feedbackSubject="Feedback about document views"
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times users read a document.
            </span>
            <button type="button" style={PS.downloadBtn} title="Download as XLSX" aria-label="Download as XLSX">
              <IconDownload />
            </button>
          </header>

          <section style={PS.body}>
            <div style={PS.tableCard}>
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
                      <span style={PS.headerCell}>
                        <span>Views</span>
                        <IconSortDesc />
                      </span>
                    </th>
                    <th style={PS.th}><span style={PS.headerCell}>Title</span></th>
                    <th style={PS.th}><span style={PS.headerCell}>Metadata</span></th>
                    <th style={PS.th} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} style={PS.emptyCell}>Loading...</td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={PS.emptyCell}>No documents match the current filters.</td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => (
                      <tr key={`${r.id || r.title}-${idx}`} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.displayCount)}</td>
                        <td style={PS.td}>
                          <span style={PS.titleCell}>
                            <span style={PS.titleIcon}>
                              {r.type === TYPE_UNSTRUCTURED ? <IconUnstructured /> : <IconBook />}
                            </span>
                            <span style={PS.titleText}>{r.title}</span>
                          </span>
                        </td>
                        <td style={PS.td}>
                          <span style={PS.metaList}>
                            {r.metadata && r.metadata.map((m) => (
                              <span key={m.key} style={PS.metaChip}>
                                <span style={PS.metaKey}>{m.key}:&nbsp;</span>
                                <span style={PS.metaVal}>{m.values[0]}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td style={PS.td}>
                          <RowActions
                            open={activeMenuRow === idx}
                            onToggle={() => setActiveMenuRow((v) => (v === idx ? null : idx))}
                            onClose={() => setActiveMenuRow(null)}
                            onViewHeatmap={() => {
                              setActiveMenuRow(null);
                              setHeatmapDoc(r);
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={PS.pager}>
                <span style={PS.totalLabel}>
                  Total views:&nbsp;<strong style={{ color: '#0f172a' }}>{formatNum(totalViews)}</strong>
                </span>
                <span style={PS.pagerLabel}>
                  {totalRows > 0 ? `${(page - 1) * perPage + 1} – ${Math.min(page * perPage, totalRows)}` : '0'} of {formatNum(totalRows)}
                </span>
                <div style={PS.pagerBtns}>
                  <PagerBtn disabled={page === 1} aria-label="First page" onClick={() => setPage(1)}><IconChevDoubleLeft /></PagerBtn>
                  <PagerBtn disabled={page === 1} aria-label="Previous page" onClick={() => setPage(p => p - 1)}><IconChevLeft /></PagerBtn>
                  <PagerBtn disabled={page * perPage >= totalRows} aria-label="Next page" onClick={() => setPage(p => p + 1)}><IconChevRight /></PagerBtn>
                  <PagerBtn disabled={page * perPage >= totalRows} aria-label="Last page" onClick={() => setPage(Math.ceil(totalRows / perPage))}><IconChevDoubleRight /></PagerBtn>
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
            <div style={DS.selectAll}>
              <Checkbox
                label="All types"
                bold
                checked={allChecked}
                indeterminate={allIndeterm}
                onChange={(v) => { setOne('books', v); setOne('unstructured', v); setOne('articles', v); setOne('topics', v); setOne('attachments', v); }}
              />
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="sr-only">Document types</legend>
              <div style={DS.group}>
                <Checkbox
                  label="All documents"
                  bold
                  checked={isGroupChecked(allDoc)}
                  indeterminate={isGroupIndeterm(allDoc)}
                  onChange={(v) => setGroup(allDoc, v)}
                />
                <ul style={DS.list}>
                  {DOC_GROUP.map((s) => (
                    <li key={s.key} style={DS.listItem}>
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

              <div style={DS.group}>
                <Checkbox
                  label="All other components"
                  bold
                  checked={isGroupChecked(allOther)}
                  indeterminate={isGroupIndeterm(allOther)}
                  onChange={(v) => setGroup(allOther, v)}
                />
                <ul style={DS.list}>
                  {OTHER_GROUP.map((s) => (
                    <li key={s.key} style={DS.listItem}>
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

            <div style={DS.sectionTitle}>Document title</div>
            <FloatingInput label="Search by title" value={titleQuery} onChange={setTitleQuery} />

            <fieldset style={DS.fieldset}>
              <legend style={DS.legend}>Metadata</legend>
              <p style={DS.emptyMessage}>Select a metadata value in the result tags to add a filter.</p>
            </fieldset>

            <div style={DS.sectionTitle}>User</div>
            <FloatingInput label="User ID" value={userId} onChange={setUserId} />
          </section>
          <footer style={DS.drawerFooter}>
            <button type="button" style={DS.applyBtn} onClick={handleApply}>Apply</button>
          </footer>
        </aside>
        
        {heatmapDoc && (
          <HeatmapDrawer doc={heatmapDoc} onClose={() => setHeatmapDoc(null)} />
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function formatNum(n) {
  return n.toLocaleString('en-US');
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

function RowActions({ open, onToggle, onClose, onViewHeatmap }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
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
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onClose}>Show document</button>
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onViewHeatmap}>View heatmap</button>
        </div>
      )}
    </span>
  );
}

function FloatingInput({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const filled = value && String(value).length > 0;
  const floating = focused || filled;
  return (
    <label style={{
      ...IS.wrapper,
      borderColor: focused ? '#1d4ed8' : '#cbd5e1',
      boxShadow: focused ? '0 0 0 1px rgba(29, 78, 216, 0.2)' : 'none',
    }}>
      <span style={{
        ...IS.label,
        top: floating ? '6px' : '50%',
        fontSize: floating ? '0.7rem' : '0.85rem',
        transform: floating ? 'translateY(0)' : 'translateY(-50%)',
        color: focused ? '#1d4ed8' : '#475569',
      }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={IS.input}
      />
    </label>
  );
}

function HeatmapDrawer({ doc, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchHeatmap = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/analytics/v2/documents/${doc.id}/topics/views-heatmap`, {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({
             startDate: '2024-01-01',
             endDate: '2026-12-31'
          })
        });
        const json = await res.json();
        if (active) {
           setData(json.results || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchHeatmap();
    return () => { active = false; };
  }, [doc.id]);

  const maxViews = data ? Math.max(...data.flatMap(d => {
    const getAllCounts = (node) => [node.displayCount, ...(node.children ? node.children.flatMap(getAllCounts) : [])];
    return getAllCounts(d);
  }), 1) : 1;

  const renderTree = (nodes, level = 0) => {
    return nodes.map(n => (
      <div key={n.id} style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: `${level * 16}px` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
             <div style={{ fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={n.title}>
               {n.title}
             </div>
             <div style={{ width: '100%', background: '#e2e8f0', height: '6px', borderRadius: '3px', marginTop: '4px' }}>
               <div style={{ width: `${(n.displayCount / maxViews) * 100}%`, background: '#1d4ed8', height: '100%', borderRadius: '3px' }} />
             </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, width: '40px', textAlign: 'right' }}>
            {formatNum(n.displayCount)}
          </div>
        </div>
        {n.children && n.children.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            {renderTree(n.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.2)', zIndex: 40 }} onClick={onClose} />
      <aside style={{ ...DS.drawer, position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}>
        <header style={DS.drawerHead}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={DS.drawerTitle}>Topic Heatmap</span>
            <span style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>{doc.title}</span>
          </div>
          <button type="button" style={DS.drawerClose} aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <section style={{ ...DS.drawerBody, padding: '20px 18px' }}>
          {loading ? (
             <div style={{ color: '#475569', fontSize: '0.85rem' }}>Loading heatmap...</div>
          ) : data && data.length > 0 ? (
             renderTree(data)
          ) : (
             <div style={DS.emptyMessage}>No topic data available for this document.</div>
          )}
        </section>
      </aside>
    </>
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
  },
  dateBadgeText: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem', color: '#475569' },
  dateBadgeIcon: { display: 'inline-flex', color: '#475569' },
};

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff', overflow: 'hidden' },
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
  body: { padding: '12px 22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },

  tableCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  tableHeadRow: { background: '#f8fafc', borderBottom: '1px solid #e5e7eb' },
  th: { padding: '12px 14px', textAlign: 'left' },
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
  metaList: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    fontSize: '0.74rem',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    color: '#0f172a',
    maxWidth: '100%',
  },
  metaKey: { color: '#475569', fontWeight: 500 },
  metaVal: { color: '#0f172a', fontWeight: 600 },

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
    minWidth: '160px',
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
    padding: '8px 12px',
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

const IS = {
  wrapper: {
    position: 'relative',
    display: 'block',
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  },
  label: {
    position: 'absolute',
    left: '12px',
    pointerEvents: 'none',
    background: '#ffffff',
    padding: '0 4px',
    transform: 'translateY(-50%)',
    transition: 'top 120ms ease, font-size 120ms ease, color 120ms ease',
  },
  input: {
    width: '100%',
    padding: '14px 12px 6px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    color: '#0f172a',
    borderRadius: '6px',
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
    transition: 'margin-right 200ms ease, visibility 200ms',
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
  group: { marginBottom: '14px' },
  list: { listStyle: 'none', padding: '4px 0 0 22px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  listItem: { padding: '4px 0' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' },
  fieldset: {
    border: 'none',
    padding: 0,
    margin: '6px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  legend: { fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', padding: 0 },
  emptyMessage: {
    margin: 0,
    padding: '8px 10px',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
    color: '#475569',
    fontSize: '0.78rem',
  },
  drawerFooter: {
    padding: '12px 18px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
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
};
