'use client';

import { useState, useRef } from 'react';
import { getComponent } from '../registry.js';

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const STATE_TABS = [
  { id: 'base',   label: 'Base'   },
  { id: 'hover',  label: 'Hover'  },
  { id: 'focus',  label: 'Focus'  },
  { id: 'active', label: 'Active' },
];

const DISPLAY_OPTIONS      = ['', 'block', 'flex', 'grid', 'inline', 'inline-flex', 'inline-block', 'none'];
const FLEX_DIR_OPTIONS     = ['', 'row', 'column', 'row-reverse', 'column-reverse'];
const ALIGN_ITEMS_OPTIONS  = ['', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'];
const JUSTIFY_OPTIONS      = ['', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const TEXT_ALIGN_OPTIONS   = ['', 'left', 'center', 'right', 'justify'];
const POSITION_OPTIONS     = ['', 'static', 'relative', 'absolute', 'fixed', 'sticky'];
const OVERFLOW_OPTIONS     = ['', 'visible', 'hidden', 'auto', 'scroll', 'clip'];
const FONT_WEIGHT_OPTIONS  = ['', '300', '400', '500', '600', '700', '800', '900'];

const sectionHeaderStyle = {
  fontSize:      '0.7rem',
  fontWeight:    600,
  color:         '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop:     '14px',
  marginBottom:  '6px',
};

const fieldLabelStyle = {
  fontSize:   '0.7rem',
  color:      '#64748b',
  marginBottom: '2px',
  display:    'block',
};

const inputStyle = {
  width:        '100%',
  padding:      '5px 7px',
  border:       '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize:     '0.78rem',
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
// Mini sub-components
// ---------------------------------------------------------------------------

function Row({ children, cols = 2 }) {
  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap:                 '6px',
        marginBottom:        '6px',
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ''}
      style={inputStyle}
    />
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt || '—'}</option>
      ))}
    </select>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width:        '28px',
          height:       '28px',
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
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. #fff or rgba(…)"
        style={{ ...inputStyle, flex: 1 }}
      />
    </div>
  );
}

// Text-align pill selector
function TextAlignSelector({ value, onChange }) {
  const options = [
    { v: 'left',    label: '⬡L' },
    { v: 'center',  label: '⬡C' },
    { v: 'right',   label: '⬡R' },
    { v: 'justify', label: '⬡J' },
  ];
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {options.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v === value ? '' : v)}
          style={{
            flex:         1,
            padding:      '4px 0',
            border:       '1px solid #e2e8f0',
            borderRadius: '4px',
            background:   value === v ? '#4f46e5' : '#fafafa',
            color:        value === v ? '#ffffff' : '#475569',
            cursor:       'pointer',
            fontSize:     '0.68rem',
          }}
        >
          {v.charAt(0).toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parse raw CSS text → object
// ---------------------------------------------------------------------------
function parseCssText(text) {
  const obj = {};
  if (!text) return obj;
  text.split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 1) return;
    const prop  = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).replace(/;$/, '').trim();
    if (prop && value) {
      // Convert kebab-case → camelCase
      const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      obj[camel] = value;
    }
  });
  return obj;
}

// Serialize style object → raw CSS text (one prop per line)
function serializeCssText(obj) {
  if (!obj) return '';
  return Object.entries(obj)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => {
      const kebab = k.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
      return `${kebab}: ${v};`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// StylesTab
// ---------------------------------------------------------------------------

export default function StylesTab({ designer }) {
  const { selectedId, selectedNode } = designer;
  const [activeState, setActiveState] = useState('base');
  const rawRef = useRef(null);

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
        <span style={{ fontSize: '2rem' }}>🎨</span>
        <span style={{ fontSize: '0.85rem' }}>Select a component to edit its styles.</span>
      </div>
    );
  }

  const component = getComponent(selectedNode.type);
  const styles    = selectedNode.style || {};
  const current   = styles[activeState] || {};

  const set = (prop, val) => {
    designer.updateNodeStyle(selectedId, activeState, { [prop]: val });
  };

  const v = (prop) => current[prop] ?? '';

  // Raw CSS text in the textarea is derived from current style, but we only
  // parse it on blur (so the user can type freely).
  const rawText = serializeCssText(current);

  const handleRawBlur = (e) => {
    const parsed = parseCssText(e.target.value);
    designer.updateNodeStyle(selectedId, activeState, parsed);
  };

  // CSS classes are stored as a special meta-prop, not in style
  const cssClasses = selectedNode.props?.['__cssClasses'] ?? '';
  const handleClassesChange = (val) => {
    designer.updateNodeProps(selectedId, { __cssClasses: val });
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
      {/* Component name bar */}
      <div
        style={{
          padding:      '8px 12px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          background:   component?.previewColor || '#fafafa',
        }}
      >
        <span style={{ fontSize: '1rem' }}>{component?.icon || '?'}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
          {selectedNode.label || component?.label}
        </span>
        <span
          style={{
            marginLeft:   'auto',
            fontSize:     '0.65rem',
            color:        '#94a3b8',
            background:   'rgba(0,0,0,0.06)',
            padding:      '1px 5px',
            borderRadius: '4px',
          }}
        >
          {selectedNode.type}
        </span>
      </div>

      {/* State tabs */}
      <div
        style={{
          display:      'flex',
          borderBottom: '1px solid #e2e8f0',
          flexShrink:   0,
          background:   '#fafafa',
        }}
      >
        {STATE_TABS.map((st) => {
          const isActive = activeState === st.id;
          const hasStyles = Object.keys(styles[st.id] || {}).length > 0;
          return (
            <button
              key={st.id}
              onClick={() => setActiveState(st.id)}
              style={{
                flex:         1,
                padding:      '8px 4px',
                border:       'none',
                background:   'transparent',
                cursor:       'pointer',
                fontSize:     '0.72rem',
                fontWeight:   isActive ? 600 : 400,
                color:        isActive ? '#4f46e5' : '#64748b',
                borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                position:     'relative',
              }}
            >
              {st.label}
              {hasStyles && !isActive && (
                <span
                  style={{
                    position:     'absolute',
                    top:          '6px',
                    right:        '8px',
                    width:        '5px',
                    height:       '5px',
                    borderRadius: '50%',
                    background:   '#4f46e5',
                    opacity:      0.5,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Property panels — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* ---- Layout ---- */}
        <div style={sectionHeaderStyle}>Layout</div>

        <Row>
          <Field label="Display">
            <SelectInput value={v('display')} options={DISPLAY_OPTIONS} onChange={(val) => set('display', val)} />
          </Field>
          <Field label="Flex Direction">
            <SelectInput value={v('flexDirection')} options={FLEX_DIR_OPTIONS} onChange={(val) => set('flexDirection', val)} />
          </Field>
        </Row>
        <Row>
          <Field label="Align Items">
            <SelectInput value={v('alignItems')} options={ALIGN_ITEMS_OPTIONS} onChange={(val) => set('alignItems', val)} />
          </Field>
          <Field label="Justify Content">
            <SelectInput value={v('justifyContent')} options={JUSTIFY_OPTIONS} onChange={(val) => set('justifyContent', val)} />
          </Field>
        </Row>
        <Row>
          <Field label="Gap">
            <TextInput value={v('gap')} onChange={(val) => set('gap', val)} placeholder="e.g. 8px" />
          </Field>
          <Field label="Flex Wrap">
            <SelectInput value={v('flexWrap')} options={['', 'nowrap', 'wrap', 'wrap-reverse']} onChange={(val) => set('flexWrap', val)} />
          </Field>
        </Row>
        <Row>
          <Field label="Padding">
            <TextInput value={v('padding')} onChange={(val) => set('padding', val)} placeholder="e.g. 8px 16px" />
          </Field>
          <Field label="Margin">
            <TextInput value={v('margin')} onChange={(val) => set('margin', val)} placeholder="e.g. 0 auto" />
          </Field>
        </Row>

        {/* ---- Size ---- */}
        <div style={sectionHeaderStyle}>Size</div>
        <Row>
          <Field label="Width">
            <TextInput value={v('width')} onChange={(val) => set('width', val)} placeholder="e.g. 100%" />
          </Field>
          <Field label="Height">
            <TextInput value={v('height')} onChange={(val) => set('height', val)} placeholder="e.g. auto" />
          </Field>
        </Row>
        <Row>
          <Field label="Min Width">
            <TextInput value={v('minWidth')} onChange={(val) => set('minWidth', val)} />
          </Field>
          <Field label="Max Width">
            <TextInput value={v('maxWidth')} onChange={(val) => set('maxWidth', val)} />
          </Field>
        </Row>
        <Row>
          <Field label="Min Height">
            <TextInput value={v('minHeight')} onChange={(val) => set('minHeight', val)} />
          </Field>
          <Field label="Max Height">
            <TextInput value={v('maxHeight')} onChange={(val) => set('maxHeight', val)} />
          </Field>
        </Row>

        {/* ---- Appearance ---- */}
        <div style={sectionHeaderStyle}>Appearance</div>
        <div style={{ marginBottom: '6px' }}>
          <label style={fieldLabelStyle}>Background</label>
          <ColorInput value={v('background')} onChange={(val) => set('background', val)} />
        </div>
        <div style={{ marginBottom: '6px' }}>
          <label style={fieldLabelStyle}>Text Color</label>
          <ColorInput value={v('color')} onChange={(val) => set('color', val)} />
        </div>
        <Row>
          <Field label="Border">
            <TextInput value={v('border')} onChange={(val) => set('border', val)} placeholder="1px solid #ccc" />
          </Field>
          <Field label="Border Radius">
            <TextInput value={v('borderRadius')} onChange={(val) => set('borderRadius', val)} placeholder="e.g. 8px" />
          </Field>
        </Row>
        <div style={{ marginBottom: '6px' }}>
          <label style={fieldLabelStyle}>Box Shadow</label>
          <TextInput value={v('boxShadow')} onChange={(val) => set('boxShadow', val)} placeholder="0 2px 8px rgba(0,0,0,0.1)" />
        </div>

        {/* ---- Typography ---- */}
        <div style={sectionHeaderStyle}>Typography</div>
        <Row>
          <Field label="Font Size">
            <TextInput value={v('fontSize')} onChange={(val) => set('fontSize', val)} placeholder="1rem" />
          </Field>
          <Field label="Font Weight">
            <SelectInput value={v('fontWeight')} options={FONT_WEIGHT_OPTIONS} onChange={(val) => set('fontWeight', val)} />
          </Field>
        </Row>
        <Row>
          <Field label="Font Family">
            <TextInput value={v('fontFamily')} onChange={(val) => set('fontFamily', val)} placeholder="inherit" />
          </Field>
          <Field label="Line Height">
            <TextInput value={v('lineHeight')} onChange={(val) => set('lineHeight', val)} placeholder="1.5" />
          </Field>
        </Row>
        <div style={{ marginBottom: '6px' }}>
          <label style={fieldLabelStyle}>Text Align</label>
          <TextAlignSelector value={v('textAlign')} onChange={(val) => set('textAlign', val)} />
        </div>

        {/* ---- Position ---- */}
        <div style={sectionHeaderStyle}>Position</div>
        <Row>
          <Field label="Position">
            <SelectInput value={v('position')} options={POSITION_OPTIONS} onChange={(val) => set('position', val)} />
          </Field>
          <Field label="Z-Index">
            <TextInput value={v('zIndex')} onChange={(val) => set('zIndex', val)} placeholder="auto" />
          </Field>
        </Row>
        <Row cols={4}>
          <Field label="Top">
            <TextInput value={v('top')} onChange={(val) => set('top', val)} />
          </Field>
          <Field label="Right">
            <TextInput value={v('right')} onChange={(val) => set('right', val)} />
          </Field>
          <Field label="Bottom">
            <TextInput value={v('bottom')} onChange={(val) => set('bottom', val)} />
          </Field>
          <Field label="Left">
            <TextInput value={v('left')} onChange={(val) => set('left', val)} />
          </Field>
        </Row>

        {/* ---- Other ---- */}
        <div style={sectionHeaderStyle}>Other</div>
        <Row>
          <Field label="Overflow">
            <SelectInput value={v('overflow')} options={OVERFLOW_OPTIONS} onChange={(val) => set('overflow', val)} />
          </Field>
          <Field label="Opacity">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={v('opacity') === '' ? 1 : parseFloat(v('opacity'))}
              onChange={(e) => set('opacity', e.target.value)}
              style={{ width: '100%', marginTop: '4px', accentColor: '#4f46e5' }}
            />
          </Field>
        </Row>

        {/* ---- Raw CSS ---- */}
        <div style={sectionHeaderStyle}>Raw CSS Rules</div>
        <div style={{ marginBottom: '8px' }}>
          <textarea
            ref={rawRef}
            key={`${selectedId}-${activeState}`}
            defaultValue={rawText}
            onBlur={handleRawBlur}
            rows={6}
            placeholder={"font-size: 14px;\ncolor: #333;\npadding: 8px 12px;"}
            style={{
              ...inputStyle,
              fontFamily: 'monospace',
              fontSize:   '0.75rem',
              resize:     'vertical',
            }}
          />
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '3px' }}>
            One rule per line. Applied on blur, merged with quick properties above.
          </div>
        </div>

        {/* ---- CSS Classes ---- */}
        <div style={sectionHeaderStyle}>CSS Class Names</div>
        <div style={{ marginBottom: '8px' }}>
          <input
            type="text"
            value={cssClasses}
            onChange={(e) => handleClassesChange(e.target.value)}
            placeholder="e.g. card card--featured my-class"
            style={inputStyle}
          />
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '3px' }}>
            Space-separated class names added to the rendered element.
          </div>
        </div>

        <div style={{ height: '24px' }} />
      </div>
    </div>
  );
}
