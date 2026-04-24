'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function RecommendationsPage() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/recommendations?limit=12').then(d => { setRecs(d.recommendations || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>✨ Recommended For You</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '24px' }}>
          Personalized suggestions based on your interests and reading history
        </p>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div> : recs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <span style={{ fontSize: '3rem' }}>✨</span>
            <h2 style={{ marginTop: '12px' }}>No recommendations yet</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Read more topics to get personalized suggestions</p>
            <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {recs.map((t, i) => (
              <a key={t._id} href={`/topics/${t._id}`} className="card card-glow animate-fadeIn"
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '8px', animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</h3>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(99,102,241,0.2)', borderRadius: '4px', color: 'var(--accent-tertiary)', flexShrink: 0 }}>
                    {Math.round(t.personalScore || 0)}pts
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(t.metadata?.tags || []).slice(0, 3).map((tag, j) => <span key={j} className="badge">{tag}</span>)}
                  {t.metadata?.product && <span className="badge badge-success">{t.metadata.product}</span>}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>👁 {t.viewCount || 0} views</span>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
