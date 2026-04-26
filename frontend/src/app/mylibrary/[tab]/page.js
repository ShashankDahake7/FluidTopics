'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const VALID_TABS = ['bookmarks', 'searches', 'collections'];
const COLORS = ['#0f172a', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#f97316', '#eab308'];

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

  const [bookmarks, setBookmarks] = useState([]);
  const [searches, setSearches] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const removeCollection = async (id) => {
    if (!confirm('Delete this collection?')) return;
    try {
      await api.delete(`/collections/${id}`);
      setCollections((cs) => cs.filter((c) => c._id !== id));
    } catch (e) { alert(e.message); }
  };

  const clearSearches = async () => {
    if (!confirm('Clear all search history?')) return;
    await api.delete('/user/searches').catch(() => {});
    setSearches([]);
  };

  const handleCreateCollection = async ({ name, description, color }) => {
    try {
      const d = await api.post('/collections', { name, description, color });
      setCollections((cs) => [d.collection, ...cs]);
      setCreateOpen(false);
    } catch (e) { alert(e.message); }
  };

  const counts = {
    bookmarks: bookmarks.length,
    searches: searches.length,
    collections: collections.length,
  };
  const titleSet = TITLES[tab];
  const title = counts[tab] ? titleSet.has : titleSet.none;

  return (
    <div style={s.shell}>
      <aside style={{ ...s.sidebar, width: collapsed ? '56px' : '108px' }}>
        <SideTab href="/mylibrary/bookmarks"   icon={IconBookmark}    label={t('bookmarks')}   active={tab === 'bookmarks'}   collapsed={collapsed} />
        <SideTab href="/mylibrary/searches"    icon={IconSearches}    label={t('searches')}    active={tab === 'searches'}    collapsed={collapsed} />
        <SideTab href="/mylibrary/collections" icon={IconCollections} label={t('collections')} active={tab === 'collections'} collapsed={collapsed} />
        <div style={{ flex: 1 }} />
        <Link href="/search" style={{ ...s.sideTab, color: '#1d4ed8', textDecoration: 'none' }}>
          <IconSearchPage />
          {!collapsed && <span style={s.sideLabel}>{t('goToSearchPage')}</span>}
        </Link>
        <button type="button" onClick={() => setCollapsed((v) => !v)} style={s.collapseBtn} aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '»' : '«'}
        </button>
      </aside>

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
                      <Link href={`/portal/docs/${b.topic?._id}`} style={s.rowMain}>
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
                <ul style={s.list}>
                  {collections.map((c) => (
                    <li key={c._id} style={s.row}>
                      <div style={s.rowMain}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.color || '#0f172a', flexShrink: 0 }} />
                          <div style={s.rowTitle}>{c.name}</div>
                        </div>
                        {c.description && <div style={s.rowSub}>{c.description}</div>}
                      </div>
                      <button type="button" onClick={() => removeCollection(c._id)} style={s.removeBtn} aria-label="Delete collection">×</button>
                    </li>
                  ))}
                </ul>
              )
          )}
        </div>
      </main>

      {createOpen && <CreateCollectionPanel onClose={() => setCreateOpen(false)} onCreate={handleCreateCollection} />}
    </div>
  );
}

function SideTab({ href, icon: Icon, label, active, collapsed }) {
  return (
    <Link href={href} style={{
      ...s.sideTab,
      background: active ? '#eff6ff' : 'transparent',
      color: '#1d4ed8',
      textDecoration: 'none',
    }}>
      <Icon />
      {!collapsed && <span style={s.sideLabel}>{label}</span>}
    </Link>
  );
}

function CreateCollectionPanel({ onClose, onCreate }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const canSave = name.trim().length > 0;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.panelHeader}>
          <button type="button" onClick={onClose} style={s.panelClose} aria-label={t('close')}>×</button>
          <div style={s.panelTitle}>{t('createCollection')}</div>
        </div>
        <div style={s.panelBody}>
          <label style={s.fieldLabel}>{t('enterName')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={s.input} autoFocus />
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
            <button type="button" style={{ ...s.saveBtn, opacity: canSave ? 1 : 0.6, cursor: canSave ? 'pointer' : 'not-allowed' }}
              disabled={!canSave}
              onClick={() => onCreate({ name: name.trim(), description: description.trim(), color })}>
              ✓ {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Icons ----------------------------------------------------------------
const IconBookmark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
);
const IconSearches = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><circle cx="17.5" cy="17.5" r="3" /><line x1="20" y1="20" x2="22" y2="22" /></svg>
);
const IconCollections = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>
);
const IconSearchPage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><path d="M8 11h6M11 8v6" /></svg>
);

// ---- Styles ---------------------------------------------------------------
const s = {
  shell: {
    display: 'flex',
    minHeight: 'calc(100vh - var(--header-height))',
    background: '#ffffff',
    fontFamily: 'var(--font-sans)',
  },
  sidebar: {
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    padding: '16px 8px 8px',
    background: '#FFFFFF',
    flexShrink: 0,
    transition: 'width 150ms',
  },
  sideTab: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '14px 6px',
    border: 'none', cursor: 'pointer',
    borderRadius: '8px', marginBottom: '6px',
    fontSize: '0.7rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    background: 'transparent', color: '#1d4ed8',
    width: '100%',
  },
  sideLabel: { textAlign: 'center', lineHeight: 1.2 },
  collapseBtn: {
    background: '#0f172a', color: '#fff',
    width: '28px', height: '28px', borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    alignSelf: 'center', marginTop: '6px',
    fontSize: '0.85rem', lineHeight: 1,
  },
  main: {
    flex: 1, padding: '32px 36px',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '14px',
    marginBottom: '24px',
  },
  headerTitle: {
    fontSize: '1.4rem', fontWeight: 600,
    color: '#1d4ed8', margin: 0, letterSpacing: '-0.01em',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  createBtn: {
    background: '#1d4ed8', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  },
  linkBtn: {
    background: 'transparent', border: 'none',
    color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem',
    padding: '6px 8px', textDecoration: 'underline',
  },
  empty: {
    color: '#94a3b8', fontSize: '0.95rem',
    textAlign: 'center',
    margin: 'auto',
    paddingBottom: '40px',
  },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 14px',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    marginBottom: '10px', background: '#fff',
  },
  rowMain: { flex: 1, color: '#0f172a', textDecoration: 'none', display: 'block' },
  rowTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  rowSub: { fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' },
  removeBtn: {
    background: 'transparent', border: 'none',
    color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer',
    width: '28px', height: '28px', borderRadius: '4px',
  },

  // Slide-out panel
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: '100%', maxWidth: '760px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-12px 0 30px rgba(0,0,0,0.15)',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
    background: '#FFFFFF',
  },
  panelClose: {
    background: 'transparent', border: 'none',
    fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
    color: '#374151', width: '28px', height: '28px',
  },
  panelTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  panelBody: { padding: '24px 28px', flex: 1 },
  fieldLabel: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '8px' },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #2563eb', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)',
    color: '#0f172a', outline: 'none', boxSizing: 'border-box',
  },
  panelActions: {
    display: 'flex', justifyContent: 'flex-end', gap: '12px',
    marginTop: '40px',
  },
  cancelBtn: {
    background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '4px',
    padding: '8px 18px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
  },
  saveBtn: {
    background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: '4px',
    padding: '8px 22px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 600,
  },
};
