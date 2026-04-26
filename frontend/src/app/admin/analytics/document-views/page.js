'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Data ------------------------------ */

const TYPE_BOOK = 'BOOK_PLAIN';
const TYPE_UNSTRUCTURED = 'UNSTRUCTURED_DOC';

const DOCUMENTS = [
  { views: 6106, title: 'Release Notes Feb 2026', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 1709, title: 'Company', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Company', 'ft:lastPublication': '2026-03-11T09:59:38.099637', 'publicationDate': '2026-03-11' } },
  { views: 1700, title: 'Darwinbox FAQs Articles', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox FAQs Articles', 'ft:lastPublication': '2026-03-27T13:25:49.599610' } },
  { views: 1333, title: 'Darwinbox Troubleshooting Articles', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Troubleshooting Articles', 'ft:lastPublication': '2026-03-27T13:31:01.145911' } },
  { views: 1018, title: 'Recruitment', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Recruitment', 'author_personname': 'Rashmi Menon', 'ft:lastPublication': '2026-03-27T06:14:31.118859', 'publicationDate': '2026-03-27' } },
  { views: 1013, title: 'Performance', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Performance', 'author_personname': 'Nilanjan Guha', 'ft:lastPublication': '2026-03-24T12:50:59.742657', 'publicationDate': '2026-03-24' } },
  { views: 907, title: 'Leave', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Leave', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2026-03-26T09:41:31.950317', 'publicationDate': '2026-03-26' } },
  { views: 879, title: 'Reports Builder', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Reports Builder', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-25T13:34:23.710560', 'publicationDate': '2026-03-25' } },
  { views: 834, title: 'Import', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Import', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-24T12:49:02.546002', 'publicationDate': '2026-03-24' } },
  { views: 833, title: 'Payroll', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Payroll', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-27T13:04:47.906108', 'publicationDate': '2026-03-27' } },
  { views: 798, title: 'Attendance', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Attendance', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2026-03-26T11:27:57.411018', 'publicationDate': '2026-03-26' } },
  { views: 733, title: 'Release Notes Nov 2025', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Nov 2025', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2026-02-12T13:35:31.970000', 'publicationDate': '2026-02-12' } },
  { views: 666, title: 'Darwinbox Studio', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Studio', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2026-03-25T14:22:40.755161', 'publicationDate': '2026-03-25' } },
  { views: 630, title: 'HR Documents', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'HR Documents', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-06T12:58:05.283000', 'publicationDate': '2026-03-06' } },
  { views: 579, title: 'Release Notes May 2025', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes May 2025', 'ft:lastPublication': '2026-03-23T13:42:13.798069', 'publicationDate': '2026-03-23' } },
  { views: 579, title: 'Employees', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Employees', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-11T10:00:17.056885', 'publicationDate': '2026-03-11' } },
  { views: 570, title: 'Workflow: Custom Workflow', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Workflow: Custom Workflow', 'author_personname': 'Rashmi Menon', 'ft:lastPublication': '2026-03-24T12:48:07.667299', 'publicationDate': '2026-03-24' } },
  { views: 490, title: 'Onboarding', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Onboarding', 'ft:lastPublication': '2026-03-16T13:45:03.259429', 'publicationDate': '2026-03-16' } },
  { views: 448, title: 'Best Practices', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Best Practices', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2026-03-06T10:06:05.091000', 'publicationDate': '2026-03-06' } },
  { views: 432, title: 'Release Notes May 2023', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes May 2023', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2024-09-26T14:16:44.492000', 'publicationDate': '2024-09-26' } },
  { views: 387, title: 'Release Notes Feb 2025', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2025', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2025-06-03T01:10:34.903000', 'publicationDate': '2025-06-03' } },
  { views: 366, title: 'Form Builder', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Form Builder', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-23T13:37:37.069513', 'publicationDate': '2026-03-23' } },
  { views: 357, title: 'Permissions', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Permissions', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-05T07:40:22.423388', 'publicationDate': '2026-03-05' } },
  { views: 345, title: 'Release Notes August 2025', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes August 2025', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-16T13:33:32.630382', 'publicationDate': '2026-03-16' } },
  { views: 317, title: 'My Access', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'My Access', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-05T06:42:06.891905', 'publicationDate': '2026-03-05' } },
  { views: 299, title: 'Talent Management', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Talent Management', 'ft:lastPublication': '2026-03-16T13:44:18.137647', 'publicationDate': '2026-03-16' } },
  { views: 292, title: 'Workflow: Standard Workflow', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Workflow: Standard Workflow', 'author_personname': 'Rashmi Menon', 'ft:lastPublication': '2026-03-05T07:45:32.027586', 'publicationDate': '2026-03-05' } },
  { views: 258, title: 'Release Notes November 2024', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes November 2024', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2025-11-19T12:52:44.153000', 'publicationDate': '2025-11-19' } },
  { views: 255, title: 'People Analytics', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'People Analytics', 'author_personname': 'Praseeda Udaykumar', 'ft:lastPublication': '2026-03-05T06:45:34.986291', 'publicationDate': '2026-03-05' } },
  { views: 250, title: '100 Features', type: TYPE_BOOK, metadata: { 'ft:publication_title': '100 Features', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2024-01-23T07:45:19.730000' } },
  { views: 242, title: 'Release Notes Nov 2023', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Nov 2023', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2025-11-19T12:28:44.166000', 'publicationDate': '2025-11-19' } },
  { views: 239, title: 'Help Desk', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Help Desk', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-05T06:37:51.687775', 'publicationDate': '2026-03-05' } },
  { views: 229, title: 'Talent Intelligence', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Talent Intelligence', 'author_personname': 'Praseeda Udaykumar', 'ft:lastPublication': '2026-03-05T07:46:30.583011', 'publicationDate': '2026-03-05' } },
  { views: 219, title: 'Release Notes Aug 2023', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Aug 2023', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2024-09-26T15:48:31.991000', 'publicationDate': '2024-09-26' } },
  { views: 210, title: 'Release Notes May 2024', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes May 2024', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2025-11-19T11:12:22.518000', 'publicationDate': '2025-11-19' } },
  { views: 204, title: 'Darwinbox AI Pack', type: TYPE_UNSTRUCTURED, metadata: { 'ft:publication_title': 'Darwinbox AI Pack', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2025-03-12T08:33:00.812000' } },
  { views: 184, title: 'Travel', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Travel', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-05T07:48:43.872014', 'publicationDate': '2026-03-05' } },
  { views: 182, title: 'Notification Templates', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Notification Templates', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2026-03-18T13:53:13.911366', 'publicationDate': '2026-03-18' } },
  { views: 179, title: 'Release Notes Feb 2024', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2024', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2024-09-26T15:53:03.223000', 'publicationDate': '2024-09-26' } },
  { views: 172, title: 'Release Notes August 2024', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes August 2024', 'ft:lastPublication': '2025-11-19T12:41:58.822000', 'publicationDate': '2025-11-19' } },
  { views: 168, title: 'Release Notes', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2024-09-26T13:56:52.193000', 'publicationDate': '2024-09-26' } },
  { views: 139, title: 'Reimbursement', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Reimbursement', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-05T07:43:03.276708', 'publicationDate': '2026-03-05' } },
  { views: 99, title: 'Vibe', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Vibe', 'author_personname': 'Payal Tikait', 'ft:lastPublication': '2026-03-05T10:00:16.133000', 'publicationDate': '2026-03-05' } },
  { views: 97, title: 'Recognition', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Recognition', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-05T07:40:33.638688', 'publicationDate': '2026-03-05' } },
  { views: 90, title: 'Country Guide', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Country Guide', 'author_personname': 'Payal Tikait', 'ft:lastPublication': '2024-12-04T10:27:14.095000' } },
  { views: 89, title: 'Surveys', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Surveys', 'author_personname': 'Payal Tikait', 'ft:lastPublication': '2026-03-05T07:45:36.329232', 'publicationDate': '2026-03-05' } },
  { views: 83, title: 'Multistakeholder Feedback', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Multistakeholder Feedback', 'author_personname': 'Debapriya Hajara', 'ft:lastPublication': '2026-03-16T13:47:17.241041', 'publicationDate': '2026-03-16' } },
  { views: 70, title: 'Integration Templates', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Integration Templates', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2025-10-16T06:07:59.818000', 'publicationDate': '2025-10-16' } },
  { views: 64, title: 'Darwinbox AI Accelerator Pack', type: TYPE_UNSTRUCTURED, metadata: { 'ft:publication_title': 'Darwinbox AI Accelerator Pack', 'author_personname': 'Payal Tikait', 'ft:lastPublication': '2026-02-27T13:51:15.418000' } },
  { views: 60, title: 'Time Sheets', type: TYPE_BOOK, metadata: { 'ft:publication_title': 'Time Sheets', 'author_personname': 'Debapriya Hajara', 'ft:lastPublication': '2026-03-05T07:48:09.521170', 'publicationDate': '2026-03-05' } },
];

const TOTAL_VIEWS = 29982;
const TOTAL_ROWS = 943;
const PAGE_SIZE = 50;

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

/* ------------------------------ Page ------------------------------ */

export default function DocumentViewsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [titleQuery, setTitleQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [appliedTitleQuery, setAppliedTitleQuery] = useState('');
  const [activeMenuRow, setActiveMenuRow] = useState(null);

  const filteredRows = useMemo(() => {
    const q = appliedTitleQuery.trim().toLowerCase();
    if (!q) return DOCUMENTS;
    return DOCUMENTS.filter((r) => r.title.toLowerCase().includes(q));
  }, [appliedTitleQuery]);

  const handleApply = () => setAppliedTitleQuery(titleQuery);

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
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={PS.emptyCell}>No documents match the current filters.</td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => (
                      <tr key={`${r.title}-${idx}`} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.views)}</td>
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
                            {Object.entries(r.metadata).map(([key, value]) => (
                              <span key={key} style={PS.metaChip}>
                                <span style={PS.metaKey}>{key}:&nbsp;</span>
                                <span style={PS.metaVal}>{value}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td style={PS.td}>
                          <RowActions
                            open={activeMenuRow === idx}
                            onToggle={() => setActiveMenuRow((v) => (v === idx ? null : idx))}
                            onClose={() => setActiveMenuRow(null)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={PS.pager}>
                <span style={PS.totalLabel}>
                  Total views:&nbsp;<strong style={{ color: '#0f172a' }}>{formatNum(TOTAL_VIEWS)}</strong>
                </span>
                <span style={PS.pagerLabel}>1 – 50 of {formatNum(TOTAL_ROWS)}</span>
                <div style={PS.pagerBtns}>
                  <PagerBtn disabled aria-label="First page"><IconChevDoubleLeft /></PagerBtn>
                  <PagerBtn disabled aria-label="Previous page"><IconChevLeft /></PagerBtn>
                  <PagerBtn aria-label="Next page"><IconChevRight /></PagerBtn>
                  <PagerBtn aria-label="Last page"><IconChevDoubleRight /></PagerBtn>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside style={{ ...DS.drawer, transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)' }}>
          <header style={DS.drawerHead}>
            <span style={DS.drawerTitle}>Refine search</span>
            <button type="button" style={DS.drawerClose} aria-label="Close" onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <section style={DS.drawerBody}>
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

function RowActions({ open, onToggle, onClose }) {
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
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onClose}>View heatmap</button>
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
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff' },
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
    transition: 'transform 200ms ease',
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
  drawerBody: { padding: '16px 18px 12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' },
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
    display: 'flex',
    justifyContent: 'flex-end',
  },
  applyBtn: {
    padding: '8px 22px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
