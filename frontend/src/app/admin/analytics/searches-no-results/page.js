'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Static data ------------------------------ */

const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'zh-CN', label: 'Chinese (Simplified, China)' },
];

/* The first 50 rows mirror the Angular blueprint exactly. Each `facets`
 * entry corresponds to a chip (label + value) that's shown in the third
 * column when present. */
const PRIMARY_ROWS = [
  { queries: 10, term: 'planned overtime',                facets: [] },
  { queries:  8, term: 'studio',                          facets: [] },
  { queries:  6, term: '21100716',                        facets: [] },
  { queries:  6, term: 'f&f tat',                         facets: [] },
  { queries:  6, term: 'payroll',                         facets: [] },
  { queries:  6, term: 'sapien',                          facets: [] },
  { queries:  6, term: 'sftp',                            facets: [] },
  { queries:  5, term: 'delegation',                      facets: [] },
  { queries:  5, term: 'digital signature',               facets: [] },
  { queries:  5, term: 'infraction',                      facets: [] },
  { queries:  5, term: 'legal entity',                    facets: [] },
  { queries:  5, term: 'pendo',                           facets: [] },
  { queries:  5, term: 'reportee dashboard',              facets: [] },
  { queries:  4, term: 'archival',                        facets: [] },
  { queries:  4, term: 'beacon',                          facets: [] },
  { queries:  4, term: 'dashboard',                       facets: [] },
  { queries:  4, term: 'helix',                           facets: [] },
  { queries:  4, term: 'ot',                              facets: [] },
  { queries:  4, term: 'overtime',                        facets: [] },
  { queries:  4, term: 'overtime threshold',              facets: [] },
  { queries:  3, term: 'additional assignment',           facets: [] },
  { queries:  3, term: 'adoption matrix',                 facets: [] },
  { queries:  3, term: 'airplane',                        facets: [] },
  { queries:  3, term: 'company',                         facets: [{ label: 'Module', value: 'Company' }] },
  { queries:  3, term: 'docusign',                        facets: [] },
  { queries:  3, term: 'error handling',                  facets: [{ label: 'Module', value: 'Darwinbox Studio' }] },
  { queries:  3, term: 'irregular persona',               facets: [] },
  { queries:  3, term: 'marathi',                         facets: [] },
  { queries:  3, term: 'minimum wage',                    facets: [] },
  { queries:  3, term: 'over night',                      facets: [] },
  { queries:  3, term: 'permission',                      facets: [] },
  { queries:  3, term: 'persona',                         facets: [] },
  { queries:  3, term: 'sapiens',                         facets: [] },
  { queries:  3, term: 'sso',                             facets: [] },
  { queries:  3, term: 'superannuation',                  facets: [] },
  { queries:  3, term: 'triggering task',                 facets: [] },
  { queries:  3, term: 'updateprocesspay',                facets: [] },
  { queries:  3, term: 'weekly off',                      facets: [] },
  { queries:  2, term: '"employee preferences policy"',   facets: [] },
  { queries:  2, term: '"org policy assignments"',        facets: [] },
  { queries:  2, term: 'alumni',                          facets: [] },
  { queries:  2, term: 'ampa',                            facets: [] },
  { queries:  2, term: 'annual appraisal',                facets: [] },
  { queries:  2, term: 'archive requisition',             facets: [] },
  { queries:  2, term: 'attendance',                      facets: [] },
  { queries:  2, term: 'authenticator',                   facets: [] },
  { queries:  2, term: 'bank',                            facets: [] },
  { queries:  2, term: 'birthday',                        facets: [] },
  { queries:  2, term: 'confidential hiring',             facets: [] },
  { queries:  2, term: 'contribution level',              facets: [] },
];

/* Lower-volume long-tail terms used to flesh out subsequent pages of mock
 * data so pagination has something to navigate. Some carry a Module chip
 * to demonstrate the Facets column rendering. */
const TAIL_TERMS = [
  { term: 'pendo guides', module: 'Engagement' },
  { term: 'role mapping', module: null },
  { term: 'ess portal', module: null },
  { term: 'mss portal', module: null },
  { term: 'manager self service', module: null },
  { term: 'biometric attendance', module: 'Attendance' },
  { term: 'rfid', module: null },
  { term: 'geo fence', module: 'Attendance' },
  { term: 'geo tag', module: null },
  { term: 'leave year', module: null },
  { term: 'leave balance carry forward', module: 'Leave' },
  { term: 'optional holidays calendar', module: null },
  { term: 'comp off lapse', module: null },
  { term: 'shift mapping bulk', module: null },
  { term: 'roster publish', module: null },
  { term: 'roster swap', module: null },
  { term: 'overtime calculation', module: 'Payroll' },
  { term: 'shift differential payout', module: null },
  { term: 'lop arrear', module: null },
  { term: 'arrears workflow', module: null },
  { term: 'salary advance', module: 'Payroll' },
  { term: 'income tax slab', module: null },
  { term: 'investment declaration deadline', module: null },
  { term: 'rent receipt', module: null },
  { term: 'lta exemption', module: null },
  { term: 'flexi pay components', module: null },
  { term: 'meal card vendor', module: null },
  { term: 'esic dispensary', module: null },
  { term: 'lwf state', module: null },
  { term: 'pt slab', module: null },
  { term: 'company structure import', module: null },
  { term: 'job profile', module: 'Talent' },
  { term: 'competency framework', module: 'Talent' },
  { term: 'role library', module: null },
  { term: 'succession plan', module: 'Talent' },
  { term: 'high potential', module: null },
  { term: 'nine box', module: null },
  { term: '9-box', module: null },
  { term: 'goal cascade', module: null },
  { term: 'check ins', module: null },
  { term: '360 questionnaire', module: null },
  { term: 'rating scale', module: null },
  { term: 'normalization', module: null },
  { term: 'forced ranking', module: null },
  { term: 'review form', module: null },
  { term: 'review cycle', module: null },
  { term: 'compensation review', module: null },
  { term: 'promotion letter', module: null },
  { term: 'increment letter', module: null },
  { term: 'experience letter', module: 'Documents' },
  { term: 'noc letter', module: null },
  { term: 'address proof', module: null },
  { term: 'kyc upload', module: null },
  { term: 'pan verification', module: null },
  { term: 'bgv vendor', module: null },
  { term: 'reference check', module: null },
  { term: 'offer comparison', module: null },
  { term: 'candidate portal', module: null },
  { term: 'interview kit', module: null },
  { term: 'interview slot', module: null },
  { term: 'panel interview', module: null },
  { term: 'agency rebate', module: null },
  { term: 'employee referral bonus', module: null },
  { term: 'campus drive', module: null },
  { term: 'walk in', module: null },
  { term: 'asset request', module: null },
  { term: 'asset retrieval', module: null },
  { term: 'asset depreciation', module: null },
  { term: 'helpdesk reopen', module: 'Helpdesk' },
  { term: 'sla breach', module: 'Helpdesk' },
  { term: 'first response time', module: null },
  { term: 'mean time to resolve', module: null },
  { term: 'csat survey', module: null },
  { term: 'pulse survey trigger', module: null },
  { term: 'engagement dashboard', module: null },
  { term: 'enps cohort', module: null },
  { term: 'kudos points', module: null },
  { term: 'spot bonus', module: null },
  { term: 'recognition leaderboard', module: null },
  { term: 'long service award', module: null },
  { term: 'town hall poll', module: null },
  { term: 'announcement schedule', module: null },
  { term: 'theme builder', module: null },
  { term: 'logo override', module: null },
  { term: 'primary color', module: null },
  { term: 'banner image', module: null },
  { term: 'mobile app force update', module: null },
  { term: 'app version', module: null },
  { term: 'fcm token', module: null },
  { term: 'push notification template', module: null },
  { term: 'email template variables', module: null },
  { term: 'email retry queue', module: null },
  { term: 'sms gateway', module: null },
  { term: 'whatsapp template approval', module: null },
  { term: 'webhook retry', module: null },
  { term: 'audit trail filter', module: null },
  { term: 'data anonymization', module: null },
  { term: 'gdpr request status', module: null },
  { term: 'consent log', module: null },
  { term: 'role audit', module: null },
  { term: 'login history', module: null },
  { term: 'session timeout', module: null },
  { term: 'mfa enforcement', module: null },
  { term: 'sso saml', module: null },
  { term: 'sso okta', module: 'Integrations' },
  { term: 'sso azure ad', module: null },
  { term: 'scim debug', module: null },
  { term: 'workday outbound feed', module: null },
  { term: 'sap inbound feed', module: null },
  { term: 'oracle ebs feed', module: null },
  { term: 'ramco hcm sync', module: null },
  { term: 'tally export', module: null },
  { term: 'gst return upload', module: null },
  { term: 'epfo ecr file', module: null },
  { term: 'esic monthly contribution', module: null },
  { term: 'tds return q4', module: null },
  { term: 'form 16a', module: null },
  { term: 'form 12bb', module: null },
  { term: 'pf transfer in', module: null },
  { term: 'pf transfer out', module: null },
  { term: 'gratuity calculation', module: 'Payroll' },
  { term: 'leave encashment formula', module: null },
  { term: 'fnf settlement', module: null },
  { term: 'exit interview', module: null },
  { term: 'clearance checklist', module: null },
  { term: 'no dues certificate', module: null },
  { term: 'experience certificate generation', module: null },
  { term: 'reliveing letter', module: null },
  { term: 'last working day', module: null },
  { term: 'notice period buyout', module: null },
  { term: 'absconding case', module: null },
  { term: 'rehire eligible', module: null },
  { term: 'do not rehire', module: null },
  { term: 'concurrent employment', module: null },
  { term: 'double pay day', module: null },
  { term: 'missed punch', module: null },
  { term: 'mass regularization', module: null },
  { term: 'shift roster import error', module: null },
  { term: 'attendance device sync', module: null },
  { term: 'biometric raw data', module: null },
  { term: 'face match threshold', module: null },
  { term: 'liveness detection', module: null },
  { term: 'mobile selfie attendance', module: null },
  { term: 'wfh check-in', module: null },
  { term: 'shift planner ai', module: null },
  { term: 'roster optimization', module: null },
  { term: 'workforce forecasting', module: null },
  { term: 'labour budget', module: null },
  { term: 'manpower planning', module: null },
  { term: 'open positions report', module: null },
  { term: 'time to hire', module: null },
  { term: 'cost per hire', module: null },
  { term: 'offer drop rate', module: null },
  { term: 'attrition forecast', module: null },
  { term: 'voluntary attrition', module: null },
  { term: 'involuntary attrition', module: null },
  { term: 'high performer attrition', module: null },
  { term: 'retention plan', module: null },
  { term: 'stay interview', module: null },
  { term: 'engagement action plan', module: null },
  { term: 'manager development plan', module: null },
  { term: 'idp template', module: null },
  { term: 'mentoring program', module: null },
  { term: 'coaching session log', module: null },
  { term: 'training nomination', module: null },
  { term: 'training feedback', module: null },
  { term: 'lms course catalog', module: null },
  { term: 'lms certification expiry', module: null },
  { term: 'lms scorm tracker', module: null },
  { term: 'tin learning path', module: null },
  { term: 'micro learning', module: null },
  { term: 'compliance training', module: null },
  { term: 'pos refresh', module: null },
  { term: 'sap successfactors connector', module: null },
  { term: 'workday recruiting bridge', module: null },
  { term: 'oracle hcm fast formula', module: null },
  { term: 'manage absence module', module: null },
  { term: 'shift bidding', module: null },
  { term: 'leave taken without approval', module: null },
  { term: 'mass approve leaves', module: null },
  { term: 'mass reject leaves', module: null },
  { term: 'mass approve attendance', module: null },
  { term: 'mass approve regularization', module: null },
  { term: 'mass shift change', module: null },
  { term: 'mass salary update', module: null },
  { term: 'mass increment', module: null },
  { term: 'mass promotion', module: null },
  { term: 'mass exit', module: null },
  { term: 'mass document upload', module: null },
  { term: 'mass policy assignment', module: null },
  { term: 'mass training enrollment', module: null },
  { term: 'mass employee transfer', module: null },
  { term: 'mass goal cascade', module: null },
  { term: 'mass review trigger', module: null },
  { term: 'mass announcement', module: null },
  { term: 'mass communication log', module: null },
  { term: 'mass sms send', module: null },
  { term: 'mass email send', module: null },
  { term: 'mass survey send', module: null },
  { term: 'mass kudos send', module: null },
  { term: 'mass reward distribute', module: null },
  { term: 'mass nomination', module: null },
  { term: 'mass certificate generate', module: null },
  { term: 'mass payslip generate', module: null },
  { term: 'mass form 16 generate', module: null },
  { term: 'mass tax declaration approve', module: null },
  { term: 'mass loan disburse', module: null },
  { term: 'mass advance disburse', module: null },
  { term: 'mass reimbursement approve', module: null },
  { term: 'mass expense approve', module: null },
  { term: 'mass travel approve', module: null },
  { term: 'mass visa request', module: null },
  { term: 'mass passport custody', module: null },
  { term: 'mass insurance enrollment', module: null },
  { term: 'mass benefit enrollment', module: null },
  { term: 'mass pf nomination', module: null },
  { term: 'mass gratuity nomination', module: null },
  { term: 'mass beneficiary update', module: null },
  { term: 'mass dependant update', module: null },
  { term: 'mass medical declaration', module: null },
  { term: 'mass health checkup', module: null },
  { term: 'mass policy ack', module: null },
  { term: 'mass training certificate upload', module: null },
  { term: 'mass background verification', module: null },
  { term: 'mass kyc upload', module: null },
  { term: 'mass document expiry alert', module: null },
  { term: 'mass passport expiry alert', module: null },
  { term: 'mass visa expiry alert', module: null },
  { term: 'mass certification expiry alert', module: null },
  { term: 'mass wo allotment', module: null },
  { term: 'mass weekly off', module: null },
  { term: 'mass shift assignment', module: null },
  { term: 'mass roster assignment', module: null },
  { term: 'mass swipe import', module: null },
  { term: 'mass biometric import', module: null },
  { term: 'mass leave grant', module: null },
  { term: 'mass leave revoke', module: null },
  { term: 'mass leave encash', module: null },
  { term: 'mass attendance regularize', module: null },
  { term: 'mass approve overtime', module: null },
  { term: 'mass deny overtime', module: null },
  { term: 'mass shift swap approve', module: null },
  { term: 'mass shift swap reject', module: null },
  { term: 'mass training nominate', module: null },
  { term: 'mass training waitlist', module: null },
  { term: 'mass survey responder', module: null },
  { term: 'mass form publish', module: null },
  { term: 'mass workflow trigger', module: null },
  { term: 'mass policy publish', module: null },
  { term: 'mass announcement schedule', module: null },
  { term: 'mass kudos schedule', module: null },
];

const PAGE_SIZE = 50;
const TOTAL_QUERIES = 502;
const TOTAL_TERMS = 333;

function generateRows() {
  const rows = [...PRIMARY_ROWS];
  let counter = 2;
  for (let i = 0; i < TAIL_TERMS.length && rows.length < TOTAL_TERMS; i++) {
    const t = TAIL_TERMS[i];
    rows.push({
      queries: counter,
      term: t.term,
      facets: t.module ? [{ label: 'Module', value: t.module }] : [],
    });
    if (i % 18 === 17 && counter > 1) counter -= 1;
  }
  while (rows.length < TOTAL_TERMS) {
    rows.push({
      queries: 1,
      term: `additional query placeholder ${rows.length + 1}`,
      facets: [],
    });
  }
  return rows;
}

const ALL_ROWS = generateRows();

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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [locale, setLocale] = useState('en-US');
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(TOTAL_TERMS / PAGE_SIZE));

  const visibleRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return ALL_ROWS.slice(start, start + PAGE_SIZE);
  }, [page]);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, TOTAL_TERMS);

  const goFirst = () => setPage(0);
  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));
  const goLast = () => setPage(totalPages - 1);

  const atStart = page === 0;
  const atEnd = page === totalPages - 1;

  return (
    <AnalyticsShell
      active="searches-no-results"
      breadcrumb={{ prefix: 'Search', title: 'Searches with no results' }}
      feedbackSubject="Feedback about searches with no results"
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
              Data is based on the number of search events sent to the server by the portal.
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
            <div style={PS.tableWrap}>
              <table style={PS.table}>
                <colgroup>
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '38%' }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th style={PS.thQ}>Queries</th>
                    <th style={PS.thT}>Terms</th>
                    <th style={PS.thF}>Facets</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => (
                    <tr key={`${page}-${i}`} style={i % 2 === 0 ? PS.trEven : PS.trOdd}>
                      <td style={PS.tdQ}>{r.queries.toLocaleString('en-US')}</td>
                      <td style={PS.tdT}>{r.term}</td>
                      <td style={PS.tdF}>
                        {r.facets && r.facets.length > 0 && (
                          <div style={PS.chipStack}>
                            {r.facets.map((f, idx) => (
                              <span key={idx} style={PS.chip} title={`${f.label}: ${f.value}`}>
                                <span style={PS.chipLabel}>{f.label} ({f.label}):</span>
                                <span style={PS.chipValue}>{f.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer style={PS.pager}>
              <span style={PS.totalLabel}>
                Total queries: <strong>{TOTAL_QUERIES.toLocaleString('en-US')}</strong>
              </span>
              <div style={PS.pagerActions}>
                <span style={PS.rangeLabel}>
                  {rangeStart.toLocaleString('en-US')} – {rangeEnd.toLocaleString('en-US')} of {TOTAL_TERMS.toLocaleString('en-US')}
                </span>
                <button
                  type="button"
                  style={atStart ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goFirst}
                  disabled={atStart}
                  aria-label="First page"
                  title="First page"
                >
                  <IconFirst />
                </button>
                <button
                  type="button"
                  style={atStart ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goPrev}
                  disabled={atStart}
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <IconPrev />
                </button>
                <button
                  type="button"
                  style={atEnd ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goNext}
                  disabled={atEnd}
                  aria-label="Next page"
                  title="Next page"
                >
                  <IconNext />
                </button>
                <button
                  type="button"
                  style={atEnd ? PS.pagerBtnDisabled : PS.pagerBtn}
                  onClick={goLast}
                  disabled={atEnd}
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
                options={LOCALE_OPTIONS}
                onChange={setLocale}
              />
            </div>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ------------------------------ Field select ------------------------------ */

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
    overflow: 'hidden',
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
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
  },
  thT: {
    textAlign: 'left',
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
  },
  thF: {
    textAlign: 'left',
    padding: '10px 18px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
  },
  trEven: { background: '#ffffff' },
  trOdd: { background: '#fafbfd' },
  tdQ: {
    padding: '8px 18px',
    textAlign: 'right',
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #f1f5f9',
    width: '110px',
    verticalAlign: 'top',
  },
  tdT: {
    padding: '8px 18px',
    textAlign: 'left',
    color: '#0f172a',
    wordBreak: 'break-all',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  tdF: {
    padding: '8px 18px',
    textAlign: 'left',
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },

  chipStack: { display: 'flex', flexDirection: 'column', gap: '4px' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '999px',
    fontSize: '0.78rem',
    color: '#1e293b',
    width: 'fit-content',
    maxWidth: '100%',
  },
  chipLabel: { color: '#475569', fontWeight: 500 },
  chipValue: { color: '#1d4ed8', fontWeight: 600 },

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
