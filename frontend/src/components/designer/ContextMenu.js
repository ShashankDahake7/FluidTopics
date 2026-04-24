'use client';

import { useEffect, useRef, useState } from 'react';

export default function ContextMenu({ designer }) {
  const { contextMenu } = designer;
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Clamp position to viewport bounds after mount / when contextMenu changes
  useEffect(() => {
    if (!contextMenu) return;
    const { x, y } = contextMenu;
    const menuEl = menuRef.current;
    if (!menuEl) {
      setPos({ x, y });
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menuEl.getBoundingClientRect();

    const clampedX = Math.min(x, vw - rect.width  - 8);
    const clampedY = Math.min(y, vh - rect.height - 8);

    setPos({ x: Math.max(8, clampedX), y: Math.max(8, clampedY) });
  }, [contextMenu]);

  // Dismiss on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        designer.hideContextMenu();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        designer.hideContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, designer]);

  if (!contextMenu) return null;

  const nodeId = contextMenu.nodeId;

  const handleRename = () => {
    const current = designer.selectedNode?.label || '';
    const newLabel = window.prompt('Rename component:', current);
    if (newLabel !== null && newLabel.trim() !== '') {
      designer.updateNodeLabel(nodeId, newLabel.trim());
    }
    designer.hideContextMenu();
  };

  const handleDuplicate = () => {
    designer.duplicateNode(nodeId);
    designer.hideContextMenu();
  };

  const handleCopy = () => {
    designer.copyNode(nodeId);
    designer.hideContextMenu();
  };

  const handlePaste = () => {
    designer.pasteNode();
    designer.hideContextMenu();
  };

  const handleMoveUp = () => {
    designer.moveUp(nodeId);
    designer.hideContextMenu();
  };

  const handleMoveDown = () => {
    designer.moveDown(nodeId);
    designer.hideContextMenu();
  };

  const handleDelete = () => {
    designer.deleteNode(nodeId);
    designer.hideContextMenu();
  };

  // ---- styles ----
  const menuStyle = {
    position:     'fixed',
    left:         pos.x,
    top:          pos.y,
    zIndex:       9999,
    background:   '#ffffff',
    boxShadow:    '0 8px 24px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    minWidth:     '180px',
    padding:      '4px 0',
    border:       '1px solid rgba(0,0,0,0.06)',
    userSelect:   'none',
  };

  const itemStyle = {
    display:        'flex',
    alignItems:     'center',
    gap:            '8px',
    width:          '100%',
    padding:        '8px 14px',
    fontSize:       '0.85rem',
    color:          '#1e293b',
    background:     'none',
    border:         'none',
    cursor:         'pointer',
    textAlign:      'left',
    fontFamily:     'inherit',
    whiteSpace:     'nowrap',
    transition:     'background 80ms',
  };

  const separatorStyle = {
    height:       '1px',
    background:   '#e2e8f0',
    margin:       '4px 0',
  };

  const deleteItemStyle = {
    ...itemStyle,
    color: '#dc2626',
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ContextMenuItem style={itemStyle} onClick={handleRename}>
        ✏️ Rename
      </ContextMenuItem>
      <ContextMenuItem style={itemStyle} onClick={handleDuplicate}>
        ⧉ Duplicate
      </ContextMenuItem>
      <ContextMenuItem style={itemStyle} onClick={handleCopy}>
        📋 Copy
      </ContextMenuItem>
      {designer.clipboard && (
        <ContextMenuItem style={itemStyle} onClick={handlePaste}>
          📌 Paste
        </ContextMenuItem>
      )}
      <ContextMenuItem style={itemStyle} onClick={handleMoveUp}>
        ↑ Move Up
      </ContextMenuItem>
      <ContextMenuItem style={itemStyle} onClick={handleMoveDown}>
        ↓ Move Down
      </ContextMenuItem>
      <div style={separatorStyle} />
      <ContextMenuItem style={deleteItemStyle} onClick={handleDelete}>
        🗑️ Delete
      </ContextMenuItem>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helper: menu item with hover state
// ---------------------------------------------------------------------------

function ContextMenuItem({ children, style, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{ ...style, background: hovered ? '#f1f5f9' : 'none' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}
