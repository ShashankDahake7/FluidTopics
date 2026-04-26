'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api, { getStoredToken } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

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

/** Same slug pattern as Darwinbox `/portal-asset/{slug}-avatar` (e.g. Shikha-Gheyee). */
function slugForPortalAuthorAvatar(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join('-');
}

/** Remove first in-body heading that repeats the page title (Paligo often echoes topic title under the shell). */
function stripLeadingDuplicateTitleHtml(html, title) {
  if (!html || !title || typeof document === 'undefined') return html;
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(title);
  if (!target) return html;
  try {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const skipJunk = () => {
      let n = wrap.firstChild;
      while (n) {
        if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) {
          const nx = n.nextSibling;
          n.remove();
          n = nx;
          continue;
        }
        if (n.nodeType === Node.COMMENT_NODE) {
          const nx = n.nextSibling;
          n.remove();
          n = nx;
          continue;
        }
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'SCRIPT') {
          const nx = n.nextSibling;
          n.remove();
          n = nx;
          continue;
        }
        break;
      }
    };
    const stripOnce = () => {
      skipJunk();
      const first = wrap.firstElementChild;
      if (!first) return false;
      if (/^H[1-6]$/i.test(first.tagName) && norm(first.textContent) === target) {
        first.remove();
        return true;
      }
      const onlyHeadingChild =
        first.children.length === 1 && /^H[1-6]$/i.test(first.firstElementChild?.tagName || '')
          ? first.firstElementChild
          : null;
      if (onlyHeadingChild && norm(onlyHeadingChild.textContent) === target) {
        first.remove();
        return true;
      }
      const inner = first.firstElementChild;
      if (inner && /^H[1-6]$/i.test(inner.tagName) && norm(inner.textContent) === target) {
        inner.remove();
        if (!first.textContent.trim() && first.children.length === 0) first.remove();
        return true;
      }
      return false;
    };
    let guard = 0;
    while (guard++ < 4 && stripOnce()) {
      /* remove repeated title blocks Paligo sometimes stacks */
    }
    return wrap.innerHTML;
  } catch {
    return html;
  }
}

function formatRelativeUpdated(iso) {
  if (!iso) return '';
  try {
    const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    const diffHr = Math.round(diffSec / 3600);
    if (Math.abs(diffHr) < 48) return rtf.format(diffHr, 'hour');
    const diffDay = Math.round(diffSec / 86400);
    if (Math.abs(diffDay) < 60) return rtf.format(diffDay, 'day');
    const diffWeek = Math.round(diffDay / 7);
    if (Math.abs(diffWeek) < 52) return rtf.format(diffWeek, 'week');
    const diffMonth = Math.round(diffDay / 30);
    return rtf.format(diffMonth, 'month');
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

// ---------------------------------------------------------------------------
// TOC node (recursive)
// ---------------------------------------------------------------------------
function TocNode({ node, selectedId, onSelect, depth = 0, forceOpen, onResetForce }) {
  const [open, setOpen] = useState(depth < 1);
  const showChildren = depth < 1;
  const hasChildren = node.children?.length > 0;
  const isOpen = forceOpen != null ? forceOpen : open;
  const nodeId = node._id;
  const isSelected = nodeId && nodeId === selectedId;

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
          display: 'flex',
          alignItems: 'center',
          paddingLeft: `${depth * 16 + 4}px`,
          paddingRight: '8px',
          minHeight: '30px',
          background: isSelected ? '#EBF2FF' : 'transparent',
          borderLeft: isSelected ? '3px solid #1455C0' : '3px solid transparent',
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
            color: isSelected ? '#1455C0' : '#1a2942',
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
  const { id } = useParams();
  const { t } = useTranslation();
  const [doc, setDoc] = useState(null);
  const [topics, setTopics] = useState([]);
  const [tree, setTree] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [topicContent, setTopicContent] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [expandAll, setExpandAll] = useState(null); // null=default, true=all open, false=all closed
  const [tocQuery, setTocQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // { total, matches } | null
  const [searching, setSearching] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkMsg, setBookmarkMsg] = useState('');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionList, setCollectionList] = useState([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionMsg, setCollectionMsg] = useState('');
  const collectionMenuRef = useRef(null);
  const contentRef = useRef(null);
  const pendingHashRef = useRef(null);
  const feedbackRef = useRef(null);

  const focusFeedback = useCallback(() => {
    const el = feedbackRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 350);
  }, []);

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
              _id: originMap[n.originId] || null,
              children: assignIds(n.children || []),
            }));
          setTree(assignIds(data.document.tocTree));
        } else {
          setTree(buildTree(sorted));
        }

        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const tid = params?.get('topic');
        if (tid && sorted.some((x) => String(x._id) === tid)) {
          setSelectedId(tid);
        } else if (sorted.length > 0) {
          setSelectedId(sorted[0]._id);
        }
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

  // Check bookmark status whenever the selected topic changes
  useEffect(() => {
    if (!selectedId) { setBookmarked(false); return; }
    if (typeof window !== 'undefined' && !getStoredToken()) {
      setBookmarked(false); return;
    }
    let cancelled = false;
    api.get(`/bookmarks/check/${selectedId}`)
      .then((d) => { if (!cancelled) setBookmarked(!!d.isBookmarked); })
      .catch(() => { if (!cancelled) setBookmarked(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const toggleBookmark = useCallback(async () => {
    if (!selectedId || bookmarkBusy) return;
    if (typeof window !== 'undefined' && !getStoredToken()) {
      setBookmarkMsg(t('signInBookmark'));
      setTimeout(() => setBookmarkMsg(''), 1800);
      return;
    }
    setBookmarkBusy(true);
    try {
      if (bookmarked) {
        await api.delete(`/bookmarks/${selectedId}`);
        setBookmarked(false);
        setBookmarkMsg(t('removedBookmark'));
      } else {
        await api.post('/bookmarks', { topicId: selectedId });
        setBookmarked(true);
        setBookmarkMsg(t('addedBookmark'));
      }
    } catch (e) {
      setBookmarkMsg(e?.message || 'Failed');
    } finally {
      setBookmarkBusy(false);
      setTimeout(() => setBookmarkMsg(''), 1800);
    }
  }, [selectedId, bookmarked, bookmarkBusy]);

  useEffect(() => {
    if (!collectionOpen) return;
    let cancelled = false;
    setCollectionLoading(true);
    api.get('/collections')
      .then((d) => {
        if (!cancelled) {
          setCollectionList((d.collections || []).filter((c) => c.kind === 'manual'));
        }
      })
      .catch(() => { if (!cancelled) setCollectionList([]); })
      .finally(() => { if (!cancelled) setCollectionLoading(false); });
    return () => { cancelled = true; };
  }, [collectionOpen]);

  useEffect(() => {
    if (!collectionOpen) return;
    const onDown = (e) => {
      const root = collectionMenuRef.current;
      if (root && !root.contains(e.target)) setCollectionOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [collectionOpen]);

  const toggleCollectionMenu = useCallback(() => {
    if (typeof window !== 'undefined' && !getStoredToken()) {
      setCollectionMsg(t('signInCollection'));
      setTimeout(() => setCollectionMsg(''), 2000);
      return;
    }
    setCollectionOpen((o) => {
      if (o) setCollectionList([]);
      return !o;
    });
  }, [t]);

  const addTopicToCollection = useCallback(async (collId, collName) => {
    if (!selectedId) return;
    try {
      await api.post(`/collections/${collId}/topics`, { topicIds: [selectedId] });
      setCollectionMsg(`${t('addedToCollection')}: ${collName}`);
    } catch (e) {
      setCollectionMsg(e?.message || 'Failed');
    } finally {
      setCollectionOpen(false);
      setTimeout(() => setCollectionMsg(''), 2200);
    }
  }, [selectedId, t]);

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

    // Already-rewritten dashboard doc link: /dashboard/docs/{topicId}[#hash]
    // (also tolerate the legacy /portal/docs/... shape so older links still work)
    const dashboardMatch = href.match(/^\/(?:dashboard|portal)\/docs\/([^#?/]+)(?:#(.+))?$/);
    if (dashboardMatch) {
      e.preventDefault();
      const [, topicId, hash] = dashboardMatch;
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

  const authorFromTocTopic = useMemo(() => {
    const t = topics.find((x) => String(x._id) === String(selectedId));
    return t?.metadata?.author || '';
  }, [topics, selectedId]);

  const articleBodyHtml = useMemo(() => {
    const raw = topicContent?.content?.html;
    const title = topicContent?.title;
    if (!raw) return '';
    return stripLeadingDuplicateTitleHtml(raw, title);
  }, [topicContent?.content?.html, topicContent?.title]);

  // Debounced server-side ES search (titles + body) within this document
  useEffect(() => {
    const q = tocQuery.trim();
    if (!q || !id) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      api.get(`/portal/documents/${id}/search?q=${encodeURIComponent(q)}`)
        .then((d) => setSearchResults({ total: d.total || 0, matches: d.matches || [] }))
        .catch(() => setSearchResults({ total: 0, matches: [] }))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [tocQuery, id]);

  // After the HTML renders, fix up Paligo's empty `.section-toc` placeholder:
  //  - if there are children, populate it with links to them
  //  - otherwise remove it so the orphan "In this section:" text doesn't appear
  useEffect(() => {
    if (!contentRef.current || !topicContent) return;
    const root = contentRef.current;

    // Find any "In this section[:]" headings/labels in the rendered HTML so we
    // can either populate them or remove them when the section has no children.
    const isSectionHeader = (el) => {
      const t = (el.textContent || '').trim().replace(/[:\s]+$/, '').toLowerCase();
      return t === 'in this section';
    };
    const candidateSelectors = 'h1,h2,h3,h4,h5,h6,p,div,span,strong,b';
    const inSectionHeadings = Array.from(root.querySelectorAll(candidateSelectors))
      .filter((el) => el.children.length === 0 && isSectionHeader(el));

    const placeholder = root.querySelector('.section-toc');

    // Case A: there are no children for this topic — remove placeholder + heading
    if (childTopics.length === 0) {
      if (placeholder) {
        const footer = placeholder.closest('.footer-content') || placeholder;
        footer.remove();
      }
      inSectionHeadings.forEach((h) => {
        const wrapper = h.closest('.footer-content, section, aside') || h;
        wrapper.remove();
      });
      return;
    }

    // Case B: there's a placeholder — populate it (idempotent)
    if (placeholder) {
      placeholder.querySelector('.section-toc-injected')?.remove();
      const ul = document.createElement('ul');
      ul.className = 'section-toc-injected';
      for (const child of childTopics) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/dashboard/docs/${child._id}`;
        a.textContent = child.title;
        li.appendChild(a);
        ul.appendChild(li);
      }
      placeholder.appendChild(ul);
      return;
    }

    // Case C: heading exists but no placeholder — drop the orphan heading.
    // The TOC sidebar already exposes the children, so we don't synthesize a
    // duplicate list inside the article.
    inSectionHeadings.forEach((h) => {
      const wrapper = h.closest('.footer-content, section, aside') || h;
      wrapper.remove();
    });
  }, [topicContent, selectedId, tree, childTopics]);

  // Highlight the active search term inside the rendered article body.
  // Walks text nodes and wraps matches in <mark>; cleans up on query change.
  useEffect(() => {
    if (!contentRef.current || !topicContent) return;
    const root = contentRef.current.querySelector('[data-portal-content]');
    if (!root) return;

    // Strip any previous highlights first
    root.querySelectorAll('mark[data-search-hl="1"]').forEach((m) => {
      const text = document.createTextNode(m.textContent || '');
      m.parentNode?.replaceChild(text, m);
    });
    // Coalesce adjacent text nodes left over from removal
    root.normalize();

    const q = tocQuery.trim();
    if (!q) return;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'gi');

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !rx.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        rx.lastIndex = 0;
        const parentTag = node.parentElement?.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'MARK') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const node of targets) {
      const frag = document.createDocumentFragment();
      let last = 0;
      const text = node.nodeValue;
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.setAttribute('data-search-hl', '1');
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        if (m.index === rx.lastIndex) rx.lastIndex++; // safety for zero-width
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  }, [tocQuery, topicContent, selectedId]);

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
        <p>{t('documentNotFound')}</p>
        <Link href="/dashboard" style={{ color: '#1d4ed8' }}>{t('backToPortal')}</Link>
      </div>
    );
  }

  return (
    <div style={layout.shell}>
      {/* Sidebar */}
      <aside style={layout.sidebar}>
        {/* Sidebar header — back link kept tiny, search prominent */}
        <div style={layout.sidebarHeader}>
          <Link href="/dashboard" style={layout.backLink}>{t('allDocs')}</Link>
          <div style={layout.searchWrap}>
            <input
              type="text"
              value={tocQuery}
              onChange={(e) => setTocQuery(e.target.value)}
              placeholder={t('searchInDocument')}
              style={layout.searchInput}
              aria-label={t('searchInDocument')}
            />
            {tocQuery ? (
              <button type="button" style={layout.searchClearBtn} aria-label="Clear search" onClick={() => setTocQuery('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : null}
            <button type="button" style={layout.searchBtn} aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expand/Collapse all toggle — hidden while searching */}
        {!tocQuery && (
          <div style={layout.tocControls}>
            <button
              style={toc.expandBtn}
              onClick={() => setExpandAll((e) => e === true ? false : true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
              {expandAll === true ? t('collapseAll') : t('expandAll')}
            </button>
          </div>
        )}

        {/* TOC or Search results */}
        <nav style={layout.tocScroll}>
          {tocQuery ? (
            searching && !searchResults ? (
              <div style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>{t('searching')}</div>
            ) : (searchResults?.matches?.length ?? 0) === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                {t('noMatchesFor')} &ldquo;{tocQuery}&rdquo;
              </div>
            ) : (
              <>
                <div style={layout.searchCount}>{t(searchResults.total === 1 ? 'resultCount' : 'resultCountPlural', { n: searchResults.total })}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {searchResults.matches.map((m) => (
                    <li key={m._id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(m._id)}
                        style={{
                          ...layout.searchCard,
                          ...(selectedId === m._id ? { background: '#EBF2FF', borderLeftColor: '#1455C0' } : {}),
                        }}
                      >
                        <div style={layout.searchCardTitle} dangerouslySetInnerHTML={{ __html: m.titleHtml || m.title }} />
                        {m.path && m.path.length > 0 && (
                          <div style={layout.searchCardPath}>{m.path.join(' › ')}</div>
                        )}
                        {m.snippet && (
                          <div style={layout.searchCardSnippet} dangerouslySetInnerHTML={{ __html: '…' + m.snippet + '…' }} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
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
          )}
        </nav>
      </aside>

      {/* Content */}
      <main ref={contentRef} style={layout.content}>
        {/* Floating action buttons — pinned to far right of the content pane */}
        {topicContent && !loadingTopic && (
          <div style={layout.floatingActions}>
            <ActionBtn label={t('share')} onClick={() => setShareOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
            </ActionBtn>
            <ActionBtn label={t('subscribe')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            </ActionBtn>
            <ActionBtn
              label={bookmarked ? t('removeBookmark') : t('bookmark')}
              onClick={toggleBookmark}
              active={bookmarked}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            </ActionBtn>
            <div ref={collectionMenuRef} style={{ position: 'relative' }}>
              <ActionBtn label={t('addToCollection')} onClick={toggleCollectionMenu} active={collectionOpen}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="4" width="14" height="4" rx="0.5" />
                  <rect x="3" y="10" width="14" height="4" rx="0.5" />
                  <path d="M19 6v12M16 9l3-3 3 3" />
                </svg>
              </ActionBtn>
              {collectionOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    minWidth: '220px',
                    maxWidth: 'min(320px, 92vw)',
                    maxHeight: 'min(280px, 40vh)',
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                    zIndex: 30,
                    padding: '6px 0',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {collectionLoading ? (
                    <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#64748b' }}>{t('loading')}</div>
                  ) : collectionList.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#475569' }}>
                      {t('createCollectionFirst')}{' '}
                      <Link href="/mylibrary/collections" style={{ color: '#1d4ed8' }} onClick={() => setCollectionOpen(false)}>
                        {t('collections')}
                      </Link>
                    </div>
                  ) : (
                    collectionList.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        role="menuitem"
                        onClick={() => addTopicToCollection(c._id, c.name)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none', background: 'transparent',
                          cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a',
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: c.color || '#0f172a', marginRight: '8px', verticalAlign: 'middle' }} aria-hidden />
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <ActionBtn label={t('feedback')} onClick={focusFeedback}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </ActionBtn>
            {(bookmarkMsg || collectionMsg) && (
              <span style={{
                position: 'absolute', top: '40px', right: 0,
                background: '#0f172a', color: '#fff',
                padding: '6px 10px', borderRadius: '4px',
                fontSize: '0.75rem', maxWidth: 'min(280px, 85vw)', whiteSpace: 'normal',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                textAlign: 'right',
              }}>
                {bookmarkMsg || collectionMsg}
              </span>
            )}
          </div>
        )}
        {loadingTopic ? (
          <div style={layout.contentLoading}>
            <div style={layout.spinner} />
          </div>
        ) : topicContent ? (
          <article style={layout.article} aria-label={topicContent.title}>
            {(() => {
              const authorName =
                topicContent.metadata?.author ||
                topicContent.author ||
                authorFromTocTopic ||
                '';
              const authorSlug = slugForPortalAuthorAvatar(authorName);
              const updatedAt = topicContent.updatedAt || topicContent.timeModified;
              const updatedPhrase = updatedAt ? formatRelativeUpdated(updatedAt) : '';
              if (!authorName && !updatedPhrase) return null;
              return (
                <div className="portal-article-author" style={layout.articleAuthor}>
                  {authorSlug ? (
                    <div style={layout.avatarPhoto}>
                      <img
                        className="portal-article-author-img"
                        style={layout.avatarImage}
                        src={`/portal-asset/${authorSlug}-avatar`}
                        alt={authorName}
                        width={36}
                        height={36}
                      />
                    </div>
                  ) : (
                    <div style={layout.avatarPhoto} aria-hidden="true">
                      <span style={layout.avatarPlaceholder} />
                    </div>
                  )}
                  <div style={layout.avatarInfos}>
                    {authorName ? (
                      <span style={layout.avatarWrittenBy}>
                        {t('writtenBy')}{' '}
                        <strong style={layout.avatarName}>{authorName}</strong>.
                      </span>
                    ) : null}
                    {updatedPhrase ? (
                      <span style={layout.avatarUpdated}>
                        {authorName ? ' ' : null}
                        {t('updated')} {updatedPhrase}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })()}
            {topicContent.content?.html ? (
              <div
                data-portal-content
                style={layout.htmlContent}
                dangerouslySetInnerHTML={{ __html: articleBodyHtml }}
                onClick={handleContentClick}
              />
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                {t('noContentTopic')}
              </p>
            )}
            <RatingBlock topicId={selectedId} feedbackRef={feedbackRef} />
          </article>
        ) : (
          <div style={layout.contentLoading}>
            <span style={{ color: '#94a3b8' }}>{t('selectTopic')}</span>
          </div>
        )}
      </main>
      {shareOpen && (
        <ShareDialog
          onClose={() => setShareOpen(false)}
          topicTitle={topicContent?.title}
          docTitle={doc?.title}
        />
      )}
    </div>
  );
}

function ShareDialog({ onClose, topicTitle, docTitle }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setUrl(window.location.href);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div role="dialog" aria-modal="true" style={shareStyles.backdrop} onClick={onClose}>
      <div style={shareStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={shareStyles.header}>
          <div style={shareStyles.title}>{t('shareTitle')}</div>
          <button type="button" onClick={onClose} aria-label={t('close')} style={shareStyles.closeIcon}>×</button>
        </div>
        <div style={shareStyles.body}>
          <div style={shareStyles.lead}>
            {t('shareLead')}
            {topicTitle ? <> — <strong>{topicTitle}</strong>{docTitle ? <> · <em>{docTitle}</em></> : null}</> : null}:
          </div>
          <div style={shareStyles.urlRow}>
            <input readOnly value={url} style={shareStyles.urlInput} />
            <button type="button" onClick={handleCopy} style={shareStyles.copyBtn}>
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <button type="button" onClick={onClose} style={shareStyles.closeBtn}>{t('closeUpper')}</button>
        </div>
      </div>
    </div>
  );
}

const shareStyles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '20px',
  },
  dialog: {
    background: '#ffffff',
    width: '100%', maxWidth: '560px',
    borderRadius: '6px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  closeIcon: {
    background: 'none', border: 'none',
    fontSize: '1.4rem', lineHeight: 1,
    color: '#6b7280', cursor: 'pointer', padding: '0 4px',
  },
  body: { padding: '20px' },
  lead: {
    fontSize: '0.875rem', color: '#1f2937',
    marginBottom: '12px',
  },
  urlRow: {
    display: 'flex', alignItems: 'stretch',
    border: '1px solid #d1d5db',
    borderRadius: '4px', overflow: 'hidden',
    marginBottom: '18px',
    background: '#f3f4f6',
  },
  urlInput: {
    flex: 1, border: 'none', outline: 'none',
    background: 'transparent',
    padding: '10px 12px',
    fontSize: '0.875rem', color: '#1f2937',
    fontFamily: 'var(--font-sans)',
  },
  copyBtn: {
    background: '#1976D2', color: '#fff',
    border: 'none', padding: '0 18px',
    fontSize: '0.78rem', fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  closeBtn: {
    background: '#1976D2', color: '#fff',
    border: 'none', borderRadius: '4px',
    padding: '8px 18px',
    fontSize: '0.78rem', fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
};

function RatingBlock({ topicId, feedbackRef }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  // Reset when topic changes
  useEffect(() => {
    setHover(0); setRating(0);
    setFeedback(''); setSubmitMsg('');
  }, [topicId]);

  const canSubmit = (rating > 0 || feedback.trim().length > 0) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !topicId) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      await api.post('/feedback', {
        topicId,
        rating: rating || null,
        feedback: feedback.trim() || null,
      });
      setSubmitMsg(t('thanksFeedback'));
      setFeedback('');
    } catch (e) {
      setSubmitMsg(e?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(''), 2200);
    }
  };

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      marginTop: '48px',
      padding: '40px 0 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
    }}>
      <div style={{ fontSize: '1.05rem', color: '#1f2937', fontWeight: 500 }}>
        {t('yourRating')}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{t('poor')}</span>
        <div style={{ display: 'inline-flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                style={{
                  background: 'none', border: 'none', padding: '2px',
                  cursor: 'pointer', lineHeight: 0,
                  color: filled ? '#1d4ed8' : '#cbd5e1',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.2 21.3 12 18 5.8 21.3 7 14.4 2 9.5 8.9 8.6 12 2" />
                </svg>
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{t('excellent')}</span>
      </div>

      {/* Feedback form */}
      <div style={{ width: '100%', maxWidth: '760px', marginTop: '24px' }}>
        <label htmlFor="topic-feedback" style={{
          display: 'block', fontSize: '0.95rem', color: '#0f172a',
          fontWeight: 600, marginBottom: '8px',
        }}>
          {t('feedback')}
        </label>
        <textarea
          id="topic-feedback"
          ref={feedbackRef}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={5}
          placeholder={t('feedbackPlaceholder')}
          style={{
            width: '100%', resize: 'vertical', minHeight: '120px',
            border: '1px solid #d1d5db', borderRadius: '6px',
            padding: '12px 14px',
            fontSize: '0.9rem', color: '#1f2937',
            fontFamily: 'var(--font-sans)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? '#1976D2' : '#cbd5e1',
              color: '#ffffff', border: 'none',
              padding: '10px 22px', borderRadius: '999px',
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? t('submitting') : t('submitFeedback')}
          </button>
          {submitMsg && (
            <span style={{ fontSize: '0.85rem', color: '#10b981' }}>{submitMsg}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ label, children, onClick, active }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} style={{
      width: '32px', height: '32px', borderRadius: '50%',
      background: active ? '#0f172a' : '#1976D2',
      color: '#fff', border: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      transition: 'background 120ms',
    }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const layout = {
  shell: {
    display: 'flex',
    height: 'calc(100vh - var(--header-height))',
    overflow: 'hidden',
    background: '#ffffff',
  },
  sidebar: {
    width: '340px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    background: '#ffffff',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '14px 16px 12px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  backLink: {
    fontSize: '0.72rem',
    color: '#9ca3af',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '10px',
    letterSpacing: '0.01em',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '8px 10px',
    fontSize: '0.8125rem',
    color: '#1f2937',
    background: 'transparent',
    fontFamily: 'var(--font-sans)',
  },
  searchBtn: {
    background: '#1976D2',
    color: '#fff',
    border: 'none',
    width: '34px',
    height: '34px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchClearBtn: {
    background: 'transparent',
    color: '#6b7280',
    border: 'none',
    width: '28px',
    height: '34px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchCount: {
    padding: '10px 16px 6px',
    fontSize: '0.78rem',
    color: '#6b7280',
    fontWeight: 500,
  },
  searchCard: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderLeft: '3px solid transparent',
    padding: '12px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    borderBottom: '1px solid #f1f5f9',
  },
  searchCardTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '4px',
    lineHeight: 1.3,
  },
  searchCardPath: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    marginBottom: '6px',
    lineHeight: 1.3,
  },
  searchCardSnippet: {
    fontSize: '0.78rem',
    color: '#475569',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  tocControls: {
    padding: '12px 16px 6px',
    flexShrink: 0,
  },
  articleAuthor: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '0',
    marginBottom: '28px',
    fontSize: '0.8125rem',
    color: '#4a6fa5',
  },
  avatarPhoto: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
  },
  avatarImage: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
    background: '#e2e8f0',
  },
  avatarPlaceholder: {
    display: 'block',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c7d2fe, #93c5fd)',
  },
  avatarInfos: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0 4px',
    lineHeight: 1.4,
  },
  avatarWrittenBy: { display: 'inline' },
  avatarName: { color: '#3d5a80', fontWeight: 600 },
  avatarUpdated: { display: 'inline', color: '#5b7a9e' },
  tocScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0 16px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    background: '#ffffff',
    position: 'relative',
  },
  floatingActions: {
    position: 'absolute',
    top: '32px',
    right: '100px',
    display: 'inline-flex',
    gap: '10px',
    zIndex: 5,
  },
  contentLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    color: '#94a3b8',
  },
  article: {
    maxWidth: '1200px',
    margin: '0',
    padding: '44px 64px 100px',
    position: 'relative',
  },
  htmlContent: {
    fontSize: '0.9375rem',
    lineHeight: 1.75,
    color: '#374151',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - var(--header-height))',
    gap: '14px',
    color: '#64748b',
  },
  notFound: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - var(--header-height))',
    gap: '12px',
    color: '#374151',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid #e2e8f0',
    borderTopColor: '#1455C0',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};

const toc = {
  toggle: {
    width: '18px',
    height: '18px',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
  },
  item: {
    flex: 1,
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '3px 6px 3px 4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    lineHeight: 1.45,
    fontFamily: 'var(--font-sans)',
    width: '100%',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 0',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    letterSpacing: '0.06em',
    fontFamily: 'var(--font-sans)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
  },
};
