'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// Adapter from API row → UI row. The original mockup used `key/values/
// indexed/system/dateLocked`; the API persists `displayName/valuesSample/
// isIndexed/manual/...`. Translating once at the boundary keeps the rest
// of the component close to the proven UX.
function toUiRow(api) {
  return {
    id: api.id,
    key: api.displayName || api.name,
    nameLower: api.name,
    values: api.valuesSample || [],
    valuesCount: api.valuesCount || 0,
    invalidDateCount: api.invalidDateCount || 0,
    indexed: !!api.isIndexed,
    isDate: !!api.isDate,
    // `system` in the original mockup blocks edit/delete. For us that
    // maps to "auto-discovered (non-manual) OR has values" — those rows
    // are still toggleable but cannot be renamed/removed.
    system: !api.manual || (api.valuesCount || 0) > 0,
    // The Set-as-date checkbox stays clickable; the backend enforces
    // built-in rejection. We never render dateLocked=true here because
    // built-ins are filtered out at extraction time and never reach the
    // registry.
    dateLocked: false,
    manual: !!api.manual,
  };
}

export default function MetadataConfigPage() {
  const [savedRows, setSavedRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);

  const dirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(savedRows),
    [rows, savedRows],
  );

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? rows.filter((r) => r.key.toLowerCase().includes(q)) : rows;
    list = [...list].sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));
    if (sortDir === 'desc') list.reverse();
    return list;
  }, [rows, query, sortDir]);

  // ── data loading ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/metadata-keys');
      const items = (res?.items || []).map(toUiRow);
      setRows(items);
      setSavedRows(items);
      // If a job was already running when the page opened, resume polling.
      if (res?.runningJob) setJob(res.runningJob);
    } catch (e) {
      setError(e?.message || 'Failed to load metadata keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // ── reprocess job polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!job?.id) return undefined;
    if (job.status === 'done' || job.status === 'failed') {
      // Refetch the table once the worker is done so valuesSample /
      // invalidDateCount reflect the latest state.
      refetch();
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/metadata-keys/jobs/${job.id}`);
        if (res?.job) setJob(res.job);
      } catch (_) {
        /* keep polling — transient errors are fine */
      }
    }, 1000);
    return () => clearInterval(pollRef.current);
  }, [job?.id, job?.status, refetch]);

  // ── row mutations ───────────────────────────────────────────────────────
  const toggleField = (rowId, field) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: !r[field] } : r)));
  };

  const upsertRow = async (draft) => {
    setBusy(true);
    setError('');
    try {
      if (draft.id) {
        // Edit (rename only — toggles flow through Save and reprocess)
        await api.patch(`/metadata-keys/${draft.id}`, {
          name: draft.key,
          isIndexed: draft.indexed,
          isDate: draft.isDate,
        });
      } else {
        await api.post('/metadata-keys', {
          name: draft.key,
          isIndexed: draft.indexed,
          isDate: draft.isDate,
        });
      }
      setEditing(null);
      await refetch();
    } catch (e) {
      setError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (row) => {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/metadata-keys/${row.id}`);
      await refetch();
    } catch (e) {
      setError(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  // ── save and reprocess ──────────────────────────────────────────────────
  const onSaveAndReprocess = async () => {
    setBusy(true);
    setError('');
    try {
      // Build a diff: toggles whose isIndexed/isDate differ from the saved
      // snapshot. Server will persist them inside the same call.
      const savedById = new Map(savedRows.map((r) => [r.id, r]));
      const changes = rows
        .map((r) => {
          const prev = savedById.get(r.id);
          if (!prev) return null;
          const out = { id: r.id };
          if (r.indexed !== prev.indexed) out.isIndexed = r.indexed;
          if (r.isDate !== prev.isDate) out.isDate = r.isDate;
          if (Object.keys(out).length === 1) return null;
          return out;
        })
        .filter(Boolean);
      const res = await api.post('/metadata-keys/save-and-reprocess', { changes });
      if (res?.job) setJob(res.job);
      await refetch();
    } catch (e) {
      setError(e?.message || 'Reprocess failed');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () => setRows(savedRows);

  // ── progress strip helpers ──────────────────────────────────────────────
  const showProgress = job && (job.status === 'queued' || job.status === 'running');
  const progressLabel = job && job.total
    ? `Reprocessing ${job.processed.toLocaleString()} / ${job.total.toLocaleString()} topics${job.errorCount ? ` — ${job.errorCount} error${job.errorCount === 1 ? '' : 's'}` : ''}`
    : 'Reprocessing started…';

  return (
    <AdminShell active="khub-metadata" allowedRoles={['superadmin']}>
      <div style={S.page}>
        <header style={S.headerRow}>
          <div>
            <h1 style={S.h1}>Metadata configuration</h1>
            <p style={S.subtitle}>Choose which metadata should be indexed and define metadata to be set as dates.</p>
          </div>
          <button type="button" style={S.primaryBtn} onClick={() => setEditing('new')} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
            <span>New metadata</span>
          </button>
        </header>

        {error && (
          <div role="alert" style={S.errorBar}>{error}</div>
        )}

        {showProgress && (
          <div role="status" style={S.progressBar}>
            <span style={S.progressDot} />
            <span>{progressLabel}</span>
          </div>
        )}

        <div style={S.filterBar}>
          <label htmlFor="metadata-search" style={S.filterLabel}>Search</label>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <span aria-hidden="true" style={S.searchIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="metadata-search"
              type="search"
              placeholder="metadata_key"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={S.searchInput}
            />
          </div>
          <span style={S.resultCount}>
            {loading ? 'Loading…' : `${filteredSorted.length} ${filteredSorted.length === 1 ? 'result' : 'results'}`}
          </span>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <colgroup>
              <col style={{ width: '24%' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Key
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                         aria-hidden="true"
                         style={{
                           transition: 'transform 150ms',
                           transform: sortDir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                         }}>
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </span>
                </th>
                <th style={S.th}>Values</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Index values</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Set as date</th>
                <th style={{ ...S.th, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={S.emptyCell}>Loading metadata keys…</td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={5} style={S.emptyCell}>
                    {rows.length === 0
                      ? 'No metadata keys yet. Publish content or create a manual key with the New metadata button.'
                      : 'No metadata matches the current search.'}
                  </td>
                </tr>
              ) : filteredSorted.map((r) => (
                <tr key={r.id} style={S.tr}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.84rem', color: '#0f172a' }}>{r.key}</td>
                  <td style={S.td}>
                    <ValueChips values={r.values} />
                    {r.invalidDateCount > 0 && (
                      <span style={S.invalidBadge}>
                        {r.invalidDateCount} invalid date{r.invalidDateCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <Checkbox checked={r.indexed} onChange={() => toggleField(r.id, 'indexed')} />
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <Checkbox
                      checked={r.isDate}
                      disabled={r.dateLocked}
                      onChange={() => !r.dateLocked && toggleField(r.id, 'isDate')}
                    />
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.manual && r.valuesCount === 0 && (
                      <>
                        <IconBtn title="Edit metadata" onClick={() => setEditing(r)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                          </svg>
                        </IconBtn>
                        <IconBtn title="Delete metadata" danger onClick={() => setConfirm({ kind: 'delete', row: r })}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                          </svg>
                        </IconBtn>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.actionsBar}>
          <button
            type="submit"
            disabled={!dirty || busy}
            onClick={onSaveAndReprocess}
            style={{
              ...S.primaryBtn,
              background: dirty ? '#16a34a' : '#e2e8f0',
              color: dirty ? '#fff' : '#94a3b8',
              border: dirty ? '1px solid #16a34a' : '1px solid #e2e8f0',
              cursor: dirty && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Save and reprocess</span>
          </button>
          <button type="button" onClick={onCancel} style={S.secondaryBtn} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>

      <MetadataModal
        open={!!editing}
        existingKeys={rows.map((r) => r.key.toLowerCase())}
        editing={editing && editing !== 'new' ? editing : null}
        onCancel={() => setEditing(null)}
        onSave={upsertRow}
        busy={busy}
      />

      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title={confirm?.row ? `Delete "${confirm.row.key}"?` : ''}
        body="The metadata key will be removed from the configuration. Save and reprocess to apply the change."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.row) await deleteRow(confirm.row);
          setConfirm(null);
        }}
      />
    </AdminShell>
  );
}

// ── Value chip strip with truncation + +n indicator ────────────────────────
function ValueChips({ values }) {
  if (!values?.length) {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No values for this metadata yet</span>;
  }
  const visible = values.slice(0, 10);
  const extra = values.length - visible.length;
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', maxWidth: '100%' }}>
      {visible.map((v, i) => (
        <span
          key={`${v}-${i}`}
          title={v}
          style={S.valueChip}
        >
          {truncate(v, 36)}
        </span>
      ))}
      {extra > 0 && <span style={S.valueChipExtra}>+{extra}</span>}
    </div>
  );
}

function truncate(text, n) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function Checkbox({ checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '18px', height: '18px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={onChange}
        style={{
          width: '16px', height: '16px',
          accentColor: '#a21caf',
          cursor: disabled ? 'not-allowed' : 'pointer',
          margin: 0,
        }}
      />
    </label>
  );
}

function IconBtn({ title, danger, onClick, children }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '4px',
        marginLeft: '4px', cursor: 'pointer',
        color: danger ? '#b91c1c' : '#475569',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function MetadataModal({ open, existingKeys, editing, onCancel, onSave, busy }) {
  const isEdit = !!editing;
  const [draft, setDraft] = useState({ key: '', indexed: true, isDate: false });

  useEffect(() => {
    if (!open) return undefined;
    setDraft(editing
      ? { key: editing.key, indexed: editing.indexed, isDate: editing.isDate }
      : { key: '', indexed: true, isDate: false }
    );
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, editing, onCancel]);

  if (!open) return null;
  const keyTrim = draft.key.trim();
  const lower = keyTrim.toLowerCase();
  // For edit, the existing key obviously matches itself — exclude it.
  const otherKeys = isEdit ? existingKeys.filter((k) => k !== editing.key.toLowerCase()) : existingKeys;
  const clash = otherKeys.includes(lower);
  const valid = keyTrim && !clash && !busy;

  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit metadata' : 'New metadata'}
           onClick={(e) => e.stopPropagation()} style={{ ...S.modalDialog, width: 'min(480px, 100%)' }}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{isEdit ? `Edit metadata — ${editing.key}` : 'New metadata'}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FloatField label="Key">
            <input
              type="text"
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="metadata_key"
              style={{ ...S.formInput, fontFamily: 'monospace' }}
            />
          </FloatField>
          {clash && <span style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '-8px' }}>A metadata with this key already exists.</span>}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.indexed} onChange={(e) => setDraft((d) => ({ ...d, indexed: e.target.checked }))}
                   style={{ width: '16px', height: '16px', accentColor: '#a21caf', margin: 0 }} />
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>Index its values (filter / facet)</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.isDate} onChange={(e) => setDraft((d) => ({ ...d, isDate: e.target.checked }))}
                   style={{ width: '16px', height: '16px', accentColor: '#a21caf', margin: 0 }} />
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>Treat as date</span>
          </label>
        </div>

        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onSave({
              id: isEdit ? editing.id : null,
              key: keyTrim,
              indexed: draft.indexed,
              isDate: draft.isDate,
            })}
            style={{ ...S.primaryBtn, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
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

function ConfirmModal({ open, title, body, onCancel, onConfirm }) {
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
          <button type="button" style={S.linkBtn} onClick={onCancel}>Cancel</button>
          <button type="button" style={{ ...S.primaryBtn, background: '#b91c1c', borderColor: '#b91c1c' }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px' },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569' },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
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
  filterBar: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '12px 16px',
  },
  filterLabel: { fontSize: '0.86rem', color: '#475569', fontWeight: 500 },
  searchIcon: {
    position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
    color: '#94a3b8', display: 'inline-flex',
  },
  searchInput: {
    width: '100%', padding: '8px 12px 8px 30px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.88rem', color: '#0f172a',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  },
  resultCount: {
    marginLeft: 'auto',
    fontSize: '0.84rem', color: '#475569',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', tableLayout: 'fixed' },
  th: {
    textAlign: 'left', padding: '10px 14px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', color: '#0f172a', verticalAlign: 'middle' },
  emptyCell: { padding: '40px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' },
  valueChip: {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: '999px',
    background: '#f1f5f9', color: '#334155',
    fontSize: '0.74rem', fontWeight: 500,
    maxWidth: '320px',
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  },
  valueChipExtra: {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: '999px',
    background: '#fdf2f8', color: '#a21caf',
    fontSize: '0.74rem', fontWeight: 600,
  },
  invalidBadge: {
    display: 'inline-block',
    marginLeft: '8px',
    padding: '2px 8px', borderRadius: '999px',
    background: '#fef2f2', color: '#b91c1c',
    fontSize: '0.74rem', fontWeight: 600,
  },
  errorBar: {
    background: '#fef2f2', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: '4px',
    padding: '10px 14px', fontSize: '0.86rem',
  },
  progressBar: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    background: '#eff6ff', color: '#1e40af',
    border: '1px solid #bfdbfe', borderRadius: '4px',
    padding: '10px 14px', fontSize: '0.86rem', fontWeight: 500,
  },
  progressDot: {
    width: '10px', height: '10px', borderRadius: '50%',
    background: '#3b82f6',
    boxShadow: '0 0 0 0 rgba(59,130,246,0.6)',
    animation: 'pulse 1.4s infinite',
  },
  actionsBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc', borderRadius: '4px',
    position: 'sticky', bottom: 0,
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
