'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RecommendationsPage() {
  const router = useRouter();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) { router.replace('/login'); return; }
    api.get('/user/recommendations?limit=12')
      .then(d => { setRecs(d.recommendations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Recommended for you</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                Personalised based on your interests and reading history
              </p>
            </div>
            <a href="/profile" className="btn btn-secondary btn-sm">← Profile</a>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner" /></div>
          ) : recs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px', maxWidth: '420px', margin: '0 auto' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✨</div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>No recommendations yet</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.875rem' }}>Read more topics to get personalised suggestions</p>
              <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
              {recs.map((t, i) => (
                <a key={t._id} href={`/topics/${t._id}`}
                  className="card animate-fadeIn"
                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '10px', animationDelay: `${i * 40}ms` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.title}</h3>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(79,70,229,0.08)', borderRadius: '4px', color: 'var(--accent-primary)', flexShrink: 0, fontWeight: 600 }}>
                      {Math.round(t.personalScore || 0)}pts
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {(t.metadata?.tags || []).slice(0, 3).map((tag, j) => <span key={j} className="badge">{tag}</span>)}
                    {t.metadata?.product && <span className="badge badge-success">{t.metadata.product}</span>}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>{t.viewCount || 0} views</span>
                </a>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
