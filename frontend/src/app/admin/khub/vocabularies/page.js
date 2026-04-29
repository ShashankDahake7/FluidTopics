'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api, { getStoredToken } from '@/lib/api';

// File picker constraints — RDF / SKOS / CSV. Server-side detection re-checks
// based on extension; this is just a polite browser hint.
const FILE_ACCEPT = '.rdf,.csv,.xml,.owl,.ttl,.nt,.jsonld,application/rdf+xml,text/csv,application/xml';
const VALID_EXT = /\.(rdf|csv|xml|owl|ttl|nt|jsonld)$/i;

// Translate the API row into the shape the UI was originally designed
// against (`SEED_VOCABULARIES` had `id`/`languages`/`author`/`updatedAt`).
// We keep `dbId` for API calls and surface `id` as the slug so the rest of
// the component reads naturally.
function toUiRow(api) {
  return {
    dbId: api.id,
    id: api.name,
    displayName: api.displayName || api.name,
    format: api.format,
    sourceFilename: api.sourceFilename || '',
    usedInSearch: !!api.usedInSearch,
    languages: api.languages || [],
    author: api.updatedByName || api.createdByName || '—',
    updatedAt: api.updatedAt
      ? new Date(api.updatedAt).toLocaleString('en-US', {
          month: '2-digit', day: '2-digit', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        })
      : '',
    updatedSinceReprocess: !!api.updatedSinceReprocess,
    status: api.status,
    parseError: api.parseError || '',
  };
}

function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function VocabulariesPage() {
  const [rows, setRows]               = useState([]);
  const [config, setConfig]           = useState({ lastFullReprocessAt: null, lastFullReprocessByName: null, pendingReprocess: false });
  const [loading, setLoading]         = useState(true);
  const [busy, setBusy]               = useState(false);
  const [query, setQuery]             = useState('');
  const [sortKey, setSortKey]         = useState('id');
  const [sortDir, setSortDir]         = useState('asc');
  const [createOpen, setCreateOpen]   = useState(false);
  const [confirm, setConfirm]         = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pageError, setPageError]     = useState('');
  const [pageWarnings, setPageWarnings] = useState([]);
  const [dragOver, setDragOver]       = useState(false);
  const [job, setJob]                 = useState(null);
  const popoverRef = useRef(null);
  const pollRef    = useRef(null);

  // ── data loading ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await api.get('/vocabularies');
      const items = (res?.items || []).map(toUiRow);
      setRows(items);
      setConfig(res?.config || { lastFullReprocessAt: null, lastFullReprocessByName: null, pendingReprocess: false });
      // Resume polling if the server reported a worker was still in flight.
      if (res?.config?.runningJob) setJob(res.config.runningJob);
    } catch (e) {
      setPageError(e?.message || 'Failed to load vocabularies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // ── reprocess job polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!job?.id) return undefined;
    if (job.status === 'done' || job.status === 'failed') {
      // Refetch once the worker reports completion so the dot + footer
      // timestamp reflect the new state.
      refetch();
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/vocabularies/jobs/${job.id}`);
        if (res?.job) setJob(res.job);
      } catch (_) { /* keep polling on transient errors */ }
    }, 1000);
    return () => clearInterval(pollRef.current);
  }, [job?.id, job?.status, refetch]);

  useEffect(() => {
    if (!popoverOpen) return undefined;
    const onClick = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopoverOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPopoverOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [popoverOpen]);

  // ── derived rows ────────────────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = !q ? rows : rows.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.languages.some((l) => l.toLowerCase().includes(q))
    );
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === 'desc') list.reverse();
    return list;
  }, [rows, query, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── mutations ───────────────────────────────────────────────────────────
  const handlePageDrop = (file) => {
    if (!file) return;
    if (!VALID_EXT.test(file.name)) { setPageError('Unsupported vocabulary file type'); return; }
    setPageError('');
    setCreateOpen({ file });
  };

  const upsertVocabulary = async ({ id, usedInSearch, file, editing }) => {
    setBusy(true);
    setPageError('');
    setPageWarnings([]);
    try {
      let res;
      if (editing) {
        if (file) {
          // File replacement → multipart PATCH carries displayName/usedInSearch
          // alongside the new file.
          const fd = new FormData();
          fd.append('file', file);
          fd.append('displayName', id || editing.displayName);
          fd.append('usedInSearch', usedInSearch ? 'true' : 'false');
          res = await api.uploadPatch(`/vocabularies/${editing.dbId}`, fd);
        } else {
          res = await api.patch(`/vocabularies/${editing.dbId}`, {
            displayName: id || editing.displayName,
            usedInSearch,
          });
        }
      } else {
        if (!file) throw new Error('Please choose a vocabulary file.');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', id);
        fd.append('displayName', id);
        fd.append('usedInSearch', usedInSearch ? 'true' : 'false');
        res = await api.upload('/vocabularies', fd);
      }
      if (Array.isArray(res?.warnings) && res.warnings.length) {
        setPageWarnings(res.warnings.slice(0, 5));
      }
      setCreateOpen(false);
      await refetch();
    } catch (e) {
      // Stay on the modal so the admin can fix and retry — surface the
      // error inline at the page level too.
      setPageError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteVocabulary = async (row) => {
    setBusy(true);
    setPageError('');
    try {
      await api.delete(`/vocabularies/${row.dbId}`);
      await refetch();
    } catch (e) {
      setPageError(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadExample = () => {
    const csv = 'id,label,language,synonyms\nproduct.cloud,Cloud,en,"saas;hosted"\nproduct.cloud,Cloud,fr,"infonuagique"\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vocabulary-example.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadOriginal = async (row) => {
    setPageError('');
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/vocabularies/${row.dbId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      a.href = url;
      a.download = m ? m[1] : (row.sourceFilename || `${row.id}.${row.format === 'csv' ? 'csv' : 'rdf'}`);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPageError(e?.message || 'Download failed');
    }
  };

  const onReprocess = async () => {
    setPageError('');
    try {
      const res = await api.post('/vocabularies/reprocess');
      if (res?.job) setJob(res.job);
    } catch (e) {
      setPageError(e?.message || 'Failed to start reprocess');
    }
  };

  // ── progress strip helpers ──────────────────────────────────────────────
  const showProgress = job && (job.status === 'queued' || job.status === 'running');
  const progressLabel = job && job.total
    ? `Reprocessing ${(job.processed || 0).toLocaleString()} / ${job.total.toLocaleString()} topics${job.errorCount ? ` — ${job.errorCount} error${job.errorCount === 1 ? '' : 's'}` : ''}`
    : 'Reprocessing started…';

  return (
    <AdminShell active="khub-vocab" allowedRoles={['superadmin']} fullWidth>
      <div style={S.page}>
        <header style={S.headerRow}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={S.titleLine}>
              <h1 style={S.h1}>Vocabularies</h1>
              <div ref={popoverRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={popoverOpen}
                  aria-label="More information"
                  onClick={() => setPopoverOpen((v) => !v)}
                  style={S.infoBtn}
                  title="More information"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8"  x2="12.01" y2="8" />
                  </svg>
                </button>
                {popoverOpen && (
                  <div role="dialog" style={S.popoverPanel}>
                    See{' '}
                    <a
                      href="https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Knowledge-Hub/Vocabularies"
                      target="_blank" rel="noreferrer"
                      style={S.link}
                    >the vocabularies documentation</a>.
                  </div>
                )}
              </div>
            </div>
            <p style={S.subtitle}>
              Upload vocabularies to normalize metadata or to manage synonyms for more relevant search results.
            </p>
          </div>
          <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" style={S.tertiaryBtn} onClick={downloadExample}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download an example</span>
            </button>
            <button type="button" style={S.primaryBtn} onClick={() => setCreateOpen({ file: null })} disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5"  y1="12" x2="19" y2="12" />
              </svg>
              <span>New vocabulary</span>
            </button>
          </div>
        </header>

        {showProgress && (
          <div role="status" style={S.progressBar}>
            <span style={S.progressDot} />
            <span>{progressLabel}</span>
          </div>
        )}

        {pageWarnings.length > 0 && (
          <div role="status" style={S.warningBar}>
            <strong>Vocabulary saved with warnings:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {pageWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div
          style={{
            ...S.fileDropArea,
            background: dragOver ? '#fdf2f8' : '#fff',
            borderColor: dragOver ? '#a21caf' : '#e2e8f0',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handlePageDrop(e.dataTransfer.files?.[0]); }}
        >
          {dragOver && (
            <div style={S.dropOverlay}>
              <span style={S.dropChip}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Drop your file here
              </span>
            </div>
          )}

          {pageError && (
            <div role="alert" style={S.errorChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
              </svg>
              {pageError}
            </div>
          )}

          <div style={S.searchRow}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search for a term"
                placeholder="Search for a term"
                style={S.searchInput}
              />
            </div>
            <button type="button" aria-label="Search" style={{ ...S.primaryBtn, padding: '10px 12px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <SortableTh label="ID"          sortKey="id"        cur={sortKey} dir={sortDir} onSort={onSort} />
                  <Th width="130px">Used in search</Th>
                  <Th>Languages</Th>
                  <SortableTh label="Author"      sortKey="author"    cur={sortKey} dir={sortDir} onSort={onSort} />
                  <SortableTh
                    label="Last update"
                    sortKey="updatedAt"
                    cur={sortKey} dir={sortDir} onSort={onSort}
                    width="180px"
                    extra={(
                      <span title='Vocabularies that have been added or updated since last full reprocess. Running a reprocess might be necessary.' style={S.thHint}>ⓘ</span>
                    )}
                  />
                  <Th width="160px" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={S.emptyCell}>Loading vocabularies…</td>
                  </tr>
                ) : filteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={S.emptyCell}>
                      <div style={S.emptyInner}>
                        <EmptyIllustration />
                        <span style={S.emptyText}>No vocabularies to display</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSorted.map((r) => (
                  <tr key={r.dbId} style={S.tr}>
                    <td style={S.td}>
                      {r.id}
                      {r.updatedSinceReprocess && (
                        <span title="Updated since last reprocess. Running a reprocess might be necessary." style={S.dotChip} aria-label="updated since last reprocess">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="12" r="6" />
                          </svg>
                        </span>
                      )}
                      {r.status === 'failed' && (
                        <span title={r.parseError || 'Parse failed'} style={{ ...S.dotChip, color: '#b91c1c' }}>!</span>
                      )}
                    </td>
                    <td style={S.td}>
                      {r.usedInSearch ? (
                        <span style={S.checkPill} aria-label="Used in search">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
                        {r.languages.map((l) => (
                          <span key={l} style={S.langChip}>{(l || '*').toUpperCase()}</span>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>{r.author}</td>
                    <td style={S.td}>{r.updatedAt}</td>
                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <IconBtn title="Download original" onClick={() => downloadOriginal(r)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </IconBtn>
                      <IconBtn title="Edit vocabulary" onClick={() => setCreateOpen({ file: null, edit: r })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                        </svg>
                      </IconBtn>
                      <IconBtn title="Delete vocabulary" onClick={() => setConfirm({ kind: 'delete', row: r })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                        </svg>
                      </IconBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer style={S.footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button
              type="button"
              onClick={onReprocess}
              disabled={busy || showProgress}
              style={{
                ...S.tertiaryBtn,
                color: '#a21caf', border: '1px solid #a21caf',
                opacity: (busy || showProgress) ? 0.55 : 1,
                cursor: (busy || showProgress) ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Reprocess</span>
            </button>
            {config.pendingReprocess && !showProgress && (
              <span style={{ fontSize: '0.78rem', color: '#a21caf' }}>
                Pending changes — running a reprocess will apply them across the corpus.
              </span>
            )}
          </div>
          <span style={{ color: '#475569' }}>
            {config.lastFullReprocessByName
              ? <>Last full reprocess by {config.lastFullReprocessByName}</>
              : 'Never reprocessed'}
          </span>
          {config.lastFullReprocessAt && (
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatTimestamp(config.lastFullReprocessAt)}</span>
          )}
        </footer>
      </div>

      {createOpen && (
        <CreateVocabularyModal
          open={!!createOpen}
          initialFile={createOpen.file || null}
          editing={createOpen.edit || null}
          existingIds={rows.map((r) => r.id)}
          busy={busy}
          onCancel={() => setCreateOpen(false)}
          onSave={upsertVocabulary}
        />
      )}

      <ConfirmDeleteModal
        open={confirm?.kind === 'delete'}
        title={confirm?.row ? `Delete "${confirm.row.id}"?` : ''}
        body="This action cannot be undone. Running a reprocess might be necessary to stop applying the vocabulary to documents."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.row) await deleteVocabulary(confirm.row);
          setConfirm(null);
        }}
      />
    </AdminShell>
  );
}

// ── Create/Edit modal ──────────────────────────────────────────────────────
function CreateVocabularyModal({ open, initialFile, editing, existingIds, busy, onCancel, onSave }) {
  const [file, setFile]              = useState(initialFile || null);
  const [id, setId]                  = useState(editing?.id || '');
  const [usedInSearch, setUsedInSearch] = useState(editing?.usedInSearch || false);
  const [error, setError]            = useState('');
  const [dragOver, setDragOver]      = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setFile(initialFile || null);
    setId(editing?.id || '');
    setUsedInSearch(editing?.usedInSearch || false);
    setError('');
    setDragOver(false);
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, initialFile, editing, onCancel]);

  if (!open) return null;

  const isEdit = !!editing;
  const idTrim = id.trim();
  const idClash = !isEdit && existingIds.includes(idTrim.toLowerCase());
  // For edit: file optional. For create: file required.
  const valid  = (isEdit ? !!idTrim : (!!file && idTrim && !idClash)) && !busy;

  const pickFile = (f) => {
    if (!f) return;
    if (!VALID_EXT.test(f.name)) { setError('Unsupported vocabulary file type'); return; }
    setError('');
    setFile(f);
    if (!id && !isEdit) {
      const base = f.name.replace(/\.[^/.]+$/, '');
      setId(base.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase());
    }
  };

  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit vocabulary' : 'Create a new vocabulary'}
        onClick={(e) => e.stopPropagation()}
        style={{ ...S.modalDialog, width: 'min(560px, 100%)' }}
      >
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{isEdit ? `Edit vocabulary — ${editing.id}` : 'Create a new vocabulary'}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>
            {isEdit ? 'Replace vocabulary file (optional):' : 'Upload vocabulary file:'}
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            style={{
              border: `1px dashed ${dragOver ? '#a21caf' : '#cbd5e1'}`,
              background: dragOver ? '#fdf2f8' : '#f8fafc',
              borderRadius: '6px', padding: '24px 16px',
              textAlign: 'center', cursor: 'pointer',
              fontSize: '0.9rem', color: '#475569',
            }}
          >
            {file ? (
              <span>
                <strong style={{ color: '#0f172a' }}>{file.name}</strong>{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  style={{ marginLeft: '6px', background: 'transparent', border: 'none', color: '#a21caf', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Remove
                </button>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {isEdit
                  ? <>Drop a new file or <span style={{ color: '#a21caf', textDecoration: 'underline' }}>click to browse</span> (keeps current file if empty)</>
                  : <>Drop a vocabulary file or <span style={{ color: '#a21caf', textDecoration: 'underline' }}>click to browse</span></>
                }
              </span>
            )}
            <input ref={fileRef} type="file" accept={FILE_ACCEPT} hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </div>
          {error && <div role="alert" style={{ ...S.errorChip, alignSelf: 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
            </svg>
            {error}
          </div>}

          <FloatField label="ID" disabled={isEdit}>
            <input
              type="text"
              value={id}
              disabled={isEdit}
              onChange={(e) => setId(e.target.value)}
              style={{
                ...S.formInput,
                background: isEdit ? '#f1f5f9' : '#fff',
                cursor: isEdit ? 'not-allowed' : 'text',
              }}
            />
          </FloatField>
          {idClash && (
            <span style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '-12px' }}>
              A vocabulary with this ID already exists.
            </span>
          )}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={usedInSearch}
              onChange={(e) => setUsedInSearch(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#a21caf', margin: 0 }}
            />
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>
              Make the search engine use this vocabulary when indexing content
            </span>
          </label>
        </div>

        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ marginRight: '4px' }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onSave({ id: idTrim, usedInSearch, file, editing })}
            style={{
              ...S.primaryBtn,
              opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete modal ───────────────────────────────────────────────────
function ConfirmDeleteModal({ open, title, body, onCancel, onConfirm }) {
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
          <button type="button" style={S.linkBtn} onClick={onCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ marginRight: '4px' }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
          <button type="button" style={{ ...S.primaryBtn, background: '#b91c1c', borderColor: '#b91c1c' }} onClick={onConfirm}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row primitives ─────────────────────────────────────────────────────────
function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '4px',
        marginLeft: '4px', cursor: 'pointer', color: '#475569',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children, width }) {
  return <th style={{ ...S.th, ...(width ? { width } : null) }}>{children}</th>;
}

function SortableTh({ label, sortKey, cur, dir, onSort, width, extra }) {
  const active = cur === sortKey;
  return (
    <th onClick={() => onSort(sortKey)}
        style={{
          ...S.th, ...(width ? { width } : null),
          cursor: 'pointer', userSelect: 'none',
          color: active ? '#0f172a' : '#475569',
        }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {extra}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true"
             style={{
               transition: 'transform 150ms',
               transform: active && dir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
               opacity: active ? 1 : 0.45,
             }}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </span>
    </th>
  );
}

function FloatField({ label, disabled, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{
        position: 'absolute', top: '-7px', left: '10px',
        padding: '0 6px', background: '#fff',
        fontSize: '0.72rem', color: disabled ? '#cbd5e1' : '#94a3b8',
        fontWeight: 500, pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}>{label}</span>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 121" aria-hidden="true">
      <g>
        <circle cx="60" cy="60.07" r="60" fill="#F2F2F5" />
        <circle cx="61.25" cy="68.81" r="1.25" fill="#BBBBC9" />
        <circle cx="58.75" cy="51.31" r="1.25" fill="#BBBBC9" />
        <path
          fill="#BBBBC9"
          d="M74.88,56.38c1.27-.21,2.58.15,3.57.97,.99.83,1.55,2.05,1.55,3.41v2.5c0,5.18-4.2,9.38-9.38,9.38h-3.12v4.93h16.25c.69,0,1.25.56,1.25,1.25s-.56,1.25-1.25,1.25h-47.5c-.69,0-1.25-.56-1.25-1.25s.56-1.25,1.25-1.25h16.25v-13.75l-3.12-.07c-5.18,0-9.38-4.13-9.38-9.31v-2.5c0-1.29.57-2.51,1.55-3.34.99-.83,2.3-1.19,3.57-.97,2.15.36,3.63,2.38,3.63,4.56v2.26c0,.34.28.62.62.62h3.12v-7.5c0-2.06.85-4.02,2.27-5.44,1.56-1.42,3.58-2.16,5.63-2.05,4.06.21,7.1,3.91,7.1,7.91v15.83h3.12c.34,0,.62-.28.62-.62v-2.26c0-2.17,1.49-4.19,3.63-4.56ZM49.38,61.31h3.12v-3.75l-3.12.07c-1.73,0-3.12-1.4-3.12-3.13v-2.5c0-1.04-.84-1.88-1.88-1.88s-1.88.84-1.88,1.88v2.5c0,3.73,3.08,6.81,6.88,6.81ZM55,77.57h10v-30c0-2.69-2.24-4.93-5-4.93s-5,2.17-5,4.93v30ZM70.63,70.06c3.8,0,6.88-3.08,6.88-6.88v-2.5c0-1.03-.84-1.74-1.88-1.74s-1.88.77-1.88,1.81v2.5c0,1.73-1.4,3.13-3.12,3.13h-3.12v3.68h3.12Z"
        />
      </g>
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px' },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: '14px',
  },
  titleLine: { display: 'flex', alignItems: 'center', gap: '8px' },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569', lineHeight: 1.5 },
  link: { color: '#a21caf', fontWeight: 500, textDecoration: 'underline' },
  infoBtn: {
    width: '24px', height: '24px', borderRadius: '999px',
    background: 'transparent', border: '1px solid transparent',
    color: '#94a3b8', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  popoverPanel: {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
    minWidth: '260px', zIndex: 50,
    padding: '10px 14px', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: '6px',
    boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
    fontSize: '0.86rem', color: '#475569', lineHeight: 1.5,
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  tertiaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'transparent', color: '#a21caf',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 12px',
    background: 'transparent', color: '#475569',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  fileDropArea: {
    position: 'relative',
    border: '1px dashed #e2e8f0', borderRadius: '6px',
    padding: '14px',
    transition: 'background 120ms, border-color 120ms',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  dropOverlay: {
    position: 'absolute', inset: 0, zIndex: 5,
    pointerEvents: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(253,242,248,0.85)', borderRadius: '6px',
  },
  dropChip: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 16px', borderRadius: '999px',
    background: '#fff', color: '#a21caf', fontWeight: 600,
    border: '1px solid #a21caf', fontSize: '0.9rem',
    boxShadow: '0 8px 16px rgba(162,28,175,0.16)',
  },
  errorChip: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 10px', borderRadius: '999px',
    background: '#fee2e2', color: '#b91c1c',
    fontSize: '0.82rem', fontWeight: 500,
    width: 'fit-content',
  },
  warningBar: {
    padding: '10px 14px', borderRadius: '4px',
    background: '#fffbeb', color: '#92400e',
    fontSize: '0.86rem', border: '1px solid #fde68a',
  },
  progressBar: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px', borderRadius: '4px',
    background: '#f5f3ff', color: '#5b21b6',
    fontSize: '0.86rem', fontWeight: 500, border: '1px solid #ddd6fe',
    width: 'fit-content',
  },
  progressDot: {
    width: '10px', height: '10px', borderRadius: '999px',
    background: '#7c3aed', display: 'inline-block',
    animation: 'pulse 1s infinite',
  },
  searchRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  searchInput: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: {
    textAlign: 'left', padding: '12px 16px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  thHint: { fontSize: '0.78rem', color: '#94a3b8', cursor: 'help' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px 16px', color: '#0f172a', verticalAlign: 'middle' },
  emptyCell: {
    padding: '60px 16px', textAlign: 'center',
    color: '#94a3b8',
  },
  emptyInner: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  emptyText: { fontSize: '0.92rem', color: '#64748b' },
  dotChip: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: '6px', color: '#a21caf',
  },
  checkPill: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px', borderRadius: '999px',
    background: '#dcfce7', color: '#166534',
  },
  langChip: {
    display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
    background: '#f1f5f9', color: '#475569', fontSize: '0.74rem', fontWeight: 600,
    letterSpacing: '0.04em',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '8px', padding: '12px 4px',
    fontSize: '0.82rem',
    borderTop: '1px solid #e2e8f0',
  },
  formInput: {
    width: '100%', padding: '14px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
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
};
