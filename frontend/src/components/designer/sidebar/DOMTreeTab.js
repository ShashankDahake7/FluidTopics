'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { getComponent } from '../registry.js';
import { flattenTree   } from '../treeUtils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isContainer(node) {
  const comp = getComponent(node?.type);
  return comp?.canHaveChildren === true && Array.isArray(node?.children);
}

// Build the initial expanded set: all container node IDs start expanded
function buildInitialExpanded(tree) {
  if (!tree) return new Set();
  const flat = flattenTree(tree);
  return new Set(flat.filter((n) => isContainer(n)).map((n) => n.id));
}

// ---------------------------------------------------------------------------
// Color picker button (small swatch that opens hidden <input type="color">)
// ---------------------------------------------------------------------------

function ColorSwatch({ nodeId, currentColor, designer }) {
  const ref = useRef(null);

  const handleSwatchClick = (e) => {
    e.stopPropagation();
    ref.current?.click();
  };

  const handleColorChange = (e) => {
    designer.updateNodeStyle(nodeId, 'base', { background: e.target.value });
  };

  return (
    <span
      onClick={handleSwatchClick}
      title="Set background color"
      style={{
        display:      'inline-block',
        width:        '12px',
        height:       '12px',
        borderRadius: '3px',
        background:   currentColor || '#e2e8f0',
        border:       '1px solid rgba(0,0,0,0.15)',
        cursor:       'pointer',
        flexShrink:   0,
        position:     'relative',
      }}
    >
      <input
        ref={ref}
        type="color"
        defaultValue={currentColor || '#ffffff'}
        onChange={handleColorChange}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          opacity:  0,
          width:    '1px',
          height:   '1px',
          top:      0,
          left:     0,
          pointerEvents: 'none',
        }}
        tabIndex={-1}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// ContextMiniMenu  — shown on right-click
// ---------------------------------------------------------------------------

function ContextMiniMenu({ node, designer, onClose }) {
  return (
    <div
      style={{
        position:     'absolute',
        right:        '6px',
        top:          '100%',
        zIndex:       100,
        background:   '#1e293b',
        borderRadius: '6px',
        padding:      '4px 0',
        boxShadow:    '0 4px 16px rgba(0,0,0,0.2)',
        minWidth:     '130px',
      }}
    >
      {[
        { label: 'Duplicate', action: () => { designer.duplicateNode(node.id); onClose(); } },
        { label: 'Copy',      action: () => { designer.copyNode(node.id);      onClose(); } },
        {
          label:  'Delete',
          action: () => { designer.deleteNode(node.id); onClose(); },
          danger: true,
        },
      ].map(({ label, action, danger }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); action(); }}
          style={{
            display:    'block',
            width:      '100%',
            padding:    '6px 12px',
            background: 'transparent',
            border:     'none',
            color:      danger ? '#f87171' : '#e2e8f0',
            cursor:     'pointer',
            fontSize:   '0.75rem',
            textAlign:  'left',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeRow — one row in the DOM tree
// ---------------------------------------------------------------------------

function TreeRow({ node, depth, expanded, toggleExpand, designer, query }) {
  const [showMenu, setShowMenu] = useState(false);

  const comp         = getComponent(node.type);
  const isSelected   = designer.selectedId  === node.id;
  const isHovered    = designer.hoveredId   === node.id;
  const isExpanded   = expanded.has(node.id);
  const canExpand    = isContainer(node);
  const bgColor      = node.style?.base?.background ?? '';
  const hasChildren  = canExpand && node.children?.length > 0;

  const matchesQuery =
    query &&
    (
      (node.label || '').toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query)
    );

  const handleClick = (e) => {
    e.stopPropagation();
    designer.selectNode(node.id);
  };

  const handleMouseEnter = () => designer.hoverNode(node.id);
  const handleMouseLeave = () => designer.hoverNode(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleExpand(node.id);
  };

  // Drag handle (visual only)
  const handleDragStart = (e) => {
    e.stopPropagation();
    designer.setDragSource({ kind: 'move', nodeId: node.id });
  };
  const handleDragEnd = () => designer.clearDrag();

  const rowBackground = isSelected
    ? 'rgba(79,70,229,0.08)'
    : isHovered
    ? 'rgba(0,0,0,0.04)'
    : matchesQuery
    ? 'rgba(250,204,21,0.18)'
    : 'transparent';

  return (
    <div style={{ position: 'relative' }}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '4px',
          padding:     `4px 8px 4px ${8 + depth * 14}px`,
          cursor:      'pointer',
          background:  rowBackground,
          userSelect:  'none',
          borderLeft:  isSelected ? '2px solid #4f46e5' : '2px solid transparent',
        }}
      >
        {/* Drag handle */}
        <span
          style={{
            color:     '#cbd5e1',
            fontSize:  '0.65rem',
            cursor:    'grab',
            flexShrink: 0,
          }}
          title="Drag to reorder (use canvas)"
        >
          ⋮⋮
        </span>

        {/* Expand / collapse toggle */}
        <span
          onClick={canExpand ? handleToggle : undefined}
          style={{
            width:     '14px',
            fontSize:  '0.6rem',
            color:     '#94a3b8',
            flexShrink: 0,
            cursor:    canExpand ? 'pointer' : 'default',
            textAlign: 'center',
            transform: canExpand && isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms',
            display:   'inline-block',
          }}
        >
          {canExpand ? '▶' : '·'}
        </span>

        {/* Component icon */}
        <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{comp?.icon || '?'}</span>

        {/* Label */}
        <span
          style={{
            flex:         1,
            fontSize:     '0.75rem',
            fontWeight:   isSelected ? 600 : 400,
            color:        isSelected ? '#4f46e5' : '#1e293b',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {node.label || comp?.label || node.type}
        </span>

        {/* Type badge */}
        <span
          style={{
            fontSize:     '0.6rem',
            color:        '#94a3b8',
            background:   '#f1f5f9',
            padding:      '1px 4px',
            borderRadius: '3px',
            flexShrink:   0,
            maxWidth:     '70px',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {node.type}
        </span>

        {/* Color swatch */}
        <ColorSwatch
          nodeId={node.id}
          currentColor={bgColor}
          designer={designer}
        />
      </div>

      {/* Context mini-menu */}
      {showMenu && (
        <>
          {/* Overlay to close menu */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setShowMenu(false)}
            onContextMenu={(e) => { e.preventDefault(); setShowMenu(false); }}
          />
          <ContextMiniMenu
            node={node}
            designer={designer}
            onClose={() => setShowMenu(false)}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive tree renderer
// ---------------------------------------------------------------------------

function TreeBranch({ node, depth, expanded, toggleExpand, designer, query }) {
  const isExpanded   = expanded.has(node.id);
  const canExpand    = isContainer(node);
  const children     = node.children || [];

  return (
    <>
      <TreeRow
        node={node}
        depth={depth}
        expanded={expanded}
        toggleExpand={toggleExpand}
        designer={designer}
        query={query}
      />
      {canExpand && isExpanded && children.map((child) => (
        <TreeBranch
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          designer={designer}
          query={query}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// DOMTreeTab
// ---------------------------------------------------------------------------

export default function DOMTreeTab({ designer }) {
  const { tree } = designer;

  const [query,    setQuery]    = useState('');
  const [expanded, setExpanded] = useState(() => buildInitialExpanded(tree));

  // Keep expanded set in sync when tree changes (add any new containers)
  // We do this with a simple memo on tree reference
  const syncedExpanded = useMemo(() => {
    if (!tree) return new Set();
    const flat = flattenTree(tree);
    const next = new Set(expanded);
    flat.forEach((n) => {
      if (isContainer(n) && !next.has(n.id)) next.add(n.id);
    });
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    // "Select all" in the DOM tree context means expanding all containers
    if (!tree) return;
    const flat = flattenTree(tree);
    setExpanded(new Set(flat.filter((n) => isContainer(n)).map((n) => n.id)));
  };

  const normalizedQuery = query.trim().toLowerCase();

  if (!tree) {
    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '100%',
          gap:            '10px',
          color:          '#94a3b8',
          textAlign:      'center',
          padding:        '24px',
        }}
      >
        <span style={{ fontSize: '2rem' }}>🌳</span>
        <span style={{ fontSize: '0.85rem' }}>No page loaded. The component tree will appear here.</span>
      </div>
    );
  }

  // Flatten to get node count
  const allNodes = flattenTree(tree);

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding:      '8px 10px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink:   0,
          display:      'flex',
          gap:          '6px',
          alignItems:   'center',
        }}
      >
        <input
          type="text"
          placeholder="Filter nodes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex:         1,
            padding:      '5px 8px',
            border:       '1px solid #e2e8f0',
            borderRadius: '5px',
            fontSize:     '0.78rem',
            outline:      'none',
            background:   '#fafafa',
            color:        '#1e293b',
          }}
        />
        <button
          onClick={handleSelectAll}
          title="Expand all containers"
          style={{
            padding:      '5px 8px',
            border:       '1px solid #e2e8f0',
            borderRadius: '5px',
            background:   '#fafafa',
            color:        '#64748b',
            cursor:       'pointer',
            fontSize:     '0.72rem',
            flexShrink:   0,
          }}
        >
          Expand All
        </button>
      </div>

      {/* Node count */}
      <div
        style={{
          padding:      '4px 12px',
          fontSize:     '0.65rem',
          color:        '#94a3b8',
          borderBottom: '1px solid #f1f5f9',
          flexShrink:   0,
          background:   '#fafafa',
        }}
      >
        {allNodes.length} node{allNodes.length !== 1 ? 's' : ''}
        {normalizedQuery && ` · filtering by "${normalizedQuery}"`}
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tree.children && tree.children.length === 0 ? (
          <div
            style={{
              textAlign:  'center',
              padding:    '24px 16px',
              fontSize:   '0.8rem',
              color:      '#94a3b8',
            }}
          >
            The canvas is empty. Add components from the Components tab.
          </div>
        ) : (
          <>
            {/* Show root node itself if it matches query, or always if no query */}
            {(!normalizedQuery ||
              tree.type.includes(normalizedQuery) ||
              (tree.label || '').toLowerCase().includes(normalizedQuery)
            ) && (
              <TreeRow
                node={tree}
                depth={0}
                expanded={syncedExpanded}
                toggleExpand={toggleExpand}
                designer={designer}
                query={normalizedQuery}
              />
            )}
            {/* Render children of the root */}
            {syncedExpanded.has(tree.id) &&
              (tree.children || []).map((child) => (
                <TreeBranch
                  key={child.id}
                  node={child}
                  depth={1}
                  expanded={syncedExpanded}
                  toggleExpand={toggleExpand}
                  designer={designer}
                  query={normalizedQuery}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
