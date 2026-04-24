'use client';
import { useState, useEffect } from 'react';
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
        if (d.recommendations && d.recommendations.length > 0) setRecs(d.recommendations);
        else loadPopular();
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
      <main>
        {/* Hero */}
        <section style={s.hero}>
          <div style={s.heroBadge}>Documentation Platform</div>
          <h1 style={s.heroTitle}>
            Find answers <span style={s.heroAccent}>instantly</span>
          </h1>
          <p style={s.heroSub}>
            Search across all your documentation, guides, and references in one place.
          </p>
          <form onSubmit={handleSearch} style={s.heroSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={s.heroSearchIcon}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, guides, and references…"
              style={s.heroInput}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '6px' }}>Search</button>
          </form>

          <div style={s.statsRow}>
            {[
              { label: 'Documents', value: stats.documents || 0 },
              { label: 'Topics', value: stats.topics || 0 },
              { label: 'Users', value: stats.users || 0 },
            ].map((stat, i) => (
              <div key={i} style={s.statItem}>
                <span style={s.statVal}>{stat.value.toLocaleString()}</span>
                <span style={s.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', paddingBottom: '48px' }}>
          {/* Recommended */}
          {recs.length > 0 && (
            <section style={s.section} className="container">
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>Recommended for you</h2>
                <a href="/profile/recommendations" style={s.sectionLink}>View all →</a>
              </div>
              <div style={s.grid}>
                {recs.map((t, i) => (
                  <a key={t._id} href={`/topics/${t._id}`} className="card animate-fadeIn" style={{ ...s.topicCard, animationDelay: `${i * 40}ms` }}>
                    <h3 style={s.topicTitle}>{t.title}</h3>
                    <div style={s.topicTags}>
                      {(t.metadata?.tags || []).slice(0, 3).map((tag, j) => (
                        <span key={j} className="badge">{tag}</span>
                      ))}
                    </div>
                    <span style={s.topicMeta}>{t.viewCount || 0} views</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Popular (fallback) */}
          {recs.length === 0 && popular.length > 0 && (
            <section style={s.section} className="container">
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>Popular topics</h2>
                <a href="/topics" style={s.sectionLink}>Browse all →</a>
              </div>
              <div style={s.grid}>
                {popular.map((t, i) => (
                  <a key={t._id} href={`/topics/${t._id}`} className="card animate-fadeIn" style={{ ...s.topicCard, animationDelay: `${i * 40}ms` }}>
                    <h3 style={s.topicTitle}>{t.title}</h3>
                    <div style={s.topicTags}>
                      {(t.metadata?.tags || []).slice(0, 3).map((tag, j) => (
                        <span key={j} className="badge">{tag}</span>
                      ))}
                    </div>
                    <span style={s.topicMeta}>{t.viewCount || 0} views</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Recently updated */}
          {recent.length > 0 && (
            <section style={s.section} className="container">
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>Recently updated</h2>
              </div>
              <div style={s.grid}>
                {recent.map((t, i) => (
                  <a key={t._id} href={`/topics/${t._id}`} className="card animate-fadeIn" style={{ ...s.topicCard, animationDelay: `${i * 40}ms` }}>
                    <h3 style={s.topicTitle}>{t.title}</h3>
                    <span style={s.topicMeta}>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {recs.length === 0 && popular.length === 0 && recent.length === 0 && (
            <section className="container" style={{ padding: '64px 0', textAlign: 'center' }}>
              <div className="card" style={{ maxWidth: '420px', margin: '0 auto', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '16px' }}>📄</div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No content yet</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
                  Upload your first document to get started
                </p>
                <a href="/admin/ingest" className="btn btn-primary" style={{ marginTop: '20px' }}>
                  Upload content
                </a>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

const s = {
  hero: {
    textAlign: 'center',
    padding: '72px 24px 56px',
    background: 'linear-gradient(180deg, rgba(79,70,229,0.05) 0%, rgba(255,255,255,0) 100%)',
    borderBottom: '1px solid var(--border-color)',
  },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 14px', borderRadius: 'var(--radius-full)',
    background: 'rgba(79,70,229,0.08)', color: 'var(--accent-primary)',
    fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em',
    textTransform: 'uppercase', marginBottom: '20px',
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800,
    lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--text-primary)',
  },
  heroAccent: {
    background: 'var(--gradient-hero)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    color: 'var(--text-secondary)', fontSize: '1.05rem',
    marginTop: '14px', maxWidth: '520px', margin: '14px auto 0',
  },
  heroSearch: {
    display: 'flex', maxWidth: '580px', margin: '28px auto 0',
    background: '#fff', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    padding: '6px 6px 6px 0',
    boxShadow: 'var(--shadow-md)',
    position: 'relative',
  },
  heroSearchIcon: { position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', flexShrink: 0 },
  heroInput: {
    flex: 1, padding: '11px 12px 11px 46px', background: 'transparent', border: 'none',
    color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  statsRow: {
    display: 'flex', justifyContent: 'center', gap: '40px',
    marginTop: '36px',
  },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statVal: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 },
  statLabel: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 },
  section: { paddingTop: '40px' },
  sectionHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' },
  sectionLink: { fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 500 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  topicCard: { display: 'flex', flexDirection: 'column', gap: '10px', textDecoration: 'none' },
  topicTitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 },
  topicTags: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  topicMeta: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' },
};
