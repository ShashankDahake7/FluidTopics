'use client';

import ComponentNode from './ComponentNode.js';

// ---------------------------------------------------------------------------
// Breakpoint config
// ---------------------------------------------------------------------------

const BREAKPOINTS = {
  desktop: { label: 'Desktop', width: '100%',  maxWidth: '100%'  },
  tablet:  { label: 'Tablet',  width: '768px', maxWidth: '768px' },
  mobile:  { label: 'Mobile',  width: '375px', maxWidth: '375px' },
};

// ---------------------------------------------------------------------------
// Root drop zone (canvas background drop target)
// ---------------------------------------------------------------------------

function RootDropZone({ designer, position }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!designer.tree) return;
    const idx = position === 'start' ? 0 : (designer.tree.children?.length ?? 0);
    designer.setDragTarget({ parentId: designer.tree.id, index: idx });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (designer.dragSource && designer.dragTarget) {
      designer.dropNode(designer.dragSource, designer.dragTarget);
    }
    designer.clearDrag();
  };

  const isDragging = !!designer.dragSource;
  const idx = position === 'start' ? 0 : (designer.tree?.children?.length ?? 0);
  const matches =
    designer.dragTarget &&
    designer.dragTarget.parentId === designer.tree?.id &&
    designer.dragTarget.index === idx;

  if (!isDragging) return null;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        height:     matches ? '6px' : '8px',
        margin:     '2px 0',
        borderRadius: '3px',
        background: matches ? '#4f46e5' : 'rgba(79,70,229,0.15)',
        transition: 'all 100ms ease',
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ designer }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!designer.tree) return;
    designer.setDragTarget({ parentId: designer.tree.id, index: 0 });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (designer.dragSource && designer.dragTarget) {
      designer.dropNode(designer.dragSource, designer.dragTarget);
    }
    designer.clearDrag();
  };

  const isTarget = !!designer.dragSource;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '320px',
        border:         isTarget ? '2px dashed #4f46e5' : '2px dashed #cbd5e1',
        borderRadius:   '12px',
        background:     isTarget ? 'rgba(79,70,229,0.04)' : 'rgba(255,255,255,0.6)',
        color:          '#94a3b8',
        fontSize:       '0.9rem',
        gap:            '10px',
        transition:     'all 150ms ease',
        padding:        '32px',
        userSelect:     'none',
      }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="8" height="8" rx="1.5"/>
        <rect x="13" y="3" width="8" height="8" rx="1.5"/>
        <rect x="3" y="13" width="8" height="8" rx="1.5"/>
        <rect x="13" y="13" width="8" height="8" rx="1.5"/>
      </svg>
      <span style={{ fontWeight: 500, color: '#64748b' }}>
        Drag components here to start building
      </span>
      <span style={{ fontSize: '0.78rem' }}>
        Choose from the Components panel on the left
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export default function Canvas({ designer }) {
  const { breakpoint, tree, dragSource, dragTarget } = designer;
  const bp = BREAKPOINTS[breakpoint] || BREAKPOINTS.desktop;

  const hasChildren = tree?.children && tree.children.length > 0;

  // Canvas outer area drag-over handler (fallback drop target for root)
  const handleCanvasDragOver = (e) => {
    // Only handle the canvas background — stop if already handled by a child
    e.preventDefault();
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (dragSource && dragTarget) {
      designer.dropNode(dragSource, dragTarget);
    } else if (dragSource && tree) {
      // Fallback: drop at end of root
      designer.dropNode(dragSource, { parentId: tree.id, index: tree.children?.length ?? 0 });
    }
    designer.clearDrag();
  };

  // Dot-grid background pattern
  const canvasStyle = {
    minHeight:  '100%',
    background: `
      radial-gradient(circle, rgba(148,163,184,0.4) 1px, transparent 1px)
    `,
    backgroundSize: '20px 20px',
    backgroundColor: '#f1f5f9',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    padding:        '24px 16px 48px',
  };

  // Page frame (white area representing the rendered page)
  const pageFrameStyle = {
    width:        bp.width === '100%' ? '100%' : bp.maxWidth,
    maxWidth:     bp.maxWidth,
    background:   '#ffffff',
    borderRadius: breakpoint === 'desktop' ? '0' : '8px',
    boxShadow:    breakpoint === 'desktop'
      ? 'none'
      : '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
    padding:      '0',
    overflow:     'hidden',
    transition:   'max-width 250ms ease',
  };

  // Top info bar
  const infoBandStyle = {
    width:          bp.width === '100%' ? '100%' : bp.maxWidth,
    maxWidth:       bp.maxWidth,
    background:     '#e2e8f0',
    borderBottom:   '1px solid #cbd5e1',
    padding:        '4px 14px',
    fontSize:       '0.72rem',
    color:          '#64748b',
    display:        'flex',
    alignItems:     'center',
    gap:            '8px',
    fontFamily:     'var(--font-mono, monospace)',
    letterSpacing:  '0.01em',
    marginBottom:   '0',
    borderRadius:   breakpoint === 'desktop' ? '0' : '8px 8px 0 0',
    transition:     'max-width 250ms ease',
  };

  const pageContentStyle = {
    padding:      '16px',
    minHeight:    '400px',
    display:      'flex',
    flexDirection:'column',
  };

  return (
    <div
      style={canvasStyle}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      {/* Breakpoint info band */}
      <div style={infoBandStyle}>
        <span style={{
          background: '#4f46e5',
          color: '#fff',
          borderRadius: '3px',
          padding: '1px 6px',
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {bp.label}
        </span>
        <span>{bp.width === '100%' ? 'Full width' : bp.maxWidth}</span>
      </div>

      {/* Page frame */}
      <div style={pageFrameStyle}>
        <div style={pageContentStyle}>
          {!tree || !hasChildren ? (
            <EmptyState designer={designer} />
          ) : (
            <>
              <RootDropZone designer={designer} position="start" />
              {tree.children.map((child, i) => (
                <div key={child.id}>
                  <ComponentNode
                    node={child}
                    designer={designer}
                    parentId={tree.id}
                    index={i}
                  />
                  <RootDropZone designer={designer} position="end" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
