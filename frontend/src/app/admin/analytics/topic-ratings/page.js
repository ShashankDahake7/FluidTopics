'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Static data ------------------------------ */

const RATING_TYPE_OPTIONS = [
  { value: 'stars', label: 'Stars' },
  { value: 'thumbs', label: 'Thumbs' },
];

/* All 18 rows mirror the Angular blueprint exactly. Each row has the
 * average star rating, the number of ratings collected, the topic + document
 * titles, and a list of metadata key/value chips that's rendered in the
 * Metadata column. */
const RATING_ROWS = [
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Time',
    document: 'Release Notes May 2024',
    metadata: [
      { key: 'author_personname', value: 'Darwinbox' },
      { key: 'ft:lastPublication', value: '2025-11-19T11:12:22.518000' },
      { key: 'ft:publication_title', value: 'Release Notes May 2024' },
      { key: 'publicationDate', value: '2025-11-19' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Sapien Design System and Experience Enhancements',
    document: 'Release Notes Feb 2026',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-05T06:25:27.907942' },
      { key: 'ft:publication_title', value: 'Release Notes Feb 2026' },
      { key: 'publicationDate', value: '2026-03-05' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Flexible Holiday Enhancements',
    document: 'Release Notes November 2024',
    metadata: [
      { key: 'author_personname', value: 'Darwinbox' },
      { key: 'ft:lastPublication', value: '2025-11-19T12:52:44.153000' },
      { key: 'ft:publication_title', value: 'Release Notes November 2024' },
      { key: 'publicationDate', value: '2025-11-19' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'FAQ- Recruitment',
    document: 'Recruitment',
    metadata: [
      { key: 'author_personname', value: 'Rashmi Menon' },
      { key: 'ft:lastPublication', value: '2026-03-07T11:59:16.015726' },
      { key: 'ft:publication_title', value: 'Recruitment' },
      { key: 'publicationDate', value: '2026-03-07' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'N-Grid Framework',
    document: 'Talent Intelligence',
    metadata: [
      { key: 'author_personname', value: 'Praseeda Udaykumar' },
      { key: 'ft:lastPublication', value: '2026-03-05T07:46:30.583011' },
      { key: 'ft:publication_title', value: 'Talent Intelligence' },
      { key: 'publicationDate', value: '2026-03-05' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'New Welcome Page Settings',
    document: 'Onboarding',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-16T13:45:03.259429' },
      { key: 'ft:publication_title', value: 'Onboarding' },
      { key: 'publicationDate', value: '2026-03-16' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Single Sign On',
    document: 'Darwinbox Studio',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-13T13:12:46.082508' },
      { key: 'ft:publication_title', value: 'Darwinbox Studio' },
      { key: 'publicationDate', value: '2026-03-13' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Unsubscribe from Notification Emails',
    document: 'Notification Templates',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-05T06:42:26.431452' },
      { key: 'ft:publication_title', value: 'Notification Templates' },
      { key: 'publicationDate', value: '2026-03-05' },
    ],
  },
  {
    stars: 5.0,
    ratings: 1,
    topic: 'Competency Mapping',
    document: 'Import',
    metadata: [
      { key: 'author_personname', value: 'Lenin Elvira' },
      { key: 'ft:lastPublication', value: '2026-03-06T12:58:36.267478' },
      { key: 'ft:publication_title', value: 'Import' },
      { key: 'publicationDate', value: '2026-03-06' },
    ],
  },
  {
    stars: 4.0,
    ratings: 1,
    topic: 'What are the Company Logo Dimensions?',
    document: 'Company',
    metadata: [
      { key: 'ft:lastPublication', value: '2025-12-19T14:19:47.498000' },
      { key: 'ft:publication_title', value: 'Company' },
      { key: 'publicationDate', value: '2025-12-19' },
    ],
  },
  {
    stars: 3.0,
    ratings: 1,
    topic: 'How to Create a Separation Flow',
    document: 'Workflow: Custom Workflow',
    metadata: [
      { key: 'author_personname', value: 'Rashmi Menon' },
      { key: 'ft:lastPublication', value: '2026-03-17T12:00:23.837954' },
      { key: 'ft:publication_title', value: 'Workflow: Custom Workflow' },
      { key: 'publicationDate', value: '2026-03-17' },
    ],
  },
  {
    stars: 3.0,
    ratings: 1,
    topic: 'Best Practices for Candidate Experience Revamp',
    document: 'Best Practices',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-06T10:06:05.091000' },
      { key: 'ft:publication_title', value: 'Best Practices' },
      { key: 'publicationDate', value: '2026-03-06' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Project Roles',
    document: 'Company',
    metadata: [
      { key: 'ft:lastPublication', value: '2025-12-19T14:19:47.498000' },
      { key: 'ft:publication_title', value: 'Company' },
      { key: 'publicationDate', value: '2025-12-19' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Continuous Feedback',
    document: 'Continuous Feedback',
    metadata: [
      { key: 'ft:lastPublication', value: '2026-03-05T06:34:18.639537' },
      { key: 'ft:publication_title', value: 'Continuous Feedback' },
      { key: 'publicationDate', value: '2026-03-05' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Bulk Upload HR Letters',
    document: 'Import',
    metadata: [
      { key: 'author_personname', value: 'Lenin Elvira' },
      { key: 'ft:lastPublication', value: '2026-03-06T12:58:36.267478' },
      { key: 'ft:publication_title', value: 'Import' },
      { key: 'publicationDate', value: '2026-03-06' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Helpdesk',
    document: 'Help Desk',
    metadata: [
      { key: 'author_personname', value: 'Shivani Kothakapu' },
      { key: 'ft:lastPublication', value: '2026-03-05T06:37:51.687775' },
      { key: 'ft:publication_title', value: 'Help Desk' },
      { key: 'publicationDate', value: '2026-03-05' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Create an Approval Flow with a Decision Matrix',
    document: 'Workflow: Custom Workflow',
    metadata: [
      { key: 'author_personname', value: 'Rashmi Menon' },
      { key: 'ft:lastPublication', value: '2026-03-24T12:48:07.667299' },
      { key: 'ft:publication_title', value: 'Workflow: Custom Workflow' },
      { key: 'publicationDate', value: '2026-03-24' },
    ],
  },
  {
    stars: 1.0,
    ratings: 1,
    topic: 'Form Builder',
    document: 'Release Notes August 2024',
    metadata: [
      { key: 'ft:lastPublication', value: '2025-11-19T12:41:58.822000' },
      { key: 'ft:publication_title', value: 'Release Notes August 2024' },
      { key: 'publicationDate', value: '2025-11-19' },
    ],
  },
];

const TOTAL_ROWS = RATING_ROWS.length;

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
  const [ratingType, setRatingType] = useState('stars');
  const [topicQuery, setTopicQuery] = useState('');
  const [docQuery, setDocQuery] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [openMenuRow, setOpenMenuRow] = useState(null);

  const tableMenuRef = useRef(null);
  useEffect(() => {
    if (openMenuRow === null) return;
    const onDoc = (e) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target)) {
        setOpenMenuRow(null);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenuRow(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuRow]);

  const sortedRows = useMemo(() => {
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...RATING_ROWS].sort((a, b) => {
      if (a.stars === b.stars) return 0;
      return a.stars > b.stars ? direction : -direction;
    });
  }, [sortDir]);

  const visibleRows = useMemo(() => {
    const tq = topicQuery.trim().toLowerCase();
    const dq = docQuery.trim().toLowerCase();
    return sortedRows.filter((r) => {
      if (tq && !r.topic.toLowerCase().includes(tq)) return false;
      if (dq && !r.document.toLowerCase().includes(dq)) return false;
      return true;
    });
  }, [sortedRows, topicQuery, docQuery]);

  const total = visibleRows.length;
  const rangeStart = total === 0 ? 0 : 1;
  const rangeEnd = total;

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
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times users rate a document.
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
                        onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                        aria-label="Sort by stars"
                      >
                        <span>Stars (</span>
                        <span style={PS.starGlyph} aria-hidden="true"><IconStar /></span>
                        <span>)</span>
                        <span style={PS.sortGlyph}>{sortDir === 'asc' ? '↑' : '↓'}</span>
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
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={PS.emptyCell}>
                        No matching topic ratings found during the selected period.
                      </td>
                    </tr>
                  )}
                  {visibleRows.map((r, i) => (
                    <tr key={i} style={i % 2 === 0 ? PS.trEven : PS.trOdd}>
                      <td style={PS.tdStars}>
                        <span style={PS.starsValue}>{r.stars.toFixed(1)}</span>
                        <span style={PS.starsSuffix}>/5</span>
                      </td>
                      <td style={PS.tdNum}>{r.ratings}</td>
                      <td style={PS.tdTopic}>{r.topic}</td>
                      <td style={PS.tdDoc}>
                        <span style={PS.docIcon} aria-hidden="true"><IconBook /></span>
                        <span>{r.document}</span>
                      </td>
                      <td style={PS.tdMeta}>
                        <div style={PS.chipStack}>
                          {r.metadata.map((m, idx) => (
                            <span key={idx} style={PS.chip} title={`${m.key}: ${m.value}`}>
                              <span style={PS.chipKey}>{m.key}:&nbsp;</span>
                              <span style={PS.chipValue}>{m.value}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={PS.tdAction}>
                        <div style={PS.menuWrap}>
                          <button
                            type="button"
                            style={PS.kebabBtn}
                            onClick={() => setOpenMenuRow((cur) => (cur === i ? null : i))}
                            aria-haspopup="menu"
                            aria-expanded={openMenuRow === i}
                            aria-label="Row actions"
                            title="Row actions"
                          >
                            <IconKebab />
                          </button>
                          {openMenuRow === i && (
                            <div
                              role="menu"
                              style={{
                                ...PS.menuPanel,
                                ...(i >= visibleRows.length - 2 ? PS.menuPanelUp : PS.menuPanelDown),
                              }}
                            >
                              <button type="button" role="menuitem" style={PS.menuItem} onClick={() => setOpenMenuRow(null)}>
                                Show topic
                              </button>
                              <button type="button" role="menuitem" style={PS.menuItem} onClick={() => setOpenMenuRow(null)}>
                                Show document
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer style={PS.pager}>
              <span />
              <div style={PS.pagerActions}>
                <span style={PS.rangeLabel}>
                  {rangeStart} – {rangeEnd} of {TOTAL_ROWS}
                </span>
                <button type="button" style={PS.pagerBtnDisabled} disabled aria-label="First page" title="First page">
                  <IconFirst />
                </button>
                <button type="button" style={PS.pagerBtnDisabled} disabled aria-label="Previous page" title="Previous page">
                  <IconPrev />
                </button>
                <button type="button" style={PS.pagerBtnDisabled} disabled aria-label="Next page" title="Next page">
                  <IconNext />
                </button>
                <button type="button" style={PS.pagerBtnDisabled} disabled aria-label="Last page" title="Last page">
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

            <form
              style={PS.drawerBody}
              onSubmit={(e) => { e.preventDefault(); }}
              noValidate
            >
              <FieldSelect
                label="Rating type"
                value={ratingType}
                options={RATING_TYPE_OPTIONS}
                onChange={setRatingType}
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
        )}
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
    transition: 'margin-right 200ms ease',
  },

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
  drawerSpace: { flex: 1 },
  drawerFooter: {
    display: 'flex',
    justifyContent: 'flex-start',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  applyBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
