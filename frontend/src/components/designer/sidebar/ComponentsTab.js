'use client';

import { useState, useMemo } from 'react';
import { CATEGORIES, getComponentsByCategory } from '../registry.js';

// ---------------------------------------------------------------------------
// ComponentsTab
// ---------------------------------------------------------------------------

export default function ComponentsTab({ designer }) {
  const [query,     setQuery]     = useState('');
  const [collapsed, setCollapsed] = useState({});

  // Build filtered components per category
  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((cat) => {
      const all = getComponentsByCategory(cat.id);
      const components = q
        ? all.filter(
            (c) =>
              c.label.toLowerCase().includes(q) ||
              (c.description && c.description.toLowerCase().includes(q)),
          )
        : all;
      return { ...cat, components };
    }).filter((cat) => cat.components.length > 0);
  }, [query]);

  const toggleCategory = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e, comp) => {
    e.dataTransfer.effectAllowed = 'copy';
    designer.setDragSource({ kind: 'new', componentType: comp.type });
  };

  const handleDragEnd = () => {
    // cleared by the canvas on drop; no-op here
  };

  const handleCardClick = (comp) => {
    const parentId = designer.tree?.id ?? 'root';
    const index    = designer.tree?.children?.length ?? 0;
    designer.dropNode(
      { kind: 'new', componentType: comp.type },
      { parentId, index },
    );
    // Switch to settings to inspect the just-added node
    designer.setSidebarTab('settings');
  };

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
      }}
    >
      {/* Search input */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search components…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width:        '100%',
            padding:      '8px 12px',
            border:       '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize:     '0.85rem',
            outline:      'none',
            boxSizing:    'border-box',
            background:   '#fafafa',
            color:        '#1e293b',
          }}
        />
        {query && (
          <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
            Showing results matching &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* Category list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filteredCategories.length === 0 && (
          <div
            style={{
              textAlign:  'center',
              padding:    '32px 16px',
              fontSize:   '0.8rem',
              color:      '#94a3b8',
            }}
          >
            No components match &ldquo;{query}&rdquo;
          </div>
        )}

        {filteredCategories.map((cat) => {
          const isOpen = !collapsed[cat.id]; // default open
          return (
            <div key={cat.id} style={{ marginBottom: '2px' }}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '6px',
                  width:          '100%',
                  padding:        '6px 12px',
                  background:     'transparent',
                  border:         'none',
                  cursor:         'pointer',
                  textAlign:      'left',
                  fontSize:       '0.75rem',
                  fontWeight:     600,
                  color:          '#475569',
                  letterSpacing:  '0.02em',
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>{cat.icon}</span>
                <span style={{ flex: 1 }}>{cat.label}</span>
                <span
                  style={{
                    fontSize:  '0.65rem',
                    color:     '#94a3b8',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 150ms',
                    display:   'inline-block',
                  }}
                >
                  ▼
                </span>
                <span
                  style={{
                    fontSize:     '0.65rem',
                    color:        '#94a3b8',
                    background:   '#f1f5f9',
                    padding:      '1px 5px',
                    borderRadius: '8px',
                    marginLeft:   '4px',
                  }}
                >
                  {cat.components.length}
                </span>
              </button>

              {/* Component grid */}
              {isOpen && (
                <div
                  style={{
                    display:             'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap:                 '6px',
                    padding:             '4px 10px 8px',
                  }}
                >
                  {cat.components.map((comp) => (
                    <ComponentCard
                      key={comp.type}
                      comp={comp}
                      catColor={cat.color}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComponentCard
// ---------------------------------------------------------------------------

function ComponentCard({ comp, catColor, onDragStart, onDragEnd, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable="true"
      onDragStart={(e) => onDragStart(e, comp)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(comp)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={comp.description || comp.label}
      style={{
        background:   catColor || '#f8fafc',
        border:       '1px solid rgba(0,0,0,0.06)',
        borderRadius: '8px',
        padding:      '10px 8px',
        cursor:       'grab',
        fontSize:     '0.8rem',
        textAlign:    'center',
        userSelect:   'none',
        transition:   'box-shadow 120ms, filter 120ms',
        boxShadow:    hovered ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
        filter:       hovered ? 'brightness(0.96)' : 'none',
      }}
    >
      <div style={{ fontSize: '1.25rem', lineHeight: 1.2, marginBottom: '4px' }}>{comp.icon}</div>
      <div
        style={{
          fontWeight:   500,
          color:        '#1e293b',
          fontSize:     '0.72rem',
          lineHeight:   1.3,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        {comp.label}
      </div>
      {comp.description && (
        <div
          style={{
            marginTop:    '3px',
            fontSize:     '0.62rem',
            color:        '#64748b',
            lineHeight:   1.3,
            overflow:     'hidden',
            display:      '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {comp.description}
        </div>
      )}
    </div>
  );
}
