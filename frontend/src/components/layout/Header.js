'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('ft_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_user');
    setUser(null);
    router.push('/');
  };

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>◆</span>
          <span style={styles.logoText}>Fluid<span style={styles.logoAccent}>Topics</span></span>
        </Link>

        <form onSubmit={handleSearch} style={styles.searchForm} className="hide-mobile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..." style={styles.searchInput}
          />
        </form>

        <nav style={styles.nav}>
          <Link href="/topics" style={styles.navLink}>Docs</Link>
          {user && ['admin', 'editor'].includes(user.role) && (
            <Link href="/admin" style={styles.navLink}>Admin</Link>
          )}
          {user ? (
            <div style={styles.userArea}>
              <Link href="/profile/bookmarks" style={styles.navLink}>🔖</Link>
              <Link href="/profile" style={styles.navLink}>{user.name}</Link>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">Sign In</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky', top: 0, zIndex: 100, height: 'var(--header-height)',
    background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-color)',
  },
  inner: {
    maxWidth: 'var(--max-content-width)', margin: '0 auto', height: '100%',
    display: 'flex', alignItems: 'center', gap: '24px', padding: '0 24px',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 },
  logoIcon: { fontSize: '1.4rem', color: 'var(--accent-primary)' },
  logoText: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' },
  logoAccent: { color: 'var(--accent-tertiary)' },
  searchForm: {
    flex: 1, maxWidth: '480px', position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon: { position: 'absolute', left: '12px', pointerEvents: 'none' },
  searchInput: {
    width: '100%', padding: '8px 16px 8px 40px', fontSize: '0.875rem',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)',
    outline: 'none', fontFamily: 'var(--font-sans)',
  },
  nav: { display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' },
  navLink: { fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { fontSize: '0.85rem', color: 'var(--text-secondary)' },
};
