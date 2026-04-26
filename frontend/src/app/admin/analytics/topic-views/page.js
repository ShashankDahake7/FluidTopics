'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Data ------------------------------ */

const TYPE_BOOK = 'BOOK_PLAIN';
const TYPE_UNSTRUCTURED = 'UNSTRUCTURED_DOC';

const TOPICS = [
  { views: 1644, topicTitle: 'Release Notes February 2026', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 723, topicTitle: 'Sapien Design System and Experience Enhancements', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 443, topicTitle: 'Core', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 419, topicTitle: 'Features Enabled By Default', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 367, topicTitle: 'Feature Availability for February 2026', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 290, topicTitle: "What's Upcoming - February 2026", documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-02-27T09:48:28.870000', 'publicationDate': '2026-02-27' } },
  { views: 281, topicTitle: 'Time Management', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 280, topicTitle: 'Platform Services', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 263, topicTitle: 'Configuration Approval Notification for Sub-Admins', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 253, topicTitle: 'Organization', documentTitle: 'Company', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Company', 'ft:lastPublication': '2026-03-11T09:59:38.099637', 'publicationDate': '2026-03-11' } },
  { views: 242, topicTitle: 'Performance', documentTitle: 'Performance', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Performance', 'author_personname': 'Nilanjan Guha', 'ft:lastPublication': '2026-03-24T12:50:59.742657', 'publicationDate': '2026-03-24' } },
  { views: 241, topicTitle: 'Talent Acquisition', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 241, topicTitle: 'Create Reports', documentTitle: 'Reports Builder', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Reports Builder', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-25T13:34:23.710560', 'publicationDate': '2026-03-25' } },
  { views: 226, topicTitle: 'Release Notes November 2025', documentTitle: 'Release Notes Nov 2025', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Nov 2025', 'author_personname': 'Darwinbox', 'ft:lastPublication': '2026-02-12T13:35:31.970000', 'publicationDate': '2026-02-12' } },
  { views: 217, topicTitle: 'Workflows', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 204, topicTitle: 'Disabling Default Emails in Flows', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 203, topicTitle: 'Darwinbox Studio', documentTitle: 'Darwinbox Studio', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Studio', 'ft:lastPublication': '2026-03-25T14:22:40.755161', 'publicationDate': '2026-03-25' } },
  { views: 199, topicTitle: 'Recruitment', documentTitle: 'Recruitment', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Recruitment', 'author_personname': 'Rashmi Menon', 'ft:lastPublication': '2026-03-27T06:14:31.118859', 'publicationDate': '2026-03-27' } },
  { views: 198, topicTitle: 'Reports Builder', documentTitle: 'Reports Builder', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Reports Builder', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-25T13:34:23.710560', 'publicationDate': '2026-03-25' } },
  { views: 196, topicTitle: 'Release Webinars', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 184, topicTitle: 'Employees', documentTitle: 'Employees', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Employees', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-11T10:00:17.056885', 'publicationDate': '2026-03-11' } },
  { views: 182, topicTitle: 'Payroll', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 179, topicTitle: 'Product Webinar: Launching Sapien 2.0', documentTitle: 'Best Practices', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Best Practices', 'ft:lastPublication': '2026-03-06T10:06:05.091000', 'publicationDate': '2026-03-06' } },
  { views: 175, topicTitle: 'Start From Scratch', documentTitle: 'Reports Builder', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Reports Builder', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-25T13:34:23.710560', 'publicationDate': '2026-03-25' } },
  { views: 174, topicTitle: 'Ability to Define the My Team Structure in Darwinbox', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 173, topicTitle: 'Attendance', documentTitle: 'Attendance', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Attendance', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2026-03-26T11:27:57.411018', 'publicationDate': '2026-03-26' } },
  { views: 170, topicTitle: 'Flows', documentTitle: 'Workflow: Custom Workflow', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Workflow: Custom Workflow', 'author_personname': 'Rashmi Menon', 'ft:lastPublication': '2026-03-24T12:48:07.667299', 'publicationDate': '2026-03-24' } },
  { views: 158, topicTitle: 'Activity Log for Offer and Offer Proposal Flows', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 158, topicTitle: 'Helpdesk', documentTitle: 'Help Desk', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Help Desk', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-05T06:37:51.687775', 'publicationDate': '2026-03-05' } },
  { views: 156, topicTitle: 'Leave', documentTitle: 'Leave', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Leave', 'author_personname': 'Shikha Gheyee', 'ft:lastPublication': '2026-03-26T09:41:31.950317', 'publicationDate': '2026-03-26' } },
  { views: 153, topicTitle: 'Leave Settings Precautions', documentTitle: 'Darwinbox Troubleshooting Articles', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Troubleshooting Articles', 'ft:lastPublication': '2026-03-27T13:31:01.145911' } },
  { views: 144, topicTitle: 'Introduction to HR Letters', documentTitle: 'HR Documents', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'HR Documents', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-06T12:58:05.283000', 'publicationDate': '2026-03-06' } },
  { views: 142, topicTitle: 'Assignment of Key People Using Import', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 142, topicTitle: 'Payroll', documentTitle: 'Payroll', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Payroll', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-27T13:04:47.906108', 'publicationDate': '2026-03-27' } },
  { views: 139, topicTitle: 'Financial Year-End Leave Balance Carry Forward – Actions & Guidelines', documentTitle: 'Darwinbox Troubleshooting Articles', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Troubleshooting Articles', 'ft:lastPublication': '2026-03-27T13:31:01.145911' } },
  { views: 138, topicTitle: 'Onboarding', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 134, topicTitle: 'Activity Import Enhancements', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 132, topicTitle: 'Legal Entity-Based Configuration for Organizations', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 129, topicTitle: 'Performance Management', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 125, topicTitle: 'Dynamic Assignee in Approval and Workflow Steps', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 117, topicTitle: 'People Analytics', documentTitle: 'People Analytics', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'People Analytics', 'author_personname': 'Lenin Elvira', 'ft:lastPublication': '2026-03-05T06:45:34.986291', 'publicationDate': '2026-03-05' } },
  { views: 111, topicTitle: 'Reports Builder', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 111, topicTitle: 'Create a New Welcome Page', documentTitle: 'Onboarding', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Onboarding', 'ft:lastPublication': '2026-03-16T13:45:03.259429', 'publicationDate': '2026-03-16' } },
  { views: 109, topicTitle: 'Create a Decision Matrix', documentTitle: 'Darwinbox Studio', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Darwinbox Studio', 'ft:lastPublication': '2026-03-25T14:22:40.755161', 'publicationDate': '2026-03-25' } },
  { views: 107, topicTitle: 'Features that Require Configuration', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 104, topicTitle: 'Additional Date Format Support', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 104, topicTitle: 'Global Compensation Playbook', documentTitle: 'Payroll', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Payroll', 'author_personname': 'Shivani Kothakapu', 'ft:lastPublication': '2026-03-27T13:04:47.906108', 'publicationDate': '2026-03-27' } },
  { views: 104, topicTitle: 'Audit Trail Reports in Reports Builder', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 103, topicTitle: 'Deprecation of Evaluation Forms and Migration to New Forms in Recruitment', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
  { views: 100, topicTitle: 'Allowances Framework and Calculated Fields in Overtime', documentTitle: 'Release Notes Feb 2026', documentType: TYPE_BOOK, metadata: { 'ft:publication_title': 'Release Notes Feb 2026', 'ft:lastPublication': '2026-03-23T13:39:55.281165', 'publicationDate': '2026-03-23' } },
];

const TOTAL_TOPIC_VIEWS = 76468;
const TOTAL_TOPIC_ROWS = 8084;
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

export default function TopicViewsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [topicQuery, setTopicQuery] = useState('');
  const [documentQuery, setDocumentQuery] = useState('');
  const [appliedTopicQuery, setAppliedTopicQuery] = useState('');
  const [appliedDocumentQuery, setAppliedDocumentQuery] = useState('');
  const [activeMenuRow, setActiveMenuRow] = useState(null);

  const filteredRows = useMemo(() => {
    const tq = appliedTopicQuery.trim().toLowerCase();
    const dq = appliedDocumentQuery.trim().toLowerCase();
    return TOPICS.filter((r) => {
      if (tq && !r.topicTitle.toLowerCase().includes(tq)) return false;
      if (dq && !r.documentTitle.toLowerCase().includes(dq)) return false;
      return true;
    });
  }, [appliedTopicQuery, appliedDocumentQuery]);

  const handleApply = () => {
    setAppliedTopicQuery(topicQuery);
    setAppliedDocumentQuery(documentQuery);
  };

  const breadcrumb = { prefix: 'Knowledge Hub', title: 'Topic views' };

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

  const rowsToRender = filteredRows.slice(0, PAGE_SIZE);

  return (
    <AnalyticsShell
      active="topic-views"
      breadcrumb={breadcrumb}
      feedbackSubject="Feedback about topic views"
      toolbarExtras={toolbarExtras}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of times users read a topic.
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
                  <col style={{ width: '300px' }} />
                  <col style={{ width: '240px' }} />
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
                    <th style={PS.th}><span style={PS.headerCell}>Topic Title</span></th>
                    <th style={PS.th}><span style={PS.headerCell}>Document Title</span></th>
                    <th style={PS.th}><span style={PS.headerCell}>Document Metadata</span></th>
                    <th style={PS.th} />
                  </tr>
                </thead>
                <tbody>
                  {rowsToRender.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={PS.emptyCell}>No topics match the current filters.</td>
                    </tr>
                  ) : (
                    rowsToRender.map((r, idx) => (
                      <tr key={`${r.topicTitle}-${r.documentTitle}-${idx}`} style={PS.tableRow}>
                        <td style={PS.td}>{formatNum(r.views)}</td>
                        <td style={PS.td}>
                          <span style={PS.topicText}>{r.topicTitle}</span>
                        </td>
                        <td style={PS.td}>
                          <span style={PS.titleCell}>
                            <span style={PS.titleIcon}>
                              {r.documentType === TYPE_UNSTRUCTURED ? <IconUnstructured /> : <IconBook />}
                            </span>
                            <span style={PS.titleText}>{r.documentTitle}</span>
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
                  Total views:&nbsp;<strong style={{ color: '#0f172a' }}>{formatNum(TOTAL_TOPIC_VIEWS)}</strong>
                </span>
                <span style={PS.pagerLabel}>1 – 50 of {formatNum(TOTAL_TOPIC_ROWS)}</span>
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
            <FloatingInput label="Search by topic title" value={topicQuery} onChange={setTopicQuery} />
            <FloatingInput label="Search by document title" value={documentQuery} onChange={setDocumentQuery} />

            <fieldset style={DS.fieldset}>
              <legend style={DS.legend}>Metadata</legend>
              <p style={DS.emptyMessage}>Select a metadata value in the result tags to add a filter.</p>
            </fieldset>
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
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onClose}>Show topic</button>
          <button type="button" style={PS.menuItem} role="menuitem" onClick={onClose}>Show document</button>
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
  td: { padding: '12px 14px', fontSize: '0.85rem', color: '#0f172a', wordBreak: 'break-word' },
  emptyCell: { padding: '24px 14px', textAlign: 'center', color: '#475569' },
  topicText: { color: '#0f172a' },
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
