'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';
import { hrefForDoc } from '@/lib/prettyUrl';

// ── Filter option lists ─────────────────────────────────────────────────────
const STATUSES = ['All', 'Success', 'Warning', 'Error', 'Running'];
const TYPES    = ['All types', 'Publication', 'Reprocess', 'Deletion'];
const PAGE_SIZES = [10, 25, 50, 100];

// Map UI filter labels → backend enum / sort knobs. Keeping the mapping in
// one place so the History select and the GET /api/publications query agree.
const STATUS_FILTER_TO_API = {
  All:     '',
  Success: 'validated',
  Warning: 'extracted',     // extracted-but-warnings still surface here
  Error:   'failed',
  Running: 'extracting',    // also covers `validating` — handled server-side
};

const SORT_KEY_TO_API = {
  started:      'createdAt',
  user:         'uploadedBy',
  type:         'createdAt',     // we don't store a real type yet
  source:       'sourceLabel',
  publications: 'extracted.fileCount',
};

// Friendly status icon kind from a backend `status` + warn/error counts.
// Mirrors the Darwinbox screenshot: green check for clean validated, amber
// triangle when there are warnings, red cross on failure, blue clock while
// any worker is still running.
function deriveIconKind(pub) {
  if (!pub) return 'queued';
  if (pub.status === 'failed') return 'err';
  if (pub.status === 'extracting' || pub.status === 'validating' || pub.status === 'uploaded') return 'run';
  if ((pub.counts?.error ?? 0) > 0) return 'err';
  if ((pub.counts?.warn ?? 0) > 0) return 'warn';
  return 'ok';
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDuration(timings) {
  if (!timings) return '';
  // Pick the latest finished phase that has both start + end so the column
  // shows "extract took…" while still extracting and flips to total duration
  // once validation is done.
  const start = timings.extractStart || timings.uploadedAt;
  const end   = timings.validateEnd  || timings.extractEnd  || timings.uploadedAt;
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!(ms > 0)) return '';
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m${s}s`;
}

// API row → table row used by the existing render code further down. Keeping
// the field names the table already consumes lets us reuse the JSX as-is.
function mapApiRow(p) {
  return {
    id:           p.id,
    uploadId:     p.id,                                      // legacy alias for table key
    status:       deriveIconKind(p),
    started:      formatDateTime(p.createdAt),
    type:         'Publication',
    name:         p.originalFilename || p.name,
    user:         p.uploadedBy?.name || p.uploadedBy?.email || '—',
    duration:     formatDuration(p.timings),
    publications: p.extractedFileCount || 0,
    source:       p.sourceLabel || '',
    raw:          p,                                         // keep full server payload for the drawer
  };
}

export default function PublishingPage() {
  const [search, setSearch] = useState('');
  const [date,   setDate]   = useState('');
  const [status, setStatus] = useState('All');
  const [type,   setType]   = useState('All types');

  // Live API state. `rows` mirrors the original local shape via mapApiRow().
  const [rows, setRows] = useState([]);
  const [ongoingJobs, setOngoingJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [sortKey, setSortKey] = useState('started');
  const [sortDir, setSortDir] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Drawers / modals
  const [selectedJob, setSelectedJob] = useState(null);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Bumped on every action (extract/validate/delete) so the page re-fetches
  // without us having to thread an "onUpdated" callback through every drawer.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((n) => n + 1);

  // Fetch from /api/publications whenever filters / sort / paging change.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (date) {
      // The HTML date input gives us "YYYY-MM-DD"; widen it to a full day so
      // the server-side $gte/$lte range matches every record from that date.
      params.set('from', `${date}T00:00:00.000Z`);
      params.set('to',   `${date}T23:59:59.999Z`);
    }
    const apiStatus = STATUS_FILTER_TO_API[status] ?? '';
    if (apiStatus) params.set('status', apiStatus);
    params.set('page',  String(page));
    params.set('limit', String(pageSize));
    params.set('sortKey', SORT_KEY_TO_API[sortKey] || 'createdAt');
    params.set('sortDir', sortDir);

    setLoading(true);
    setLoadError('');
    api.get(`/publications?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items.map(mapApiRow) : [];
        setRows(items);
        setTotal(typeof data?.total === 'number' ? data.total : items.length);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        // Surface a single readable error in place of the table; auth/expired
        // sessions show the generic copy from api.js.
        setLoadError(err?.message || 'Failed to load publications');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [search, date, status, page, pageSize, sortKey, sortDir, refreshKey]);

  // Auto-refresh while any publication in the current page OR any ongoing
  // job globally is still running.
  useEffect(() => {
    const hasInflight = rows.some((r) => r.status === 'run') || ongoingJobs.length > 0;
    if (!hasInflight) return undefined;

    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [rows, ongoingJobs]);

  // Fetch ongoing jobs separately so they can be shown in the 'Jobs' section
  // regardless of the History table's paging/filtering.
  useEffect(() => {
    let cancelled = false;
    api.get('/publications?status=running&limit=50')
      .then((data) => {
        if (cancelled) return;
        setOngoingJobs(Array.isArray(data?.items) ? data.items.map(mapApiRow) : []);
      })
      .catch(() => { if (!cancelled) setOngoingJobs([]); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Type column is purely cosmetic right now (everything is "Publication");
  // applying the filter client-side avoids a server-side enum that doesn't
  // exist yet.
  const visibleRows = useMemo(() => (
    type === 'All types' ? rows : rows.filter((r) => r.type === type)
  ), [rows, type]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows  = visibleRows;
  const visibleStart = pageRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const visibleEnd   = (safePage - 1) * pageSize + pageRows.length;

  const onSort = (key, sortable) => {
    if (!sortable) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <AdminShell active="khub-publishing" allowedRoles={['superadmin']} fullWidth>
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
        {ongoingJobs.length === 0 ? (
          <div style={S.emptyState}>There are no ongoing jobs.</div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: '70px' }}>Status</th>
                  <th style={S.th}>Started</th>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Source</th>
                  <th style={S.th}>User</th>
                </tr>
              </thead>
              <tbody>
                {ongoingJobs.map((j) => (
                  <tr key={j.id} style={S.tr} onClick={() => setSelectedJob(j)}>
                    <td style={S.td}><StatusIcon kind="run" /></td>
                    <td style={S.td}>{j.started}</td>
                    <td style={{ ...S.td, color: '#0f172a' }}>{j.name}</td>
                    <td style={S.td}>{j.source}</td>
                    <td style={S.td}>{j.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={STATUSES}
            isActive={status !== 'All'}
            onClear={() => { setStatus('All'); setPage(1); }}
          />
          <FilterSelect
            label="Type"
            value={type}
            onChange={(v) => { setType(v); setPage(1); }}
            options={TYPES}
            isActive={type !== 'All types'}
            onClear={() => { setType('All types'); setPage(1); }}
          />
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
              {loadError ? (
                <tr><td colSpan={8} style={{ ...S.emptyTableCell, color: '#991b1b' }}>{loadError}</td></tr>
              ) : loading && pageRows.length === 0 ? (
                <tr><td colSpan={8} style={S.emptyTableCell}>Loading publications…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={8} style={S.emptyTableCell}>No publishing history matches your filters.</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id || r.uploadId} style={S.tr} onClick={() => setSelectedJob(r)}>
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
      <JobDetailDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onChanged={refresh}
      />

      <ConfirmModal
        open={cleanOpen}
        title="Clean all reports"
        body="All reports will be deleted. This action cannot be undone. This will not cancel jobs in progress or scheduled."
        confirmLabel="Clean"
        onCancel={() => setCleanOpen(false)}
        onConfirm={async () => {
          try {
            await api.post('/publications/clean');
            setCleanOpen(false);
            refresh();
          } catch (e) {
            console.error('Failed to clean history:', e);
            setCleanOpen(false);
          }
        }}
      />

      <PublishContentModal
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onPublished={() => {
          setPublishOpen(false);
          refresh();
        }}
      />
    </AdminShell>
  );
}

// ── Sortable column header ─────────────────────────────────────────────────
// Outlined-select filter used in the History toolbar. The label sits as a
// "notch" on the top border (Material Outlined style) so the field height
// matches the search/date inputs next to it. When `isActive` is true (i.e.
// the user has narrowed the filter away from "All") we tint the border and
// expose a small × clear button so it's obvious a filter is on.
function FilterSelect({ label, value, onChange, options, optionLabel, isActive, onClear }) {
  const [focused, setFocused] = useState(false);
  const accent = '#a21caf';
  const borderColor = focused || isActive ? accent : '#e2e8f0';
  const labelColor  = focused || isActive ? accent : '#64748b';
  const labelFor = (o) => (typeof optionLabel === 'function' ? optionLabel(o) : (o || ''));

  return (
    <div style={{ ...S.selectField, borderColor }}>
      <span style={{ ...S.floatLabel, color: labelColor }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...S.select, fontWeight: isActive ? 600 : 500, color: isActive ? accent : '#0f172a' }}
      >
        {options.map((o) => <option key={String(o)} value={o}>{labelFor(o)}</option>)}
      </select>
      {isActive && onClear ? (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
          onMouseDown={(e) => e.preventDefault()}
          style={S.selectClear}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6"  y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : null}
      <span aria-hidden="true" style={S.selectChevron}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

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
//
// The Source dropdown is populated from /api/sources (the same list driving
// the Knowledge-Hub Sources admin page). When no Source has been configured
// yet we render an empty-state link to /admin/khub/sources so the publisher
// can hop over and create one without leaving the flow guess-bound.

// Only .zip uploads flow through /api/publications — single-file ingest still
// goes through the legacy /api/ingest/upload endpoint via the portal Upload-
// document dialog, so we don't allow ad-hoc HTML/DOCX here.
const PUBLISH_ACCEPT = '.zip';
const PUBLISH_ACCEPT_DESCRIPTION = 'Drop a .zip export from your authoring tool';

function PublishContentModal({ open, onCancel, onPublished }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('');
  // Optional: id of an existing Publication this upload should
  // diff-merge into. Empty = fresh publish (default behaviour). The
  // dropdown is populated from /publications/replaceable filtered by
  // the picked source so a user can't merge a Paligo zip into a
  // generic-source publication.
  const [replaces, setReplaces] = useState('');
  const [replaceables, setReplaceables] = useState([]);
  const [replaceablesLoading, setReplaceablesLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setFile(null); setSource(''); setReplaces(''); setReplaceables([]);
    setDragOver(false); setError(''); setAuthExpired(false); setUploading(false);

    let cancelled = false;
    setSourcesLoading(true);
    setSourcesError('');
    api.get('/sources')
      .then((data) => {
        if (cancelled) return;
        setSources(data?.items || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setSourcesError(err?.message || 'Failed to load sources');
      })
      .finally(() => { if (!cancelled) setSourcesLoading(false); });

    const onKey = (e) => { if (e.key === 'Escape' && !uploading) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Whenever the user changes the source (or first picks one), refresh
  // the "Publish as new version of" dropdown. Resetting `replaces` here
  // is intentional: a target only makes sense within the picked source,
  // and we'd otherwise carry stale state across selections.
  useEffect(() => {
    if (!open) return undefined;
    setReplaces('');
    setReplaceables([]);
    if (!source) return undefined;
    let cancelled = false;
    setReplaceablesLoading(true);
    api.get(`/publications/replaceable?source=${encodeURIComponent(source)}`)
      .then((data) => {
        if (cancelled) return;
        setReplaceables(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => { if (!cancelled) setReplaceables([]); })
      .finally(() => { if (!cancelled) setReplaceablesLoading(false); });
    return () => { cancelled = true; };
  }, [open, source]);

  if (!open) return null;

  const valid = !!file && !!source && !uploading;
  const pickedReplacement = replaces ? replaceables.find((r) => r.id === replaces) : null;

  // /api/publications only accepts .zip — anything else gets rejected by
  // the backend with a 400, but we surface a friendlier error up-front.
  const ACCEPT_RX = /\.zip$/i;
  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPT_RX.test(f.name)) {
      setError('Only .zip uploads are supported. ' + PUBLISH_ACCEPT_DESCRIPTION + '.');
      return;
    }
    setError('');
    setFile(f);
  };

  // Upload to the raw S3 bucket via /api/publications. Extraction is a
  // separate step the user kicks off from the drawer; this just persists the
  // zip + creates the Publication row so the History list shows it as
  // "Running" immediately.
  const handlePublish = async () => {
    if (!valid) return;
    setUploading(true);
    setError('');
    setAuthExpired(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source', source);
      if (replaces) fd.append('replaces', replaces);
      const data = await api.upload('/publications', fd);
      onPublished?.({ file, source, publication: data?.publication });
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
              disabled={uploading || sourcesLoading || sources.length === 0}
              onChange={(e) => setSource(e.target.value)}
              style={{
                width: '100%', padding: '10px 28px 10px 12px',
                border: '1px solid #cbd5e1', borderRadius: '4px',
                background: '#fff', fontSize: '0.92rem', color: source ? '#0f172a' : '#94a3b8',
                fontFamily: 'var(--font-sans)', outline: 'none',
                appearance: 'none',
                cursor: (uploading || sourcesLoading || sources.length === 0) ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <option value="">
                {sourcesLoading ? 'Loading sources…' : 'Select a source'}
              </option>
              {sources.map((s) => {
                // Compose a Darwinbox-style "Name — description" label so the
                // operator can pick the right Source even when several share
                // the same connector type. Falls back to just the name.
                const label = s.description ? `${s.name} — ${s.description}` : s.name;
                return <option key={s.id} value={s.sourceId}>{label}</option>;
              })}
            </select>
            <span aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>▾</span>
          </div>

          {!sourcesLoading && !sourcesError && sources.length === 0 && (
            <div role="status" style={{
              padding: '10px 12px',
              background: '#fffbeb', color: '#92400e',
              border: '1px solid #fde68a', borderRadius: '6px',
              fontSize: '0.85rem',
            }}>
              No sources configured yet.{' '}
              <a
                href="/admin/khub/sources"
                style={{ color: '#a21caf', textDecoration: 'underline', fontWeight: 600 }}
              >
                Configure a source first
              </a>
              {' '}before publishing content.
            </div>
          )}

          {/* "Publish as new version of" dropdown — only meaningful once the
              source has been picked AND there's at least one prior validated
              publication under that source. Otherwise we hide the row entirely
              to keep the modal focussed on the common (fresh-publish) path. */}
          {source && (replaceablesLoading || replaceables.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="publish-replaces" style={{
                fontSize: '0.78rem', color: '#475569', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Publish as new version of
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  id="publish-replaces"
                  value={replaces}
                  disabled={uploading || replaceablesLoading}
                  onChange={(e) => setReplaces(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 28px 10px 12px',
                    border: '1px solid #cbd5e1', borderRadius: '4px',
                    background: '#fff', fontSize: '0.92rem', color: replaces ? '#0f172a' : '#94a3b8',
                    fontFamily: 'var(--font-sans)', outline: 'none',
                    appearance: 'none',
                    cursor: (uploading || replaceablesLoading) ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box',
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  <option value="">
                    {replaceablesLoading ? 'Loading existing publications…' : '(None — publish as a new document)'}
                  </option>
                  {replaceables.map((r) => {
                    const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
                    const label = `${r.name || r.originalFilename}${when ? ` — ${when}` : ''}`;
                    return <option key={r.id} value={r.id}>{label}</option>;
                  })}
                </select>
                <span aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>▾</span>
              </div>
              {pickedReplacement && (
                <div role="note" style={{
                  padding: '10px 12px',
                  background: '#eff6ff', color: '#1e40af',
                  border: '1px solid #bfdbfe', borderRadius: '6px',
                  fontSize: '0.82rem', lineHeight: 1.5,
                }}>
                  Topics that match the existing publication will reuse their bookmarks, ratings, and pretty URLs.
                  New topics will be added; missing topics will be removed.
                </div>
              )}
            </div>
          )}
          {sourcesError && (
            <div role="alert" style={{
              padding: '10px 12px',
              background: '#fef2f2', color: '#991b1b',
              border: '1px solid #fecaca', borderRadius: '6px',
              fontSize: '0.85rem',
            }}>
              Couldn&apos;t load sources: {sourcesError}
            </div>
          )}

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
// Pulls full publication detail + paginated logs from the API every time the
// drawer opens or `refreshKey` bumps. Surfaces Extract / Validate / Retry
// actions that hit the backend worker pipeline, plus Download archive +
// Download logs which use presigned S3 URLs.
function JobDetailDrawer({ job, onClose, onChanged }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pubFilter, setPubFilter] = useState('');

  const [pub, setPub]       = useState(null);
  const [logs, setLogs]     = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [busyAction, setBusyAction] = useState('');     // '' | 'delete'
  const [tick, setTick] = useState(0);                  // local refresh counter

  const open = !!job;
  const id   = job?.id || job?.uploadId;

  // Fetch detail + first page of logs whenever the drawer opens for a new
  // publication, or when the user kicks off another action that mutates state.
  useEffect(() => {
    if (!open || !id) return undefined;
    let cancelled = false;
    setDrawerLoading(true);
    setDrawerError('');
    Promise.all([
      api.get(`/publications/${id}`),
      api.get(`/publications/${id}/logs?limit=200`),
    ])
      .then(([detailRes, logsRes]) => {
        if (cancelled) return;
        setPub(detailRes?.publication || null);
        setLogs(Array.isArray(logsRes?.items) ? logsRes.items : []);
        setLogTotal(typeof logsRes?.total === 'number' ? logsRes.total : 0);
      })
      .catch((e) => { if (!cancelled) setDrawerError(e?.message || 'Failed to load publication'); })
      .finally(() => { if (!cancelled) setDrawerLoading(false); });

    return () => { cancelled = true; };
  }, [open, id, tick]);

  // Poll while a worker is still in flight so the user sees logs stream in
  // without having to manually refresh. 4s feels right — the worker emits a
  // progress message every ~25 entries so 4s gives a steady drip-feed.
  useEffect(() => {
    if (!open) return undefined;
    const inflight = pub?.status === 'extracting' || pub?.status === 'validating' || pub?.status === 'uploaded';
    if (!inflight) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [open, pub?.status]);

  const reload = () => setTick((n) => n + 1);

  const triggerDelete = async () => {
    if (!id) return;
    setBusyAction('delete');
    try {
      await api.delete(`/publications/${id}`);
      setCancelOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      setDrawerError(e?.message || 'Delete failed');
    } finally { setBusyAction(''); }
  };

  const downloadArchive = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/publications/${id}/archive`);
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    } catch (e) {
      setDrawerError(e?.message || 'Could not generate archive URL');
    }
  };

  const downloadLogs = () => {
    if (!id) return;
    // Same-origin via the Next rewrite proxy, plus the auth header — easiest
    // is a fetch + blob since we can't add Authorization to a plain <a>.
    const token = (typeof window !== 'undefined')
      ? (sessionStorage.getItem('ft_token') || localStorage.getItem('ft_token'))
      : null;
    fetch(`/api/publications/${id}/logs.txt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob().then((blob) => ({ blob, ok: r.ok })))
      .then(({ blob, ok }) => {
        if (!ok) throw new Error('Could not download logs');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `publication-${id}-logs.txt`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setDrawerError(e?.message || 'Could not download logs'));
  };

  // Filter the logs table by level if the user picked a status from the
  // Publications row's per-status filter. Mapping mirrors the page-level one.
  const visibleLogs = useMemo(() => {
    if (!pubFilter) return logs;
    const map = { Success: 'info', Warning: 'warn', Error: 'error' };
    const want = map[pubFilter];
    return want ? logs.filter((l) => l.level === want) : logs;
  }, [logs, pubFilter]);

  // Status badge text — distinct from the small icon kind used in the table.
  const statusBadge = (() => {
    if (!pub) return { text: 'PENDING', color: '#475569', kind: 'queued' };
    if (pub.status === 'failed')      return { text: 'FAILED',   color: '#dc2626', kind: 'err'  };
    if (pub.status === 'extracting')  return { text: 'EXTRACTING', color: '#1d4ed8', kind: 'run' };
    if (pub.status === 'validating')  return { text: 'VALIDATING', color: '#1d4ed8', kind: 'run' };
    if (pub.status === 'uploaded')    return { text: 'UPLOADED',   color: '#475569', kind: 'queued' };
    if ((pub.counts?.error ?? 0) > 0) return { text: 'ERROR',    color: '#dc2626', kind: 'err'  };
    if ((pub.counts?.warn  ?? 0) > 0) return { text: 'WARNING',  color: '#b45309', kind: 'warn' };
    return { text: 'DONE', color: '#16a34a', kind: 'ok' };
  })();

  return (
    <>
      <RightDrawer open={open} title={job?.name || pub?.originalFilename || ''} width={640} onClose={onClose}>
        {open && (
          <>
            {drawerError && (
              <div role="alert" style={{
                padding: '10px 12px',
                background: '#fef2f2', color: '#991b1b',
                border: '1px solid #fecaca', borderRadius: '6px',
                fontSize: '0.85rem', marginBottom: '16px',
              }}>
                {drawerError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <StatusIcon kind={statusBadge.kind} />
                <span style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.8rem', color: statusBadge.color }}>
                  {statusBadge.text}
                </span>
              </span>

              <button type="button" style={{ ...S.linkBtn, padding: '6px 12px', fontSize: '0.85rem', color: '#dc2626' }}
                onClick={() => setCancelOpen(true)}>
                Delete
              </button>

              {pub?.documentId && (
                <a
                  href={hrefForDoc({ _id: pub.documentId, prettyUrl: pub.documentPrettyUrl || '' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...S.linkBtn, padding: '6px 12px', fontSize: '0.85rem', marginLeft: 'auto', textDecoration: 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span>Open in portal</span>
                </a>
              )}

              <button type="button" style={{ ...S.linkBtn, padding: '6px 12px', fontSize: '0.85rem', marginLeft: pub?.documentId ? undefined : 'auto' }}
                onClick={downloadArchive}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download archive</span>
              </button>
            </div>

            <div style={S.infoGrid}>
              <InfoCell label="UploadID:"   value={id} copyable />
              <InfoCell label="Duration:"   value={pub?.timings ? formatDuration(pub.timings) || '—' : '—'} />
              <InfoCell label="Uploaded by:" value={pub?.uploadedBy?.name || pub?.uploadedBy?.email || job?.user || '—'} />
              <InfoCell label="Source:"     value={pub?.sourceLabel || job?.source || '—'} />
              <InfoCell label="Files:"      value={String(pub?.extracted?.fileCount ?? job?.publications ?? 0)} />
              <InfoCell label="Size:"       value={formatBytes(pub?.sizeBytes)} />
            </div>

            {/* dedupeMode pill: surfaces what the incremental pipeline did
                on this publish (skipped extract/validate, merged into an
                existing doc, or full fresh run). */}
            {pub?.dedupeMode && pub.dedupeMode !== 'fresh' && (
              <DedupePill mode={pub.dedupeMode} replaces={pub.replacesSummary} />
            )}

            {/* Version chain: rendered only for documents that have been
                re-published at least once (versionHistory length > 1, or
                a single non-fresh entry). The most recent ingest sits at
                the top of the list. */}
            {Array.isArray(pub?.documentVersionHistory) && pub.documentVersionHistory.length > 0 && (
              <VersionChainSection
                history={pub.documentVersionHistory}
                currentPublicationId={pub.id}
              />
            )}

            <div style={{ marginTop: '24px' }}>
              <div style={S.drawerSectionHeader}>
                <h3 style={S.drawerSectionTitle}>Publications</h3>
                <div style={{ minWidth: '240px' }}>
                  <FilterSelect
                    label="Filter logs by Status"
                    value={pubFilter}
                    onChange={(v) => setPubFilter(v)}
                    options={['', ...STATUSES.filter((s) => s !== 'All' && s !== 'Running')]}
                    optionLabel={(v) => (v === '' ? 'Any' : v)}
                    isActive={!!pubFilter}
                    onClear={() => setPubFilter('')}
                  />
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
                    {pub ? (
                      <tr style={S.tr}>
                        <td style={S.td}><StatusIcon kind={statusBadge.kind} /></td>
                        <td style={{ ...S.td, color: '#0f172a' }}>{pub.name || pub.originalFilename}</td>
                        <td style={S.td}>{String(pub.id || id).slice(-12).toUpperCase()}</td>
                      </tr>
                    ) : (
                      <tr><td colSpan={3} style={S.emptyTableCell}>{drawerLoading ? 'Loading…' : 'No publication detail'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={S.drawerSectionTitle}>General logs</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', margin: '8px 0 12px' }}>
                <span style={{ fontSize: '0.88rem', color: '#475569' }}>
                  To access specific publication logs, use the table above. {logTotal ? `(${logTotal} entries)` : ''}
                </span>
                <button type="button" style={S.linkBtn} onClick={downloadLogs}>
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
                    {visibleLogs.length === 0 ? (
                      <tr><td colSpan={2} style={S.emptyTableCell}>{drawerLoading ? 'Loading…' : 'No logs for this report'}</td></tr>
                    ) : visibleLogs.map((l) => (
                      <tr key={l._id || `${l.timestamp}-${l.message}`} style={{
                        ...S.tr,
                        background: l.level === 'error' ? '#fef2f2' : l.level === 'warn' ? '#fefce8' : '#fff',
                      }}>
                        <td style={{ ...S.td, color: '#475569', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                          <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                            .{String(new Date(l.timestamp).getMilliseconds()).padStart(3, '0')}
                          </span>
                        </td>
                        <td style={{
                          ...S.td,
                          color: l.level === 'error' ? '#991b1b' : l.level === 'warn' ? '#92400e' : '#475569',
                          whiteSpace: 'normal',
                        }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <LevelDot level={l.level} />
                            <span>{l.message}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </RightDrawer>

      <ConfirmModal
        open={cancelOpen}
        title="Delete this publication?"
        body="The original archive, all extracted files, and every log entry will be removed. This cannot be undone."
        cancelLabel="Keep"
        confirmLabel={busyAction === 'delete' ? 'Deleting…' : 'Delete'}
        onCancel={() => setCancelOpen(false)}
        onConfirm={triggerDelete}
      />
    </>
  );
}

function LevelDot({ level }) {
  const color = level === 'error' ? '#dc2626' : level === 'warn' ? '#d97706' : '#94a3b8';
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', width: '8px', height: '8px',
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  );
}

function formatBytes(n) {
  if (!n || !Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// ── Incremental-pipeline UI helpers ────────────────────────────────────────
//
// `DedupePill` renders a small status badge that explains what the pipeline
// reused on this run. We deliberately render NOTHING for the 'fresh' case
// (handled by the parent's conditional) so we don't clutter the drawer for
// the common first-publish path.
function DedupePill({ mode, replaces }) {
  const variants = {
    'reused-zip': {
      label: 'Skipped extract + validate (identical zip)',
      bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46',
    },
    'reused-validation': {
      label: 'Used cached validation summary',
      bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af',
    },
    'reused-document': {
      label: 'Merged into existing document',
      bg: '#fef3c7', border: '#fde68a', fg: '#92400e',
    },
  };
  const v = variants[mode];
  if (!v) return null;
  return (
    <div style={{
      marginTop: '14px',
      padding: '10px 12px',
      background: v.bg, color: v.fg, border: `1px solid ${v.border}`,
      borderRadius: '6px', fontSize: '0.85rem',
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <strong>{v.label}</strong>
      {replaces && (
        <span style={{ opacity: 0.85 }}>
          (was {replaces.name || replaces.originalFilename}
          {replaces.createdAt ? ` — ${new Date(replaces.createdAt).toLocaleDateString()}` : ''})
        </span>
      )}
    </div>
  );
}

// `VersionChainSection` renders Document.versionHistory in reverse-chrono
// order. Each row shows the per-version add/update/remove counters that
// the diff-ingest path emits, so a publisher can answer "which release
// actually changed Topic X" without leaving the drawer.
function VersionChainSection({ history, currentPublicationId }) {
  const ordered = useMemo(() => {
    return [...history].sort((a, b) => {
      const aTime = a.ingestedAt ? new Date(a.ingestedAt).getTime() : 0;
      const bTime = b.ingestedAt ? new Date(b.ingestedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [history]);
  if (!ordered.length) return null;
  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={S.drawerSectionTitle}>Version chain</h3>
      <div style={{ ...S.tableWrap, marginTop: '8px' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '70px' }}>Version</th>
              <th style={{ ...S.th, width: '170px' }}>Ingested</th>
              <th style={S.th}>Topics</th>
              <th style={{ ...S.th, width: '170px' }}>Mode</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((entry, idx) => {
              const versionNumber = ordered.length - idx;
              const isCurrent = entry.publicationId
                && currentPublicationId
                && String(entry.publicationId) === String(currentPublicationId);
              const ts = entry.ingestedAt ? new Date(entry.ingestedAt).toLocaleString() : '—';
              return (
                <tr key={`${entry.publicationId || idx}-${idx}`} style={{
                  ...S.tr,
                  background: isCurrent ? '#fef9c3' : undefined,
                }}>
                  <td style={{ ...S.td, fontWeight: 600 }}>V{versionNumber}{isCurrent ? ' ★' : ''}</td>
                  <td style={S.td}>{ts}</td>
                  <td style={S.td}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>+{entry.topicsAdded || 0}</span>{' '}
                    <span style={{ color: '#0369a1', fontWeight: 600 }}>~{entry.topicsUpdated || 0}</span>{' '}
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>-{entry.topicsRemoved || 0}</span>{' '}
                    <span style={{ color: '#64748b' }}>={entry.topicsKept || 0}</span>
                  </td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: '#475569', fontWeight: 600,
                    }}>
                      {entry.dedupeMode || 'fresh'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
    flex: 1,
    padding: '8px 44px 8px 4px',
    border: 'none', outline: 'none',
    background: 'transparent',
    fontSize: '0.85rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)',
    appearance: 'none',
    cursor: 'pointer',
    fontWeight: 500,
  },
  selectField: {
    position: 'relative', display: 'flex', alignItems: 'center',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    padding: '0 10px',
    transition: 'border-color 120ms ease',
  },
  // "Notched" outlined label: sits across the top border so the field
  // height stays the same as Search/Date inputs alongside it. The bg
  // colour matches the surrounding card so the border looks broken
  // exactly where the label is.
  floatLabel: {
    position: 'absolute',
    top: '-7px', left: '8px',
    padding: '0 6px',
    background: '#fff',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#64748b',
    pointerEvents: 'none',
    lineHeight: 1,
  },
  selectChevron: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#64748b',
    pointerEvents: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  // Inline × button shown when an "active" filter is set. Sits to the
  // left of the chevron so the user can clear without having to open
  // the menu and re-pick "All".
  selectClear: {
    position: 'absolute',
    right: '32px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '18px', height: '18px',
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: '#a21caf',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
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
