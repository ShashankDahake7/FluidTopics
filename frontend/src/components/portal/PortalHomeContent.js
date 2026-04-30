'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import api, { getStoredUser } from '@/lib/api';
import PortalSearch from '@/components/portal/PortalSearch';
import PortalFooter from '@/components/portal/PortalFooter';
import { customTemplates, GenericDocIcon } from '@/customTemplates';
import { useTranslation } from '@/lib/i18n';
import { hrefForDoc } from '@/lib/prettyUrl';

const HIDDEN_TEMPLATES_KEY = 'ft_hidden_templates';

/* Reads the persisted set of template slugs that the current superadmin has
 * hidden on this device. Templates live in a static code registry so there's
 * nothing to delete server-side — we just suppress them from the home grid. */
function readHiddenTemplates() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_TEMPLATES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeHiddenTemplates(set) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HIDDEN_TEMPLATES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Storage may be unavailable (private mode, quota); fail silently.
  }
}

/* Small reusable hook that powers the right-click context menu on tiles.
 * Returns the current menu position (or null), a ref to attach to the menu
 * panel for outside-click detection, and `open`/`close` handlers. The menu is
 * dismissed on outside click, Escape, scroll, or window resize. */
function useTileContextMenu() {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [menu, close]);

  const open = (e) => {
    e.preventDefault();
    const PAD = 6;
    const MENU_W = 180;
    const MENU_H = 140;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const x = Math.min(e.clientX, vw - MENU_W - PAD);
    const y = Math.min(e.clientY, vh - MENU_H - PAD);
    setMenu({ x, y });
  };

  return { menu, menuRef, open, close };
}

/* Context menu for tiles — shows Upload Icon, Remove Icon (if custom icon
 * exists), and Delete. Only rendered for superadmins. */
function TileContextMenu({ menu, menuRef, label, hasCustomIcon, onUploadIcon, onRemoveIcon, onDelete }) {
  if (!menu) return null;
  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={{ ...styles.contextMenu, top: 0, left: 0, transform: `translate(${menu.x}px, ${menu.y}px)`, position: 'fixed' }}
    >
      <button type="button" role="menuitem" style={styles.contextMenuItem} onClick={onUploadIcon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span>Upload Icon</span>
      </button>
      {hasCustomIcon && (
        <button type="button" role="menuitem" style={styles.contextMenuItem} onClick={onRemoveIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" />
            <line x1="12" y1="9" x2="18" y2="15" />
          </svg>
          <span>Remove Icon</span>
        </button>
      )}
      <div style={styles.contextMenuDivider} />
      <button type="button" role="menuitem" style={styles.contextMenuItemDanger} onClick={onDelete}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
        <span>Delete</span>
      </button>
    </div>
  );
}

function TemplateTile({ tpl, canDelete, customIconUrl, onRequestDelete, onUploadIcon, onRemoveIcon }) {
  const Icon = tpl.icon || GenericDocIcon;
  const ctx = useTileContextMenu();
  const hasCustomIcon = !!customIconUrl;

  const handleContextMenu = (e) => {
    if (!canDelete) return;
    ctx.open(e);
  };

  return (
    <div style={styles.tileWrap} onContextMenu={handleContextMenu}>
      <Link href={`/dashboard/templates/${tpl.slug}`} style={styles.tile}>
        <div style={styles.tileBox}>
          <div style={styles.tileIconBox}>
            {hasCustomIcon ? (
              <img src={customIconUrl} alt={tpl.title} style={styles.tileIconImg} />
            ) : (
              <Icon />
            )}
          </div>
        </div>
        <div style={styles.tileLabel}>{tpl.title}</div>
      </Link>
      <TileContextMenu
        menu={ctx.menu}
        menuRef={ctx.menuRef}
        label={`Actions for ${tpl.title}`}
        hasCustomIcon={hasCustomIcon}
        onUploadIcon={() => { ctx.close(); onUploadIcon('template', tpl.slug); }}
        onRemoveIcon={() => { ctx.close(); onRemoveIcon('template', tpl.slug); }}
        onDelete={() => { ctx.close(); onRequestDelete(tpl); }}
      />
    </div>
  );
}

function DocTile({ doc, canDelete, customIconUrl, onRequestDelete, onUploadIcon, onRemoveIcon }) {
  const ctx = useTileContextMenu();
  const hasCustomIcon = !!customIconUrl;

  const handleContextMenu = (e) => {
    if (!canDelete) return;
    ctx.open(e);
  };

  return (
    <div style={styles.tileWrap} onContextMenu={handleContextMenu}>
      <Link href={hrefForDoc(doc)} style={styles.tile}>
        <div style={styles.tileBox}>
          <div style={styles.tileIconBox}>
            {hasCustomIcon ? (
              <img src={customIconUrl} alt={doc.title} style={styles.tileIconImg} />
            ) : (
              <GenericDocIcon />
            )}
          </div>
        </div>
        <div style={styles.tileLabel}>{doc.title}</div>
      </Link>
      <TileContextMenu
        menu={ctx.menu}
        menuRef={ctx.menuRef}
        label={`Actions for ${doc.title}`}
        hasCustomIcon={hasCustomIcon}
        onUploadIcon={() => { ctx.close(); onUploadIcon('document', doc._id); }}
        onRemoveIcon={() => { ctx.close(); onRemoveIcon('document', doc._id); }}
        onDelete={() => { ctx.close(); onRequestDelete(doc); }}
      />
    </div>
  );
}

export default function PortalHomeContent() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [hiddenTemplates, setHiddenTemplates] = useState(() => new Set());
  // pendingDelete: { kind: 'template' | 'doc', tpl?, doc? }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Custom tile icons — keyed by "template:slug" or "document:_id"
  const [tileIcons, setTileIcons] = useState({});
  const fileInputRef = useRef(null);
  const pendingUploadRef = useRef(null); // { tileType, tileKey }
  const { t } = useTranslation();

  const loadDocs = () => {
    setLoading(true);
    api.get('/portal/documents')
      .then((d) => setDocs(d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDocs(); }, []);

  // Load all custom tile icons in one request
  const loadTileIcons = useCallback(() => {
    api.get('/tile-icons')
      .then((data) => {
        const map = {};
        (data.icons || []).forEach((i) => {
          // Append cache-bust so the browser refetches after upload
          map[`${i.tileType}:${i.tileKey}`] = `${i.url}?t=${Date.now()}`;
        });
        setTileIcons(map);
      })
      .catch(() => {}); // icons are optional, don't block UI
  }, []);

  useEffect(() => {
    setMounted(true);
    loadTileIcons();
    const sync = () => {
      setUser(getStoredUser());
      setHiddenTemplates(readHiddenTemplates());
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('ft-auth', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('ft-auth', sync);
    };
  }, [loadTileIcons]);

  const isSuperadmin = mounted && user?.role === 'superadmin';

  const filtered = docs;
  const filteredTemplates = customTemplates.filter((tpl) => !hiddenTemplates.has(tpl.slug));

  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError('');

    if (pendingDelete.kind === 'template') {
      const next = new Set(hiddenTemplates);
      next.add(pendingDelete.tpl.slug);
      setHiddenTemplates(next);
      writeHiddenTemplates(next);
      setPendingDelete(null);
      return;
    }

    if (pendingDelete.kind === 'doc') {
      const id = pendingDelete.doc._id;
      setDeleting(true);
      try {
        await api.delete(`/ingest/${id}`);
        setDocs((prev) => prev.filter((d) => d._id !== id));
        setPendingDelete(null);
      } catch (err) {
        setDeleteError(err?.message || 'Failed to delete document');
      } finally {
        setDeleting(false);
      }
    }
  };

  // ── Icon upload / remove handlers ──
  const handleUploadIcon = (tileType, tileKey) => {
    pendingUploadRef.current = { tileType, tileKey };
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const target = pendingUploadRef.current;
    if (!file || !target) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.upload(`/tile-icons/${target.tileType}/${target.tileKey}`, formData);
      loadTileIcons();
    } catch (err) {
      console.error('Icon upload failed:', err);
    }
  };

  const handleRemoveIcon = async (tileType, tileKey) => {
    try {
      await api.delete(`/tile-icons/${tileType}/${tileKey}`);
      loadTileIcons();
    } catch (err) {
      console.error('Icon removal failed:', err);
    }
  };

  return (
    <div style={styles.page}>
      {/* Hidden file input for icon uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <img src="/Group 79.png" alt="evolve. Everyday" style={styles.heroEvolve} />
          <div style={styles.heroCenter}>
            <h1 style={styles.heroTitle}>{t('portalTitle')}</h1>
            <PortalSearch />
          </div>
          <img src="/Group 4562.png" alt="" aria-hidden="true" style={styles.heroFigures} />
        </div>
      </section>

      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>{t('loadingDocs')}</span>
          </div>
        ) : filtered.length === 0 && filteredTemplates.length === 0 ? (
          <div style={styles.empty}>
            {docs.length === 0 ? t('noDocsPublished') : t('noResultsMatch')}
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredTemplates.map((tpl) => (
              <TemplateTile
                key={tpl.slug}
                tpl={tpl}
                canDelete={isSuperadmin}
                customIconUrl={tileIcons[`template:${tpl.slug}`] || null}
                onRequestDelete={(t) => setPendingDelete({ kind: 'template', tpl: t })}
                onUploadIcon={handleUploadIcon}
                onRemoveIcon={handleRemoveIcon}
              />
            ))}
            {filtered.map((doc) => (
              <DocTile
                key={doc._id}
                doc={doc}
                canDelete={isSuperadmin}
                customIconUrl={tileIcons[`document:${doc._id}`] || null}
                onRequestDelete={(d) => setPendingDelete({ kind: 'doc', doc: d })}
                onUploadIcon={handleUploadIcon}
                onRemoveIcon={handleRemoveIcon}
              />
            ))}
          </div>
        )}
      </div>
      {pendingDelete && (
        <DeleteConfirmDialog
          pending={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDelete}
        />
      )}
      <section style={styles.disclaimer}>
        <div style={styles.disclaimerInner}>
          <strong>{t('disclaimerLabel')}</strong>: {t('disclaimerBody')}
        </div>
      </section>
      <PortalFooter />
    </div>
  );
}

function DeleteConfirmDialog({ pending, deleting, error, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => {
      if (deleting) return;
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onCancel, onConfirm]);

  const isTemplate = pending.kind === 'template';
  const title = isTemplate ? 'Delete template?' : 'Delete document?';
  const name = isTemplate ? pending.tpl.title : pending.doc.title;
  const body = isTemplate ? (
    <>
      The <strong>{name}</strong> tile will no longer appear on the portal home. You can restore it later by clearing this site’s storage.
    </>
  ) : (
    <>
      <strong>{name}</strong> and all of its topics will be permanently removed from the portal and search index. This cannot be undone.
    </>
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" style={styles.dialogBackdrop}>
      <div style={styles.dialog}>
        <h2 id="delete-dialog-title" style={styles.dialogTitle}>{title}</h2>
        <p style={styles.dialogBody}>{body}</p>
        {error && <p style={styles.dialogError} role="alert">{error}</p>}
        <div style={styles.dialogActions}>
          <button type="button" onClick={onCancel} style={styles.btnSecondary} disabled={deleting}>Cancel</button>
          <button type="button" onClick={onConfirm} style={styles.btnDanger} disabled={deleting} autoFocus>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  hero: {
    background: '#EDF6FF',
    padding: '32px 24px',
  },
  heroInner: {
    maxWidth: '1320px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr minmax(0, 760px) 1fr',
    alignItems: 'center',
    gap: '24px',
  },
  heroEvolve: {
    height: '110px',
    width: 'auto',
    justifySelf: 'start',
    objectFit: 'contain',
  },
  heroFigures: {
    height: '160px',
    width: 'auto',
    justifySelf: 'end',
    objectFit: 'contain',
  },
  heroCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    textAlign: 'center',
    width: '100%',
  },
  heroTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1d4ed8',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '48px 24px 64px',
    width: '100%',
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '24px 28px',
    justifyItems: 'center',
  },
  tileWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: '180px',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    textDecoration: 'none',
    width: '100%',
    maxWidth: '180px',
  },
  tileBox: {
    width: '150px',
    height: '150px',
    borderRadius: '14px',
    background: '#f3f4f6',
    boxShadow: '6px 6px 14px rgba(15, 23, 42, 0.06), -2px -2px 6px rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 150ms, box-shadow 150ms',
  },
  tileIconBox: {
    width: '76px',
    height: '76px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '80px 0',
    color: '#64748b',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '80px 0',
    fontSize: '0.95rem',
  },
  disclaimer: {
    background: '#FFFFFF',
    padding: '20px 32px',
  },
  disclaimerInner: {
    width: '100%',
    fontSize: '0.85rem',
    color: '#475569',
    lineHeight: 1.6,
  },

  contextMenu: {
    minWidth: '180px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
    padding: '4px',
    zIndex: 1000,
  },
  contextMenuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: '#334155',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  contextMenuDivider: {
    height: '1px',
    background: '#e2e8f0',
    margin: '4px 8px',
  },
  contextMenuItemDanger: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: '#b91c1c',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  tileIconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
  },

  dialogBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '16px',
  },
  dialog: {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)',
    padding: '20px 22px 18px',
  },
  dialogTitle: {
    margin: '0 0 8px',
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  dialogBody: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#475569',
    lineHeight: 1.5,
  },
  dialogError: {
    margin: '12px 0 0',
    padding: '8px 10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '18px',
  },
  btnSecondary: {
    padding: '8px 14px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#1f2937',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 14px',
    border: '1px solid #b91c1c',
    background: '#b91c1c',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
