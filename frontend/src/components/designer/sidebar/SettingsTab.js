'use client';

import { useState } from 'react';
import { getComponent } from '../registry.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANDMARK_OPTIONS = ['none', 'header', 'main', 'nav', 'aside', 'footer'];

const VISIBILITY_CONDITIONS = [
  { value: 'always',         label: 'Always'         },
  { value: 'logged-in',      label: 'When logged in' },
  { value: 'logged-out',     label: 'When logged out'},
  { value: 'role',           label: 'By role'        },
  { value: 'metadata',       label: 'By metadata'    },
  { value: 'device',         label: 'By device'      },
];

const LAYOUT_CATEGORIES = ['layout'];

// Shared section header style
const sectionHeaderStyle = {
  fontSize:      '0.7rem',
  fontWeight:    600,
  color:         '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop:     '16px',
  marginBottom:  '6px',
};

// Shared label style
const fieldLabelStyle = {
  display:       'block',
  fontSize:      '0.75rem',
  fontWeight:    500,
  color:         '#475569',
  marginBottom:  '4px',
};

// Shared input style
const inputStyle = {
  width:        '100%',
  padding:      '6px 8px',
  border:       '1px solid #e2e8f0',
  borderRadius: '5px',
  fontSize:     '0.8rem',
  background:   '#fafafa',
  color:        '#1e293b',
  boxSizing:    'border-box',
  outline:      'none',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// ToggleSwitch (boolean setting)
// ---------------------------------------------------------------------------

function ToggleSwitch({ checked, onChange }) {
  return (
    <label
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        cursor:     'pointer',
        gap:        '8px',
      }}
    >
      <span
        onClick={() => onChange(!checked)}
        style={{
          position:     'relative',
          display:      'inline-block',
          width:        '36px',
          height:       '20px',
          background:   checked ? '#4f46e5' : '#cbd5e1',
          borderRadius: '10px',
          transition:   'background 150ms',
          flexShrink:   0,
          cursor:       'pointer',
        }}
      >
        <span
          style={{
            position:     'absolute',
            top:          '2px',
            left:         checked ? '18px' : '2px',
            width:        '16px',
            height:       '16px',
            background:   '#ffffff',
            borderRadius: '50%',
            transition:   'left 150ms',
            boxShadow:    '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      <span style={{ fontSize: '0.78rem', color: '#475569' }}>
        {checked ? 'Enabled' : 'Disabled'}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ColorField
// ---------------------------------------------------------------------------

function ColorField({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width:        '32px',
          height:       '32px',
          padding:      '1px',
          border:       '1px solid #e2e8f0',
          borderRadius: '4px',
          cursor:       'pointer',
          background:   'none',
          flexShrink:   0,
        }}
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        style={{ ...inputStyle, flex: 1 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArrayField
// ---------------------------------------------------------------------------

function ArrayField({ value, onChange }) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx, newVal) => {
    const next = [...items];
    next[idx] = newVal;
    onChange(next);
  };

  const add = () => onChange([...items, '']);

  const remove = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            value={item}
            onChange={(e) => update(idx, e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => remove(idx)}
            title="Remove"
            style={{
              background:   '#fee2e2',
              border:       'none',
              borderRadius: '4px',
              color:        '#ef4444',
              cursor:       'pointer',
              fontSize:     '0.9rem',
              padding:      '3px 7px',
              flexShrink:   0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={add}
        style={{
          background:   '#f1f5f9',
          border:       '1px dashed #cbd5e1',
          borderRadius: '4px',
          color:        '#64748b',
          cursor:       'pointer',
          fontSize:     '0.75rem',
          padding:      '5px 8px',
          textAlign:    'left',
        }}
      >
        + Add item
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VisibilitySection
// ---------------------------------------------------------------------------

function VisibilitySection({ visibility, onUpdate }) {
  const condition = visibility?.condition ?? 'always';
  const value     = visibility?.value     ?? '';

  const needsValue = ['role', 'metadata', 'device'].includes(condition);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <select
        value={condition}
        onChange={(e) => onUpdate({ condition: e.target.value, value })}
        style={selectStyle}
      >
        {VISIBILITY_CONDITIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {needsValue && (
        <input
          type="text"
          value={value}
          onChange={(e) => onUpdate({ condition, value: e.target.value })}
          placeholder={
            condition === 'role'     ? 'e.g. admin, editor' :
            condition === 'metadata' ? 'e.g. product=API' :
            condition === 'device'   ? 'mobile, tablet, desktop' : ''
          }
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingField — renders a single setting by type
// ---------------------------------------------------------------------------

function SettingField({ setting, value, onChange, selectedId, designer }) {
  switch (setting.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );

    case 'textarea':
      return (
        <textarea
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          style={inputStyle}
        />
      );

    case 'boolean':
      return (
        <ToggleSwitch
          checked={!!value}
          onChange={onChange}
        />
      );

    case 'select':
      return (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
        >
          {(setting.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'array':
      return <ArrayField value={value} onChange={onChange} />;

    case 'color':
      return <ColorField value={value} onChange={onChange} />;

    case 'landmark':
      return (
        <select
          value={value ?? 'none'}
          onChange={(e) => onChange(e.target.value === 'none' ? '' : e.target.value)}
          style={selectStyle}
        >
          {LANDMARK_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'condition':
      // Inline visibility section reuse
      return (
        <VisibilitySection
          visibility={{ condition: value || 'always', value: '' }}
          onUpdate={(vis) => onChange(vis.condition)}
        />
      );

    case 'code-html':
    case 'code-css':
    case 'code-js':
      return (
        <button
          onClick={() => designer.toggleCodeEditor(selectedId)}
          style={{
            background:   '#4f46e5',
            color:        '#ffffff',
            border:       'none',
            borderRadius: '5px',
            padding:      '7px 12px',
            fontSize:     '0.78rem',
            cursor:       'pointer',
            fontWeight:   500,
          }}
        >
          Open Code Editor
        </button>
      );

    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// SettingsTab
// ---------------------------------------------------------------------------

export default function SettingsTab({ designer }) {
  const { selectedId, selectedNode } = designer;

  if (!selectedId || !selectedNode) {
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
        <span style={{ fontSize: '2rem' }}>⚙️</span>
        <span style={{ fontSize: '0.85rem' }}>Select a component on the canvas to edit its settings.</span>
      </div>
    );
  }

  const component  = getComponent(selectedNode.type);
  const props      = selectedNode.props   || {};
  const visibility = selectedNode.visibility || { condition: 'always', value: '' };
  const settings   = component?.settings  || [];

  const handlePropChange = (key, val) => {
    designer.updateNodeProps(selectedId, { [key]: val });
  };

  const handleLabelChange = (e) => {
    designer.updateNodeLabel(selectedId, e.target.value);
  };

  const handleVisibilityChange = (vis) => {
    designer.updateNodeVisibility(selectedId, vis);
  };

  const isLayoutComponent = LAYOUT_CATEGORIES.includes(component?.category);

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflowY:     'auto',
        padding:       '12px',
        gap:           '2px',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Component header                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          padding:      '8px 10px',
          background:   component?.previewColor || '#f8fafc',
          borderRadius: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{component?.icon || '?'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight:   600,
              fontSize:     '0.85rem',
              color:        '#1e293b',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {selectedNode.label || component?.label}
          </div>
          <div
            style={{
              fontSize:     '0.68rem',
              color:        '#64748b',
              background:   'rgba(0,0,0,0.06)',
              padding:      '1px 5px',
              borderRadius: '4px',
              display:      'inline-block',
              marginTop:    '2px',
            }}
          >
            {selectedNode.type}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Label / rename                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div style={sectionHeaderStyle}>General</div>

      <div style={{ marginBottom: '10px' }}>
        <label style={fieldLabelStyle}>Label (display name)</label>
        <input
          type="text"
          value={selectedNode.label || ''}
          onChange={handleLabelChange}
          placeholder={component?.label || 'Component label'}
          style={inputStyle}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Landmark selector (layout/section components only)                 */}
      {/* ------------------------------------------------------------------ */}
      {isLayoutComponent && (
        <div style={{ marginBottom: '10px' }}>
          <label style={fieldLabelStyle}>ARIA Landmark</label>
          <select
            value={props['aria-landmark'] || 'none'}
            onChange={(e) =>
              handlePropChange('aria-landmark', e.target.value === 'none' ? '' : e.target.value)
            }
            style={selectStyle}
          >
            {LANDMARK_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Visibility                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div style={sectionHeaderStyle}>Visibility</div>
      <div style={{ marginBottom: '10px' }}>
        <VisibilitySection
          visibility={visibility}
          onUpdate={handleVisibilityChange}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Component-specific settings                                         */}
      {/* ------------------------------------------------------------------ */}
      {settings.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>Component Settings</div>
          {settings.map((setting) => (
            <div key={setting.key} style={{ marginBottom: '10px' }}>
              <label style={fieldLabelStyle}>{setting.label}</label>
              <SettingField
                setting={setting}
                value={props[setting.key]}
                onChange={(val) => handlePropChange(setting.key, val)}
                selectedId={selectedId}
                designer={designer}
              />
            </div>
          ))}
        </>
      )}

      {/* Bottom padding */}
      <div style={{ height: '24px', flexShrink: 0 }} />
    </div>
  );
}
