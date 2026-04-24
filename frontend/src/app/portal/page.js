'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// Palette of icon backgrounds — cycles by index
const TILE_COLORS = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#2563eb',
];

const ICONS = ['📄', '📚', '🗂️', '📑', '📋', '📝', '🔖', '📰'];

function DocTile({ doc, index }) {
  const color = TILE_COLORS[index % TILE_COLORS.length];
  const icon  = ICONS[index % ICONS.length];

  return (
    <Link href={`/portal/docs/${doc._id}`} style={styles.tile}>
      <div style={{ ...styles.tileIcon, background: color }}>
        <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      </div>
      <div style={styles.tileBody}>
        <div style={styles.tileTitle}>{doc.title}</div>
        {doc.description && (
          <div style={styles.tileDesc}>{doc.description}</div>
        )}
        <div style={styles.tileMeta}>
          {doc.topicCount} topic{doc.topicCount !== 1 ? 's' : ''}
          {doc.product && <> · {doc.product}</>}
        </div>
      </div>
    </Link>
  );
}

export default function PortalHomepage() {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState('');
  const router = useRouter();

  useEffect(() => {
    api.get('/portal/documents')
      .then((d) => setDocs(d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const filtered = query
    ? docs.filter((d) =>
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.product?.toLowerCase().includes(query.toLowerCase()) ||
        d.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : docs;

  return (
    <div style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <h1 style={styles.heroTitle}>How can we help you?</h1>
          <p style={styles.heroSub}>Search our documentation or browse topics below</p>
          <form onSubmit={handleSearch} style={styles.searchWrap}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" style={styles.searchIcon}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              style={styles.searchInput}
              placeholder="Search documentation…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" style={styles.searchBtn}>Search</button>
          </form>
        </div>
      </div>

      {/* Tiles */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>Loading documentation…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            {docs.length === 0
              ? 'No documentation published yet.'
              : 'No results match your search.'}
          </div>
        ) : (
          <>
            <h2 style={styles.sectionTitle}>
              {query ? `Results for "${query}"` : 'Browse Documentation'}
            </h2>
            <div style={styles.grid}>
              {filtered.map((doc, i) => (
                <DocTile key={doc._id} doc={doc} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - var(--header-height))',
    background: '#f8fafc',
  },
  hero: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 60%, #4f46e5 100%)',
    padding: '64px 24px 72px',
  },
  heroInner: {
    maxWidth: '640px',
    margin: '0 auto',
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: '2.2rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    marginBottom: '10px',
  },
  heroSub: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: '28px',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '12px',
    padding: '4px 4px 4px 16px',
    gap: '10px',
    backdropFilter: 'blur(8px)',
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    color: '#ffffff',
    fontFamily: 'var(--font-sans)',
    '::placeholder': { color: 'rgba(255,255,255,0.5)' },
  },
  searchBtn: {
    background: '#ffffff',
    color: '#1e40af',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 20px',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    flexShrink: 0,
    transition: 'opacity 150ms',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '48px 24px 64px',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '20px',
    letterSpacing: '-0.01em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    textDecoration: 'none',
    transition: 'box-shadow 150ms, transform 150ms',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  tileIcon: {
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: {
    padding: '16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  tileTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#1e293b',
    lineHeight: 1.3,
  },
  tileDesc: {
    fontSize: '0.8rem',
    color: '#64748b',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  tileMeta: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: 'auto',
    paddingTop: '4px',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '80px 0',
    color: '#64748b',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '80px 0',
    fontSize: '0.95rem',
  },
};
