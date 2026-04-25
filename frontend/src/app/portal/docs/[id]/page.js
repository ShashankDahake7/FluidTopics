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

// Find a node by _id anywhere in the tree
function findNode(nodes, id) {
  for (const node of nodes) {
    if (node._id === id) return node;
    const found = findNode(node.children || [], id);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------
// TOC node (recursive)
// ---------------------------------------------------------------------------
function TocNode({ node, selectedId, onSelect, depth = 0, forceOpen, onResetForce }) {
  const [open, setOpen] = useState(depth < 1);
  const showChildren = depth < 1;
  const hasChildren  = node.children?.length > 0;
  const isOpen       = forceOpen != null ? forceOpen : open;
  const nodeId       = node._id;
  const isSelected   = nodeId && nodeId === selectedId;

  const handleToggle = (e) => {
    e.stopPropagation();
    // If a global force is active, hand control back to local state
    if (forceOpen != null) {
      onResetForce?.();
      setOpen(!isOpen);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <li style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      <div
        style={{
          display:     'flex',
          alignItems:  'center',
          paddingLeft: `${depth * 16 + 4}px`,
          paddingRight:'8px',
          minHeight:   '30px',
          background:  isSelected ? '#EBF2FF' : 'transparent',
          borderLeft:  isSelected ? '3px solid #1455C0' : '3px solid transparent',
        }}
      >
        {/* Toggle (+/-) for sections, dot for leaf nodes */}
        {hasChildren && showChildren ? (
          <button
            style={toc.toggle}
            onClick={handleToggle}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? '−' : '+'}
          </button>
        ) : (
          <span style={{
            width: '18px', height: '18px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              width: isSelected ? '7px' : '5px',
              height: isSelected ? '7px' : '5px',
              borderRadius: '50%',
              background: isSelected ? '#1455C0' : '#c0cad8',
              flexShrink: 0,
              transition: 'all 120ms',
            }} />
          </span>
        )}
        <button
          style={{
            ...toc.item,
            color:      isSelected ? '#1455C0' : '#1a2942',
            fontWeight: isSelected ? 600 : 400,
          }}
          onClick={() => nodeId && onSelect(nodeId)}
        >
          {node.title}
        </button>
      </div>
      {isOpen && hasChildren && showChildren && (
        <ul style={{ margin: 0, padding: 0 }}>
          {node.children.map((child, ci) => (
            <TocNode
              key={child._id || child.originId || ci}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              forceOpen={forceOpen}
              onResetForce={onResetForce}
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
  const [expandAll,    setExpandAll]    = useState(null); // null=default, true=all open, false=all closed
  const contentRef    = useRef(null);
  const pendingHashRef = useRef(null);

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

        // Paligo: use stored tocTree to preserve the exact Paligo ordering.
        // Map originId → _id so TocNode can resolve topic IDs from the tree.
        if (data.document?.isPaligoFormat && data.document?.tocTree?.length) {
          const originMap = {};
          sorted.forEach((t) => { if (t.originId) originMap[t.originId] = t._id; });
          const assignIds = (nodes) =>
            nodes.map((n) => ({
              ...n,
              _id:      originMap[n.originId] || null,
              children: assignIds(n.children || []),
            }));
          setTree(assignIds(data.document.tocTree));
        } else {
          setTree(buildTree(sorted));
        }

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

    // Scroll content to top (unless we have a pending in-page hash to scroll to)
    if (contentRef.current && !pendingHashRef.current) contentRef.current.scrollTop = 0;
  }, [selectedId]);

  // After topic content renders, scroll to any pending in-page hash
  useEffect(() => {
    if (!topicContent || !pendingHashRef.current) return;
    const hash = pendingHashRef.current;
    pendingHashRef.current = null;
    setTimeout(() => {
      const target = contentRef.current?.querySelector(`[id="${hash}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [topicContent]);

  const handleSelect = useCallback((topicId) => {
    setSelectedId(topicId);
  }, []);

  // Intercept link clicks in rendered HTML content
  const handleContentClick = useCallback((e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:)/.test(href)) return;

    // Pure hash link — scroll within the content pane
    if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.slice(1);
      const target = contentRef.current?.querySelector(`[id="${targetId}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Already-rewritten portal doc link: /portal/docs/{topicId}[#hash]
    const portalMatch = href.match(/^\/portal\/docs\/([^#?/]+)(?:#(.+))?$/);
    if (portalMatch) {
      e.preventDefault();
      const [, topicId, hash] = portalMatch;
      if (hash) pendingHashRef.current = hash;
      setSelectedId(topicId);
      return;
    }

    e.preventDefault();

    const [filePart, hash] = href.split('#');
    if (!filePart) return;

    // Resolve relative path against current topic's permalink directory
    const currentPermalink = topicContent?.permalink || '';
    const dirParts = currentPermalink.split('/').slice(0, -1);
    const resolved = [...dirParts, ...filePart.split('/')]
      .reduce((acc, p) => {
        if (p === '..') return acc.slice(0, -1);
        if (p && p !== '.') return [...acc, p];
        return acc;
      }, [])
      .join('/');

    if (!doc?._id) return;
    // Store hash so we can scroll after the new topic loads
    if (hash) pendingHashRef.current = hash;
    api.get(`/portal/documents/${doc._id}/by-permalink?permalink=${encodeURIComponent(resolved)}`)
      .then((data) => { if (data.topic?._id) setSelectedId(data.topic._id); })
      .catch(console.error);
  }, [topicContent, doc]);

  // Compute children of the current topic (from the TOC tree)
  const currentNode = selectedId ? findNode(tree, selectedId) : null;
  const childTopics = currentNode?.children?.filter((c) => c._id) ?? [];

  // After the HTML renders, fix up Paligo's empty `.section-toc` placeholder:
  //  - if there are children, populate it with links to them
  //  - otherwise remove it so the orphan "In this section:" text doesn't appear
  useEffect(() => {
    if (!contentRef.current || !topicContent) return;
    const placeholder = contentRef.current.querySelector('.section-toc');
    if (!placeholder) return;

    // Idempotent: remove any list we previously injected
    placeholder.querySelector('.section-toc-injected')?.remove();

    if (childTopics.length === 0) {
      const footer = placeholder.closest('.footer-content') || placeholder;
      footer.remove();
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'section-toc-injected';
    for (const child of childTopics) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href        = `/portal/docs/${child._id}`;
      a.textContent = child.title;
      li.appendChild(a);
      ul.appendChild(li);
    }
    placeholder.appendChild(ul);
  }, [topicContent, selectedId, tree]);

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
            onClick={() => setExpandAll((e) => e === true ? false : true)}
          >
            {expandAll === true ? 'Collapse all' : 'Expand all'}
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
                forceOpen={expandAll}
                onResetForce={() => setExpandAll(null)}
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
                onClick={handleContentClick}
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
    width:         '260px',
    flexShrink:    0,
    display:       'flex',
    flexDirection: 'column',
    borderRight:   '1px solid #e5e7eb',
    background:    '#ffffff',
    overflow:      'hidden',
  },
  sidebarHeader: {
    padding:      '14px 16px 10px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink:   0,
  },
  backLink: {
    fontSize:       '0.72rem',
    color:          '#9ca3af',
    textDecoration: 'none',
    display:        'inline-flex',
    alignItems:     'center',
    gap:            '4px',
    marginBottom:   '10px',
    letterSpacing:  '0.01em',
  },
  docTitle: {
    fontSize:     '0.875rem',
    fontWeight:   700,
    color:        '#0f172a',
    lineHeight:   1.35,
    marginBottom: '3px',
  },
  docMeta: {
    fontSize: '0.72rem',
    color:    '#94a3b8',
  },
  tocControls: {
    padding:    '6px 12px 4px',
    flexShrink: 0,
  },
  tocScroll: {
    flex:      1,
    overflowY: 'auto',
    padding:   '4px 0 16px',
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
    color:          '#94a3b8',
  },
  article: {
    maxWidth: '780px',
    margin:   '0 auto',
    padding:  '44px 40px 100px',
  },
  articleTitle: {
    fontSize:     '1.75rem',
    fontWeight:   700,
    color:        '#0f172a',
    marginBottom: '20px',
    lineHeight:   1.25,
  },
  htmlContent: {
    fontSize:   '0.9375rem',
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
    width:          '28px',
    height:         '28px',
    border:         '2px solid #e2e8f0',
    borderTopColor: '#1455C0',
    borderRadius:   '50%',
    animation:      'spin 0.7s linear infinite',
  },
};

const toc = {
  toggle: {
    width:          '18px',
    height:         '18px',
    background:     'none',
    border:         'none',
    padding:        0,
    cursor:         'pointer',
    color:          '#94a3b8',
    fontSize:       '0.875rem',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    lineHeight:     1,
  },
  item: {
    flex:       1,
    background: 'none',
    border:     'none',
    textAlign:  'left',
    padding:    '3px 6px 3px 4px',
    fontSize:   '0.8125rem',
    cursor:     'pointer',
    lineHeight: 1.45,
    fontFamily: 'var(--font-sans)',
    width:      '100%',
    whiteSpace: 'normal',
    wordBreak:  'break-word',
  },
  expandBtn: {
    background:   'none',
    border:       'none',
    padding:      '2px 0',
    fontSize:     '0.75rem',
    fontWeight:   500,
    color:        '#1455C0',
    cursor:       'pointer',
    letterSpacing:'0.01em',
    fontFamily:   'var(--font-sans)',
    textDecoration:'underline',
    textUnderlineOffset: '2px',
  },
};
