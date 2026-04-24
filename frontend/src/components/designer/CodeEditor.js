'use client';

import { useState } from 'react';
import { findNode } from './treeUtils.js';
import { getComponent } from './registry.js';

// ---------------------------------------------------------------------------
// JS reference data
// ---------------------------------------------------------------------------

const JS_VARIABLES = [
  { name: 'user',        desc: 'Current user object (profile, roles, preferences)' },
  { name: 'ftCluster',   desc: 'Search: current cluster context' },
  { name: 'ftFacets',    desc: 'Search: active facets / filter values' },
  { name: 'ftPaging',    desc: 'Search: pagination state (page, pageSize, total)' },
  { name: 'ftRequest',   desc: 'Search: the raw search request object' },
  { name: 'ftResult',    desc: 'Search: single result item (inside result loops)' },
  { name: 'ftResults',   desc: 'Search: full results array for the current page' },
  { name: 'ftSpellcheck','desc': 'Search: spellcheck suggestion object' },
  { name: 'ftMap',       desc: 'Reader: map variable for the current publication' },
  { name: 'ftTopic',     desc: 'Reader: current topic object' },
  { name: 'ftToc',       desc: 'Reader: table of contents variable' },
  { name: 'ftCurrentPage', desc: 'Reader: current page/section variable' },
];

const JS_METHODS = [
  { name: 'fluidTopics.ai.summarize(topicId)',             desc: 'Request AI-generated summary for a topic' },
  { name: 'fluidTopics.analytics.track(event, data)',      desc: 'Track a custom analytics event' },
  { name: 'fluidTopics.analytics.pageView(url)',           desc: 'Record a page view' },
  { name: 'fluidTopics.api.get(path)',                     desc: 'Make an authenticated GET request to the FT API' },
  { name: 'fluidTopics.auth.login()',                      desc: 'Trigger the login flow' },
  { name: 'fluidTopics.auth.getUser()',                    desc: 'Return the current user object (or null)' },
  { name: 'fluidTopics.auth.logout()',                     desc: 'Sign the user out and clear the session' },
  { name: 'fluidTopics.date.formatDate(date, format)',     desc: 'Format a date string using the given pattern' },
  { name: 'fluidTopics.date.isDate(value)',                desc: 'Return true if value is a parseable date' },
  { name: 'fluidTopics.loadLibrary(name)',                 desc: 'Dynamically load an external JS library by name' },
  { name: 'fluidTopics.highlight(el, query)',              desc: 'Highlight query terms within a DOM element' },
  { name: 'fluidTopics.locale.getContentLocale()',         desc: 'Return the current content locale code' },
  { name: 'fluidTopics.locale.setContentLocale(code)',     desc: 'Switch the content locale' },
  { name: 'fluidTopics.locale.getUILocale()',              desc: 'Return the current UI locale code' },
  { name: 'fluidTopics.locale.setUILocale(code)',          desc: 'Switch the UI locale' },
  { name: 'fluidTopics.misc.getTopicContent(topicId)',     desc: 'Fetch rendered HTML content for a topic' },
  { name: 'fluidTopics.misc.getTopicMetadata(topicId)',    desc: 'Fetch metadata for a topic' },
  { name: 'fluidTopics.misc.sendFeedback(topicId, data)',  desc: 'Submit user feedback for a topic' },
  { name: 'fluidTopics.navigate(url)',                     desc: 'Navigate to a portal URL (respects SPA routing)' },
  { name: 'fluidTopics.notify(message, type)',             desc: 'Show a toast notification (info/success/error/warning)' },
  { name: 'fluidTopics.rating.get(topicId)',               desc: 'Fetch the rating summary for a topic' },
  { name: 'fluidTopics.rating.rate(topicId, score)',       desc: 'Submit a star rating for a topic' },
  { name: 'fluidTopics.rating.unrate(topicId)',            desc: 'Remove the current user\'s rating' },
  { name: 'fluidTopics.searchInDocument(query)',           desc: 'Programmatically trigger in-document search' },
  { name: 'fluidTopics.theme.listThemes()',                desc: 'Return all available portal themes' },
  { name: 'fluidTopics.theme.getActiveTheme()',            desc: 'Return the currently active theme object' },
  { name: 'fluidTopics.theme.setTheme(themeId)',           desc: 'Switch the portal theme' },
  { name: 'fluidTopics.translate(topicId, targetLang)',    desc: 'Request on-demand translation for a topic' },
  { name: 'fluidTopics.url.urlToSearchRequest(url)',       desc: 'Parse a search URL into a request object' },
  { name: 'fluidTopics.url.searchRequestToUrl(request)',   desc: 'Serialize a search request object into a URL' },
];

const LATEST_MAPS_EXAMPLE = {
  html: `<div class="latest-maps">
  <h3>Latest Maps</h3>
  <div id="maps-list"></div>
</div>`,
  js: `// Fetch and display latest maps
const maps = await fluidTopics.api.getMaps({ limit: 5, sort: '-updatedAt' });
document.getElementById('maps-list').innerHTML =
  maps.map(m => \`<a href="\${m.url}">\${m.title}</a>\`).join('');`,
};

// ---------------------------------------------------------------------------
// CodeEditor
// ---------------------------------------------------------------------------

export default function CodeEditor({ designer }) {
  const [activeTab, setActiveTab]     = useState('html');
  const [refExpanded, setRefExpanded] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);

  if (!designer.showCodeEditor) return null;

  const nodeId = designer.showCodeEditor;
  const node   = findNode(designer.tree, nodeId);

  if (!node) return null;

  const def = getComponent(node.type);

  const tabs = ['HTML', 'CSS', 'JavaScript'];

  const propKey = { HTML: 'htmlContent', CSS: 'cssContent', JavaScript: 'jsContent' };

  const getValue = (tab) => {
    const key = propKey[tab];
    // Fall back to the legacy short-key used by custom-component defaultProps
    const legacyKey = { HTML: 'html', CSS: 'css', JavaScript: 'js' }[tab];
    return node.props?.[key] ?? node.props?.[legacyKey] ?? '';
  };

  const handleChange = (tab, val) => {
    designer.updateNodeProps(nodeId, { [propKey[tab]]: val });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta  = e.target;
      const sel = ta.selectionStart;
      const v   = ta.value;
      const newVal = v.substring(0, sel) + '  ' + v.substring(ta.selectionEnd);
      // Synthetic change to update React state
      const nativeInput = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      );
      nativeInput?.set?.call(ta, newVal);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      // Restore cursor
      requestAnimationFrame(() => {
        ta.selectionStart = sel + 2;
        ta.selectionEnd   = sel + 2;
      });
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      designer.toggleCodeEditor(nodeId);
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.6)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:         '900px',
          maxWidth:      'calc(100vw - 32px)',
          maxHeight:     'calc(100vh - 48px)',
          background:    '#1e293b',
          borderRadius:  '12px',
          boxShadow:     '0 24px 64px rgba(0,0,0,0.4)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          color:         '#e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '14px 20px',
            borderBottom:   '1px solid #334155',
            flexShrink:     0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1rem' }}>{def?.icon || '⚡'}</span>
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {node.label || node.type}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '8px' }}>
                Code Editor
              </span>
            </div>
          </div>
          <button
            onClick={() => designer.toggleCodeEditor(nodeId)}
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
            aria-label="Close code editor"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display:      'flex',
            borderBottom: '1px solid #334155',
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
                  padding:      '10px 20px',
                  border:       'none',
                  background:   'none',
                  cursor:       'pointer',
                  fontSize:     '0.85rem',
                  fontWeight:   isActive ? 600 : 400,
                  color:        isActive ? '#818cf8' : '#64748b',
                  borderBottom: isActive ? '2px solid #818cf8' : '2px solid transparent',
                  transition:   'color 120ms, border-color 120ms',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {tabs.map((tab) => {
            if (activeTab !== tab.toLowerCase()) return null;
            const val = getValue(tab);
            return (
              <div key={tab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  value={val}
                  onChange={(e) => handleChange(tab, e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  style={{
                    flex:        1,
                    fontFamily:  "'Courier New', 'Consolas', monospace",
                    fontSize:    '0.875rem',
                    background:  '#0f172a',
                    color:       '#e2e8f0',
                    padding:     '16px',
                    border:      'none',
                    width:       '100%',
                    minHeight:   '300px',
                    resize:      'vertical',
                    outline:     'none',
                    lineHeight:  1.6,
                    tabSize:     2,
                  }}
                  placeholder={
                    tab === 'HTML'       ? '<!-- Enter HTML content -->' :
                    tab === 'CSS'        ? '/* Enter CSS styles */'      :
                    '// Enter JavaScript code'
                  }
                />

                {/* JS reference — only on the JavaScript tab */}
                {tab === 'JavaScript' && (
                  <JSReferencePanel
                    expanded={refExpanded}
                    onToggle={() => setRefExpanded((v) => !v)}
                    exampleOpen={exampleOpen}
                    onExampleToggle={() => setExampleOpen((v) => !v)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'flex-end',
            gap:            '10px',
            padding:        '12px 20px',
            borderTop:      '1px solid #334155',
            flexShrink:     0,
          }}
        >
          <span style={{ flex: 1, fontSize: '0.78rem', color: '#475569' }}>
            Changes are applied live. Press Tab to indent.
          </span>
          <button
            onClick={() => designer.toggleCodeEditor(nodeId)}
            style={{
              padding:      '7px 16px',
              background:   '#4f46e5',
              color:        '#fff',
              border:       'none',
              borderRadius: '6px',
              cursor:       'pointer',
              fontSize:     '0.85rem',
              fontWeight:   500,
            }}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JS Reference Panel
// ---------------------------------------------------------------------------

function JSReferencePanel({ expanded, onToggle, exampleOpen, onExampleToggle }) {
  return (
    <div
      style={{
        borderTop:  '1px solid #334155',
        background: '#0f172a',
        flexShrink: 0,
      }}
    >
      {/* Toggle header */}
      <button
        onClick={onToggle}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '8px',
          width:          '100%',
          padding:        '10px 16px',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          color:          '#94a3b8',
          fontSize:       '0.8rem',
          fontWeight:     500,
          textAlign:      'left',
        }}
      >
        <span style={{ transition: 'transform 120ms', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        JavaScript Variables &amp; Methods Reference
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Variables */}
          <section>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '8px' }}>
              Variables
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {JS_VARIABLES.map((v) => (
                <div key={v.name} style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
                  <code style={{ color: '#818cf8', flexShrink: 0, minWidth: '160px', fontFamily: 'monospace' }}>
                    {v.name}
                  </code>
                  <span style={{ color: '#64748b' }}>{v.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Methods */}
          <section>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '8px' }}>
              Methods
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {JS_METHODS.map((m) => (
                <div key={m.name} style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', alignItems: 'flex-start' }}>
                  <code
                    style={{
                      color:      '#34d399',
                      flexShrink: 0,
                      minWidth:   '260px',
                      fontFamily: 'monospace',
                      wordBreak:  'break-all',
                    }}
                  >
                    {m.name}
                  </code>
                  <span style={{ color: '#64748b' }}>{m.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Latest Maps example */}
          <section>
            <button
              onClick={onExampleToggle}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         '6px',
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                color:       '#f59e0b',
                fontSize:    '0.78rem',
                fontWeight:  500,
                padding:     0,
              }}
            >
              <span style={{ transform: exampleOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 120ms' }}>▶</span>
              Latest Maps example
            </button>

            {exampleOpen && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>HTML</p>
                  <pre
                    style={{
                      background:   '#1e293b',
                      padding:      '10px 14px',
                      borderRadius: '6px',
                      fontSize:     '0.78rem',
                      color:        '#e2e8f0',
                      fontFamily:   'monospace',
                      overflowX:    'auto',
                      margin:       0,
                      whiteSpace:   'pre',
                    }}
                  >
                    {LATEST_MAPS_EXAMPLE.html}
                  </pre>
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>JavaScript</p>
                  <pre
                    style={{
                      background:   '#1e293b',
                      padding:      '10px 14px',
                      borderRadius: '6px',
                      fontSize:     '0.78rem',
                      color:        '#e2e8f0',
                      fontFamily:   'monospace',
                      overflowX:    'auto',
                      margin:       0,
                      whiteSpace:   'pre',
                    }}
                  >
                    {LATEST_MAPS_EXAMPLE.js}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
