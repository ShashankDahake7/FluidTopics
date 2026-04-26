'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredUser } from '@/lib/api';

const Caret = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <polyline points="6 9, 12 15, 18 9" />
  </svg>
);

const SECTIONS = [
  {
    key: 'khub',
    title: 'Knowledge Hub',
    allowedRoles: ['superadmin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
    items: [
      { key: 'khub-publishing', label: 'Publishing',             href: '/admin/khub/publishing',   allowedRoles: ['superadmin'] },
      { key: 'khub-sources',    label: 'Sources',                href: '/admin/khub/sources',      allowedRoles: ['superadmin'] },
      { key: 'khub-enrich',     label: 'Enrich and Clean',       href: '/admin/khub/enrich',       allowedRoles: ['superadmin'] },
      { key: 'khub-vocab',      label: 'Vocabularies',           href: '/admin/khub/vocabularies', allowedRoles: ['superadmin'] },
      { key: 'khub-metadata',   label: 'Metadata configuration', href: '/admin/khub/metadata',     allowedRoles: ['superadmin'] },
      { key: 'khub-pretty-url', label: 'Pretty URL',             href: '/admin/khub/pretty-url',   allowedRoles: ['superadmin'] },
      { key: 'khub-access',     label: 'Access rules',           href: '/admin/khub/access-rules', allowedRoles: ['superadmin'] },
    ],
  },
  {
    key: 'manage-users',
    title: 'Manage users',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    items: [
      { key: 'manage-users-list', label: 'Manage users',    href: '/admin/users',           allowedRoles: ['superadmin'] },
      { key: 'legal-terms',       label: 'Legal terms',     href: '/admin/legal-terms' },
      { key: 'authentication',    label: 'Authentication',  href: '/admin/authentication' },
    ],
  },
  {
    key: 'notifications',
    title: 'Notifications',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    items: [
      { key: 'notif-email',    label: 'Email',    href: '/admin/notifications/email' },
      { key: 'notif-feedback', label: 'Feedback', href: '/admin/notifications/feedback' },
      { key: 'notif-rating',   label: 'Rating',   href: '/admin/notifications/rating' },
      { key: 'notif-alerts',   label: 'Alerts',   href: '/admin/notifications/alerts' },
    ],
  },
  {
    key: 'integrations',
    title: 'Integration',
    allowedRoles: ['superadmin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    items: [
      { key: 'integ-search-engine', label: 'Web search engines', href: '/admin/integrations/search-engine', allowedRoles: ['superadmin'] },
      { key: 'integ-opensearch',    label: 'OpenSearch',         href: '/admin/integrations/opensearch',    allowedRoles: ['superadmin'] },
      { key: 'integ-security',      label: 'Security',           href: '/admin/integrations/security',      allowedRoles: ['superadmin'] },
      { key: 'integ-api-keys',      label: 'API keys',           href: '/admin/integrations/api-keys',      allowedRoles: ['superadmin'] },
    ],
  },
  {
    key: 'my-tenant',
    title: 'My tenant',
    href: '/admin/import-configuration',
    allowedRoles: ['superadmin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    items: [
      { key: 'tenant-import',  label: 'Import configuration',  href: '/admin/import-configuration',  allowedRoles: ['superadmin'] },
      { key: 'tenant-history', label: 'Configuration history', href: '/admin/configuration-history', allowedRoles: ['superadmin'] },
    ],
  },
];

export default function AdminShell({
  active,
  children,
  footer,
  allowedRoles = ['superadmin', 'admin', 'editor'],
}) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [openSections, setOpenSections] = useState(() => {
    const init = {};
    SECTIONS.forEach((s) => {
      init[s.key] = s.items.some((it) => it.key === active);
    });
    return init;
  });

  useEffect(() => {
    // Auth state lives in either sessionStorage (no "Remember me") or
    // localStorage (Remember me on); use the helpers so we honour both.
    if (!getStoredToken()) {
      router.replace('/login');
      return;
    }
    try {
      const u = getStoredUser();
      if (!u || !['superadmin', 'admin', 'editor'].includes(u.role)) {
        router.replace('/dashboard');
        return;
      }
      // Per-page restriction (e.g. superadmin-only screens). The /admin landing
      // dashboard no longer exists, so admins/editors who hit a screen they are
      // not entitled to are bounced to the user-facing dashboard.
      if (allowedRoles && !allowedRoles.includes(u.role)) {
        router.replace('/dashboard');
        return;
      }
      setUserRole(u.role);
    } catch { router.replace('/login'); return; }
    setAuthChecked(true);
  }, []);

  const visibleSections = SECTIONS
    .filter((sec) => !sec.allowedRoles || sec.allowedRoles.includes(userRole))
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => !it.allowedRoles || it.allowedRoles.includes(userRole)),
    }))
    .filter((sec) => sec.items.length > 0);

  if (!authChecked) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.header}>
          <span style={{ display: 'inline-flex', color: '#0f172a' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </span>
          <span style={S.headerText}>Administration</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {visibleSections.map((sec) => {
            const isOpen = openSections[sec.key];
            const toggle = () => setOpenSections((o) => ({ ...o, [sec.key]: !o[sec.key] }));
            return (
              <div key={sec.key}>
                {sec.href ? (
                  <div style={S.groupRow}>
                    <Link href={sec.href} style={S.groupLink} onClick={() => setOpenSections((o) => ({ ...o, [sec.key]: true }))}>
                      <span style={{ display: 'inline-flex', color: '#475569' }}>{sec.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{sec.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={toggle}
                      style={S.groupCaretBtn}
                      aria-label={isOpen ? `Collapse ${sec.title}` : `Expand ${sec.title}`}
                    >
                      <Caret open={isOpen} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={toggle}
                    style={S.groupBtn}
                  >
                    <span style={{ display: 'inline-flex', color: '#475569' }}>{sec.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{sec.title}</span>
                    <Caret open={isOpen} />
                  </button>
                )}
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
                              color: isActive ? '#1d4ed8' : '#374151',
                              background: isActive ? '#eff6ff' : 'transparent',
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            {it.label}
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

        <a href="https://docs.darwinbox.com" target="_blank" rel="noopener noreferrer" style={S.docs}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Go to documentation</span>
        </a>
      </aside>

      <div style={S.content}>
        <div style={S.contentInner}>{children}</div>
        {footer && <div style={S.footer}>{footer}</div>}
      </div>
    </div>
  );
}

const S = {
  shell: {
    display: 'flex',
    minHeight: 'calc(100vh - 60px)',
    background: '#ffffff',
    fontFamily: 'var(--font-sans)',
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px 18px',
    borderBottom: '1px solid #f1f5f9',
  },
  headerText: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' },
  groupBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  groupRow: {
    display: 'flex',
    alignItems: 'center',
  },
  groupLink: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 6px 10px 18px',
    color: '#0f172a',
    textDecoration: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  groupCaretBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    marginRight: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#0f172a',
  },
  subList: {
    listStyle: 'none',
    margin: 0,
    padding: '2px 0 8px',
  },
  subLink: {
    display: 'block',
    padding: '7px 18px 7px 46px',
    fontSize: '0.88rem',
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
  },
  docs: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 18px',
    color: '#1d4ed8',
    fontSize: '0.88rem',
    textDecoration: 'none',
    borderTop: '1px solid #e5e7eb',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
  },
  contentInner: {
    flex: 1,
    padding: '24px 36px 24px',
    maxWidth: '1280px',
    width: '100%',
  },
  footer: {
    borderTop: '1px solid #e5e7eb',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    background: '#ffffff',
  },
};
