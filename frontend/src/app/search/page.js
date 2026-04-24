'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Header from '@/components/layout/Header';
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

  useEffect(() => { setQuery(q); if (q) doSearch(q, 1, {}); }, [q]);

  const doSearch = async (searchQuery, pg = 1, filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, page: pg, limit: 20 });
      if (filters.tags) params.set('tags', filters.tags.join(','));
      if (filters.product) params.set('product', filters.product);
      const data = await api.get(`/search?${params}`);
      setResults(data);
      setPage(pg);

      // Trigger AI Answer if query is detailed enough (e.g. > 10 chars)
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
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }} className="container">
        <div style={{ padding: '32px 0' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              className="input" placeholder="Search..." style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner" /></div>}

          {results && !loading && (
            <div style={{ display: 'flex', gap: '24px' }}>
              {/* Filters sidebar */}
              <aside style={{ width: '220px', flexShrink: 0 }} className="hide-mobile">
                {results.facets?.tags?.length > 0 && (
                  <div className="card" style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>Tags</h4>
                    {results.facets.tags.map(f => (
                      <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={(activeFilters.tags || []).includes(f.value)} onChange={() => toggleTag(f.value)} />
                        {f.value} <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>({f.count})</span>
                      </label>
                    ))}
                  </div>
                )}
                {results.facets?.products?.length > 0 && (
                  <div className="card">
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>Products</h4>
                    {results.facets.products.map(f => (
                      <div key={f.value} style={{ padding: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {f.value} ({f.count})
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              {/* Results */}
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {results.total} results found in {results.responseTime}ms
                </p>

                {/* AI Answer Box */}
                {(aiLoading || aiAnswer) && (
                  <div className="card card-glow" style={{ marginBottom: '24px', background: 'var(--bg-glass)', border: '1px solid rgba(99,102,241,0.3)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-10px', left: '16px', background: 'var(--bg-primary)', padding: '0 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-tertiary)' }}>
                      ✨ Ask AI
                    </div>
                    {aiLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
                        <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Synthesizing answer from documentation...</span>
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                          {aiAnswer.answer}
                        </p>
                        {aiAnswer.sources?.length > 0 && (
                          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Sources:</span>
                            {aiAnswer.sources.map((s, idx) => (
                              <a key={idx} href={`/topics/${s.id}`} style={{ color: 'var(--accent-tertiary)', textDecoration: 'none', marginRight: '12px' }}>
                                [{idx + 1}] {s.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {results.hits?.map((hit, i) => (
  <a
    key={hit.id}
    href={`/topics/${hit.topicId || hit.id}`}
    className="card animate-fadeIn"
    style={{
      display: 'block',
      marginBottom: '12px',
      textDecoration: 'none',
      animationDelay: `${i * 50}ms`
    }}
  >
    <h3
      style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text-primary)'
      }}
      dangerouslySetInnerHTML={{
        __html: hit.highlight?.title?.[0] || hit.title
      }}
    />

    {hit.highlight?.content?.[0] && (
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginTop: '6px',
          lineHeight: 1.5
        }}
        dangerouslySetInnerHTML={{
          __html: hit.highlight.content[0]
        }}
      />
    )}

    <div
      style={{
        display: 'flex',
        gap: '6px',
        marginTop: '8px',
        flexWrap: 'wrap'
      }}
    >
      {(hit.tags || []).slice(0, 4).map((t, j) => (
        <span key={j} className="badge">{t}</span>
      ))}
    </div>
  </a>
))}
                {results.total === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1.2rem' }}>No results found</p>
                    <p style={{ marginTop: '8px' }}>Try different keywords or remove filters</p>
                  </div>
                )}
                {results.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
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
        </div>
      </main>
    </>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'100px'}}><div className="spinner"/></div>}><SearchContent /></Suspense>;
}
