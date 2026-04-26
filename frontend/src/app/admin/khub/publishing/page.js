'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// ── Filter option lists ─────────────────────────────────────────────────────
const STATUSES = ['All', 'Success', 'Warning', 'Error', 'Running'];
const TYPES    = ['All types', 'Publication', 'Reprocess', 'Deletion'];
const PAGE_SIZES = [10, 25, 50, 100];

// ── Mock history (matches Darwinbox screenshot rows) ────────────────────────
const HISTORY = [
  { uploadId: 'cce-103931', status: 'warn', started: '04/23/2026, 5:19 PM',  type: 'Publication', name: 'Confluence-space-export-103931.html', user: 'Shivani Kothakapu', duration: '8m9s',  publications: 1, source: 'Confluence' },
  { uploadId: 'cce-112537', status: 'warn', started: '04/23/2026, 5:17 PM',  type: 'Publication', name: 'Confluence-space-export-112537.html', user: 'Shivani Kothakapu', duration: '5m40s', publications: 1, source: 'Confluence' },
  { uploadId: 'paligo-8206', status: 'ok',   started: '04/23/2026, 10:26 AM', type: 'Publication', name: 'Release_Notes_Feb_2026_1776920157.8206', user: 'Paligo-Key', duration: '43s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-5837', status: 'ok',   started: '04/23/2026, 10:08 AM', type: 'Publication', name: 'Release_Notes_Nov_2025_1776919055.5837', user: 'Paligo-Key', duration: '40s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-0823', status: 'ok',   started: '04/23/2026, 10:06 AM', type: 'Publication', name: 'Release_Notes_Feb_2026_1776918955.0823', user: 'Paligo-Key', duration: '42s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-7824', status: 'ok',   started: '04/23/2026, 10:04 AM', type: 'Publication', name: 'Reports_Builder_1776918855.7824',         user: 'Paligo-Key', duration: '54s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-6462', status: 'ok',   started: '04/23/2026, 10:02 AM', type: 'Publication', name: 'Reimbursement_1776918745.6462',           user: 'Paligo-Key', duration: '1m19s', publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-5600', status: 'ok',   started: '04/23/2026, 10:02 AM', type: 'Publication', name: 'My_Access_1776918716.5600',               user: 'Paligo-Key', duration: '16s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-3938', status: 'ok',   started: '04/22/2026, 9:34 AM',  type: 'Publication', name: 'Recruitment_1776830622.3938',             user: 'Paligo-Key', duration: '35s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-7190', status: 'ok',   started: '04/22/2026, 9:32 AM',  type: 'Publication', name: 'Payroll_1776830521.7190',                 user: 'Paligo-Key', duration: '28s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-9978', status: 'ok',   started: '04/20/2026, 2:42 PM',  type: 'Publication', name: 'Legal_Changes_1776676374.9978',           user: 'Paligo-Key', duration: '4s',    publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-5051', status: 'ok',   started: '04/20/2026, 2:28 PM',  type: 'Publication', name: 'Legal_Changes_1776675481.5051',           user: 'Paligo-Key', duration: '5s',    publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-6251', status: 'ok',   started: '04/17/2026, 6:30 PM',  type: 'Publication', name: 'Payroll_1776430790.6251',                 user: 'Paligo-Key', duration: '26s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-1066', status: 'ok',   started: '04/17/2026, 6:28 PM',  type: 'Publication', name: 'Help_Desk_1776430708.1066',               user: 'Paligo-Key', duration: '11s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-3128', status: 'ok',   started: '04/17/2026, 6:28 PM',  type: 'Publication', name: 'Travel_1776430681.3128',                  user: 'Paligo-Key', duration: '12s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-0102', status: 'ok',   started: '04/17/2026, 6:27 PM',  type: 'Publication', name: 'Reimbursement_1776430645.0102',           user: 'Paligo-Key', duration: '17s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-1057', status: 'ok',   started: '04/17/2026, 6:27 PM',  type: 'Publication', name: 'People_Analytics_1776430606.1057',        user: 'Paligo-Key', duration: '19s',   publications: 1, source: 'Paligo' },
  { uploadId: 'cce-092326', status: 'warn', started: '04/16/2026, 4:42 PM',  type: 'Publication', name: 'Confluence-space-export-092326.html',     user: 'Shivani Kothakapu', duration: '7m13s', publications: 1, source: 'Confluence' },
  { uploadId: 'cce-095331', status: 'warn', started: '04/16/2026, 4:34 PM',  type: 'Publication', name: 'Confluence-space-export-095331.html',     user: 'Shivani Kothakapu', duration: '5m41s', publications: 1, source: 'Confluence' },
  { uploadId: 'paligo-4978', status: 'ok',   started: '04/15/2026, 7:46 PM',  type: 'Publication', name: 'Recruitment_1776262577.4978',             user: 'Paligo-Key', duration: '38s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-2896', status: 'ok',   started: '04/15/2026, 7:44 PM',  type: 'Publication', name: 'Company_1776262464.2896',                 user: 'Paligo-Key', duration: '37s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-3087', status: 'ok',   started: '04/15/2026, 7:43 PM',  type: 'Publication', name: 'People_Analytics_1776262361.3087',        user: 'Paligo-Key', duration: '44s',   publications: 1, source: 'Paligo' },
  { uploadId: 'paligo-1622', status: 'ok',   started: '04/15/2026, 7:41 PM',  type: 'Publication', name: 'Attendance_1776262305.1622',              user: 'Paligo-Key', duration: '26s',   publications: 1, source: 'Paligo' },
  { uploadId: 'cce-081402', status: 'warn', started: '04/08/2026, 6:01 PM',  type: 'Publication', name: 'Confluence-space-export-081402.html',     user: 'Shivani Kothakapu', duration: '7m8s',  publications: 1, source: 'Confluence' },
  { uploadId: 'cce-084513', status: 'warn', started: '04/08/2026, 5:56 PM',  type: 'Publication', name: 'Confluence-space-export-084513.html',     user: 'Shivani Kothakapu', duration: '5m54s', publications: 1, source: 'Confluence' },
];

const FAKE_TOTAL = 1391; // total items shown in the screenshot footer

export default function PublishingPage() {
  const [search, setSearch] = useState('');
  const [date,   setDate]   = useState('');
  const [status, setStatus] = useState('All');
  const [type,   setType]   = useState('All types');
  const [history, setHistory] = useState(HISTORY);

  const [sortKey, setSortKey] = useState('started');
  const [sortDir, setSortDir] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Drawers / modals
  const [selectedJob, setSelectedJob] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Filter + sort
  const rows = useMemo(() => {
    const filtered = history.filter((h) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${h.name} ${h.source} ${h.user}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (date && !h.started.startsWith(date)) return false;
      if (status !== 'All') {
        const map = { Success: 'ok', Warning: 'warn', Error: 'err', Running: 'run' };
        if (h.status !== map[status]) return false;
      }
      if (type !== 'All types' && h.type !== type) return false;
      return true;
    });
    if (!sortKey) return filtered;
    const cmp = (a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    };
    const sorted = [...filtered].sort(cmp);
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [history, search, date, status, type, sortKey, sortDir]);

  const total = Math.max(rows.length, FAKE_TOTAL); // mimic the long list count
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows  = rows.slice(pageStart, pageStart + pageSize);
  const visibleStart = pageRows.length ? pageStart + 1 : 0;
  const visibleEnd   = pageStart + pageRows.length;

  const onSort = (key, sortable) => {
    if (!sortable) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <AdminShell active="khub-publishing" allowedRoles={['superadmin']}>
      <div style={S.headerRow}>
        <div>
          <h1 style={S.h1}>
            Publishing{' '}
            <span style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }}>
              <button
                type="button"
                aria-label="More information"
                onClick={() => setPopoverOpen((v) => !v)}
                style={S.infoBtn}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              {popoverOpen && (
                <div role="dialog" aria-label="Publishing information" style={S.popover}>
                  <div>
                    See{' '}
                    <a
                      href="https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Knowledge-Hub/Publishing"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.popoverLink}
                    >
                      the publishing documentation
                    </a>
                    .
                  </div>
                </div>
              )}
            </span>
          </h1>
          <p style={S.subtitle}>Publish content, track ongoing jobs, and view job history.</p>
        </div>
        <div style={{ display: 'inline-flex', gap: '12px' }}>
          <button type="button" style={S.linkBtn} onClick={() => setScheduleOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            <span>Schedule a reprocess</span>
          </button>
          <button type="button" style={S.primaryBtn} onClick={() => setPublishOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
            <span>Publish content</span>
          </button>
        </div>
      </div>

      {/* Jobs section */}
      <section style={{ marginTop: '12px' }}>
        <h2 style={S.h2}>Jobs</h2>
        <div style={S.emptyState}>There are no ongoing jobs.</div>
      </section>

      {/* History section */}
      <section style={{ marginTop: '24px' }}>
        <div style={S.historyHeader}>
          <h2 style={S.h2}>History</h2>
          <button type="button" style={S.linkBtnBare} onClick={() => setCleanOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Clean history</span>
          </button>
        </div>

        <div style={S.filterRow}>
          <div style={S.filterField}>
            <span style={S.fieldIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by job name, source, or username"
              style={S.input}
            />
          </div>
          <div style={S.filterField}>
            <span style={S.fieldIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <input
              type="text"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              placeholder="Search by upload date"
              style={S.input}
            />
          </div>
          <div style={S.selectField}>
            <span style={S.floatLabel}>Filter by Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={S.select}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span aria-hidden="true" style={S.chevron}>▾</span>
          </div>
          <div style={S.selectField}>
            <span style={S.floatLabel}>Filter by Type</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} style={S.select}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span aria-hidden="true" style={S.chevron}>▾</span>
          </div>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <Th label="Status"       width="70px" />
                <Th label="Started"      sortable sortKey="started"      cur={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="Type"         sortable sortKey="type"         cur={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="Name" />
                <Th label="User"         sortable sortKey="user"         cur={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="Duration" />
                <Th label="Publications" sortable sortKey="publications" cur={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="Source"       sortable sortKey="source"       cur={sortKey} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={8} style={S.emptyTableCell}>No publishing history matches your filters.</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.uploadId} style={S.tr} onClick={() => setSelectedJob(r)}>
                  <td style={S.td}><StatusIcon kind={r.status} /></td>
                  <td style={S.td}>{r.started}</td>
                  <td style={S.td}>{r.type}</td>
                  <td style={{ ...S.td, color: '#0f172a' }}>{r.name}</td>
                  <td style={S.td}>{r.user}</td>
                  <td style={S.td}>{r.duration}</td>
                  <td style={S.td}>{r.publications}</td>
                  <td style={S.td}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={S.tableFooter}>
            <div style={S.perPage}>
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>Items per page:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={S.perPageSelect}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span aria-hidden="true" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', fontSize: '0.85rem' }}>▾</span>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              {visibleStart}-{visibleEnd} of {total}
            </div>
            <div style={S.pager}>
              <PagerBtn label="First" disabled={safePage === 1} onClick={() => setPage(1)}>«</PagerBtn>
              <PagerBtn label="Previous" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</PagerBtn>
              <PagerBtn label="Next" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</PagerBtn>
              <PagerBtn label="Last" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</PagerBtn>
            </div>
          </div>
        </div>
      </section>

      {/* Drawers + modals */}
      <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />
      <ScheduleReprocessDrawer open={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      <ConfirmModal
        open={cleanOpen}
        title="Clean all reports"
        body="All reports will be deleted. This action cannot be undone. This will not cancel jobs in progress or scheduled."
        confirmLabel="Clean"
        onCancel={() => setCleanOpen(false)}
        onConfirm={() => { setHistory([]); setCleanOpen(false); }}
      />

      <PublishContentModal
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onPublished={({ file, source, doc, durationMs }) => {
          // Map backend doc.status → the local status badge kinds.
          // ingestFile returns "completed" on success, "failed" on parser
          // errors, and "processing" while still running.
          const STATUS_MAP = { completed: 'ok', failed: 'err', processing: 'run' };
          const formatDuration = (ms) => {
            const total = Math.max(1, Math.round(ms / 1000));
            if (total < 60) return `${total}s`;
            const m = Math.floor(total / 60);
            const s = total % 60;
            return `${m}m${s}s`;
          };
          setHistory((h) => [{
            uploadId: doc?.id ? `upl-${String(doc.id).slice(-6)}` : `upl-${Date.now()}`,
            status: STATUS_MAP[doc?.status] || 'ok',
            started: new Date().toLocaleString('en-US', {
              month: '2-digit', day: '2-digit', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            }),
            type: 'Publication',
            name: doc?.title || file.name,
            user: 'Super Admin',
            duration: formatDuration(durationMs ?? 0),
            publications: doc?.topicCount ? 1 : 1,
            source,
          }, ...h]);
          setPublishOpen(false);
        }}
      />
    </AdminShell>
  );
}

// ── Sortable column header ─────────────────────────────────────────────────
function Th({ label, width, sortable, sortKey, cur, dir, onSort }) {
  const active = sortable && cur === sortKey;
  return (
    <th
      onClick={() => sortable && onSort(sortKey, true)}
      style={{
        ...S.th,
        ...(width ? { width } : null),
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        color: active ? '#0f172a' : '#475569',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {sortable && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true"
               style={{
                 transition: 'transform 150ms',
                 transform: active && dir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                 opacity: active ? 1 : 0.45,
               }}>
            <polyline points="18 15 12 9 6 15" />
          </svg>
        )}
      </span>
    </th>
  );
}

function PagerBtn({ children, label, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'transparent', border: 'none',
        color: disabled ? '#cbd5e1' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '1rem', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function StatusIcon({ kind }) {
  if (kind === 'ok') {
    return (
      <span title="Done" style={{ color: '#16a34a', display: 'inline-flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
        </svg>
      </span>
    );
  }
  if (kind === 'warn') {
    return (
      <span title="Warning" style={{ color: '#f59e0b', display: 'inline-flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z" />
        </svg>
      </span>
    );
  }
  if (kind === 'err') {
    return (
      <span title="Error" style={{ color: '#dc2626', display: 'inline-flex' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </span>
    );
  }
  return (
    <span title="Running" style={{ color: '#1d4ed8', display: 'inline-flex' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </span>
  );
}

// ── Confirm modal (centred) ─────────────────────────────────────────────────
function ConfirmModal({ open, title, body, cancelLabel = 'Cancel', confirmLabel = 'Confirm', onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={S.modalDialog}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={S.modalBody}>{body}</div>
        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" style={S.primaryBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Publish content modal (file drop + source picker) ──────────────────────
const SOURCE_OPTIONS = [
  { value: 'dita',         label: 'DITA — Default DITA source' },
  { value: 'ud',           label: 'UD — Default Unstructured Document source' },
  { value: 'ait',          label: 'Author-it — Default Author-It source' },
  { value: 'ftml',         label: 'FTML — Default FTML source' },
  { value: 'Paligo',       label: 'Paligo' },
  { value: 'Confluence',   label: 'Confluence' },
  { value: 'PDF_open',     label: 'PDF_open — PDFs that do not need authentication' },
  { value: 'Docebo_help',  label: 'docebo — Docebo Help' },
];

// File extensions accepted by the ingest endpoint (mirrors the portal
// Upload-document dialog so admins get parity between flows).
const PUBLISH_ACCEPT = '.html,.htm,.md,.markdown,.docx,.xml,.zip,.txt';
const PUBLISH_ACCEPT_DESCRIPTION = 'Supports HTML, Markdown, DOCX, XML, ZIP, TXT';

function PublishContentModal({ open, onCancel, onPublished }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // When the backend rejects auth (e.g. session revoked, JWT expired), we
  // surface a re-sign-in CTA instead of a generic "Publish failed" message.
  const [authExpired, setAuthExpired] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setFile(null); setSource(''); setDragOver(false); setError(''); setAuthExpired(false); setUploading(false);
    const onKey = (e) => { if (e.key === 'Escape' && !uploading) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const valid = !!file && !!source && !uploading;

  // Validate against the same extension list the backend accepts.
  const ACCEPT_RX = /\.(html?|md|markdown|docx|xml|zip|txt)$/i;
  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPT_RX.test(f.name)) {
      setError('Unsupported file type. ' + PUBLISH_ACCEPT_DESCRIPTION + '.');
      return;
    }
    setError('');
    setFile(f);
  };

  // Real upload — same endpoint the portal Upload-document dialog uses.
  // ingestFile parses topics server-side and creates a Document.
  const handlePublish = async () => {
    if (!valid) return;
    setUploading(true);
    setError('');
    setAuthExpired(false);
    const startedAt = Date.now();
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Source is informational on the FT side; the backend ignores
      // unknown fields, but we forward it so server logs can correlate.
      fd.append('source', source);
      const data = await api.upload('/ingest/upload', fd);
      const durationMs = Date.now() - startedAt;
      onPublished?.({ file, source, doc: data?.document, durationMs });
    } catch (e) {
      // 401 means the bearer token / session was rejected. The frontend
      // already attempted a refresh once inside fetchWithOptionalRefresh, so
      // a second 401 here is terminal — prompt the user to sign in again.
      if (e?.status === 401) {
        setAuthExpired(true);
        setError('Your session has expired. Sign in again to publish content.');
      } else if (e?.status === 403) {
        setError('You do not have permission to publish content.');
      } else {
        setError(e?.message || 'Publish failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    onCancel?.();
  };

  const handleSignInAgain = async () => {
    try { await api.signOut(); } catch { /* clear-only path */ }
    router.replace('/login?next=/admin/khub/publishing');
  };

  return (
    <div role="presentation" onClick={handleClose} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label="Publish content"
           onClick={(e) => e.stopPropagation()}
           style={{ ...S.modalDialog, width: 'min(520px, 100%)' }}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>Publish content</h2>
          <button type="button" aria-label="Close" onClick={handleClose} disabled={uploading} style={{ ...S.modalClose, opacity: uploading ? 0.5 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { if (uploading) return; e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (uploading) return;
              e.preventDefault(); setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            aria-disabled={uploading}
            style={{
              border: `1px dashed ${dragOver ? '#a21caf' : '#cbd5e1'}`,
              background: dragOver ? '#fdf2f8' : '#f8fafc',
              borderRadius: '6px',
              padding: '28px 16px',
              textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem', color: '#475569',
              transition: 'background 120ms, border-color 120ms',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {file ? (
              <span>
                <strong style={{ color: '#0f172a' }}>{file.name}</strong>{' '}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => { e.stopPropagation(); if (!uploading) setFile(null); }}
                  style={{ marginLeft: '6px', background: 'transparent', border: 'none', color: '#a21caf', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                >
                  Remove
                </button>
              </span>
            ) : (
              <>
                <div>
                  Drop a file or{' '}
                  <span style={{ color: '#a21caf', textDecoration: 'underline' }}>browse</span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {PUBLISH_ACCEPT_DESCRIPTION}
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file" accept={PUBLISH_ACCEPT} hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={source}
              disabled={uploading}
              onChange={(e) => setSource(e.target.value)}
              style={{
                width: '100%', padding: '10px 28px 10px 12px',
                border: '1px solid #cbd5e1', borderRadius: '4px',
                background: '#fff', fontSize: '0.92rem', color: source ? '#0f172a' : '#94a3b8',
                fontFamily: 'var(--font-sans)', outline: 'none',
                appearance: 'none', cursor: uploading ? 'not-allowed' : 'pointer', boxSizing: 'border-box',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <option value="">Select a source</option>
              {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>▾</span>
          </div>

          {error && (
            <div role="alert" style={{
              padding: '10px 12px',
              background: '#fef2f2', color: '#991b1b',
              border: '1px solid #fecaca', borderRadius: '6px',
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button type="button" style={{ ...S.linkBtn, opacity: uploading ? 0.5 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }} onClick={handleClose} disabled={uploading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ marginRight: '4px' }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
          {authExpired ? (
            <button
              type="button"
              onClick={handleSignInAgain}
              style={S.primaryBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign in again
            </button>
          ) : (
            <button
              type="button"
              disabled={!valid}
              onClick={handlePublish}
              style={{ ...S.primaryBtn, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed' }}
            >
              {uploading ? (
                <>
                  <span aria-hidden="true" style={S.spinnerDot} />
                  Publishing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Publish
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Right-side drawer (shared shell) ────────────────────────────────────────
function RightDrawer({ open, title, width = 540, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="presentation" onClick={onClose} style={S.drawerOverlay}>
      <aside role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
             style={{ ...S.drawer, width: `min(${width}px, 96vw)` }}>
        <header style={S.drawerHeader}>
          <div style={S.drawerTitle}>{title}</div>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={S.drawerBody}>{children}</div>
      </aside>
    </div>
  );
}

// ── Job detail drawer ───────────────────────────────────────────────────────
function JobDetailDrawer({ job, onClose }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pubFilter, setPubFilter] = useState('');
  if (!job && !cancelOpen) {
    // ensure modal closes alongside drawer
  }
  return (
    <>
      <RightDrawer open={!!job} title={job?.name || ''} width={640} onClose={onClose}>
        {job && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <StatusIcon kind={job.status} />
                <span style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.8rem', color: '#475569' }}>
                  {job.status === 'ok' ? 'Done' : job.status === 'warn' ? 'Warning' : job.status === 'err' ? 'Error' : 'Pending'}
                </span>
              </span>
              <button type="button" style={{ ...S.primaryBtn, padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setCancelOpen(true)}>Cancel</button>
            </div>

            <div style={S.infoGrid}>
              <InfoCell label="UploadID:" value={job.uploadId} copyable />
              <InfoCell label="Duration:" value={`${job.duration} (${job.duration} total)`} />
              <InfoCell label="Uploaded by:" value={job.user} />
            </div>

            <div style={{ marginTop: '24px' }}>
              <div style={S.drawerSectionHeader}>
                <h3 style={S.drawerSectionTitle}>Publications</h3>
                <div style={{ ...S.selectField, minWidth: '220px' }}>
                  <span style={S.floatLabel}>Filter publications by Status</span>
                  <select value={pubFilter} onChange={(e) => setPubFilter(e.target.value)} style={S.select}>
                    <option value="">Any</option>
                    {STATUSES.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span aria-hidden="true" style={S.chevron}>▾</span>
                </div>
              </div>

              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: '110px' }}>Status</th>
                      <th style={S.th}>Title</th>
                      <th style={S.th}>originId</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={3} style={S.emptyTableCell}>No logs for this publication</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={S.drawerSectionTitle}>General logs</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', margin: '8px 0 12px' }}>
                <span style={{ fontSize: '0.88rem', color: '#475569' }}>To access specific publication logs, use the table above.</span>
                <button type="button" style={S.linkBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download logs</span>
                </button>
              </div>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: '160px' }}>Date</th>
                      <th style={S.th}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={2} style={S.emptyTableCell}>No logs for this report</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </RightDrawer>

      <ConfirmModal
        open={cancelOpen}
        title="Cancel this job?"
        body="All unfinished tasks will be canceled. New configurations will not be applied to non-processed publications."
        cancelLabel="Keep in queue"
        confirmLabel="Cancel job"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => { setCancelOpen(false); onClose(); }}
      />
    </>
  );
}

function InfoCell({ label, value, copyable }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        {copyable && (
          <button type="button" aria-label={copied ? 'Copied' : 'Copy to clipboard'} onClick={handleCopy} style={S.iconBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Schedule reprocess drawer ───────────────────────────────────────────────
function ScheduleReprocessDrawer({ open, onClose }) {
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [pending, setPending] = useState([]);
  const [delIdx, setDelIdx] = useState(null);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return { value: String(h), label: `${String(hh).padStart(2, '0')}:00 ${ampm}` };
  }), []);

  const canSchedule = !!date && hour !== '' && pending.length < 5;

  const schedule = () => {
    if (!canSchedule) return;
    setPending([...pending, {
      date,
      hour: hours.find((h) => h.value === hour)?.label || hour,
      user: 'Super Admin',
    }]);
    setDate(''); setHour('');
  };

  return (
    <>
      <RightDrawer open={open} title="Scheduled reprocess" width={1100} onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', marginBottom: '24px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Pick a reprocess date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.dateInput} />
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Select hour</label>
            <select disabled={!date} value={hour} onChange={(e) => setHour(e.target.value)} style={{ ...S.dateInput, paddingRight: '28px', appearance: 'none', cursor: date ? 'pointer' : 'not-allowed' }}>
              <option value="">Select hour</option>
              {hours.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            <span aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '34px', color: '#94a3b8', pointerEvents: 'none' }}>▾</span>
          </div>
          <button type="button" disabled={!canSchedule} onClick={schedule}
                  style={{ ...S.primaryBtn, height: '42px', opacity: canSchedule ? 1 : 0.55, cursor: canSchedule ? 'pointer' : 'not-allowed' }}>
            Schedule
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={S.drawerSectionTitle}>Pending scheduled reprocess</h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Maximum 5 scheduled reprocesses allowed</span>
        </div>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>User</th>
                <th style={{ ...S.th, width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={3} style={S.emptyTableCell}>No scheduled processing found</td></tr>
              ) : pending.map((p, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{p.date} {p.hour}</td>
                  <td style={S.td}>{p.user}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <button type="button" aria-label="Delete" onClick={() => setDelIdx(i)} style={{ ...S.iconBtn, color: '#a21caf' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RightDrawer>

      <ConfirmModal
        open={delIdx !== null}
        title="Delete scheduled reprocess?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDelIdx(null)}
        onConfirm={() => {
          setPending((p) => p.filter((_, i) => i !== delIdx));
          setDelIdx(null);
        }}
      />
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: '14px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  infoBtn: {
    background: 'transparent', border: 'none', padding: '2px',
    color: '#94a3b8', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  popover: {
    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
    marginTop: '6px', zIndex: 20,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '10px 14px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
    fontSize: '0.85rem', color: '#0f172a',
    whiteSpace: 'nowrap',
  },
  popoverLink: { color: '#a21caf', textDecoration: 'underline' },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'transparent', color: '#a21caf',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  linkBtnBare: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '4px 0',
    background: 'transparent', color: '#a21caf',
    border: 'none', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#94a3b8', padding: '2px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  h2: { margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' },
  emptyState: {
    background: '#fff', border: 'none',
    padding: '48px 0', textAlign: 'center',
    color: '#475569', fontSize: '0.9rem',
  },
  historyHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '12px',
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
    gap: '12px', marginBottom: '12px',
  },
  filterField: {
    position: 'relative', display: 'flex', alignItems: 'center',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '0 10px',
  },
  fieldIcon: { color: '#94a3b8', display: 'inline-flex', marginRight: '6px' },
  input: {
    flex: 1, padding: '8px 4px', border: 'none', outline: 'none',
    background: 'transparent', fontSize: '0.85rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)',
  },
  select: {
    flex: 1, padding: '14px 22px 6px 4px', border: 'none', outline: 'none',
    background: 'transparent', fontSize: '0.85rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', appearance: 'none', cursor: 'pointer',
  },
  selectField: {
    position: 'relative', display: 'flex', alignItems: 'center',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '0 10px',
  },
  floatLabel: {
    position: 'absolute', top: '4px', left: '12px',
    fontSize: '0.65rem', color: '#94a3b8', pointerEvents: 'none',
  },
  chevron: {
    position: 'absolute', right: '10px', top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8', fontSize: '0.85rem', pointerEvents: 'none',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    textAlign: 'left', padding: '12px 14px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
  td: {
    padding: '12px 14px', color: '#475569', verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  emptyTableCell: {
    padding: '40px 14px', textAlign: 'center', color: '#94a3b8',
    fontSize: '0.9rem',
  },
  tableFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '24px', padding: '8px 14px', borderTop: '1px solid #e2e8f0',
    background: '#fff', flexWrap: 'wrap',
  },
  perPage: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  perPageSelect: {
    padding: '4px 22px 4px 8px', border: '1px solid #cbd5e1',
    borderRadius: '4px', background: '#fff', fontSize: '0.85rem',
    fontFamily: 'var(--font-sans)', color: '#0f172a',
    appearance: 'none', cursor: 'pointer',
  },
  pager: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  // Drawer + modal
  drawerOverlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    background: '#f1f5f9', height: '100%',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
    fontFamily: 'var(--font-sans)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
    background: '#fff', boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
  },
  drawerTitle: { fontSize: '1.05rem', fontWeight: 600, color: '#0f172a',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '24px', minWidth: 0 },
  drawerSectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  drawerSectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '14px', marginBottom: '8px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 1fr',
    gap: '20px', alignItems: 'center',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  modalDialog: {
    width: 'min(440px, 100%)', background: '#fff',
    borderRadius: '8px', boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
  },
  modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: '18px', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
  },
  dateInput: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none',
  },
  spinnerDot: {
    display: 'inline-block',
    width: '12px', height: '12px',
    border: '2px solid rgba(255,255,255,0.45)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
