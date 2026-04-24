'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchTopics(1); }, []);

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
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }} className="container">
        <div style={{ padding: '32px 0' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Documentation</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Browse all available topics</p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '24px' }}>
                {topics.map((t, i) => (
                  <a key={t._id} href={`/topics/${t._id}`} className="card card-glow animate-fadeIn"
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '8px', animationDelay: `${i * 30}ms` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(99,102,241,0.2)', borderRadius: '4px', color: 'var(--accent-tertiary)' }}>
                        H{t.hierarchy?.level || 1}
                      </span>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(t.metadata?.tags || []).slice(0, 3).map((tag, j) => <span key={j} className="badge">{tag}</span>)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                      👁 {t.viewCount || 0} views
                    </span>
                  </a>
                ))}
              </div>
              {total > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px' }}>
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
        </div>
      </main>
    </>
  );
}
