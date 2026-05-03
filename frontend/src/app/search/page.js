'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getStoredToken } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { hrefForTopic } from '@/lib/prettyUrl';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const q = searchParams.get('q') || '';

  const [query, setQuery] = useState(q);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [titlesOnly, setTitlesOnly] = useState(false);
  const [activeTags, setActiveTags] = useState([]);  // becomes "MODULE"
  const [activeProducts, setActiveProducts] = useState([]); // optional
  const [releaseNotes, setReleaseNotes] = useState(false);
  const [savedToast, setSavedToast] = useState('');
  const [savedInterests, setSavedInterests] = useState([]); // from /user/profile
  const [savedDocIds,    setSavedDocIds]    = useState([]);
  const [savedTopicIds,  setSavedTopicIds]  = useState([]);
  const [savedRN,        setSavedRN]        = useState(false);
  // Module facet — list of uploaded documents the user can pick to scope
  const [modules,        setModules]        = useState([]);
  const [activeDocIds,   setActiveDocIds]   = useState([]);
  const [moduleFilter,   setModuleFilter]   = useState('');
  const [contentLocales, setContentLocales] = useState([]);
  const [contentLang, setContentLang] = useState('');

  // Load uploaded documents once so the MODULE list can render
  useEffect(() => {
    api.get('/portal/documents')
      .then((d) => setModules(d.documents || []))
      .catch(() => setModules([]));
  }, []);

  useEffect(() => {
    const lp = searchParams.get('lang');
    if (!lp) setContentLang('');
    else if (lp === '*') setContentLang('*');
    else setContentLang(lp);
  }, [searchParams]);

  useEffect(() => {
    api.get('/locales')
      .then((d) => setContentLocales(d.locales || []))
      .catch(() => setContentLocales([]));
  }, []);

  // Load saved filter preferences so every search is scoped to them.
  useEffect(() => {
    if (typeof window === 'undefined' || !getStoredToken()) return;
    api.get('/user/profile')
      .then((d) => {
        setSavedInterests(d.interests || []);
        setSavedDocIds(d.documentIds || []);
        setSavedTopicIds(d.topicIds || []);
        setSavedRN(!!d.releaseNotesOnly);
      })
      .catch(() => {});
  }, []);

  const doSearch = useCallback(async (pg = 1) => {
    if (!q) { setResults(null); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: pg, limit: 20 });
      // Combine the user's saved-preference filters (always applied) with
      // session-level facet selections from this page.
      const tagsForRequest = Array.from(new Set([...savedInterests, ...activeTags]));
      if (releaseNotes && !tagsForRequest.includes('Release Notes')) tagsForRequest.push('Release Notes');
      if (savedRN && !tagsForRequest.includes('Release Notes')) tagsForRequest.push('Release Notes');
      if (tagsForRequest.length) params.set('tags', tagsForRequest.join(','));
      if (activeProducts.length === 1) params.set('product', activeProducts[0]);
      if (titlesOnly) params.set('titlesOnly', '1');
      // documentIds = saved preferences ∩ session selection (when both set),
      // otherwise just whichever is non-empty.
      const docIdsForRequest = (() => {
        if (savedDocIds.length && activeDocIds.length) {
          return savedDocIds.filter((id) => activeDocIds.includes(id));
        }
        return savedDocIds.length ? savedDocIds : activeDocIds;
      })();
      if (docIdsForRequest.length)  params.set('documentIds', docIdsForRequest.join(','));
      if (savedTopicIds.length)     params.set('topicIds',    savedTopicIds.join(','));
      if (contentLang === '*' || contentLang === 'all') params.set('language', 'all');
      else if (contentLang) params.set('language', contentLang);
      const data = await api.get(`/search?${params}`);
      setResults(data);
      setPage(pg);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [q, activeTags, activeProducts, releaseNotes, titlesOnly, savedInterests, savedDocIds, savedTopicIds, savedRN, activeDocIds, contentLang]);

  // Re-run search when q or filters change
  useEffect(() => {
    setQuery(q);
    doSearch(1);
  }, [q, titlesOnly, activeTags, activeProducts, releaseNotes, savedInterests, savedDocIds, savedTopicIds, savedRN, activeDocIds, contentLang, doSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (contentLang === '*' || contentLang === 'all') p.set('lang', '*');
    else if (contentLang) p.set('lang', contentLang);
    const qs = p.toString();
    router.push(qs ? `/search?${qs}` : '/search');
  };

  const toggle = (list, setList) => (value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSavedToast(t('linkCopied'));
    } catch {
      setSavedToast(t('couldNotCopy'));
    }
    setTimeout(() => setSavedToast(''), 1500);
  };

  const saveSearch = async () => {
    try {
      await api.post('/user/searches/save', { query: q, filters: { tags: activeTags, products: activeProducts, titlesOnly, releaseNotes } });
      setSavedToast(t('searchSaved'));
    } catch {
      setSavedToast(t('searchSaved'));
    }
    setTimeout(() => setSavedToast(''), 1500);
  };

  return (
    <div style={s.page}>
      {/* Hero */}
      <section style={s.hero}>
        <img src="/Group 79.png" alt="evolve. Everyday" style={s.heroEvolve} />
        <div style={s.heroCenter}>
          <h1 style={s.heroTitle}>{t('portalTitle')}</h1>
          <form onSubmit={handleSubmit} style={s.searchWrap}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={s.searchInput}
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); router.push('/search'); }} aria-label="Clear" style={s.searchClearBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <button type="submit" style={s.searchBtn} aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
          </form>
          {q && (
            <div style={s.heroActions}>
              <span style={s.resultCount}>
                {results
                  ? t(results.total === 1 ? 'resultCount' : 'resultCountPlural', { n: results.total })
                  : ''}
              </span>
              <button type="button" style={s.linkAction} onClick={copyLink}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                {t('copyLink')}
              </button>
              <button type="button" style={s.linkAction} onClick={saveSearch}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                {t('saveSearch')}
              </button>
              {savedToast && <span style={s.toast}>{savedToast}</span>}
            </div>
          )}
        </div>
        <img src="/Group 4562.png" alt="" aria-hidden="true" style={s.heroFigures} />
      </section>

      {/* Body */}
      <div style={s.body}>
        {/* Filters sidebar */}
        <aside style={s.sidebar}>
          <div style={s.savedSearchPill}>
            <span style={{ fontSize: '0.95rem', color: '#94a3b8' }}>⋮</span>
            {t('savedSearch')}
          </div>

          <div style={s.facetGroup}>
            <div style={s.facetLabel}>{t('searchScope')}</div>
            <FacetCheck
              label={t('searchTitlesOnly')}
              checked={titlesOnly}
              onChange={() => setTitlesOnly((v) => !v)}
            />
          </div>

          <div style={s.facetGroup}>
            <div style={s.facetLabel}>{t('contentLanguage')}</div>
            <select
              value={contentLang === '' ? '__implicit__' : contentLang}
              onChange={(e) => {
                const v = e.target.value;
                const next = v === '__implicit__' ? '' : v;
                setContentLang(next);
                const p = new URLSearchParams(window.location.search);
                if (next === '') p.delete('lang');
                else if (next === '*' || next === 'all') p.set('lang', '*');
                else p.set('lang', next);
                const qs = p.toString();
                router.replace(qs ? `/search?${qs}` : '/search');
              }}
              style={s.facetSelect}
            >
              <option value="__implicit__">{t('contentLangPreferred')}</option>
              <option value="*">{t('contentLangAll')}</option>
              {contentLocales.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.name} ({loc.count})
                </option>
              ))}
            </select>
          </div>

          <div style={s.facetGroup}>
            <div style={s.facetLabel}>{t('releaseNotes')}</div>
            <FacetCheck
              label={t('releaseNotesItem')}
              checked={releaseNotes}
              onChange={() => setReleaseNotes((v) => !v)}
            />
          </div>

          {/* MODULE — uploaded documents */}
          {modules.length > 0 && (
            <div style={s.facetGroup}>
              <div style={s.facetLabel}>{t('module')}</div>
              <input
                type="text"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                placeholder="Filter Module"
                style={s.facetFilterInput}
              />
              <div style={s.facetScroll}>
                {modules
                  .filter((d) => d.title?.toLowerCase().includes(moduleFilter.toLowerCase()))
                  .map((d) => (
                    <FacetCheck
                      key={d._id}
                      label={d.title}
                      checked={activeDocIds.includes(d._id)}
                      onChange={() => toggle(activeDocIds, setActiveDocIds)(d._id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {results?.facets?.tags?.length > 0 && (
            <div style={s.facetGroup}>
              <div style={s.facetLabel}>TAGS</div>
              <div style={s.facetScroll}>
                {results.facets.tags
                  .filter((t) => t.value !== 'Release Notes')
                  .map((t) => (
                    <FacetCheck
                      key={t.value}
                      label={t.value}
                      count={t.count}
                      checked={activeTags.includes(t.value)}
                      onChange={() => toggle(activeTags, setActiveTags)(t.value)}
                    />
                  ))}
              </div>
            </div>
          )}

          {results?.facets?.products?.length > 0 && (
            <div style={s.facetGroup}>
              <div style={s.facetLabel}>{t('product')}</div>
              {results.facets.products.map((p) => (
                <FacetCheck
                  key={p.value}
                  label={p.value}
                  count={p.count}
                  checked={activeProducts.includes(p.value)}
                  onChange={() => toggle(activeProducts, setActiveProducts)(p.value)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Results */}
        <main style={s.results}>
          {loading ? (
            <div style={s.loadingWrap}>
              <div className="spinner" />
            </div>
          ) : !q ? (
            <div style={s.emptyState}>
              <p style={{ fontSize: '0.95rem', color: '#64748b' }}>{t('typeQuery')}</p>
            </div>
          ) : results?.total === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{t('noResultsFound')}</p>
              <p style={{ marginTop: '6px', color: '#64748b', fontSize: '0.875rem' }}>
                {t('tryDifferent')}
              </p>
            </div>
          ) : results ? (
            <>
              {/* Custom-template virtual hits — static dashboard pages
                  (Release Notes, FAQs, …) surfaced server-side so a
                  search for e.g. "release notes" jumps straight to the
                  /dashboard/templates/release-notes page. Only present
                  on page 1; backend never paginates them. */}
              {results.templates?.length > 0 && (
                <div style={s.templateBlock}>
                  <div style={s.templateBlockLabel}>{t('searchPagesLabel') || 'PAGES'}</div>
                  {results.templates.map((tpl) => (
                    <a
                      key={tpl.slug}
                      href={tpl.href}
                      style={s.templateCard}
                    >
                      <div style={s.templateCardRow}>
                        <span style={s.templateBadge}>Page</span>
                        <h3 style={s.templateTitle}>{tpl.title}</h3>
                      </div>
                      {tpl.description && (
                        <p style={s.templateSnippet}>{tpl.description}</p>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {results.unstructuredHits?.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: '#64748b',
                      marginBottom: 12,
                    }}
                  >
                    FILES & PUBLICATIONS
                  </div>
                  {results.unstructuredHits.map((hit) => (
                    <Link
                      key={hit.id}
                      href={`/dashboard/file/${hit.unstructuredId}`}
                      style={s.resultCard}
                    >
                      <span style={s.fileBadge}>File</span>
                      <h3
                        style={s.resultTitle}
                        dangerouslySetInnerHTML={{
                          __html: hit.highlight?.title?.[0] || hit.title,
                        }}
                      />
                      {hit.highlight?.content?.[0] && (
                        <p
                          style={s.resultSnippet}
                          dangerouslySetInnerHTML={{ __html: hit.highlight.content[0] }}
                        />
                      )}
                      {(hit.tags || []).length > 0 && (
                        <div style={s.tagRow}>
                          {hit.tags.slice(0, 4).map((tg, j) => (
                            <span key={j} style={s.tagBadge}>{tg}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {results.hits?.map((hit) => {
                // Search hits are topics. Resolve the link with our
                // shared helper so we use:
                //   /r/<topic-pretty>                 when topic has prettyUrl
                //   /r/<doc-pretty>?topic=<topicId>   when only the doc does
                //   /dashboard/docs/<docId>?topic=…   legacy fallback
                const topicLike = {
                  _id: hit.topicId || hit.id,
                  prettyUrl: hit.prettyUrl || '',
                  documentId: hit.documentId || null,
                };
                const parentDoc = hit.documentId
                  ? { _id: hit.documentId, prettyUrl: hit.documentPrettyUrl || '' }
                  : null;
                return (
                <a
                  key={hit.topicId || hit.id}
                  href={hrefForTopic(topicLike, parentDoc)}
                  style={s.resultCard}
                >
                  <h3
                    style={s.resultTitle}
                    dangerouslySetInnerHTML={{ __html: hit.highlight?.title?.[0] || hit.title }}
                  />
                  {hit.highlight?.content?.[0] && (
                    <p
                      style={s.resultSnippet}
                      dangerouslySetInnerHTML={{ __html: hit.highlight.content[0] }}
                    />
                  )}
                  {(hit.tags || []).length > 0 && (
                    <div style={s.tagRow}>
                      {hit.tags.slice(0, 4).map((t, j) => (
                        <span key={j} style={s.tagBadge}>{t}</span>
                      ))}
                    </div>
                  )}
                </a>
                );
              })}

              {results.totalPages > 1 && (
                <div style={s.pager}>
                  {Array.from({ length: Math.min(results.totalPages, 7) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => doSearch(i + 1)}
                      style={{
                        ...s.pagerBtn,
                        ...(page === i + 1 ? s.pagerBtnActive : {}),
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function FacetCheck({ label, count, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '6px 0', cursor: 'pointer',
      fontSize: '0.85rem', color: '#1f2937',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: '#1d4ed8' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {typeof count === 'number' && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{count}</span>}
    </label>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

// ---------- styles ----------
const s = {
  page: { minHeight: 'calc(100vh - var(--header-height))', background: '#ffffff', fontFamily: 'var(--font-sans)' },
  hero: {
    background: '#EDF6FF',
    padding: '32px 24px 28px',
    display: 'grid',
    gridTemplateColumns: '1fr minmax(0, 760px) 1fr',
    alignItems: 'center',
    gap: '24px',
  },
  heroEvolve: { height: '110px', width: 'auto', justifySelf: 'start', objectFit: 'contain' },
  heroFigures: { height: '160px', width: 'auto', justifySelf: 'end', objectFit: 'contain' },
  heroCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', width: '100%' },
  heroTitle: { fontSize: '1.5rem', fontWeight: 600, color: '#1d4ed8', letterSpacing: '-0.01em', margin: 0 },
  searchWrap: {
    display: 'flex', alignItems: 'center',
    background: '#fff', border: '1px solid #cfd8e6',
    borderRadius: '6px', overflow: 'hidden',
    width: '100%', maxWidth: '720px',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none',
    padding: '12px 16px', fontSize: '0.95rem',
    color: '#1f2937', background: 'transparent',
    fontFamily: 'var(--font-sans)',
  },
  searchClearBtn: {
    background: 'transparent', border: 'none',
    padding: '0 10px', height: '100%',
    cursor: 'pointer', color: '#6b7280',
    display: 'inline-flex', alignItems: 'center',
  },
  searchBtn: {
    background: '#1976D2', color: '#fff',
    border: 'none', width: '46px', height: '46px',
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  heroActions: {
    display: 'inline-flex', alignItems: 'center',
    gap: '24px', marginTop: '6px',
    fontSize: '0.78rem', color: '#475569', letterSpacing: '0.06em',
  },
  resultCount: { color: '#1d4ed8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
  linkAction: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#1d4ed8', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontFamily: 'var(--font-sans)',
  },
  toast: { color: '#10b981', fontSize: '0.78rem' },
  body: {
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    gap: '24px',
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '20px 24px 64px',
    alignItems: 'flex-start',
  },
  sidebar: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '14px 16px 18px',
    position: 'sticky',
    top: 'calc(var(--header-height) + 16px)',
  },
  savedSearchPill: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    border: '1px solid #cfd8e6', borderRadius: '999px',
    padding: '6px 14px',
    fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8',
    letterSpacing: '0.06em',
    marginBottom: '14px',
  },
  facetGroup: { marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' },
  facetLabel: { fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' },
  facetScroll: { maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' },
  facetSelect: {
    width: '100%',
    marginTop: '4px',
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-sans)',
    background: '#fff',
    color: '#0f172a',
    boxSizing: 'border-box',
  },
  facetFilterInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.82rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    marginBottom: '8px',
    boxSizing: 'border-box',
  },
  results: { minWidth: 0 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  emptyState: {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '56px 24px', textAlign: 'center',
  },
  resultCard: {
    display: 'block', textDecoration: 'none',
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '16px 18px', marginBottom: '10px',
    transition: 'box-shadow 120ms, transform 120ms',
  },
  resultTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0 },
  resultSnippet: { fontSize: '0.85rem', color: '#475569', marginTop: '6px', lineHeight: 1.6 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' },
  tagBadge: {
    background: '#eff6ff', color: '#1d4ed8',
    padding: '2px 8px', borderRadius: '4px',
    fontSize: '0.72rem', fontWeight: 500,
  },
  pager: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '24px' },
  pagerBtn: {
    background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '4px',
    padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem',
  },
  pagerBtnActive: { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' },
  fileBadge: {
    display: 'inline-block',
    background: '#fef3c7',
    color: '#92400e',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  // Custom-template "Pages" block — distinct from topic hits so readers
  // can tell at a glance these are dashboard pages, not document snippets.
  templateBlock: {
    marginBottom: '18px',
    paddingBottom: '14px',
    borderBottom: '1px solid #e5e7eb',
  },
  templateBlockLabel: {
    fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700,
    letterSpacing: '0.08em', marginBottom: '8px',
  },
  templateCard: {
    display: 'block', textDecoration: 'none',
    background: '#f8faff', border: '1px solid #c7d7f5', borderRadius: '8px',
    padding: '14px 18px', marginBottom: '8px',
    transition: 'box-shadow 120ms, transform 120ms',
  },
  templateCardRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  templateBadge: {
    background: '#1d4ed8', color: '#ffffff',
    padding: '2px 8px', borderRadius: '4px',
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  templateTitle: {
    fontSize: '0.95rem', fontWeight: 600, color: '#1d4ed8', margin: 0,
  },
  templateSnippet: {
    fontSize: '0.85rem', color: '#475569', marginTop: '6px', lineHeight: 1.55,
  },
};
