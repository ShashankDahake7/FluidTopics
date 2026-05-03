'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// ── Type chips + dropdown order ─────────────────────────────────────────────
// Pretty colour for the chip per source type.
const TYPE_CHIP_COLORS = {
  MapAttachments:        { bg: '#fef3c7', fg: '#92400e' },
  Dita:                  { bg: '#fdf2f8', fg: '#9d174d' },
  Html:                  { bg: '#fff7ed', fg: '#9a3412' },
  Ftml:                  { bg: '#ecfeff', fg: '#155e75' },
  UnstructuredDocuments: { bg: '#fef3c7', fg: '#92400e' },
  Authorit:              { bg: '#ede9fe', fg: '#5b21b6' },
  AuthoritMagellan:      { bg: '#ede9fe', fg: '#5b21b6' },
  Paligo:                { bg: '#dcfce7', fg: '#166534' },
  Confluence:            { bg: '#dbeafe', fg: '#1e40af' },
  ExternalDocument:      { bg: '#f1f5f9', fg: '#334155' },
  External:              { bg: '#f1f5f9', fg: '#334155' },
};

// Default order for the "New source" dropdown — overridden by the live list
// from /api/sources/types as soon as it loads.
const DEFAULT_SOURCE_TYPES = [
  'MapAttachments',
  'Dita',
  'Html',
  'Ftml',
  'UnstructuredDocuments',
  'Authorit',
  'AuthoritMagellan',
  'Paligo',
  'Confluence',
  'ExternalDocument',
  'External',
];

// Translate the wire shape (Source doc from /api/sources) into the row shape
// the rest of this page already speaks (`id`, `subtitle`, `publications`,
// plus the original Mongo `_id` so we can hit /:id endpoints).
function toRow(s) {
  return {
    _id: s.id,                 // Mongo _id, used for PATCH/DELETE/clean URLs
    id: s.sourceId,            // canonical, human id ("paligo")
    name: s.name,
    subtitle: s.description || '',
    type: s.type,
    category: s.category || '',
    publications: s.publicationCount ?? 0,
    permissions: s.permissions || { mode: 'admins', userIds: [], apiKeyHints: [] },
    installationStatus: s.installationStatus || 'installed',
  };
}

export default function SourcesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [types, setTypes] = useState(DEFAULT_SOURCE_TYPES);
  const [toast, setToast] = useState(null);          // { kind: 'success'|'error', text }

  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const [editing, setEditing] = useState(null);     // source row, 'new', or { type }
  const [confirm, setConfirm] = useState(null);     // { kind, source }
  const [busy, setBusy]       = useState(false);    // any in-flight save/clean/delete
  const [ditaOpen, setDitaOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);

  const showToast = useCallback((kind, text) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      setLoadError('');
      const data = await api.get('/sources');
      setRows((data.items || []).map(toRow));
    } catch (err) {
      setLoadError(err?.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    api.get('/sources/types')
      .then((data) => {
        if (Array.isArray(data?.types) && data.types.length) setTypes(data.types);
      })
      .catch(() => { /* fall back to defaults */ });
  }, []);

  useEffect(() => {
    if (!newMenuOpen) return undefined;
    const onClick = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setNewMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setNewMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [newMenuOpen]);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === 'desc') list.reverse();
    return list;
  }, [rows, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Persist an edit (PATCH) or a brand-new source (POST). The wizard/editor
  // pre-validates the obvious cases; here we surface server-side conflicts
  // (duplicate id/name) as a toast and keep the editor open so the admin can
  // fix the input without losing their typing.
  const saveSource = async (draft, { isEdit }) => {
    if (busy) return;
    setBusy(true);
    try {
      const permissions = normaliseDraftPermissions(draft);
      if (isEdit) {
        const target = rows.find((r) => r.id === draft.id);
        if (!target) throw new Error('Source not found');
        await api.patch(`/sources/${target._id}`, {
          name: draft.name.trim(),
          category: draft.category || '',
          description: draft.subtitle || '',
          permissions,
        });
        showToast('success', `Saved ${draft.name.trim()}`);
      } else {
        await api.post('/sources', {
          sourceId: draft.id.trim(),
          name: draft.name.trim(),
          type: draft.type,
          category: draft.category || '',
          description: draft.subtitle || '',
          permissions,
        });
        showToast('success', `Created ${draft.name.trim()}`);
      }
      setEditing(null);
      await reload();
    } catch (err) {
      showToast('error', err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Clean source — wipes every Publication attributed to this source. The
  // Source row stays so the admin can immediately re-publish into it.
  const cleanSource = async (s) => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await api.post(`/sources/${s._id}/clean`);
      showToast('success', data?.message || 'Source cleaned');
      await reload();
    } catch (err) {
      showToast('error', err?.message || 'Clean failed');
    } finally {
      setBusy(false);
    }
  };

  // Delete source — backend will respond 409 if any publications still link
  // to it, which becomes a "Clean source first" toast in the UI.
  const deleteSource = async (s) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.delete(`/sources/${s._id}`);
      showToast('success', `Deleted ${s.name}`);
      await reload();
    } catch (err) {
      const msg = err?.status === 409
        ? (err.message || 'Clean the source first.')
        : (err?.message || 'Delete failed');
      showToast('error', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell
      active="khub-sources"
      allowedRoles={['superadmin', 'admin', 'editor']}
      allowedAdminRoles={['CONTENT_ADMIN', 'CONTENT_PUBLISHER', 'KHUB_ADMIN']}
      fullWidth
    >
      <div style={S.headerRow}>
        <h1 style={S.h1}>Sources</h1>
        <div style={{ display: 'inline-flex', gap: '12px' }}>
          <button type="button" style={S.linkBtn} onClick={() => setDitaOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
            </svg>
            <span>Configure DITA-OT</span>
          </button>
          <div ref={newMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
              style={S.primaryBtn}
              onClick={() => setNewMenuOpen((v) => !v)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5"  y1="12" x2="19" y2="12" />
              </svg>
              <span>New source</span>
            </button>
            {newMenuOpen && (
              <ul role="menu" aria-label="New source type" style={S.newMenu}>
                {types.map((t) => (
                  <li key={t} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setNewMenuOpen(false);
                        setEditing({ __new: true, type: t });
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      style={S.newMenuItem}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editing && !editing.__new ? (
        <SourceEditor
          source={editing}
          presetType=""
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(draft) => saveSource(draft, { isEdit: true })}
        />
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <Th label="Name"         sortKey="name"         cur={sortKey} dir={sortDir} onSort={onSort} sortable />
                <Th label="ID"           sortKey="id"           cur={sortKey} dir={sortDir} onSort={onSort} sortable />
                <Th label="Type"         sortKey="type"         cur={sortKey} dir={sortDir} onSort={onSort} sortable width="160px" />
                <Th label="Category" />
                <Th label="Publications" sortKey="publications" cur={sortKey} dir={sortDir} onSort={onSort} sortable width="120px" align="right" />
                <Th label="" width="140px" align="right" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={S.emptyTableCell}>Loading sources…</td></tr>
              ) : loadError ? (
                <tr><td colSpan={6} style={{ ...S.emptyTableCell, color: '#b91c1c' }}>{loadError}</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} style={S.emptyTableCell}>No sources configured.</td></tr>
              ) : sorted.map((s) => (
                <tr key={s._id || s.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={{ color: '#0f172a' }}>{s.name}</div>
                    {s.subtitle && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{s.subtitle}</div>}
                  </td>
                  <td style={S.td}>{s.id}</td>
                  <td style={S.td}><TypeChip type={s.type} /></td>
                  <td style={S.td}>{s.category || ''}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{s.publications}</td>
                  <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <IconBtn title="Clean source" onClick={() => setConfirm({ kind: 'clean', source: s })}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M19.36,2.72L20.78,4.14L15.06,9.85C16.13,11.39 16.28,13.24 15.38,14.44L9.06,8.12C10.26,7.22 12.11,7.37 13.65,8.44L19.36,2.72M5.93,17.57C3.92,15.56 2.69,13.16 2.35,10.92L7.23,8.83L14.67,16.27L12.58,21.15C10.34,20.81 7.94,19.58 5.93,17.57Z" />
                      </svg>
                    </IconBtn>
                    <IconBtn title="Edit source" onClick={() => setEditing(s)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                      </svg>
                    </IconBtn>
                    <IconBtn title="Delete source" onClick={() => setConfirm({ kind: 'delete', source: s })}>
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
      )}

      <NewSourceWizard
        open={!!editing && editing.__new === true}
        presetType={editing && editing.__new ? editing.type : ''}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={(payload) => saveSource(payload, { isEdit: false })}
      />

      <DitaOtModal open={ditaOpen} onClose={() => setDitaOpen(false)} onToast={showToast} />

      <ConfirmModal
        open={confirm?.kind === 'clean'}
        title="Clean source?"
        body={confirm?.source ? `All publications from "${confirm.source.name}" will be removed. This cannot be undone.` : ''}
        confirmLabel="Clean"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm?.source) await cleanSource(confirm.source); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title="Delete source?"
        body={confirm?.source ? `"${confirm.source.name}" will be permanently deleted. The backend refuses to delete a source that still has publications attributed to it — clean it first if needed.` : ''}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm?.source) await deleteSource(confirm.source); setConfirm(null); }}
      />

      {toast && (
        <div role="status" style={{
          ...S.toast,
          background: toast.kind === 'error' ? '#fef2f2' : '#ecfdf5',
          color:      toast.kind === 'error' ? '#991b1b' : '#065f46',
          border:     `1px solid ${toast.kind === 'error' ? '#fecaca' : '#a7f3d0'}`,
        }}>
          {toast.text}
        </div>
      )}
    </AdminShell>
  );
}

// Translate the editor's three permission state fields into the wire shape
// the backend wants. `userIds` is a comma-separated list and we silently
// drop entries that aren't ObjectId-shaped — the backend filters too, so
// this just keeps the UI honest about what survived the round-trip.
function normaliseDraftPermissions(draft) {
  const mode = draft.permission || 'admins';
  const userIds = mode === 'some_pubs'
    ? String(draft.users || '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const apiKeyHints = mode === 'some_pubs'
    ? String(draft.apiKeys || '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return { mode, userIds, apiKeyHints };
}

// ── Small primitives ───────────────────────────────────────────────────────
function Th({ label, sortable, sortKey, cur, dir, onSort, width, align }) {
  const active = sortable && cur === sortKey;
  return (
    <th
      onClick={() => sortable && onSort(sortKey)}
      style={{
        ...S.th,
        ...(width ? { width } : null),
        ...(align ? { textAlign: align } : null),
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        color: active ? '#0f172a' : '#475569',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px',
                     justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
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

function TypeChip({ type }) {
  const c = TYPE_CHIP_COLORS[type] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      background: c.bg, color: c.fg, fontSize: '0.78rem', fontWeight: 500,
    }}>{type}</span>
  );
}

// ── Confirm modal (centred) ────────────────────────────────────────────────
function ConfirmModal({ open, title, body, cancelLabel = 'Cancel', confirmLabel = 'Confirm', busy, onCancel, onConfirm }) {
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
          <button type="button" style={S.linkBtn} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" style={{ ...S.primaryBtn, opacity: busy ? 0.65 : 1 }} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline source editor (full page) ───────────────────────────────────────
const PERMISSION_OPTIONS = [
  { value: 'admins',     label: 'Admins and KHUB admins' },
  { value: 'all_pubs',   label: ['Admins, KHUB Admins ', { strong: 'and all' }, ' Content Publishers'] },
  { value: 'some_pubs',  label: ['Admins, KHUB Admins ', { strong: 'and some' }, ' Content Publishers'] },
];

function SourceEditor({ source, presetType, busy, onCancel, onSave }) {
  const initial = useMemo(() => {
    if (source) return { ...source };
    return { ...blankDraft(), type: presetType || '' };
  }, [source, presetType]);

  const [draft, setDraft] = useState(initial);
  const [permission, setPermission] = useState(initial.permissions?.mode || 'admins');
  const [users, setUsers]     = useState((initial.permissions?.userIds || []).join(', '));
  const [apiKeys, setApiKeys] = useState((initial.permissions?.apiKeyHints || []).join(', '));
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    setDraft(initial);
    setPermission(initial.permissions?.mode || 'admins');
    setUsers((initial.permissions?.userIds || []).join(', '));
    setApiKeys((initial.permissions?.apiKeyHints || []).join(', '));
    setDirty(false);
  }, [initial]);

  const isEdit = !!source;
  const valid  = draft.id?.trim() && draft.name?.trim() && draft.type;
  const canSave = valid && dirty && !busy;

  const update = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };

  return (
    <div style={S.editorWrap}>
      <div style={S.editorHeaderRow}>
        <button type="button" onClick={onCancel} aria-label="Back to sources" style={S.backBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span style={S.editorTitleName}>{draft.name || (isEdit ? source.name : 'New source')}</span>
        <span style={S.editorTitleId}>{draft.id || (isEdit ? source.id : '')}</span>
        {draft.type && <TypeChip type={draft.type} />}
      </div>

      <div style={S.editorGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <MField label="ID" disabled={isEdit}>
            <input
              type="text"
              value={draft.id}
              disabled={isEdit}
              readOnly={isEdit}
              onChange={(e) => update({ id: e.target.value })}
              style={{ ...S.mInput, ...(isEdit ? S.mInputDisabled : null) }}
            />
          </MField>
          <MField label="Name">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              style={S.mInput}
            />
          </MField>
          <MField label="Category">
            <input
              type="text"
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
              style={S.mInput}
            />
          </MField>
          {/* Type is also fixed once a Source has been created — the docs
              treat it as part of the connector contract. */}
          <MField label="Type" disabled={isEdit}>
            <input
              type="text"
              value={draft.type}
              disabled={isEdit}
              readOnly={isEdit}
              style={{ ...S.mInput, ...(isEdit ? S.mInputDisabled : null) }}
              onChange={(e) => update({ type: e.target.value })}
            />
          </MField>
        </div>

        <MField label="Description" stretch>
          <textarea
            rows={5}
            value={draft.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            style={{ ...S.mInput, resize: 'vertical', fontFamily: 'inherit', minHeight: '128px' }}
          />
        </MField>
      </div>

      <div style={S.permissionsHeading}>
        <span style={S.permissionsLine} />
        <span style={S.permissionsTitle}>Permissions</span>
        <span style={S.permissionsLine} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
        {PERMISSION_OPTIONS.map((opt) => (
          <label key={opt.value} style={S.radioRow}>
            <input
              type="radio"
              name="src-perm"
              value={opt.value}
              checked={permission === opt.value}
              onChange={() => { setPermission(opt.value); setDirty(true); }}
              style={S.radioInput}
            />
            <span style={S.radioLabel}>
              {Array.isArray(opt.label)
                ? opt.label.map((part, i) => (typeof part === 'string'
                    ? <span key={i}>{part}</span>
                    : <strong key={i} style={{ fontWeight: 600 }}>{part.strong}</strong>))
                : opt.label}
            </span>
          </label>
        ))}
      </div>

      {permission === 'some_pubs' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
            <MField label="User IDs (comma-separated)">
              <SelectStub value={users} onChange={(v) => { setUsers(v); setDirty(true); }} placeholder="Search for users" />
            </MField>
            <MField label="API key hints (comma-separated)">
              <SelectStub value={apiKeys} onChange={(v) => { setApiKeys(v); setDirty(true); }} placeholder="Search for API keys" />
            </MField>
          </div>
          <div style={S.permissionsCaption}>
            Search not yet wired — paste raw user IDs or free-form API-key
            labels for now. They round-trip through the API but aren&apos;t
            yet enforced server-side.
          </div>
        </>
      )}

      <div style={S.editorSaveBar}>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => canSave && onSave({
            ...draft,
            id: draft.id.trim(),
            name: draft.name.trim(),
            permission,
            users,
            apiKeys,
          })}
          style={{
            ...S.primaryBtn,
            opacity: canSave ? 1 : 0.55,
            cursor: canSave ? 'pointer' : 'not-allowed',
            background: canSave ? '#a21caf' : '#e2e8f0',
            color: canSave ? '#fff' : '#94a3b8',
            border: canSave ? '1px solid #a21caf' : '1px solid #e2e8f0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── New source two-step wizard (modal) ─────────────────────────────────────
function NewSourceWizard({ open, presetType, busy, onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(blankDraft());
  const [permission, setPermission] = useState('admins');
  const [users, setUsers] = useState('');
  const [apiKeys, setApiKeys] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setStep(1);
    setDraft({ ...blankDraft(), type: presetType || '' });
    setPermission('admins');
    setUsers('');
    setApiKeys('');
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, presetType, onCancel]);

  if (!open) return null;

  const validIdent = draft.id.trim() && draft.name.trim();
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const goNext = () => { if (validIdent) setStep(2); };
  const goPrev = () => setStep(1);
  const goSave = () => {
    if (!validIdent || !draft.type || busy) return;
    onSave({
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      permission,
      users,
      apiKeys,
    });
  };

  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New source"
        onClick={(e) => e.stopPropagation()}
        style={{ ...S.modalDialog, width: 'min(640px, 100%)' }}
      >
        <header style={S.wizardHeader}>
          <Stepper current={step} steps={[
            { id: 1, label: 'Identification' },
            { id: 2, label: 'Permission' },
          ]} />
          <button type="button" aria-label="Close" onClick={onCancel} style={{ ...S.modalClose, alignSelf: 'center', marginLeft: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={{ padding: '24px 22px', minHeight: '230px' }}>
          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <MField label="ID">
                  <input type="text" value={draft.id} onChange={(e) => update({ id: e.target.value })} style={S.mInput} />
                </MField>
                <MField label="Name">
                  <input type="text" value={draft.name} onChange={(e) => update({ name: e.target.value })} style={S.mInput} />
                </MField>
                <MField label="Category">
                  <input type="text" value={draft.category} onChange={(e) => update({ category: e.target.value })} style={S.mInput} />
                </MField>
              </div>
              <MField label="Description" stretch>
                <textarea
                  rows={5}
                  value={draft.subtitle}
                  onChange={(e) => update({ subtitle: e.target.value })}
                  style={{ ...S.mInput, resize: 'vertical', fontFamily: 'inherit', minHeight: '160px' }}
                />
              </MField>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {PERMISSION_OPTIONS.map((opt) => (
                <label key={opt.value} style={S.radioRow}>
                  <input
                    type="radio"
                    name="new-src-perm"
                    value={opt.value}
                    checked={permission === opt.value}
                    onChange={() => setPermission(opt.value)}
                    style={S.radioInput}
                  />
                  <span style={S.radioLabel}>
                    {Array.isArray(opt.label)
                      ? opt.label.map((part, i) => (typeof part === 'string'
                          ? <span key={i}>{part}</span>
                          : <strong key={i} style={{ fontWeight: 600 }}>{part.strong}</strong>))
                      : opt.label}
                  </span>
                </label>
              ))}
              {permission === 'some_pubs' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '14px' }}>
                    <MField label="User IDs (comma-separated)">
                      <SelectStub value={users} onChange={setUsers} placeholder="Search for users" />
                    </MField>
                    <MField label="API key hints (comma-separated)">
                      <SelectStub value={apiKeys} onChange={setApiKeys} placeholder="Search for API keys" />
                    </MField>
                  </div>
                  <div style={S.permissionsCaption}>
                    Search not yet wired — paste raw user IDs or free-form
                    API-key labels for now. They round-trip through the API
                    but aren&apos;t yet enforced server-side.
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ ...S.modalFooter, justifyContent: 'space-between' }}>
          {step === 1 ? (
            <>
              <button type="button" style={{ ...S.linkBtn, color: '#a21caf', padding: '4px 8px' }} onClick={onCancel}>Cancel</button>
              <button
                type="button"
                disabled={!validIdent}
                onClick={goNext}
                style={{ ...S.primaryBtn, opacity: validIdent ? 1 : 0.55, cursor: validIdent ? 'pointer' : 'not-allowed' }}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button type="button" style={{ ...S.linkBtn, color: '#a21caf', padding: '4px 8px' }} onClick={goPrev}>Previous</button>
              <button
                type="button"
                style={{ ...S.primaryBtn, opacity: busy ? 0.65 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
                onClick={goSave}
                disabled={busy}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current, steps }) {
  return (
    <ol style={S.stepperRow}>
      {steps.map((s) => {
        const active = s.id === current;
        return (
          <li
            key={s.id}
            style={{
              ...S.stepperItem,
              background: active ? '#fff' : '#f1f5f9',
              borderBottom: active ? '2px solid transparent' : '1px solid #e2e8f0',
            }}
          >
            <span style={{ ...S.stepperBadge, background: active ? '#475569' : '#cbd5e1' }}>
              {s.id}
            </span>
            <span style={{
              ...S.stepperLabel,
              color: active ? '#0f172a' : '#94a3b8',
              fontWeight: active ? 600 : 500,
            }}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SelectStub({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...S.mInput, paddingRight: '28px' }}
      />
      <span aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>▾</span>
    </div>
  );
}

function MField({ label, disabled, stretch, children }) {
  return (
    <div style={{
      position: 'relative',
      ...(stretch ? { display: 'flex', flexDirection: 'column', height: '100%' } : null),
    }}>
      {children}
      <span
        style={{
          position: 'absolute', top: '-7px', left: '10px',
          padding: '0 6px', background: '#fff',
          fontSize: '0.72rem', color: disabled ? '#cbd5e1' : '#94a3b8',
          fontWeight: 500, pointerEvents: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function blankDraft() {
  return {
    id: '', name: '', type: '', category: '', subtitle: '',
    publications: 0,
    permissions: { mode: 'admins', userIds: [], apiKeyHints: [] },
  };
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '16px' }}>
      <span style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '4px', fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>{hint}</span>}
    </label>
  );
}

// ── DITA-OT configuration modal (centred) ──────────────────────────────────
//
// Backed by /api/dita-ot/config + /archive + /reset. The modal loads on open
// (so the user always sees the latest archive metadata even if another admin
// uploaded between sessions), uploads + downloads route through the
// presigned-URL endpoint to avoid streaming through the Next.js proxy, and
// "Reset" wipes the S3 archive and clears the advanced settings.
function DitaOtModal({ open, onClose, onToast }) {
  const [config, setConfig]    = useState(null);
  const [loading, setLoading]  = useState(true);
  const [busy, setBusy]        = useState(false);
  const [transtype, setTranstype] = useState('');
  const [params, setParams]    = useState([{ key: '', value: '' }]);
  const [showAdvanced, setShowAdv] = useState(true);
  const [dragOver, setDragOver]    = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get('/dita-ot/config')
      .then((data) => {
        if (cancelled) return;
        const cfg = data?.config || {};
        setConfig(cfg);
        setTranstype(cfg.transtype || '');
        setParams(cfg.parameters?.length ? cfg.parameters : [{ key: '', value: '' }]);
        setShowAdv(true);
      })
      .catch((err) => onToast?.('error', err?.message || 'Failed to load DITA-OT config'))
      .finally(() => { if (!cancelled) setLoading(false); });
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, onToast]);

  if (!open) return null;

  const updateParam = (i, patch) => setParams((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeParam = (i) => setParams((p) => p.filter((_, idx) => idx !== i));
  const addParam    = () => setParams((p) => [...p, { key: '', value: '' }]);

  const handleFile = async (file) => {
    if (!file || busy) return;
    if (!/\.zip$/i.test(file.name)) {
      onToast?.('error', 'DITA-OT archive must be a .zip file');
      return;
    }
    const fd = new FormData();
    fd.append('archive', file, file.name);
    setBusy(true);
    try {
      const data = await api.upload('/dita-ot/config', fd);
      setConfig(data?.config || null);
      onToast?.('success', 'Archive uploaded');
    } catch (err) {
      onToast?.('error', err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!config?.archive) return;
    try {
      const data = await api.get('/dita-ot/archive');
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (err) {
      onToast?.('error', err?.message || 'Download failed');
    }
  };

  const handleReset = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await api.post('/dita-ot/reset');
      setConfig(data?.config || null);
      setTranstype('');
      setParams([{ key: '', value: '' }]);
      onToast?.('success', 'Reset to default DITA-OT');
    } catch (err) {
      onToast?.('error', err?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAdvanced = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cleaned = params
        .map((p) => ({ key: String(p.key || '').trim(), value: String(p.value || '') }))
        .filter((p) => p.key);
      const data = await api.patch('/dita-ot/config', { transtype, parameters: cleaned });
      setConfig(data?.config || null);
      onToast?.('success', 'Advanced settings saved');
      onClose?.();
    } catch (err) {
      onToast?.('error', err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const archive = config?.archive || null;

  return (
    <div role="presentation" onClick={onClose} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label="Configure DITA-OT"
           onClick={(e) => e.stopPropagation()}
           style={{ ...S.modalDialog, width: 'min(620px, 100%)' }}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>Configure DITA-OT</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {loading ? (
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading current configuration…</div>
          ) : (
            <>
              <div
                onClick={() => !busy && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '18px 16px', borderRadius: '6px',
                  background: dragOver ? '#fdf2f8' : '#f1f5f9',
                  border: `1px dashed ${dragOver ? '#a21caf' : '#cbd5e1'}`,
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                }}
              >
                <span style={{ color: '#94a3b8', display: 'inline-flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" />
                  </svg>
                </span>
                <span style={{ color: '#475569', fontSize: '0.92rem' }}>
                  {busy ? 'Uploading…' : 'Upload DITA-OT archive (.zip)'}
                </span>
                <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
                  DITA-OT configuration
                  {archive ? (
                    <button
                      type="button" onClick={handleDownload}
                      aria-label="Download archive"
                      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#475569', display: 'inline-flex' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                  {archive ? (
                    <>
                      <div>{archive.originalName}</div>
                      <div>Uploaded by {archive.uploadedBy?.name || archive.uploadedBy?.email || 'Unknown'}</div>
                      <div>{archive.uploadedAt ? new Date(archive.uploadedAt).toLocaleString() : ''}</div>
                    </>
                  ) : (
                    <div>Using stock DITA-OT 3.5.4 — no custom archive uploaded.</div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdv((v) => !v)}
                style={{
                  alignSelf: 'center',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 8px', background: 'transparent', border: 'none',
                  color: '#a21caf', cursor: 'pointer', fontSize: '0.85rem',
                  fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                     style={{ transform: showAdvanced ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Advanced settings
              </button>

              {showAdvanced && (
                <>
                  <Field label="Transtype">
                    <input type="text" value={transtype} onChange={(e) => setTranstype(e.target.value)} style={S.formInput} placeholder="e.g. xhtml" />
                  </Field>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Parameters</span>
                      <button type="button" onClick={addParam} style={{ ...S.linkBtn, padding: '4px 6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5"  y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Add parameter</span>
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {params.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="text" value={p.key}   placeholder="Key"   onChange={(e) => updateParam(i, { key: e.target.value })}   style={{ ...S.formInput, flex: 1 }} />
                          <input type="text" value={p.value} placeholder="Value" onChange={(e) => updateParam(i, { value: e.target.value })} style={{ ...S.formInput, flex: 1 }} />
                          <button type="button" aria-label="Remove parameter" onClick={() => removeParam(i)}
                                  style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: '#a21caf', display: 'inline-flex' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ ...S.modalFooter, justifyContent: 'space-between' }}>
          <button type="button" onClick={handleReset} disabled={busy} style={{ ...S.linkBtn, color: '#a21caf', padding: '4px 8px' }}>
            Reset to default
          </button>
          <div style={{ display: 'inline-flex', gap: '8px' }}>
            <button type="button" style={S.linkBtn} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ marginRight: '4px' }}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cancel
            </button>
            <button type="button" style={{ ...S.primaryBtn, opacity: busy ? 0.65 : 1 }} onClick={handleSaveAdvanced} disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '14px', marginBottom: '16px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'transparent', color: '#a21caf',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
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
  newMenu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    minWidth: '220px', zIndex: 50,
    margin: 0, padding: '4px 0',
    listStyle: 'none', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: '4px',
    boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
    fontFamily: 'var(--font-sans)',
  },
  newMenuItem: {
    display: 'block', width: '100%', padding: '10px 16px',
    background: 'transparent', border: 'none',
    textAlign: 'left', color: '#0f172a',
    fontSize: '0.9rem', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
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
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: {
    padding: '14px 16px', color: '#0f172a', verticalAlign: 'middle',
  },
  emptyTableCell: {
    padding: '40px 14px', textAlign: 'center', color: '#94a3b8',
    fontSize: '0.9rem',
  },
  formInput: {
    width: '100%', padding: '10px 12px',
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
  editorWrap: {
    background: '#fff', borderRadius: '4px',
    padding: '20px 24px 80px',
    minHeight: 'calc(100vh - 220px)',
    position: 'relative',
  },
  editorHeaderRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    marginBottom: '24px',
  },
  backBtn: {
    background: 'transparent', border: 'none', padding: '4px',
    cursor: 'pointer', color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  editorTitleName: {
    fontSize: '1rem', fontWeight: 600, color: '#0f172a',
  },
  editorTitleId: {
    fontSize: '0.95rem', color: '#475569', fontStyle: 'italic',
  },
  editorGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px',
    marginBottom: '24px',
  },
  mInput: {
    width: '100%', padding: '14px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  },
  // Visually communicate that a field is locked (id/type on edit). Same
  // metrics as `mInput` so the layout doesn't shift.
  mInputDisabled: {
    background: '#f8fafc', color: '#64748b', cursor: 'not-allowed',
    borderColor: '#e2e8f0',
  },
  permissionsHeading: {
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '12px 0 4px',
  },
  permissionsLine: {
    flex: 1, height: '1px', background: '#a21caf', opacity: 0.6,
  },
  permissionsTitle: {
    fontSize: '0.95rem', fontWeight: 600, color: '#0f172a',
  },
  permissionsCaption: {
    marginTop: '8px', fontSize: '0.78rem', color: '#94a3b8',
    fontStyle: 'italic',
  },
  radioRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', userSelect: 'none', width: 'fit-content',
  },
  radioInput: {
    width: '16px', height: '16px', accentColor: '#a21caf',
    cursor: 'pointer', margin: 0,
  },
  radioLabel: {
    fontSize: '0.9rem', color: '#475569',
  },
  editorSaveBar: {
    position: 'sticky', bottom: 0, left: 0, right: 0,
    marginTop: '32px', marginLeft: '-24px', marginRight: '-24px',
    padding: '12px 24px',
    background: '#fff', borderTop: '1px solid #e2e8f0',
    display: 'flex', justifyContent: 'flex-end',
  },
  wizardHeader: {
    display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
    paddingRight: '12px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  stepperRow: {
    flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
    listStyle: 'none', margin: 0, padding: 0,
  },
  stepperItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', padding: '14px 16px',
    background: '#fff',
  },
  stepperBadge: {
    width: '20px', height: '20px', borderRadius: '999px',
    color: '#fff', fontSize: '0.72rem', fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  stepperLabel: {
    fontSize: '0.92rem',
    fontFamily: 'var(--font-sans)',
  },
  // Floating bottom-right toast for save/clean/delete success and 409
  // conflict messaging.
  toast: {
    position: 'fixed', bottom: '24px', right: '24px',
    zIndex: 10010,
    padding: '10px 14px', borderRadius: '6px',
    fontSize: '0.85rem', fontFamily: 'var(--font-sans)',
    boxShadow: '0 6px 16px rgba(15,23,42,0.18)',
  },
};
