'use client';

import ComponentsTab from './ComponentsTab.js';
import SettingsTab   from './SettingsTab.js';
import StylesTab     from './StylesTab.js';
import DOMTreeTab    from './DOMTreeTab.js';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'components', label: 'Components', icon: '📦' },
  { id: 'settings',   label: 'Settings',   icon: '⚙️'  },
  { id: 'styles',     label: 'Styles',     icon: '🎨'  },
  { id: 'dom',        label: 'DOM Tree',   icon: '🌳'  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({ designer }) {
  const activeTab = designer.sidebarTab;

  return (
    <div
      style={{
        width:         '280px',
        flexShrink:    0,
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        background:    '#ffffff',
        borderRight:   '1px solid #e2e8f0',
        overflow:      'hidden',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Tab bar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display:         'flex',
          height:          '48px',
          flexShrink:      0,
          borderBottom:    '1px solid #e2e8f0',
          background:      '#fafafa',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => designer.setSidebarTab(tab.id)}
              title={tab.label}
              style={{
                flex:           1,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            '2px',
                border:         'none',
                background:     'transparent',
                cursor:         'pointer',
                fontSize:       '0.6rem',
                fontWeight:     isActive ? 600 : 400,
                color:          isActive ? '#4f46e5' : '#64748b',
                borderBottom:   isActive ? '2px solid #4f46e5' : '2px solid transparent',
                padding:        '0 4px',
                transition:     'color 120ms, border-color 120ms',
                outline:        'none',
              }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active tab content (fills remaining height, scrolls internally)     */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'components' && <ComponentsTab designer={designer} />}
        {activeTab === 'settings'   && <SettingsTab   designer={designer} />}
        {activeTab === 'styles'     && <StylesTab     designer={designer} />}
        {activeTab === 'dom'        && <DOMTreeTab    designer={designer} />}
      </div>
    </div>
  );
}
