'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import api from '@/lib/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get('q') || '';
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setQuery(q);
    if (q) doSearch(q, 1, {});
    const handlePageShow = (e) => { if (e.persisted && q) doSearch(q, 1, {}); };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [q]);

  const doSearch = async (searchQuery, pg = 1, filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, page: pg, limit: 20 });
      if (filters.tags) params.set('tags', filters.tags.join(','));
      if (filters.product) params.set('product', filters.product);
      const data = await api.get(`/search?${params}`);
      setResults(data);
      setPage(pg);

      if (searchQuery.trim().length > 10 && pg === 1) {
        setAiLoading(true);
        setAiAnswer(null);
        api.get(`/search/ask?q=${encodeURIComponent(searchQuery)}`)
          .then(res => setAiAnswer(res))
          .catch(e => console.error('AI Error:', e))
          .finally(() => setAiLoading(false));
      } else {
        setAiAnswer(null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const toggleTag = (tag) => {
    const tags = activeFilters.tags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    const f = { ...activeFilters, tags: newTags };
    setActiveFilters(f);
    doSearch(q, 1, f);
  };

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '28px 0 56px' }}>
          {/* Search bar */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              className="input" placeholder="Search documentation…"
              style={{ flex: 1, fontSize: '1rem', padding: '11px 16px' }} />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
              <div className="spinner" />
            </div>
          )}

          {results && !loading && (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {/* Filters sidebar */}
              <aside style={{ width: '210px', flexShrink: 0 }} className="hide-mobile">
                {results.facets?.tags?.length > 0 && (
                  <div className="card" style={{ marginBottom: '12px', padding: '16px 18px' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags</h4>
                    {results.facets.tags.map(f => (
                      <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={(activeFilters.tags || []).includes(f.value)} onChange={() => toggleTag(f.value)}
                          style={{ accentColor: 'var(--accent-primary)' }} />
                        <span style={{ flex: 1 }}>{f.value}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{f.count}</span>
                      </label>
                    ))}
                  </div>
                )}
                {results.facets?.products?.length > 0 && (
                  <div className="card" style={{ padding: '16px 18px' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Products</h4>
                    {results.facets.products.map(f => (
                      <div key={f.value} style={{ padding: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{f.value}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{f.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              {/* Results */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
                  {results.total} result{results.total !== 1 ? 's' : ''} · {results.responseTime}ms
                </p>

                {/* AI Answer */}
                {(aiLoading || aiAnswer) && (
                  <div className="card" style={{
                    marginBottom: '20px', padding: '20px 24px',
                    background: 'rgba(79,70,229,0.04)',
                    border: '1px solid rgba(79,70,229,0.15)',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', top: '-10px', left: '16px',
                      background: 'var(--bg-card)', padding: '0 8px',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)',
                    }}>
                      AI Answer
                    </div>
                    {aiLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Synthesizing answer from documentation…</span>
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
                          {aiAnswer.answer}
                        </p>
                        {aiAnswer.sources?.length > 0 && (
                          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Sources:</span>
                            {aiAnswer.sources.map((src, idx) => (
                              <a key={idx} href={`/topics/${src.id}`} style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                                [{idx + 1}] {src.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {results.hits?.map((hit, i) => (
                  <a key={hit.id} href={`/topics/${hit.topicId || hit.id}`}
                    className="card animate-fadeIn"
                    style={{ display: 'block', marginBottom: '10px', textDecoration: 'none', animationDelay: `${i * 40}ms` }}>
                    <h3
                      style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: hit.highlight?.title?.[0] || hit.title }}
                    />
                    {hit.highlight?.content?.[0] && (
                      <p
                        style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: hit.highlight.content[0] }}
                      />
                    )}
                    {(hit.tags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {(hit.tags).slice(0, 4).map((t, j) => <span key={j} className="badge">{t}</span>)}
                      </div>
                    )}
                  </a>
                ))}

                {results.total === 0 && (
                  <div className="card" style={{ textAlign: 'center', padding: '56px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No results found</p>
                    <p style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Try different keywords or remove filters</p>
                  </div>
                )}

                {results.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '24px' }}>
                    {Array.from({ length: Math.min(results.totalPages, 5) }, (_, i) => (
                      <button key={i} onClick={() => doSearch(q, i + 1, activeFilters)}
                        className={`btn ${page === i + 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
