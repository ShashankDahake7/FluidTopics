'use client';

import { useState, useRef } from 'react';
import { flattenTree } from './treeUtils.js';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// ExportImport
// ---------------------------------------------------------------------------

export default function ExportImport({ designer, pageId }) {
  const [activeTab, setActiveTab] = useState('export');

  if (!designer.showExportImport) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      designer.toggleExportImport();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.5)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:         '560px',
          maxWidth:      'calc(100vw - 32px)',
          maxHeight:     'calc(100vh - 48px)',
          background:    '#ffffff',
          borderRadius:  '12px',
          boxShadow:     '0 20px 60px rgba(0,0,0,0.2)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
        }}
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
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Export / Import</h2>
          <button
            onClick={designer.toggleExportImport}
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
            aria-label="Close export/import"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display:      'flex',
            borderBottom: '1px solid #e2e8f0',
            flexShrink:   0,
          }}
        >
          {['Export', 'Import'].map((tab) => {
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
                  fontSize:     '0.875rem',
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {activeTab === 'export' && (
            <ExportTab designer={designer} />
          )}
          {activeTab === 'import' && (
            <ImportTab designer={designer} pageId={pageId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export tab
// ---------------------------------------------------------------------------

function ExportTab({ designer }) {
  const downloadBlob = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const json = JSON.stringify(designer.page, null, 2);
    const name = (designer.page?.name || 'page').replace(/\s+/g, '-').toLowerCase();
    downloadBlob(json, `${name}.json`, 'application/json');
  };

  const handleDownloadCSS = () => {
    const theme    = designer.theme || {};
    const colors   = theme.colors     || {};
    const typo     = theme.typography || {};
    const spacing  = theme.spacing    || {};

    const lines = [
      ':root {',
      ...Object.entries(colors).map(([k, v]) => `  --color-${k}: ${v};`),
      `  --font-family: ${typo.fontFamily || 'Inter'}, sans-serif;`,
      `  --font-size-base: ${typo.fontSize || 16}px;`,
      `  --line-height-base: ${typo.lineHeight || 1.6};`,
      `  --spacing-unit: ${spacing.unit || 8}px;`,
      `  --border-radius: ${spacing.borderRadius || 8}px;`,
      '}',
    ];

    downloadBlob(lines.join('\n'), 'theme.css', 'text/css');
  };

  // Component usage statistics
  const stats = (() => {
    if (!designer.tree) return [];
    const nodes = flattenTree(designer.tree);
    const counts = {};
    nodes.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Download buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ActionButton
          icon="📄"
          label="Download Page JSON"
          description="Export the complete page definition including component tree and settings"
          onClick={handleDownloadJSON}
        />
        <ActionButton
          icon="🎨"
          label="Download CSS Theme"
          description="Export the current theme as a CSS :root variables file (theme.css)"
          onClick={handleDownloadCSS}
        />
      </div>

      {/* Statistics */}
      <div>
        <h3
          style={{
            fontSize:      '0.75rem',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color:         '#64748b',
            marginBottom:  '10px',
          }}
        >
          Export Statistics
        </h3>
        {stats.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No components on the page yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stats.map(({ type, count }) => (
              <div
                key={type}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '6px 10px',
                  background:     '#f8fafc',
                  borderRadius:   '6px',
                  fontSize:       '0.82rem',
                }}
              >
                <span style={{ color: '#475569', fontFamily: 'monospace' }}>{type}</span>
                <span
                  style={{
                    background:   '#e0e7ff',
                    color:        '#4f46e5',
                    padding:      '2px 8px',
                    borderRadius: '99px',
                    fontWeight:   600,
                    fontSize:     '0.75rem',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
            <div
              style={{
                padding:        '6px 10px',
                fontSize:       '0.78rem',
                color:          '#94a3b8',
                fontWeight:     500,
                textAlign:      'right',
              }}
            >
              Total: {stats.reduce((s, r) => s + r.count, 0)} nodes
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import tab
// ---------------------------------------------------------------------------

function ImportTab({ designer, pageId }) {
  const [dragging, setDragging]     = useState(false);
  const [status, setStatus]         = useState(null);   // { type: 'success'|'error', msg }
  const [loading, setLoading]       = useState(false);
  const [replaceTree, setReplaceTree] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const fileRef = useRef(null);

  const readFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setStatus({ type: 'error', msg: 'Only .json files are supported.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setParsedData(data);
        setStatus({ type: 'success', msg: `File parsed: "${file.name}" (${Object.keys(data).length} top-level keys)` });
      } catch {
        setStatus({ type: 'error', msg: 'Failed to parse JSON. Please check the file.' });
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    readFile(file);
  };

  const handleFileChange = (e) => {
    readFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setLoading(true);
    setStatus(null);
    try {
      if (replaceTree && pageId) {
        await api.patch(`/designer/pages/${pageId}`, { tree: parsedData.tree });
        setStatus({ type: 'success', msg: 'Page tree replaced successfully. Reload the page to see changes.' });
      } else {
        const result = await api.post('/designer/pages/import', parsedData);
        setStatus({ type: 'success', msg: `Page imported successfully! New page ID: ${result._id || result.id}` });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: `Import failed: ${err.message}` });
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border:         `2px dashed ${dragging ? '#4f46e5' : '#cbd5e1'}`,
          borderRadius:   '10px',
          padding:        '32px 20px',
          textAlign:      'center',
          cursor:         'pointer',
          background:     dragging ? '#f5f3ff' : '#fafafa',
          transition:     'border-color 120ms, background 120ms',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
        <p style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
          Drop a .json page file here, or click to browse
        </p>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
          Accepts files exported from the Portal Designer
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Replace toggle */}
      {pageId && (
        <label
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '10px',
            cursor:      'pointer',
            fontSize:    '0.85rem',
            color:       '#475569',
          }}
        >
          <input
            type="checkbox"
            checked={replaceTree}
            onChange={(e) => setReplaceTree(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>
            <strong>Replace current page tree</strong>
            <span style={{ color: '#94a3b8', fontWeight: 400 }}> — instead of creating a new page, update this page's component tree</span>
          </span>
        </label>
      )}

      {/* Status message */}
      {status && (
        <div
          style={{
            padding:      '10px 14px',
            borderRadius: '8px',
            fontSize:     '0.82rem',
            background:   status.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color:        status.type === 'success' ? '#15803d' : '#dc2626',
            border:       `1px solid ${status.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {status.type === 'success' ? '✓ ' : '⚠ '}{status.msg}
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!parsedData || loading}
        style={{
          padding:      '10px 20px',
          background:   parsedData && !loading ? '#4f46e5' : '#e2e8f0',
          color:        parsedData && !loading ? '#ffffff' : '#94a3b8',
          border:       'none',
          borderRadius: '8px',
          cursor:       parsedData && !loading ? 'pointer' : 'not-allowed',
          fontSize:     '0.875rem',
          fontWeight:   500,
          transition:   'background 120ms',
        }}
      >
        {loading ? 'Importing…' : replaceTree ? 'Replace Page Tree' : 'Import as New Page'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ActionButton({ icon, label, description, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '14px',
        padding:      '14px 16px',
        border:       `1px solid ${hovered ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '10px',
        background:   hovered ? '#f5f3ff' : '#ffffff',
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'border-color 120ms, background 120ms',
        width:        '100%',
      }}
    >
      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{label}</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{description}</div>
      </div>
    </button>
  );
}
