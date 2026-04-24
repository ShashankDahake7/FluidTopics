'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [popular, setPopular] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ documents: 0, topics: 0 });
  const router = useRouter();

  useEffect(() => {
    const loadPopular = () => {
      api.get('/topics/popular?limit=6').then(d => setPopular(d.topics || [])).catch(() => {});
    };

    api.get('/user/recommendations?limit=6')
      .then(d => {
        if (d.recommendations && d.recommendations.length > 0) {
          setRecs(d.recommendations);
        } else {
          loadPopular();
        }
      })
      .catch(() => loadPopular());

    api.get('/topics/recent?limit=6').then(d => setRecent(d.topics || [])).catch(() => {});
    api.get('/admin/stats').then(d => setStats(d)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <h1 style={styles.heroTitle}>
            Find answers <span style={styles.heroAccent}>instantly</span>
          </h1>
          <p style={styles.heroSub}>Search across all your documentation in one place</p>
          <form onSubmit={handleSearch} style={styles.heroSearch}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={styles.heroSearchIcon}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, guides, and references..."
              style={styles.heroInput}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          <div style={styles.statsRow}>
            {[
              { label: 'Documents', value: stats.documents || 0 },
              { label: 'Topics', value: stats.topics || 0 },
              { label: 'Users', value: stats.users || 0 },
            ].map((s,i) => (
              <div key={i} style={styles.statItem}>
                <span style={styles.statVal}>{s.value}</span>
                <span style={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Personalized Recommendations */}
        {recs.length > 0 && (
          <section style={styles.section} className="container">
            <h2 style={styles.sectionTitle}>✨ Recommended For You</h2>
            <div style={styles.grid}>
              {recs.map(t => (
                <a key={t._id} href={`/topics/${t._id}`} className="card card-glow" style={styles.topicCard}>
                  <h3 style={styles.topicTitle}>{t.title}</h3>
                  <div style={styles.topicMeta}>
                    {(t.metadata?.tags || []).slice(0, 3).map((tag, i) => (
                      <span key={i} className="badge">{tag}</span>
                    ))}
                  </div>
                  <span style={styles.views}>👁 {t.viewCount || 0} views</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Popular Topics (Fallback) */}
        {recs.length === 0 && popular.length > 0 && (
          <section style={styles.section} className="container">
            <h2 style={styles.sectionTitle}>📚 Popular Topics</h2>
            <div style={styles.grid}>
              {popular.map(t => (
                <a key={t._id} href={`/topics/${t._id}`} className="card card-glow" style={styles.topicCard}>
                  <h3 style={styles.topicTitle}>{t.title}</h3>
                  <div style={styles.topicMeta}>
                    {(t.metadata?.tags || []).slice(0, 3).map((tag, i) => (
                      <span key={i} className="badge">{tag}</span>
                    ))}
                  </div>
                  <span style={styles.views}>👁 {t.viewCount || 0} views</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <section style={styles.section} className="container">
            <h2 style={styles.sectionTitle}>🕐 Recently Updated</h2>
            <div style={styles.grid}>
              {recent.map(t => (
                <a key={t._id} href={`/topics/${t._id}`} className="card" style={styles.topicCard}>
                  <h3 style={styles.topicTitle}>{t.title}</h3>
                  <span style={styles.date}>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {recs.length === 0 && popular.length === 0 && recent.length === 0 && (
          <section style={styles.emptySection} className="container">
            <div style={styles.emptyCard} className="card">
              <span style={{ fontSize: '3rem' }}>📄</span>
              <h2 style={{ color: 'var(--text-primary)', marginTop: '12px' }}>No content yet</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Upload your first document to get started
              </p>
              <a href="/admin/ingest" className="btn btn-primary" style={{ marginTop: '20px' }}>
                Upload Content
              </a>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

const styles = {
  hero: {
    textAlign: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
    width: '600px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)',
    pointerEvents: 'none',
  },
  heroTitle: { fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, position: 'relative' },
  heroAccent: { background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '12px', position: 'relative' },
  heroSearch: {
    display: 'flex', maxWidth: '600px', margin: '32px auto 0', position: 'relative',
    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)', padding: '6px',
  },
  heroSearchIcon: { position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)' },
  heroInput: {
    flex: 1, padding: '14px 16px 14px 48px', background: 'transparent', border: 'none',
    color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', fontFamily: 'var(--font-sans)',
  },
  statsRow: { display: 'flex', justifyContent: 'center', gap: '48px', marginTop: '40px', position: 'relative' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statVal: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-tertiary)' },
  statLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' },
  section: { padding: '40px 0' },
  sectionTitle: { fontSize: '1.3rem', fontWeight: 600, marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  topicCard: { display: 'flex', flexDirection: 'column', gap: '8px', textDecoration: 'none', cursor: 'pointer' },
  topicTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' },
  topicMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  views: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'auto' },
  date: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  emptySection: { padding: '60px 0', textAlign: 'center' },
  emptyCard: { maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px' },
};
