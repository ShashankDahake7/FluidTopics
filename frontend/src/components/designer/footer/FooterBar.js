'use client';

import { useState } from 'react';
import { getNodePath } from '../treeUtils.js';
import { getComponent } from '../registry.js';

// ---------------------------------------------------------------------------
// Breakpoint definitions
// ---------------------------------------------------------------------------

const BREAKPOINTS = [
  { id: 'mobile',  label: 'Mobile',  icon: '📱', width: '375px' },
  { id: 'tablet',  label: 'Tablet',  icon: '💻', width: '768px' },
  { id: 'desktop', label: 'Desktop', icon: '🖥️', width: 'Full'  },
];

// ---------------------------------------------------------------------------
// FooterBar
// ---------------------------------------------------------------------------

export default function FooterBar({ designer }) {
  return (
    <div
      style={{
        height:      '40px',
        background:  '#ffffff',
        borderTop:   '1px solid #e2e8f0',
        display:     'flex',
        alignItems:  'center',
        padding:     '0 16px',
        gap:         '16px',
        fontSize:    '0.8rem',
        flexShrink:  0,
        userSelect:  'none',
      }}
    >
      {/* LEFT — Breadcrumb */}
      <BreadcrumbSection designer={designer} />

      {/* CENTER — Breakpoint controls */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <BreakpointControls designer={designer} />
      </div>

      {/* RIGHT — Status indicators */}
      <StatusIndicators designer={designer} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb section
// ---------------------------------------------------------------------------

function BreadcrumbSection({ designer }) {
  const { tree, selectedId, page } = designer;

  if (!selectedId || !tree) {
    // Show page type + name when nothing is selected
    return (
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
          color:      '#64748b',
          minWidth:   0,
          flex:       1,
          overflow:   'hidden',
        }}
      >
        <span style={{ opacity: 0.6 }}>📄</span>
        <span
          style={{
            fontWeight:   500,
            color:        '#475569',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {page?.type || 'page'}
        </span>
        {page?.name && (
          <>
            <span style={{ color: '#cbd5e1' }}>›</span>
            <span
              style={{
                color:        '#94a3b8',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {page.name}
            </span>
          </>
        )}
      </div>
    );
  }

  const path = getNodePath(tree, selectedId);

  if (!path || path.length === 0) {
    return <div style={{ flex: 1 }} />;
  }

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '4px',
        color:      '#64748b',
        minWidth:   0,
        flex:       1,
        overflow:   'hidden',
        flexWrap:   'nowrap',
      }}
    >
      {path.map((node, index) => {
        const def    = getComponent(node.type);
        const icon   = def?.icon  || '📦';
        const label  = node.label || node.type;
        const isLast = index === path.length - 1;

        return (
          <span
            key={node.id}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}
          >
            {index > 0 && (
              <span style={{ color: '#cbd5e1', flexShrink: 0 }}>›</span>
            )}
            <button
              onClick={() => designer.selectNode(node.id)}
              title={label}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '3px',
                background:   'none',
                border:       'none',
                cursor:       'pointer',
                padding:      '2px 4px',
                borderRadius: '4px',
                fontSize:     '0.8rem',
                fontWeight:   isLast ? 600 : 400,
                color:        isLast ? '#4f46e5' : '#64748b',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                maxWidth:     '120px',
                transition:   'background 80ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: '0.75rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
              <span
                style={{
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {label}
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakpoint controls
// ---------------------------------------------------------------------------

function BreakpointControls({ designer }) {
  const active = designer.breakpoint;

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '2px',
        background:   '#f8fafc',
        border:       '1px solid #e2e8f0',
        borderRadius: '6px',
        padding:      '2px',
      }}
    >
      {BREAKPOINTS.map((bp) => {
        const isActive = active === bp.id;
        return (
          <button
            key={bp.id}
            onClick={() => designer.setBreakpoint(bp.id)}
            title={`${bp.label} (${bp.width})`}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            '4px',
              padding:        '3px 8px',
              borderRadius:   '4px',
              border:         'none',
              cursor:         'pointer',
              fontSize:       '0.75rem',
              fontWeight:     isActive ? 600 : 400,
              background:     isActive ? '#4f46e5' : 'transparent',
              color:          isActive ? '#ffffff' : '#64748b',
              transition:     'background 120ms, color 120ms',
              whiteSpace:     'nowrap',
            }}
          >
            <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{bp.icon}</span>
            <span>{bp.label}</span>
            <span
              style={{
                fontSize:  '0.65rem',
                opacity:   isActive ? 0.8 : 0.5,
                fontWeight: 400,
              }}
            >
              {bp.width}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status indicators
// ---------------------------------------------------------------------------

function StatusIndicators({ designer }) {
  const { dirty, saving } = designer;

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '12px',
        flexShrink: 0,
        color:      '#94a3b8',
      }}
    >
      {/* Saving spinner */}
      {saving && (
        <span
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '4px',
            color:      '#64748b',
          }}
        >
          <SpinnerIcon />
          <span>Saving…</span>
        </span>
      )}

      {/* Saved / Unsaved */}
      {!saving && (
        <span
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '5px',
            color:      dirty ? '#d97706' : '#059669',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width:        '7px',
              height:       '7px',
              borderRadius: '50%',
              background:   dirty ? '#d97706' : '#059669',
              display:      'inline-block',
              flexShrink:   0,
            }}
          />
          {dirty ? 'Unsaved changes' : 'Saved'}
        </span>
      )}

      {/* Keyboard hint */}
      <span
        style={{
          color:    '#cbd5e1',
          fontSize: '0.72rem',
        }}
      >
        Ctrl+Z to undo
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny spinner SVG
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      style={{ animation: 'ft-spin 0.8s linear infinite' }}
    >
      <style>{`
        @keyframes ft-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <circle
        cx="6" cy="6" r="4.5"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="14 6"
      />
    </svg>
  );
}
