'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredUser, syncCurrentUserFromServer } from '@/lib/api';
import { TicketCostProvider } from '@/components/admin/TicketCostDialog';

const Caret = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <polyline points="6 9, 12 15, 18 9" />
  </svg>
);

// Paper-plane glyph — must match the Knowledge Hub icon used in AdminShell and
// the Administration dropdown in PortalHeader. The previous book glyph was
// shared with the "My Library" header button which caused two unrelated nav
// items to show identical icons.
const ICON_KHUB = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ICON_USERS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ICON_GLOBE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const ICON_SEARCH = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const ICON_FLASK = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 2v6.6a4 4 0 0 1-.6 2.1L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-4.4-8.3a4 4 0 0 1-.6-2.1V2" />
    <path d="M8.5 2h7" />
    <path d="M7 16h10" />
  </svg>
);
const ICON_MENU = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const ICON_FEEDBACK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const ANALYTICS_SECTIONS = [
  {
    key: 'khub',
    title: 'Knowledge Hub',
    icon: ICON_KHUB,
    items: [
      { key: 'content-inventory', label: 'Content inventory',  href: '/admin/analytics/content-inventory' },

      { key: 'document-views',    label: 'Document views',     href: '/admin/analytics/document-views' },
      { key: 'topic-views',       label: 'Topic views',        href: '/admin/analytics/topic-views' },
      { key: 'topic-ratings',     label: 'Topic ratings',      href: '/admin/analytics/topic-ratings' },
    ],
  },
  {
    key: 'users',
    title: 'Users',
    icon: ICON_USERS,
    items: [
      { key: 'user-traffic', label: 'User traffic', href: '/admin/analytics/user-traffic' },
      { key: 'user-assets',  label: 'User assets',  href: '/admin/analytics/user-assets' },
    ],
  },
  {
    key: 'traffic',
    title: 'Traffic',
    icon: ICON_GLOBE,
    items: [
      { key: 'events',              label: 'Events',              href: '/admin/analytics/events' },
      { key: 'sessions',            label: 'Sessions',            href: '/admin/analytics/sessions' },
      { key: 'session-list',        label: 'Session list',        href: '/admin/analytics/session-list' },
      { key: 'sources',             label: 'Sources',             href: '/admin/analytics/sources' },
      { key: 'internal-navigation', label: 'Internal navigation', href: '/admin/analytics/internal-navigation' },
      { key: 'page-views',          label: 'Page views',          href: '/admin/analytics/page-views' },
      { key: 'api-calls',           label: 'API calls',           href: '/admin/analytics/api-calls' },
      { key: 'countries',           label: 'Countries',           href: '/admin/analytics/countries' },
      { key: 'browsers',            label: 'Browsers',            href: '/admin/analytics/browsers' },
      { key: 'device-types',        label: 'Device types',        href: '/admin/analytics/device-types' },
    ],
  },
  {
    key: 'search',
    title: 'Search',
    icon: ICON_SEARCH,
    items: [
      { key: 'facets',              label: 'Facets',                   href: '/admin/analytics/facets' },
      { key: 'search-terms',        label: 'Search terms',             href: '/admin/analytics/search-terms' },
      { key: 'searches-no-results', label: 'Searches with no results', href: '/admin/analytics/searches-no-results' },
    ],
  },
];

export default function AnalyticsShell({
  active = 'home',
  breadcrumb = 'Home',
  breadcrumbTrailing = null,
  feedbackSubject = 'Feedback',
  toolbarExtras = null,
  children,
}) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [openSections, setOpenSections] = useState(() => {
    const init = {};
    ANALYTICS_SECTIONS.forEach((s) => { init[s.key] = true; });
    return init;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      try {
        await syncCurrentUserFromServer();
      } finally {
        if (cancelled) return;
        if (!getStoredToken()) { router.replace('/login'); return; }
        try {
          const u = getStoredUser();
          const tierOk = u && ['superadmin', 'admin', 'editor'].includes(u.role);
          const analyticsOk = u && Array.isArray(u.adminRoles) && u.adminRoles.includes('ANALYTICS_ADMIN');
          if (!u || (!tierOk && !analyticsOk)) { router.replace('/dashboard'); return; }
        } catch { router.replace('/login'); return; }
        setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!authChecked) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <TicketCostProvider>
      <div style={S.shell}>
        {drawerOpen && (
        <aside style={S.sidebar}>
          <Link href="/admin/analytics" style={S.brand}>
            <span style={S.brandIcon} aria-hidden="true">
              {/* Line-stroke bar-chart — must match the Analytics nav button in PortalHeader. */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 16V9M12 16V5M17 16v-7" />
              </svg>
            </span>
            <span style={S.brandText}>Analytics</span>
          </Link>

          <nav style={S.nav}>
            {ANALYTICS_SECTIONS.map((sec) => {
              const isOpen = openSections[sec.key];
              return (
                <div key={sec.key}>
                  <button
                    type="button"
                    style={S.groupBtn}
                    onClick={() => setOpenSections((o) => ({ ...o, [sec.key]: !o[sec.key] }))}
                  >
                    <span style={{ display: 'inline-flex', color: '#475569' }}>{sec.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{sec.title}</span>
                    <Caret open={isOpen} />
                  </button>
                  {isOpen && (
                    <ul style={S.subList}>
                      {sec.items.map((it) => {
                        const isActive = it.key === active;
                        return (
                          <li key={it.key}>
                            <Link
                              href={it.href}
                              style={{
                                ...S.subLink,
                                color: isActive ? '#1d4ed8' : '#1f2937',
                                background: isActive ? '#eff6ff' : 'transparent',
                                fontWeight: isActive ? 600 : 500,
                              }}
                            >
                              <span>{it.label}</span>
                              {it.beta && (
                                <span style={S.betaChip}>
                                  {ICON_FLASK}
                                  <span>Beta</span>
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      )}

      <div style={S.content}>
        <div style={S.toolbar}>
          <button
            type="button"
            style={S.menuBtn}
            onClick={() => setDrawerOpen((v) => !v)}
            title={drawerOpen ? 'Hide left-side menu' : 'Show left-side menu'}
            aria-label={drawerOpen ? 'Hide left-side menu' : 'Show left-side menu'}
          >
            {ICON_MENU}
          </button>
          <span style={S.breadcrumb}>
            {typeof breadcrumb === 'object' && breadcrumb !== null ? (
              <>
                {breadcrumb.prefix && <span style={S.breadcrumbPrefix}>{breadcrumb.prefix}&nbsp;&gt;&nbsp;</span>}
                <span style={S.breadcrumbTitle}>{breadcrumb.title}</span>
              </>
            ) : (
              <span style={S.breadcrumbTitle}>{breadcrumb}</span>
            )}
            {breadcrumbTrailing && (
              <span style={S.breadcrumbTrailing}>{breadcrumbTrailing}</span>
            )}
          </span>
          <span style={{ flex: 1 }} />
          <a
            href={`mailto:feedbacks.analytics@fluidtopics.com?subject=${encodeURIComponent(feedbackSubject)}`}
            style={S.feedbackBtn}
          >
            {ICON_FEEDBACK}
            <span>Feedback</span>
          </a>
          {toolbarExtras}
        </div>
        <div style={S.body}>{children}</div>
      </div>
      </div>
    </TicketCostProvider>
  );
}

const S = {
  shell: {
    display: 'flex',
    minHeight: 'calc(100vh - 60px)',
    background: '#f8fafc',
    fontFamily: 'var(--font-sans)',
  },
  sidebar: {
    width: '270px',
    flexShrink: 0,
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '14px 0 18px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '4px 18px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    textDecoration: 'none',
  },
  brandIcon: {
    display: 'inline-flex',
    color: '#0f172a',
  },
  brandText: { fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' },
  nav: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  groupBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: 'inherit',
  },
  subList: { listStyle: 'none', margin: 0, padding: '2px 8px 6px' },
  subLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '7px 26px',
    fontSize: '0.85rem',
    textDecoration: 'none',
    borderRadius: '6px',
  },
  betaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#0c4a6e',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    borderRadius: '999px',
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 18px',
    height: '56px',
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
  },
  menuBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid transparent',
    borderRadius: '50%',
    background: 'transparent',
    color: '#0f172a',
    cursor: 'pointer',
  },
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'baseline',
    fontSize: '0.95rem',
    color: '#0f172a',
  },
  breadcrumbPrefix: {
    fontSize: '0.92rem',
    fontWeight: 500,
    color: '#475569',
  },
  breadcrumbTitle: {
    fontWeight: 600,
    color: '#0f172a',
  },
  breadcrumbTrailing: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '6px',
  },
  feedbackBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#9D207B',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    borderRadius: '6px',
  },
  body: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
  },
};
