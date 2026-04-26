'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ── Mock data ──────────────────────────────────────────────────────────────
const SEED_VOCABULARIES = [
  {
    id: 'products',
    usedInSearch: true,
    languages: ['en', 'fr'],
    author: 'Prem Garudadri',
    updatedAt: '04/29/2025, 5:00 PM',
    updatedSinceReprocess: false,
  },
  {
    id: 'audiences',
    usedInSearch: false,
    languages: ['en'],
    author: 'Bastien Boulard',
    updatedAt: '03/14/2025, 11:18 AM',
    updatedSinceReprocess: true,
  },
  {
    id: 'regions',
    usedInSearch: true,
    languages: ['en', 'fr', 'de', 'ja'],
    author: 'Lucia Mendez',
    updatedAt: '02/04/2025, 09:42 AM',
    updatedSinceReprocess: false,
  },
];

const LAST_FULL_REPROCESS = {
  user: 'Prem GARUDADRI',
  at: '04/29/2025, 5:00 PM',
};

const FILE_ACCEPT = '.rdf,.csv,application/rdf+xml,text/csv';
const VALID_EXT = /\.(rdf|csv)$/i;

export default function VocabulariesPage() {
  const [rows, setRows]               = useState(SEED_VOCABULARIES);
  const [query, setQuery]             = useState('');
  const [sortKey, setSortKey]         = useState('id');
  const [sortDir, setSortDir]         = useState('asc');
  const [createOpen, setCreateOpen]   = useState(false);
  const [confirm, setConfirm]         = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pageError, setPageError]     = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!popoverOpen) return undefined;
    const onClick = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopoverOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPopoverOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [popoverOpen]);

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

  const handlePageDrop = (file) => {
    if (!file) return;
    if (!VALID_EXT.test(file.name)) { setPageError('Unsupported vocabulary file type'); return; }
    setPageError('');
    setCreateOpen({ file });
  };

  const upsertVocabulary = ({ id, usedInSearch, file }) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const today = new Date().toLocaleString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      const langs = inferLanguagesFromFile(file);
      const next  = {
        id, usedInSearch,
        languages: langs.length ? langs : ['en'],
        author: 'Super Admin',
        updatedAt: today,
        updatedSinceReprocess: true,
      };
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = { ...prev[idx], ...next }; return copy;
      }
      return [...prev, next];
    });
    setCreateOpen(false);
  };
  const deleteVocabulary = (row) => setRows((prev) => prev.filter((r) => r.id !== row.id));

  const downloadExample = () => {
    const csv = 'id,label,language,synonyms\nproduct.cloud,Cloud,en,"saas;hosted"\nproduct.cloud,Cloud,fr,"infonuagique"\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vocabulary-example.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell active="khub-vocab" allowedRoles={['superadmin']}>
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
            <button type="button" style={S.primaryBtn} onClick={() => setCreateOpen({ file: null })}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5"  y1="12" x2="19" y2="12" />
              </svg>
              <span>New vocabulary</span>
            </button>
          </div>
        </header>

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
                  <Th width="120px" />
                </tr>
              </thead>
              <tbody>
                {filteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={S.emptyCell}>
                      <EmptyIllustration />
                      <span style={S.emptyText}>No vocabularies to display</span>
                    </td>
                  </tr>
                ) : filteredSorted.map((r) => (
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}>
                      {r.id}
                      {r.updatedSinceReprocess && (
                        <span title="Updated since last reprocess" style={S.dotChip} aria-label="updated since last reprocess">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="12" r="6" />
                          </svg>
                        </span>
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
                          <span key={l} style={S.langChip}>{l.toUpperCase()}</span>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>{r.author}</td>
                    <td style={S.td}>{r.updatedAt}</td>
                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
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
          <span style={{ color: '#475569' }}>Last full reprocess by {LAST_FULL_REPROCESS.user}</span>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>{LAST_FULL_REPROCESS.at}</span>
        </footer>
      </div>

      {createOpen && (
        <CreateVocabularyModal
          open={!!createOpen}
          initialFile={createOpen.file || null}
          editing={createOpen.edit || null}
          existingIds={rows.map((r) => r.id)}
          onCancel={() => setCreateOpen(false)}
          onSave={upsertVocabulary}
        />
      )}

      <ConfirmDeleteModal
        open={confirm?.kind === 'delete'}
        title={confirm?.row ? `Delete "${confirm.row.id}"?` : ''}
        body="This action cannot be undone. Running a reprocess might be necessary to stop applying the vocabulary to documents."
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm?.row) deleteVocabulary(confirm.row); setConfirm(null); }}
      />
    </AdminShell>
  );
}

// ── Create/Edit modal ──────────────────────────────────────────────────────
function CreateVocabularyModal({ open, initialFile, editing, existingIds, onCancel, onSave }) {
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
  const idClash = !isEdit && existingIds.includes(idTrim);
  const valid  = !!file && idTrim && !idClash;

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
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>Upload vocabulary file:</div>

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
                Drop a vocabulary file or <span style={{ color: '#a21caf', textDecoration: 'underline' }}>click to browse</span>
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
            onClick={() => valid && onSave({ id: idTrim, usedInSearch, file })}
            style={{
              ...S.primaryBtn,
              opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Save
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

function inferLanguagesFromFile(file) {
  if (!file) return [];
  const m = file.name.match(/[._-]([a-z]{2})\b/i);
  return m ? [m[1].toLowerCase()] : [];
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
