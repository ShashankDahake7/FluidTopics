'use client';
import { useState } from 'react';
import Link from 'next/link';

const Icon = {
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  searchGo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
      <path d="m12 8 3 3-3 3" />
    </svg>
  ),
};

export default function ProfileShell({ active, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={S.shell}>
      <aside style={{ ...S.sidebar, width: collapsed ? '56px' : '120px' }}>
        <SidebarLink href="/profile" icon={Icon.profile} label="Profile" collapsed={collapsed} active={active === 'profile'} />
        <SidebarLink href="/profile/search-preferences" icon={Icon.search} label="Search preferences" collapsed={collapsed} active={active === 'search-preferences'} />
        <div style={{ flex: 1 }} />
        <SidebarLink href="/search" icon={Icon.searchGo} label="Go to Search page" collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={S.collapseBtn}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span style={{ fontSize: '1.1rem' }}>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span style={{ fontSize: '0.78rem' }}>Collapse sidebar</span>}
        </button>
      </aside>

      <main style={S.main}>{children}</main>
    </div>
  );
}

function SidebarLink({ href, icon, label, collapsed, active }) {
  return (
    <Link
      href={href}
      style={{
        ...S.sideItem,
        background: active ? '#eff6ff' : 'transparent',
        borderRight: active ? '3px solid #1d4ed8' : '3px solid transparent',
      }}
    >
      <span style={{ display: 'inline-flex', color: '#1d4ed8' }}>{icon}</span>
      {!collapsed && (
        <span style={{ fontSize: '0.72rem', color: '#1d4ed8', textAlign: 'center', lineHeight: 1.2 }}>
          {label}
        </span>
      )}
    </Link>
  );
}

const S = {
  shell: {
    display: 'flex',
    minHeight: 'calc(100vh - 60px)',
    background: '#ffffff',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    transition: 'width 200ms',
    flexShrink: 0,
  },
  sideItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px 8px',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    padding: '10px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    marginTop: 'auto',
  },
  main: {
    flex: 1,
    padding: '24px 32px 80px',
    maxWidth: '1200px',
  },
};
