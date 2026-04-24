'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Preset themes
// ---------------------------------------------------------------------------

const PRESET_THEMES = [
  {
    id:     'default',
    label:  'Default',
    colors: {
      primary:        '#4f46e5',
      secondary:      '#6366f1',
      background:     '#ffffff',
      surface:        '#f8fafc',
      text:           '#0f172a',
      textSecondary:  '#475569',
      border:         '#e2e8f0',
      success:        '#059669',
      warning:        '#d97706',
      error:          '#dc2626',
    },
    typography: { fontFamily: 'Inter', fontSize: 16, lineHeight: 1.6 },
    spacing:    { unit: 8, borderRadius: 8 },
  },
  {
    id:     'dark',
    label:  'Dark',
    colors: {
      primary:        '#818cf8',
      secondary:      '#a5b4fc',
      background:     '#0f172a',
      surface:        '#1e293b',
      text:           '#f1f5f9',
      textSecondary:  '#94a3b8',
      border:         '#334155',
      success:        '#34d399',
      warning:        '#fbbf24',
      error:          '#f87171',
    },
    typography: { fontFamily: 'Inter', fontSize: 16, lineHeight: 1.6 },
    spacing:    { unit: 8, borderRadius: 8 },
  },
  {
    id:     'ocean',
    label:  'Ocean',
    colors: {
      primary:        '#0ea5e9',
      secondary:      '#14b8a6',
      background:     '#f0f9ff',
      surface:        '#e0f2fe',
      text:           '#0c4a6e',
      textSecondary:  '#0369a1',
      border:         '#bae6fd',
      success:        '#059669',
      warning:        '#f59e0b',
      error:          '#ef4444',
    },
    typography: { fontFamily: 'Inter', fontSize: 16, lineHeight: 1.6 },
    spacing:    { unit: 8, borderRadius: 12 },
  },
  {
    id:     'forest',
    label:  'Forest',
    colors: {
      primary:        '#16a34a',
      secondary:      '#65a30d',
      background:     '#f0fdf4',
      surface:        '#dcfce7',
      text:           '#14532d',
      textSecondary:  '#166534',
      border:         '#bbf7d0',
      success:        '#15803d',
      warning:        '#ca8a04',
      error:          '#dc2626',
    },
    typography: { fontFamily: 'Source Sans Pro', fontSize: 16, lineHeight: 1.6 },
    spacing:    { unit: 8, borderRadius: 6 },
  },
  {
    id:     'sunset',
    label:  'Sunset',
    colors: {
      primary:        '#ea580c',
      secondary:      '#f59e0b',
      background:     '#fff7ed',
      surface:        '#ffedd5',
      text:           '#431407',
      textSecondary:  '#7c2d12',
      border:         '#fed7aa',
      success:        '#16a34a',
      warning:        '#d97706',
      error:          '#dc2626',
    },
    typography: { fontFamily: 'Lato', fontSize: 16, lineHeight: 1.65 },
    spacing:    { unit: 8, borderRadius: 10 },
  },
];

const COLOR_KEYS = [
  'primary', 'secondary', 'background', 'surface',
  'text', 'textSecondary', 'border',
  'success', 'warning', 'error',
];

const FONT_FAMILIES = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Source Sans Pro'];
const SPACING_UNITS = [4, 8, 12, 16];

// ---------------------------------------------------------------------------
// ThemeEditor
// ---------------------------------------------------------------------------

export default function ThemeEditor({ designer }) {
  const [activeTab, setActiveTab] = useState('colors');

  if (!designer.showThemeEditor) return null;

  const theme = designer.theme || {};
  const colors     = theme.colors     || {};
  const typography = theme.typography || {};
  const spacing    = theme.spacing    || {};

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      designer.toggleThemeEditor();
    }
  };

  const applyPreset = (preset) => {
    designer.updateTheme({
      colors:     preset.colors,
      typography: preset.typography,
      spacing:    preset.spacing,
    });
  };

  const updateColors = (key, val) => {
    designer.updateTheme({
      ...theme,
      colors: { ...colors, [key]: val },
    });
  };

  const updateTypography = (key, val) => {
    designer.updateTheme({
      ...theme,
      typography: { ...typography, [key]: val },
    });
  };

  const updateSpacing = (key, val) => {
    designer.updateTheme({
      ...theme,
      spacing: { ...spacing, [key]: val },
    });
  };

  const tabs = ['Colors', 'Typography', 'Spacing'];

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.5)',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      <div
        style={{
          width:         '640px',
          maxWidth:      'calc(100vw - 32px)',
          maxHeight:     'calc(100vh - 48px)',
          background:    '#ffffff',
          borderRadius:  '12px',
          boxShadow:     '0 20px 60px rgba(0,0,0,0.2)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '16px 20px',
            borderBottom:   '1px solid #e2e8f0',
            flexShrink:     0,
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Theme Editor</h2>
          <button
            onClick={designer.toggleThemeEditor}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              fontSize:     '1.2rem',
              color:        '#64748b',
              lineHeight:   1,
              padding:      '4px',
              borderRadius: '4px',
            }}
            aria-label="Close theme editor"
          >
            ×
          </button>
        </div>

        {/* Body: two-column */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT — Presets */}
          <div
            style={{
              width:        '200px',
              flexShrink:   0,
              borderRight:  '1px solid #e2e8f0',
              padding:      '16px',
              overflowY:    'auto',
              display:      'flex',
              flexDirection:'column',
              gap:          '8px',
            }}
          >
            <p
              style={{
                fontSize:      '0.7rem',
                fontWeight:    600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color:         '#94a3b8',
                marginBottom:  '4px',
              }}
            >
              Presets
            </p>
            {PRESET_THEMES.map((preset) => (
              <PresetButton
                key={preset.id}
                preset={preset}
                onApply={() => applyPreset(preset)}
                currentPrimary={colors.primary}
              />
            ))}
          </div>

          {/* RIGHT — Editor */}
          <div
            style={{
              flex:          1,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display:      'flex',
                borderBottom: '1px solid #e2e8f0',
                flexShrink:   0,
              }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.toLowerCase();
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    style={{
                      flex:         1,
                      padding:      '10px 0',
                      border:       'none',
                      background:   'none',
                      cursor:       'pointer',
                      fontSize:     '0.85rem',
                      fontWeight:   isActive ? 600 : 400,
                      color:        isActive ? '#4f46e5' : '#64748b',
                      borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                      transition:   'color 120ms, border-color 120ms',
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

              {activeTab === 'colors' && (
                <ColorsTab
                  colors={colors}
                  onChange={updateColors}
                />
              )}

              {activeTab === 'typography' && (
                <TypographyTab
                  typography={typography}
                  onChange={updateTypography}
                />
              )}

              {activeTab === 'spacing' && (
                <SpacingTab
                  spacing={spacing}
                  onChange={updateSpacing}
                />
              )}
            </div>

            {/* Live preview */}
            <LivePreview colors={colors} typography={typography} spacing={spacing} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset button
// ---------------------------------------------------------------------------

function PresetButton({ preset, onApply, currentPrimary }) {
  const [hovered, setHovered] = useState(false);
  const swatch = [
    preset.colors.primary,
    preset.colors.secondary,
    preset.colors.background,
    preset.colors.surface,
  ];

  return (
    <button
      onClick={onApply}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        flexDirection:'column',
        alignItems:   'flex-start',
        gap:          '6px',
        padding:      '10px',
        border:       `1px solid ${hovered ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '8px',
        background:   hovered ? '#f5f3ff' : '#ffffff',
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'border-color 120ms, background 120ms',
        width:        '100%',
      }}
    >
      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1e293b' }}>
        {preset.label}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {swatch.map((color, i) => (
          <span
            key={i}
            style={{
              width:        '16px',
              height:       '16px',
              borderRadius: '3px',
              background:   color,
              border:       '1px solid rgba(0,0,0,0.08)',
              display:      'inline-block',
              flexShrink:   0,
            }}
          />
        ))}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Colors tab
// ---------------------------------------------------------------------------

function ColorsTab({ colors, onChange }) {
  const labels = {
    primary:       'Primary',
    secondary:     'Secondary',
    background:    'Background',
    surface:       'Surface',
    text:          'Text',
    textSecondary: 'Text Secondary',
    border:        'Border',
    success:       'Success',
    warning:       'Warning',
    error:         'Error',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {COLOR_KEYS.map((key) => {
        const val = colors[key] || '#000000';
        return (
          <div
            key={key}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         '10px',
            }}
          >
            <label
              style={{
                width:    '120px',
                flexShrink: 0,
                fontSize: '0.82rem',
                color:    '#475569',
                fontWeight: 500,
              }}
            >
              {labels[key] || key}
            </label>
            <input
              type="color"
              value={val}
              onChange={(e) => onChange(key, e.target.value)}
              style={{
                width:        '32px',
                height:       '32px',
                padding:      '2px',
                border:       '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor:       'pointer',
                flexShrink:   0,
              }}
            />
            <input
              type="text"
              value={val}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(key, v);
              }}
              style={{
                flex:         1,
                padding:      '5px 8px',
                border:       '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize:     '0.8rem',
                fontFamily:   'monospace',
                color:        '#1e293b',
                outline:      'none',
              }}
              maxLength={7}
              spellCheck={false}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typography tab
// ---------------------------------------------------------------------------

function TypographyTab({ typography, onChange }) {
  const fontFamily = typography.fontFamily || 'Inter';
  const fontSize   = typography.fontSize   || 16;
  const lineHeight = typography.lineHeight || 1.6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Font Family */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          Font Family
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => onChange('fontFamily', e.target.value)}
            style={{
              flex:         1,
              padding:      '6px 10px',
              border:       '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize:     '0.85rem',
              color:        '#1e293b',
              outline:      'none',
            }}
          />
          <select
            value={FONT_FAMILIES.includes(fontFamily) ? fontFamily : ''}
            onChange={(e) => { if (e.target.value) onChange('fontFamily', e.target.value); }}
            style={{
              padding:      '6px 8px',
              border:       '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize:     '0.82rem',
              color:        '#475569',
              cursor:       'pointer',
              outline:      'none',
              background:   '#fff',
            }}
          >
            <option value="">Presets…</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          Base Font Size: <strong>{fontSize}px</strong>
        </label>
        <input
          type="range"
          min={12}
          max={24}
          step={1}
          value={fontSize}
          onChange={(e) => onChange('fontSize', Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
          <span>12px</span>
          <span>24px</span>
        </div>
      </div>

      {/* Line Height */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          Line Height: <strong>{lineHeight}</strong>
        </label>
        <input
          type="range"
          min={1.2}
          max={2.0}
          step={0.05}
          value={lineHeight}
          onChange={(e) => onChange('lineHeight', Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
          <span>1.2</span>
          <span>2.0</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

function SpacingTab({ spacing, onChange }) {
  const unit         = spacing.unit         || 8;
  const borderRadius = spacing.borderRadius || 8;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Spacing Unit */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          Spacing Unit
        </label>
        <select
          value={unit}
          onChange={(e) => onChange('unit', Number(e.target.value))}
          style={{
            width:        '100%',
            padding:      '7px 10px',
            border:       '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize:     '0.85rem',
            color:        '#1e293b',
            cursor:       'pointer',
            outline:      'none',
            background:   '#fff',
          }}
        >
          {SPACING_UNITS.map((u) => (
            <option key={u} value={u}>{u}px</option>
          ))}
        </select>
      </div>

      {/* Border Radius */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          Border Radius: <strong>{borderRadius}px</strong>
        </label>
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={borderRadius}
          onChange={(e) => onChange('borderRadius', Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
          <span>0 (square)</span>
          <span>24px (pill)</span>
        </div>
        {/* Visual preview of border-radius */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          {[0, borderRadius, 9999].map((r, i) => (
            <div
              key={i}
              style={{
                width:        '40px',
                height:       '40px',
                background:   '#e0e7ff',
                border:       '2px solid #818cf8',
                borderRadius: `${r}px`,
                flexShrink:   0,
              }}
            />
          ))}
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center' }}>
            0 / {borderRadius}px / pill
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview
// ---------------------------------------------------------------------------

function LivePreview({ colors, typography, spacing }) {
  const bg      = colors.background     || '#ffffff';
  const surface = colors.surface        || '#f8fafc';
  const primary = colors.primary        || '#4f46e5';
  const text    = colors.text           || '#0f172a';
  const textSec = colors.textSecondary  || '#475569';
  const border  = colors.border         || '#e2e8f0';
  const br      = spacing.borderRadius  || 8;
  const ff      = typography.fontFamily || 'inherit';
  const fs      = typography.fontSize   || 16;

  return (
    <div
      style={{
        borderTop:    '1px solid #e2e8f0',
        padding:      '12px 16px',
        background:   bg,
        flexShrink:   0,
      }}
    >
      <p
        style={{
          fontSize:      '0.65rem',
          fontWeight:    600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color:         textSec,
          marginBottom:  '8px',
          fontFamily:    ff,
        }}
      >
        Live Preview
      </p>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Button */}
        <button
          style={{
            background:   primary,
            color:        '#fff',
            border:       'none',
            borderRadius: `${br}px`,
            padding:      '6px 14px',
            fontSize:     `${fs * 0.82}px`,
            fontFamily:   ff,
            cursor:       'pointer',
          }}
        >
          Button
        </button>
        {/* Card */}
        <div
          style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: `${br}px`,
            padding:      '8px 12px',
            fontSize:     `${fs * 0.8}px`,
            fontFamily:   ff,
            color:        text,
          }}
        >
          <span style={{ color: text, fontWeight: 600 }}>Card title</span>
          <span style={{ color: textSec, marginLeft: '6px' }}>subtitle</span>
        </div>
        {/* Text */}
        <span style={{ fontSize: `${fs * 0.875}px`, color: text, fontFamily: ff }}>
          Aa Bb Cc
        </span>
      </div>
    </div>
  );
}
