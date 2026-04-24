'use client';

import { useEffect, useRef, useState } from 'react';

import useDesigner from './useDesigner.js';
import Canvas      from './Canvas.js';
import ContextMenu from './ContextMenu.js';

import Sidebar      from './sidebar/Sidebar.js';
import FooterBar    from './footer/FooterBar.js';
import ThemeEditor  from './ThemeEditor.js';
import CodeEditor   from './CodeEditor.js';
import ExportImport from './ExportImport.js';

import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100vh',
      flexDirection:  'column',
      gap:            '16px',
      background:     'var(--bg-secondary, #f8fafc)',
      color:          '#64748b',
    }}>
      <div style={{
        width:           '36px',
        height:          '36px',
        border:          '3px solid #e2e8f0',
        borderTopColor:  '#4f46e5',
        borderRadius:    '50%',
        animation:       'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Loading designer…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar({ designer, pageId, onManualSave }) {
  const { page, dirty, saving, canUndo, canRedo } = designer;

  const [nameFocused, setNameFocused] = useState(false);

  const statusBadge = (() => {
    if (saving) {
      return { label: 'Saving…', bg: '#fef3c7', color: '#92400e' };
    }
    if (!dirty) {
      return { label: 'Saved', bg: '#dcfce7', color: '#166534' };
    }
    return { label: 'Unsaved', bg: '#fee2e2', color: '#991b1b' };
  })();

  const pageBadge = page?.published
    ? { label: 'Published', bg: '#dcfce7', color: '#166534' }
    : { label: 'Draft',     bg: '#f1f5f9', color: '#475569' };

  const topBarStyle = {
    height:         '48px',
    flexShrink:     0,
    background:     '#ffffff',
    borderBottom:   '1px solid #e2e8f0',
    display:        'flex',
    alignItems:     'center',
    padding:        '0 14px',
    gap:            '10px',
    zIndex:         50,
  };

  const backLinkStyle = {
    display:        'flex',
    alignItems:     'center',
    gap:            '5px',
    fontSize:       '0.8rem',
    color:          '#64748b',
    textDecoration: 'none',
    padding:        '4px 8px',
    borderRadius:   '5px',
    whiteSpace:     'nowrap',
    transition:     'background 120ms',
    flexShrink:     0,
  };

  const nameInputStyle = {
    border:         nameFocused ? '1px solid #4f46e5' : '1px solid transparent',
    background:     nameFocused ? '#f8fafc' : 'transparent',
    outline:        'none',
    fontWeight:     600,
    fontSize:       '1.05rem',
    color:          '#1e293b',
    fontFamily:     'inherit',
    padding:        '3px 7px',
    borderRadius:   '5px',
    minWidth:       '120px',
    maxWidth:       '280px',
    transition:     'border-color 120ms, background 120ms',
  };

  const badgeStyle = (bg, color) => ({
    background:   bg,
    color,
    borderRadius: '4px',
    padding:      '2px 8px',
    fontSize:     '0.72rem',
    fontWeight:   600,
    whiteSpace:   'nowrap',
    flexShrink:   0,
  });

  const iconBtnStyle = (disabled) => ({
    background:   disabled ? '#f1f5f9' : '#f8fafc',
    border:       '1px solid #e2e8f0',
    borderRadius: '5px',
    padding:      '4px 8px',
    fontSize:     '0.78rem',
    color:        disabled ? '#cbd5e1' : '#475569',
    cursor:       disabled ? 'not-allowed' : 'pointer',
    fontFamily:   'inherit',
    transition:   'background 100ms',
    flexShrink:   0,
  });

  const saveBtnStyle = {
    background:   dirty && !saving ? '#4f46e5' : '#e2e8f0',
    color:        dirty && !saving ? '#ffffff' : '#64748b',
    border:       'none',
    borderRadius: '5px',
    padding:      '5px 14px',
    fontSize:     '0.8rem',
    fontWeight:   600,
    cursor:       'pointer',
    fontFamily:   'inherit',
    transition:   'background 150ms',
    flexShrink:   0,
  };

  return (
    <div style={topBarStyle}>
      {/* Back link */}
      <a href="/admin/designer" style={backLinkStyle}>
        ← Pages
      </a>

      <div style={{ width: '1px', height: '20px', background: '#e2e8f0', flexShrink: 0 }} />

      {/* Editable page name */}
      <input
        style={nameInputStyle}
        value={page?.name ?? ''}
        onChange={(e) => designer.updatePageMeta({ name: e.target.value })}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        placeholder="Page name"
        spellCheck={false}
      />

      {/* Publish status badge */}
      <span style={badgeStyle(pageBadge.bg, pageBadge.color)}>
        {pageBadge.label}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Save status */}
      <span style={badgeStyle(statusBadge.bg, statusBadge.color)}>
        {statusBadge.label}
      </span>

      {/* Undo / Redo */}
      <button
        style={iconBtnStyle(!canUndo)}
        disabled={!canUndo}
        onClick={designer.undo}
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>
      <button
        style={iconBtnStyle(!canRedo)}
        disabled={!canRedo}
        onClick={designer.redo}
        title="Redo (Ctrl+Y)"
      >
        ↪ Redo
      </button>

      <div style={{ width: '1px', height: '20px', background: '#e2e8f0', flexShrink: 0 }} />

      {/* Export */}
      <button style={iconBtnStyle(false)} onClick={designer.toggleExportImport} title="Export / Import">
        ⬆ Export
      </button>

      {/* Themes */}
      <button style={iconBtnStyle(false)} onClick={designer.toggleThemeEditor} title="Theme Editor">
        🎨 Themes
      </button>

      {/* Save */}
      <button style={saveBtnStyle} onClick={onManualSave} disabled={saving}>
        {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DesignerEditor (main)
// ---------------------------------------------------------------------------

export default function DesignerEditor({ pageId }) {
  const designer = useDesigner();
  const saveTimerRef = useRef(null);

  // ---- Load page on mount ----
  useEffect(() => {
    if (!pageId) return;
    api.get(`/designer/pages/${pageId}`)
      .then((data) => {
        const page = data.page || data;
        designer.loadPage(page, page.tree ?? null, page.theme ?? {});
      })
      .catch((err) => {
        console.error('[DesignerEditor] Failed to load page:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // ---- Auto-save with 1.5s debounce ----
  useEffect(() => {
    if (!designer.dirty || !designer.page) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer.dirty, designer.tree, designer.theme]);

  const performSave = async () => {
    if (!designer.page) return;
    designer.setSaving();
    try {
      await api.patch(`/designer/pages/${pageId}`, {
        tree:  designer.tree,
        theme: designer.theme,
        name:  designer.page?.name,
      });
      designer.setSaved();
    } catch (err) {
      console.error('[DesignerEditor] Auto-save failed:', err);
      designer.setSaved(); // reset saving flag even on failure
    }
  };

  const handleManualSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    performSave();
  };

  // ---- Loading state ----
  if (designer.page === null) {
    return <LoadingSpinner />;
  }

  // ---- Layout ----
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100vh',
      overflow:       'hidden',
      background:     'var(--bg-secondary, #f8fafc)',
    }}>
      {/* Top bar */}
      <TopBar
        designer={designer}
        pageId={pageId}
        onManualSave={handleManualSave}
      />

      {/* Main area: sidebar + canvas */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar designer={designer} />
        <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <Canvas designer={designer} />
        </main>
      </div>

      {/* Footer */}
      <FooterBar designer={designer} />

      {/* Overlays */}
      {designer.contextMenu    && <ContextMenu    designer={designer} />}
      {designer.showThemeEditor && <ThemeEditor   designer={designer} />}
      {designer.showCodeEditor  && <CodeEditor    designer={designer} />}
      {designer.showExportImport && <ExportImport designer={designer} pageId={pageId} />}
    </div>
  );
}
