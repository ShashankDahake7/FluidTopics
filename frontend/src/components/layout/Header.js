'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const syncUser = () => {
      try {
        const stored = localStorage.getItem('ft_user');
        setUser(stored ? JSON.parse(stored) : null);
      } catch { setUser(null); }
    };
    syncUser();
    setMounted(true);
    window.addEventListener('popstate', syncUser);
    window.addEventListener('focus', syncUser);
    window.addEventListener('storage', syncUser);
    window.addEventListener('pageshow', syncUser);
    return () => {
      window.removeEventListener('popstate', syncUser);
      window.removeEventListener('focus', syncUser);
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('pageshow', syncUser);
    };
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
    <header style={s.header}>
      <div style={s.inner}>
        <Link href="/" style={s.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="8" height="8" rx="2" fill="var(--accent-primary)" />
            <rect x="13" y="3" width="8" height="8" rx="2" fill="var(--accent-primary)" opacity="0.5" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="var(--accent-primary)" opacity="0.5" />
            <rect x="13" y="13" width="8" height="8" rx="2" fill="var(--accent-primary)" />
          </svg>
          <span style={s.logoText}>Fluid<span style={s.logoAccent}>Topics</span></span>
        </Link>

        <form onSubmit={handleSearch} style={s.searchForm} className="hide-mobile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={s.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation…" style={s.searchInput}
          />
          <kbd style={s.searchKbd}>⌘K</kbd>
        </form>

        <nav style={s.nav}>
          <Link href="/topics" style={s.navLink}>Docs</Link>
          <Link href="/portal" style={s.navLink}>Portal</Link>
          {mounted && user && ['admin', 'editor'].includes(user.role) && (
            <Link href="/admin" style={s.navLink}>Admin</Link>
          )}
          {mounted && user ? (
            <div style={s.userArea}>
              <Link href="/profile/bookmarks" style={s.navLink}>Bookmarks</Link>
              <Link href="/profile" style={s.navAvatar} title={user.name}>
                {user.name?.charAt(0).toUpperCase()}
              </Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">Sign out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link href="/login?register=1" className="btn btn-secondary btn-sm">Sign up</Link>
              <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

const s = {
  header: {
    position: 'sticky', top: 0, zIndex: 100, height: 'var(--header-height)',
    background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border-color)',
  },
  inner: {
    maxWidth: 'var(--max-content-width)', margin: '0 auto', height: '100%',
    display: 'flex', alignItems: 'center', gap: '20px', padding: '0 24px',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flexShrink: 0 },
  logoText: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' },
  logoAccent: { color: 'var(--accent-primary)' },
  searchForm: {
    flex: 1, maxWidth: '440px', position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon: { position: 'absolute', left: '12px', pointerEvents: 'none', flexShrink: 0 },
  searchInput: {
    width: '100%', padding: '8px 80px 8px 38px', fontSize: '0.875rem',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)',
    outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 150ms, box-shadow 150ms',
  },
  searchKbd: {
    position: 'absolute', right: '12px', fontSize: '0.7rem', color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: '4px', padding: '2px 6px', pointerEvents: 'none', fontFamily: 'var(--font-sans)',
  },
  nav: { display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto', flexShrink: 0 },
  navLink: {
    fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    transition: 'color 120ms, background 120ms',
  },
  userArea: { display: 'flex', alignItems: 'center', gap: '4px' },
  navAvatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'var(--accent-primary)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', flexShrink: 0,
  },
};
