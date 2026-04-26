'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import MyLibrarySidebar from '@/components/mylibrary/MyLibrarySidebar';
import { myLibraryStyles as s } from '../mylibraryStyles';

const VALID_TABS = ['bookmarks', 'searches', 'collections'];
const COLORS = ['#0f172a', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#f97316', '#eab308'];

function ToastHost({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 'min(400px, calc(100vw - 32px))',
        pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 4,
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.35,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
            background: toast.variant === 'success' ? '#1d4ed8' : '#ea580c',
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
              fontSize: '1.1rem',
              lineHeight: 1,
              opacity: 0.9,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function DeleteCollectionModal({ target, onClose, onDelete, t }) {
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  return (
    <div style={dm.backdrop} onClick={busy ? undefined : onClose}>
      <div style={dm.box} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="del-coll-title">
        <p id="del-coll-title" style={dm.question}>{t('deleteCollectionQuestion', { name: target.name })}</p>
        <div style={dm.actions}>
          <button type="button" disabled={busy} onClick={onClose} style={{ ...dm.cancel, opacity: busy ? 0.65 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
            ✕ {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete();
              } finally {
                setBusy(false);
              }
            }}
            style={dm.deleteBtn}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              {t('delete')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const dm = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: 'var(--font-sans)',
  },
  box: {
    background: '#fff',
    borderRadius: 6,
    maxWidth: 440,
    width: '100%',
    padding: '24px 28px 22px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
  },
  question: {
    margin: '0 0 22px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#ea580c',
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancel: {
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  deleteBtn: {
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 20px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
};

export default function MyLibraryTabPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const tab = VALID_TABS.includes(params.tab) ? params.tab : 'bookmarks';

  const TITLES = {
    bookmarks:   { has: t('bookmarks'),   none: t('noBookmarks') },
    searches:    { has: t('searches'),    none: t('noSearches') },
    collections: { has: t('collections'), none: t('noCollections') },
  };

  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);    // collection being edited
  const [sortBy, setSortBy]   = useState('title'); // 'title' | 'date'
  const [filter, setFilter]   = useState('');
  const [page, setPage]       = useState(1);
  const PER_PAGE = 8;

  const [bookmarks, setBookmarks] = useState([]);
  const [searches, setSearches] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toastTimers = useRef({});

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((list) => [...list, { id, ...toast }]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== id));
      delete toastTimers.current[id];
    }, 6500);
  }, []);

  const dismissToast = useCallback((id) => {
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  useEffect(() => () => {
    Object.keys(toastTimers.current).forEach((id) => {
      clearTimeout(toastTimers.current[id]);
    });
    toastTimers.current = {};
  }, []);

  // Redirect unknown tab segments to /mylibrary/bookmarks
  useEffect(() => {
    if (!VALID_TABS.includes(params.tab)) {
      router.replace('/mylibrary/bookmarks');
    }
  }, [params.tab, router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, c] = await Promise.all([
        api.get('/bookmarks').catch(() => ({ bookmarks: [] })),
        api.get('/user/searches').catch(() => ({ searches: [] })),
        api.get('/collections').catch(() => ({ collections: [] })),
      ]);
      setBookmarks(b.bookmarks || []);
      setSearches(s.searches || []);
      setCollections(c.collections || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('ft_token')) { router.replace('/login'); return; }
    loadAll();
  }, [loadAll, router]);

  const removeBookmark = async (bookmark) => {
    const id = bookmark.id || bookmark.topic?._id;
    if (!id) return;
    try {
      await api.delete(`/bookmarks/${id}`);
      setBookmarks((bs) => bs.filter((b) => (b.id || b.topic?._id) !== id));
    } catch (e) { alert(e.message); }
  };

  const confirmDeleteCollection = useCallback(async () => {
    if (!deleteTarget) return;
    const { _id, name } = deleteTarget;
    try {
      await api.delete(`/collections/${_id}`);
      setCollections((cs) => cs.filter((c) => c._id !== _id));
      pushToast({ variant: 'success', message: t('collectionDeletedToast', { name }) });
      setDeleteTarget(null);
    } catch (e) {
      pushToast({ variant: 'error', message: e?.message || 'Failed' });
    }
  }, [deleteTarget, pushToast, t]);

  const clearSearches = async () => {
    if (!confirm('Clear all search history?')) return;
    await api.delete('/user/searches').catch(() => {});
    setSearches([]);
  };

  const handleCreateCollection = useCallback(async ({ name, description, color }) => {
    const trimmed = (name || '').trim();
    try {
      if (editing) {
        const d = await api.patch(`/collections/${editing._id}`, { name: trimmed, description, color });
        setCollections((cs) => cs.map((c) => (c._id === editing._id ? d.collection : c)));
        pushToast({ variant: 'success', message: t('collectionUpdatedToast', { name: trimmed }) });
      } else {
        const d = await api.post('/collections', { name: trimmed, description, color });
        setCollections((cs) => [d.collection, ...cs]);
        pushToast({ variant: 'success', message: t('collectionCreatedToast', { name: trimmed }) });
      }
      setCreateOpen(false);
      setEditing(null);
      return { ok: true };
    } catch (e) {
      const raw = (e?.message || '').toLowerCase();
      const dup = raw.includes('already exists');
      if (editing) {
        pushToast({ variant: 'error', message: t('collectionUpdateFailedName', { name: trimmed }) });
      } else {
        pushToast({ variant: 'error', message: t('collectionCreateFailedName', { name: trimmed }) });
      }
      return { ok: false, duplicate: dup };
    }
  }, [editing, pushToast, t]);

  const counts = {
    bookmarks: bookmarks.length,
    searches: searches.length,
    collections: collections.length,
  };
  const titleSet = TITLES[tab];
  // For Collections we render the count in the title ("1 collection") to
  // match the FT-style listing.
  const title = tab === 'collections' && counts.collections > 0
    ? `${counts.collections} collection${counts.collections === 1 ? '' : 's'}`
    : counts[tab] ? titleSet.has : titleSet.none;

  const collectionTopicMeta = (c) => {
    if (c.kind === 'smart') return t('smartCollectionShort');
    const n = c.topicIds?.length || 0;
    // Same pattern as non-empty rows: "0 topics" / "1 topic" / "N topics"
    if (n === 0) return t('topicCountPlural', { n: 0 });
    return n === 1 ? t('topicCount', { n }) : t('topicCountPlural', { n });
  };

  // Filter / sort / paginate the collections list for the Collections tab.
  const filteredCollections = collections
    .filter((c) =>
      !filter ||
      c.name?.toLowerCase().includes(filter.toLowerCase()) ||
      c.description?.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => sortBy === 'title'
      ? (a.name || '').localeCompare(b.name || '')
      : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const totalPages = Math.max(1, Math.ceil(filteredCollections.length / PER_PAGE));
  const pagedCollections = filteredCollections.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={s.shell}>
      <MyLibrarySidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        activeTab={tab}
        labels={{
          bookmarks: t('bookmarks'),
          searches: t('searches'),
          collections: t('collections'),
          goToSearchPage: t('goToSearchPage'),
        }}
        styles={s}
      />

      <main style={s.main}>
        <div style={s.header}>
          <h1 style={s.headerTitle}>{title}</h1>
          {tab === 'collections' && (
            <button type="button" style={s.createBtn} onClick={() => setCreateOpen(true)}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>⊕</span> {t('create')}
            </button>
          )}
          {tab === 'searches' && counts.searches > 0 && (
            <button type="button" style={s.linkBtn} onClick={clearSearches}>{t('clearAll')}</button>
          )}
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={s.empty}>{t('loading')}</div>
          ) : tab === 'bookmarks' ? (
            counts.bookmarks === 0
              ? <div style={s.empty}>{t('nothingToSee')}</div>
              : (
                <ul style={s.list}>
                  {bookmarks.map((b) => (
                    <li key={b.id || b._id} style={s.row}>
                      <Link href={`/dashboard/docs/${b.topic?._id}`} style={s.rowMain}>
                        <div style={s.rowTitle}>{b.topic?.title || 'Untitled'}</div>
                        {b.note && <div style={s.rowSub}>{b.note}</div>}
                      </Link>
                      <button type="button" onClick={() => removeBookmark(b)} style={s.removeBtn} aria-label="Remove bookmark">×</button>
                    </li>
                  ))}
                </ul>
              )
          ) : tab === 'searches' ? (
            counts.searches === 0
              ? <div style={s.empty}>{t('nothingToSee')}</div>
              : (
                <ul style={s.list}>
                  {searches.map((q) => (
                    <li key={q.query} style={s.row}>
                      <Link href={`/search?q=${encodeURIComponent(q.query)}`} style={s.rowMain}>
                        <div style={s.rowTitle}>{q.query}</div>
                        <div style={s.rowSub}>
                          {q.resultCount} result{q.resultCount === 1 ? '' : 's'}
                          {q.lastUsed ? ` · ${new Date(q.lastUsed).toLocaleString()}` : ''}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
          ) : (
            counts.collections === 0
              ? <div style={s.empty}>{t('nothingToSee')}</div>
              : (
                <>
                  <div style={s.collectionsToolbar}>
                    <div style={s.orderBy}>
                      <span style={s.orderLabel}>{t('orderBy')}</span>
                      <button type="button" onClick={() => setSortBy('title')} style={{ ...s.orderBtn, ...(sortBy === 'title' ? s.orderBtnActive : {}) }}>Title</button>
                      <button type="button" onClick={() => setSortBy('date')}  style={{ ...s.orderBtn, ...(sortBy === 'date'  ? s.orderBtnActive : {}) }}>Date</button>
                    </div>
                    <input
                      type="text"
                      placeholder={t('filterPlaceholder')}
                      value={filter}
                      onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                      style={s.filterInput}
                    />
                  </div>

                  <ul style={s.collectionsList}>
                    {pagedCollections.map((c) => (
                      <li key={c._id} style={s.collectionRow}>
                        <div style={s.collectionMain}>
                          <div style={s.collectionHead}>
                            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.color || '#0f172a', flexShrink: 0 }} />
                            <Link href={`/mylibrary/collections/${c._id}`} style={s.collectionTitle}>{c.name}</Link>
                          </div>
                          {c.description && <div style={s.collectionDesc}>{c.description}</div>}
                          <div style={s.collectionMeta}>
                            {collectionTopicMeta(c)}
                          </div>
                        </div>
                        <div style={s.collectionActions}>
                          <button type="button" onClick={() => { setEditing(c); setCreateOpen(true); }} style={s.iconBtn} aria-label="Edit collection" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
                          </button>
                          <button type="button" onClick={() => setDeleteTarget({ _id: c._id, name: c.name })} style={{ ...s.iconBtn, color: '#dc2626' }} aria-label="Delete collection" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {totalPages > 1 && (
                    <div style={s.pager}>
                      <button type="button" onClick={() => setPage(1)} disabled={page === 1} style={s.pagerBtn}>«</button>
                      <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} style={s.pagerBtn}>&lt;</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          style={{ ...s.pagerBtn, ...(n === page ? s.pagerBtnActive : {}) }}
                        >{n}</button>
                      ))}
                      <button type="button" onClick={() => setPage(page + 1)} disabled={page === totalPages} style={s.pagerBtn}>&gt;</button>
                      <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={s.pagerBtn}>»</button>
                    </div>
                  )}
                </>
              )
          )}
        </div>
      </main>

      {createOpen && (
        <CreateCollectionPanel
          initial={editing}
          onClose={() => { setCreateOpen(false); setEditing(null); }}
          onCreate={handleCreateCollection}
        />
      )}

      {deleteTarget && (
        <DeleteCollectionModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDelete={confirmDeleteCollection}
          t={t}
        />
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function CreateCollectionPanel({ onClose, onCreate, initial }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0;

  useEffect(() => {
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setColor(initial?.color || COLORS[0]);
    setNameError('');
  }, [initial?._id]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setNameError('');
    const res = await onCreate({ name: trimmed, description: description.trim(), color });
    setSaving(false);
    if (res && !res.ok && res.duplicate) setNameError(t('collectionDuplicateTitle'));
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.panelHeader}>
          <button type="button" onClick={onClose} style={s.panelClose} aria-label={t('close')}>×</button>
          <div>
            <div style={s.panelTitle}>{initial ? t('editCollection') : t('createCollection')}</div>
            {initial ? <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{t('editCollectionMeta')}</div> : null}
          </div>
        </div>
        <div style={s.panelBody}>
          <label style={s.fieldLabel}>{t('enterName')}</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(''); }}
            style={{
              ...s.input,
              ...(nameError ? { borderColor: '#ea580c' } : {}),
            }}
            autoFocus
          />
          {nameError ? (
            <div
              role="alert"
              style={{
                marginTop: 8,
                padding: '10px 12px',
                borderRadius: 4,
                background: '#ea580c',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {nameError}
            </div>
          ) : null}
          <label style={{ ...s.fieldLabel, marginTop: '18px' }}>{t('addDescription')}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={s.input} />
          <label style={{ ...s.fieldLabel, marginTop: '18px' }}>{t('chooseColor')}</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: c, border: 'none', cursor: 'pointer',
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', boxShadow: color === c ? '0 0 0 3px #cfe2ff' : 'none',
              }} aria-label={`Color ${c}`}>{color === c ? '✓' : ''}</button>
            ))}
          </div>
          <div style={s.panelActions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>✕ {t('cancel')}</button>
            <button
              type="button"
              style={{ ...s.saveBtn, opacity: canSave && !saving ? 1 : 0.6, cursor: canSave && !saving ? 'pointer' : 'not-allowed' }}
              disabled={!canSave || saving}
              onClick={handleSave}
            >
              ✓ {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

