'use client';
import Link from 'next/link';

const IconBookmark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
);
const IconSearches = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><circle cx="17.5" cy="17.5" r="3" /><line x1="20" y1="20" x2="22" y2="22" /></svg>
);
const IconCollections = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>
);
const IconSearchPage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><path d="M8 11h6M11 8v6" /></svg>
);

function SideTab({ href, icon: Icon, label, active, collapsed, styles: s }) {
  return (
    <Link href={href} style={{
      ...s.sideTab,
      background: active ? '#eff6ff' : 'transparent',
      color: '#1d4ed8',
      textDecoration: 'none',
    }}>
      <Icon />
      {!collapsed && <span style={s.sideLabel}>{label}</span>}
    </Link>
  );
}

export default function MyLibrarySidebar({
  collapsed,
  onToggleCollapse,
  activeTab,
  labels,
  styles: s,
}) {
  return (
    <aside style={{ ...s.sidebar, width: collapsed ? '56px' : '108px' }}>
      <SideTab href="/mylibrary/bookmarks" icon={IconBookmark} label={labels.bookmarks} active={activeTab === 'bookmarks'} collapsed={collapsed} styles={s} />
      <SideTab href="/mylibrary/searches" icon={IconSearches} label={labels.searches} active={activeTab === 'searches'} collapsed={collapsed} styles={s} />
      <SideTab href="/mylibrary/collections" icon={IconCollections} label={labels.collections} active={activeTab === 'collections'} collapsed={collapsed} styles={s} />
      <div style={{ flex: 1 }} />
      <Link href="/search" style={{ ...s.sideTab, color: '#1d4ed8', textDecoration: 'none' }}>
        <IconSearchPage />
        {!collapsed && <span style={s.sideLabel}>{labels.goToSearchPage}</span>}
      </Link>
      <button type="button" onClick={onToggleCollapse} style={s.collapseBtn} aria-label={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '»' : '«'}
      </button>
    </aside>
  );
}
