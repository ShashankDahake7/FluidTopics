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

/* The first 50 rows mirror the Angular blueprint exactly. */
const PRIMARY_ROWS = [
  { queries: 108, term: 'bulk custom flow trigger import' },
  { queries:  72, term: 'decision matrix' },
  { queries:  44, term: 'ask darwin' },
  { queries:  40, term: 'location master' },
  { queries:  40, term: 'talent review' },
  { queries:  39, term: 'planned overtime' },
  { queries:  35, term: 'reports builder' },
  { queries:  34, term: 'sapien design system and experience enhancements' },
  { queries:  30, term: 'facial recognition' },
  { queries:  30, term: 'flows' },
  { queries:  30, term: 'workflow skip logic' },
  { queries:  28, term: 'delegation' },
  { queries:  28, term: 'payroll' },
  { queries:  28, term: 'sapien' },
  { queries:  28, term: 'talent profile' },
  { queries:  27, term: 'pay group' },
  { queries:  27, term: 'recruitment' },
  { queries:  26, term: 'my access' },
  { queries:  24, term: 'calibration' },
  { queries:  23, term: 'advance - merge reports' },
  { queries:  23, term: 'manager hub' },
  { queries:  22, term: 'comp off import' },
  { queries:  22, term: 'f&f tat' },
  { queries:  22, term: 'permissions' },
  { queries:  22, term: 'stack ranking' },
  { queries:  21, term: 'darwinbox studio' },
  { queries:  21, term: 'helpdesk' },
  { queries:  21, term: 'separation' },
  { queries:  20, term: 'bulk custom flow trigger' },
  { queries:  20, term: 'performance' },
  { queries:  20, term: 'product webinar: launching sapien 2.0' },
  { queries:  20, term: 'sla settings' },
  { queries:  19, term: 'analytics' },
  { queries:  19, term: 'asset management' },
  { queries:  19, term: 'dont allow referral option adding candidate' },
  { queries:  19, term: 'forms' },
  { queries:  19, term: 'import' },
  { queries:  19, term: 'intercompany transfer' },
  { queries:  19, term: 'journeys' },
  { queries:  19, term: 'neo user' },
  { queries:  19, term: 'onboarding' },
  { queries:  19, term: 'profile view settings' },
  { queries:  19, term: 'sftp' },
  { queries:  19, term: 'user assignment' },
  { queries:  19, term: 'workflow' },
  { queries:  18, term: 'bulk upload of documents' },
  { queries:  18, term: 'msf' },
  { queries:  18, term: 'salary structure' },
  { queries:  18, term: 'talent management' },
  { queries:  17, term: 'appraisal stage changes' },
];

/* Lower-volume long-tail terms used to flesh out subsequent pages of mock
 * data so pagination has something to navigate. The Angular blueprint reports
 * Total queries: 17,933 across 9,284 distinct terms. */
const TAIL_TERMS = [
  'leave policy', 'attendance regularization', 'reimbursement claims', 'okr cascade', 'goal review',
  'pms cycle', '360 feedback', 'shift roster', 'roster bulk upload', 'shift swap requests',
  'comp off accrual', 'leave encashment', 'travel desk', 'travel approval flow', 'expense rules',
  'gst entry', 'tds calculation', 'pf settings', 'esi settings', 'lop calculation',
  'leave year reset', 'salary on hold', 'salary release', 'arrears processing', 'one time payment',
  'recurring deduction', 'bonus payout', 'incentive structure', 'commission engine', 'variable pay',
  'cost center mapping', 'cost code allocation', 'project costing', 'org structure import',
  'reporting hierarchy', 'matrix manager', 'dotted line manager', 'role groups', 'access control',
  'sso configuration', 'okta integration', 'azure ad sync', 'ldap sync', 'scim provisioning',
  'webhook subscriptions', 'audit log download', 'data retention policy', 'gdpr export', 'right to be forgotten',
  'document checklist', 'esign integration', 'docusign envelope', 'offer letter template', 'background verification',
  'candidate scoring', 'interview scheduling', 'interview feedback', 'offer rollout', 'pre-onboarding tasks',
  'asset issue request', 'asset return request', 'helpdesk sla', 'helpdesk routing', 'incident category',
  'knowledge base article', 'announcement banner', 'pulse survey', 'engagement score', 'enps trend',
  'town hall recording', 'recognition badges', 'kudos wall', 'reward redemption', 'wallet balance',
  'payslip download', 'form 16', 'form 24q', 'income tax declaration', 'investment proofs',
  'flexi benefit plan', 'meal coupons', 'lta computation', 'medical reimbursement', 'phone reimbursement',
  'overtime register', 'shift differential', 'night allowance', 'wfh stipend', 'hybrid work policy',
  'workday calendar', 'company holidays', 'optional holidays', 'holiday calendar import', 'attendance penalty',
  'mass update employees', 'mass transfer', 'mass exit', 'mass salary revision', 'mass document upload',
  'sap successfactors mapping', 'workday connector', 'oracle hcm bridge', 'ramco bridge', 'zoho people sync',
  'microsoft teams app', 'slack app', 'whatsapp bot', 'email templates', 'sms templates',
];

const PAGE_SIZE = 50;
const TOTAL_QUERIES = 17_933;
const TOTAL_TERMS = 9_284;

function generateRows() {
  const rows = [...PRIMARY_ROWS];
  let counter = 17;
  for (let i = 0; i < TAIL_TERMS.length; i++) {
    rows.push({ queries: counter, term: TAIL_TERMS[i] });
    if (i % 4 === 3 && counter > 4) counter -= 1;
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

export default function SearchTermsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [locale, setLocale] = useState('en-US');
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(TOTAL_TERMS / PAGE_SIZE));

  /* For paged navigation we recycle the available mock rows. */
  const visibleRows = useMemo(() => {
    const startMock = (page * PAGE_SIZE) % ALL_ROWS.length;
    if (startMock + PAGE_SIZE <= ALL_ROWS.length) {
      return ALL_ROWS.slice(startMock, startMock + PAGE_SIZE);
    }
    return ALL_ROWS.slice(startMock).concat(
      ALL_ROWS.slice(0, PAGE_SIZE - (ALL_ROWS.length - startMock)),
    );
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
      active="search-terms"
      breadcrumb={{ prefix: 'Search', title: 'Search terms' }}
      feedbackSubject="Feedback about search terms"
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
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th style={PS.thQ}>Queries</th>
                    <th style={PS.thT}>Terms</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => (
                    <tr key={`${page}-${i}`} style={i % 2 === 0 ? PS.trEven : PS.trOdd}>
                      <td style={PS.tdQ}>{r.queries.toLocaleString('en-US')}</td>
                      <td style={PS.tdT}>{r.term}</td>
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
  trEven: { background: '#ffffff' },
  trOdd: { background: '#fafbfd' },
  tdQ: {
    padding: '8px 18px',
    textAlign: 'right',
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #f1f5f9',
    width: '110px',
  },
  tdT: {
    padding: '8px 18px',
    textAlign: 'left',
    color: '#0f172a',
    wordBreak: 'break-all',
    borderBottom: '1px solid #f1f5f9',
  },

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
