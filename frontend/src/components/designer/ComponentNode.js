'use client';

import { getComponent } from './registry.js';

// ---------------------------------------------------------------------------
// Drop Zone
// ---------------------------------------------------------------------------

function DropZone({ parentId, index, designer, isActive }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    designer.setDragTarget({ parentId, index });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (designer.dragSource && designer.dragTarget) {
      designer.dropNode(designer.dragSource, designer.dragTarget);
    }
    designer.clearDrag();
  };

  const isDragging = !!designer.dragSource;
  const matches =
    designer.dragTarget &&
    designer.dragTarget.parentId === parentId &&
    designer.dragTarget.index === index;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        height: isDragging ? (matches ? '6px' : '8px') : '4px',
        margin: isDragging ? '2px 0' : '1px 0',
        borderRadius: '3px',
        background: matches ? '#4f46e5' : isDragging ? 'rgba(79,70,229,0.15)' : 'transparent',
        transition: 'all 100ms ease',
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ComponentNode
// ---------------------------------------------------------------------------

export default function ComponentNode({ node, designer, parentId, index, isRoot }) {
  const component = getComponent(node.type);

  if (!component) {
    return (
      <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
        Unknown component: {node.type}
      </div>
    );
  }

  const isSelected = designer.selectedId === node.id;
  const isHovered  = designer.hoveredId === node.id;
  const isDragging = !!designer.dragSource;

  // ---- border style ----
  let border;
  if (isSelected) {
    border = '2px solid #4f46e5';
  } else if (isHovered) {
    border = '1px dashed #94a3b8';
  } else {
    border = '1px solid rgba(0,0,0,0.08)';
  }

  const boxShadow = isSelected ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none';

  const baseStyle = node.style?.base || {};

  const wrapperStyle = {
    position:     'relative',
    minHeight:    '40px',
    padding:      '10px 12px',
    borderRadius: '6px',
    background:   component.previewColor || '#f8fafc',
    border,
    boxShadow,
    cursor:       'pointer',
    userSelect:   'none',
    marginTop:    '2px',
    ...baseStyle,
  };

  // ---- handlers ----
  const handleClick = (e) => {
    e.stopPropagation();
    designer.selectNode(node.id);
    designer.setSidebarTab('settings');
  };

  const handleMouseEnter = (e) => {
    e.stopPropagation();
    designer.hoverNode(node.id);
  };

  const handleMouseLeave = (e) => {
    e.stopPropagation();
    designer.hoverNode(null);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    designer.showContextMenu(e.clientX, e.clientY, node.id);
  };

  const handleDragStart = (e) => {
    e.stopPropagation();
    designer.setDragSource({ kind: 'move', nodeId: node.id });
  };

  const handleDragEnd = (e) => {
    designer.clearDrag();
  };

  // ---- label bar actions ----
  const handleMoveUp = (e) => {
    e.stopPropagation();
    designer.moveUp(node.id);
  };

  const handleMoveDown = (e) => {
    e.stopPropagation();
    designer.moveDown(node.id);
  };

  const handleDuplicate = (e) => {
    e.stopPropagation();
    designer.duplicateNode(node.id);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    designer.deleteNode(node.id);
  };

  const showLabel = isSelected || isHovered;

  const labelBarStyle = {
    position:     'absolute',
    top:          '-22px',
    left:         0,
    background:   '#4f46e5',
    color:        '#ffffff',
    fontSize:     '0.68rem',
    padding:      '2px 7px',
    borderRadius: '4px 4px 0 0',
    display:      showLabel ? 'flex' : 'none',
    alignItems:   'center',
    gap:          '4px',
    whiteSpace:   'nowrap',
    zIndex:       20,
    lineHeight:   1.4,
    pointerEvents: isSelected ? 'auto' : 'none',
  };

  const actionBtnStyle = {
    background:   'rgba(255,255,255,0.2)',
    border:       'none',
    color:        '#ffffff',
    cursor:       'pointer',
    fontSize:     '0.68rem',
    padding:      '1px 4px',
    borderRadius: '3px',
    lineHeight:   1.3,
    marginLeft:   '2px',
    display:      isSelected ? 'inline-block' : 'none',
  };

  // ---- children / placeholder ----
  const hasChildren = Array.isArray(node.children);
  const canHaveChildren = component.canHaveChildren;
  const children = node.children || [];

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      style={wrapperStyle}
    >
      {/* Label bar */}
      <div style={labelBarStyle}>
        <span>{component.icon} {node.label || component.label}</span>
        <button style={actionBtnStyle} onClick={handleMoveUp} title="Move Up">↑</button>
        <button style={actionBtnStyle} onClick={handleMoveDown} title="Move Down">↓</button>
        <button style={actionBtnStyle} onClick={handleDuplicate} title="Duplicate">⧉</button>
        <button
          style={{ ...actionBtnStyle, background: 'rgba(239,68,68,0.5)' }}
          onClick={handleDelete}
          title="Delete"
        >
          ×
        </button>
      </div>

      {/* Component content */}
      {canHaveChildren ? (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '30px' }}>
          {children.length === 0 ? (
            <>
              <DropZone parentId={node.id} index={0} designer={designer} />
              <div
                style={{
                  border:       '1.5px dashed #cbd5e1',
                  borderRadius: '5px',
                  padding:      '12px 10px',
                  textAlign:    'center',
                  fontSize:     '0.75rem',
                  color:        '#94a3b8',
                  margin:       '4px 0',
                  background:   'rgba(255,255,255,0.5)',
                }}
              >
                {component.icon} {component.label} — Drop components here
              </div>
            </>
          ) : (
            <>
              <DropZone parentId={node.id} index={0} designer={designer} />
              {children.map((child, i) => (
                <div key={child.id}>
                  <ComponentNode
                    node={child}
                    designer={designer}
                    parentId={node.id}
                    index={i}
                  />
                  <DropZone parentId={node.id} index={i + 1} designer={designer} />
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#475569' }}>
          <span style={{ fontSize: '1.2rem' }}>{component.icon}</span>
          <span style={{ fontWeight: 500 }}>{node.label || component.label}</span>
        </div>
      )}
    </div>
  );
}
