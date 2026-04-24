'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchTopics(1);
    const handlePageShow = (e) => { if (e.persisted) fetchTopics(1); };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const fetchTopics = async (pg) => {
    setLoading(true);
    try {
      const data = await api.get(`/topics?page=${pg}&limit=24&sort=-updatedAt`);
      setTopics(data.topics || []);
      setTotal(data.totalPages || 1);
      setPage(pg);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 48px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Documentation</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Browse all available topics</p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {topics.map((t, i) => (
                  <a key={t._id} href={`/topics/${t._id}`}
                    className="card animate-fadeIn"
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '10px', animationDelay: `${i * 25}ms` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px',
                        background: 'rgba(79,70,229,0.08)', borderRadius: '4px',
                        color: 'var(--accent-primary)', flexShrink: 0,
                      }}>
                        H{t.hierarchy?.level || 1}
                      </span>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.title}</h3>
                    </div>
                    {(t.metadata?.tags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {(t.metadata.tags).slice(0, 3).map((tag, j) => <span key={j} className="badge">{tag}</span>)}
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                      {t.viewCount || 0} views
                    </span>
                  </a>
                ))}
              </div>

              {total > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '32px' }}>
                  {Array.from({ length: Math.min(total, 7) }, (_, i) => (
                    <button key={i} onClick={() => fetchTopics(i + 1)}
                      className={`btn ${page === i + 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
