'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Build a tree from a flat list of topics
// ---------------------------------------------------------------------------
function buildTree(topics) {
  const byId = {};
  topics.forEach((t) => { byId[t._id] = { ...t, children: [] }; });

  const roots = [];
  topics.forEach((t) => {
    const parentId = t.hierarchy?.parent;
    if (parentId && byId[parentId]) {
      byId[parentId].children.push(byId[t._id]);
    } else {
      roots.push(byId[t._id]);
    }
  });
  return roots;
}

// ---------------------------------------------------------------------------
// TOC node (recursive)
// ---------------------------------------------------------------------------
function TocNode({ node, selectedId, onSelect, depth = 0, forceOpen }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;
  const isOpen = forceOpen !== undefined ? forceOpen : open;
  const isSelected  = node._id === selectedId;

  return (
    <li style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '4px',
          paddingLeft:  `${depth * 14 + 8}px`,
          paddingRight: '8px',
        }}
      >
        {hasChildren ? (
          <button
            style={toc.toggle}
            onClick={() => setOpen((o) => !o)}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: '16px', flexShrink: 0 }} />
        )}
        <button
          style={{
            ...toc.item,
            background:  isSelected ? '#eff6ff' : 'transparent',
            color:        isSelected ? '#1d4ed8' : '#374151',
            fontWeight:   isSelected ? 600 : 400,
            borderLeft:   isSelected ? '2px solid #1d4ed8' : '2px solid transparent',
          }}
          onClick={() => onSelect(node._id)}
        >
          {node.title}
        </button>
      </div>
      {isOpen && hasChildren && (
        <ul style={{ margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <TocNode
              key={child._id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main reader page
// ---------------------------------------------------------------------------
export default function DocReaderPage() {
  const { id }   = useParams();
  const [doc,    setDoc]    = useState(null);
  const [topics, setTopics] = useState([]);
  const [tree,   setTree]   = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [topicContent, setTopicContent] = useState(null);
  const [loadingDoc,   setLoadingDoc]   = useState(true);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [expandAll,    setExpandAll]    = useState(false);
  const contentRef = useRef(null);

  // Load document + topic list
  useEffect(() => {
    if (!id) return;
    api.get(`/portal/documents/${id}`)
      .then((data) => {
        setDoc(data.document);
        const sorted = [...(data.topics || [])].sort(
          (a, b) => (a.hierarchy?.order ?? 0) - (b.hierarchy?.order ?? 0)
        );
        setTopics(sorted);
        setTree(buildTree(sorted));
        // Auto-select first topic
        if (sorted.length > 0) setSelectedId(sorted[0]._id);
      })
      .catch(console.error)
      .finally(() => setLoadingDoc(false));
  }, [id]);

  // Load topic content on selection change
  useEffect(() => {
    if (!selectedId) return;
    setLoadingTopic(true);
    api.get(`/portal/topics/${selectedId}`)
      .then((data) => setTopicContent(data.topic))
      .catch(console.error)
      .finally(() => setLoadingTopic(false));

    // Scroll content to top
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [selectedId]);

  const handleSelect = useCallback((topicId) => {
    setSelectedId(topicId);
  }, []);

  // Loading state
  if (loadingDoc) {
    return (
      <div style={layout.loading}>
        <div style={layout.spinner} />
        <span>Loading…</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={layout.notFound}>
        <p>Document not found.</p>
        <Link href="/portal" style={{ color: '#1d4ed8' }}>← Back to portal</Link>
      </div>
    );
  }

  return (
    <div style={layout.shell}>
      {/* Sidebar */}
      <aside style={layout.sidebar}>
        {/* Sidebar header */}
        <div style={layout.sidebarHeader}>
          <Link href="/portal" style={layout.backLink}>← All Docs</Link>
          <div style={layout.docTitle}>{doc.title}</div>
          <div style={layout.docMeta}>{topics.length} topics</div>
        </div>

        {/* Expand all toggle */}
        <div style={layout.tocControls}>
          <button
            style={toc.expandBtn}
            onClick={() => setExpandAll((e) => !e)}
          >
            {expandAll ? 'COLLAPSE ALL' : 'EXPAND ALL'}
          </button>
        </div>

        {/* TOC */}
        <nav style={layout.tocScroll}>
          <ul style={{ margin: 0, padding: 0 }}>
            {tree.map((node) => (
              <TocNode
                key={node._id}
                node={node}
                selectedId={selectedId}
                onSelect={handleSelect}
                depth={0}
                forceOpen={expandAll ? true : undefined}
              />
            ))}
          </ul>
        </nav>
      </aside>

      {/* Content */}
      <main ref={contentRef} style={layout.content}>
        {loadingTopic ? (
          <div style={layout.contentLoading}>
            <div style={layout.spinner} />
          </div>
        ) : topicContent ? (
          <article style={layout.article}>
            <h1 style={layout.articleTitle}>{topicContent.title}</h1>
            {topicContent.content?.html ? (
              <div
                data-portal-content
                style={layout.htmlContent}
                dangerouslySetInnerHTML={{ __html: topicContent.content.html }}
              />
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                No content available for this topic.
              </p>
            )}
          </article>
        ) : (
          <div style={layout.contentLoading}>
            <span style={{ color: '#94a3b8' }}>Select a topic from the sidebar.</span>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const layout = {
  shell: {
    display:    'flex',
    height:     'calc(100vh - var(--header-height))',
    overflow:   'hidden',
    background: '#ffffff',
  },
  sidebar: {
    width:          '280px',
    flexShrink:     0,
    display:        'flex',
    flexDirection:  'column',
    borderRight:    '1px solid #e5e7eb',
    background:     '#f8fafc',
    overflow:       'hidden',
  },
  sidebarHeader: {
    padding:      '16px 16px 12px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink:   0,
  },
  backLink: {
    fontSize:       '0.75rem',
    color:          '#6b7280',
    textDecoration: 'none',
    display:        'block',
    marginBottom:   '8px',
  },
  docTitle: {
    fontSize:    '0.9rem',
    fontWeight:  700,
    color:       '#111827',
    lineHeight:  1.3,
    marginBottom:'4px',
  },
  docMeta: {
    fontSize: '0.75rem',
    color:    '#9ca3af',
  },
  tocControls: {
    padding:      '8px 14px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink:   0,
  },
  tocScroll: {
    flex:     1,
    overflowY:'auto',
    padding:  '8px 0',
  },
  content: {
    flex:      1,
    overflowY: 'auto',
    background:'#ffffff',
  },
  contentLoading: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    gap:            '12px',
    color:          '#6b7280',
  },
  article: {
    maxWidth:  '760px',
    margin:    '0 auto',
    padding:   '40px 32px 80px',
  },
  articleTitle: {
    fontSize:     '1.8rem',
    fontWeight:   800,
    color:        '#111827',
    marginBottom: '24px',
    letterSpacing:'-0.02em',
    lineHeight:   1.2,
  },
  htmlContent: {
    fontSize:   '0.95rem',
    lineHeight: 1.75,
    color:      '#374151',
  },
  loading: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    height:         'calc(100vh - var(--header-height))',
    gap:            '14px',
    color:          '#64748b',
  },
  notFound: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    height:         'calc(100vh - var(--header-height))',
    gap:            '12px',
    color:          '#374151',
  },
  spinner: {
    width:          '30px',
    height:         '30px',
    border:         '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius:   '50%',
    animation:      'spin 0.7s linear infinite',
  },
};

const toc = {
  toggle: {
    width:      '16px',
    height:     '16px',
    background: 'none',
    border:     'none',
    padding:    0,
    cursor:     'pointer',
    color:      '#9ca3af',
    fontSize:   '0.7rem',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  item: {
    flex:         1,
    background:   'none',
    border:       'none',
    textAlign:    'left',
    padding:      '5px 6px',
    fontSize:     '0.82rem',
    cursor:       'pointer',
    borderRadius: '4px',
    lineHeight:   1.4,
    fontFamily:   'var(--font-sans)',
    transition:   'background 100ms',
    width:        '100%',
  },
  expandBtn: {
    background:   'none',
    border:       '1px solid #d1d5db',
    borderRadius: '4px',
    padding:      '3px 8px',
    fontSize:     '0.7rem',
    fontWeight:   600,
    color:        '#6b7280',
    cursor:       'pointer',
    letterSpacing:'0.05em',
    fontFamily:   'var(--font-sans)',
  },
};
