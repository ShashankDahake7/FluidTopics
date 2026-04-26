'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import './portal.css';

const Arrow = () => (
  <svg className="portal-arrow" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
    <polyline
      points="4 6, 8 10, 12 6"
      strokeWidth="2"
      fill="transparent"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRight = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
    <polyline
      points="6 4, 10 8, 6 12"
      strokeWidth="2"
      fill="transparent"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HOME_MENU = [
  { label: 'Release Notes', href: 'http://localhost:3000/portal/templates/release-notes' },
  {
    label: 'Core',
    children: [
      { label: 'Company', href: 'https://help.darwinbox.com/r/Company/Company' },
      { label: 'Employees', href: 'https://help.darwinbox.com/r/Employees/Employees' },
      { label: 'Permissions', href: 'https://help.darwinbox.com/r/Permissions/Permissions' },
      { label: 'Import', href: 'https://help.darwinbox.com/r/Import' },
      { label: 'Custom Field', href: 'https://help.darwinbox.com/r/Custom-Fields/Custom-Field' },
    ],
  },
  { label: 'HR Letters', href: 'https://help.darwinbox.com/r/HR-Documents/Introduction-to-HR-Letters' },
  { label: 'Notification Templates', href: 'https://help.darwinbox.com/r/Notification-Templates/Notification-Templates' },
  {
    label: 'Workflow',
    children: [
      { label: 'Custom Workflow', href: 'https://help.darwinbox.com/r/Workflow-Custom-Workflow/Custom-Workflow' },
      { label: 'FaaS', href: 'https://help.darwinbox.com/r/Workflow-FaaS/Forms-as-a-Service' },
      { label: 'Standard Workflow', href: 'https://help.darwinbox.com/r/Workflow-Standard-Workflow/Introduction-to-Standard-Workflows' },
    ],
  },
  {
    label: 'Time Management',
    children: [
      { label: 'Attendance', href: 'http://localhost:3000/portal/docs/69ec7edc62caf312a8e3f27e' },
      { label: 'Leave', href: 'https://help.darwinbox.com/r/Leave/Leave' },
      { label: 'Timesheets', href: 'https://help.darwinbox.com/r/Time-Sheets/Time-Sheets' },
    ],
  },
  {
    label: 'Talent Management',
    children: [
      { label: 'Performance (PMS)', href: 'https://help.darwinbox.com/r/Performance/Performance' },
      { label: 'Talent Intelligence', href: 'https://help.darwinbox.com/r/Talent-Intelligence/Talent-Intelligence' },
    ],
  },
  {
    label: 'Employee Engagement',
    children: [
      { label: 'Helpdesk', href: 'https://help.darwinbox.com/r/Help-Desk/Helpdesk' },
      { label: 'Pulse', href: 'https://help.darwinbox.com/r/Pulse/Pulse' },
      { label: 'Recognition', href: 'https://help.darwinbox.com/r/Recognition/Recognition' },
      { label: 'Vibe', href: 'https://help.darwinbox.com/r/Vibe/Vibe' },
    ],
  },
  {
    label: 'Travel & Expense',
    children: [{ label: 'Travel', href: 'https://help.darwinbox.com/r/Travel/Travel' }],
  },
  {
    label: 'Reports',
    children: [{ label: 'Reports Builder', href: 'https://help.darwinbox.com/r/Reports-Builder/Reports-Builder' }],
  },
];

function isExternal(href) {
  return /^https?:\/\//i.test(href);
}

function MenuLink({ href, children, ...rest }) {
  if (!href || href === '#') {
    return <a href="#" onClick={(e) => e.preventDefault()} {...rest}>{children}</a>;
  }
  if (isExternal(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
  }
  return <Link href={href} {...rest}>{children}</Link>;
}

function DropdownItem({ item }) {
  if (!item.children) {
    return (
      <li className="portal-dropdown-item">
        <MenuLink href={item.href} className="portal-dropdown-link">
          <span>{item.label}</span>
        </MenuLink>
      </li>
    );
  }
  return (
    <li className="portal-dropdown-item has-children">
      <button type="button" className="portal-dropdown-link">
        <span>{item.label}</span>
        <ChevronRight />
      </button>
      <ul className="portal-dropdown-menu">
        {item.children.map((child) => (
          <DropdownItem key={child.label} item={child} />
        ))}
      </ul>
    </li>
  );
}

export default function PortalHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const sync = () => {
      try {
        const stored = localStorage.getItem('ft_user');
        setUser(stored ? JSON.parse(stored) : null);
      } catch { setUser(null); }
    };
    sync();
    setMounted(true);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_user');
    setUser(null);
    router.push('/portal');
  };

  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        <div className="portal-header-left">
          <Link href="/portal" className="portal-logo" aria-label="Darwinbox Documentation">
            <img src="/ft-header-logo.png" alt="Darwinbox" className="portal-logo-img" />
          </Link>

          <button
            type="button"
            className="portal-nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <nav className="portal-nav" aria-label="Primary">
            <ul className={`portal-nav-list${open ? ' is-open' : ''}`}>
              <li className="portal-nav-item">
                <button type="button" className="portal-nav-link">
                  {t('home')}
                  <Arrow />
                </button>
                <ul className="portal-dropdown-menu">
                  {HOME_MENU.map((item) => (
                    <DropdownItem key={item.label} item={item} />
                  ))}
                </ul>
              </li>
              <li className="portal-nav-item">
                <a className="portal-nav-link is-plain" href="https://community.darwinbox.com" target="_blank" rel="noopener noreferrer">{t('community')}</a>
              </li>
              <li className="portal-nav-item">
                <a className="portal-nav-link is-plain" href="https://darwinbox.com/support" target="_blank" rel="noopener noreferrer">{t('support')}</a>
              </li>
              <li className="portal-nav-item">
                <a className="portal-nav-link is-plain" href="https://academy.darwinbox.com" target="_blank" rel="noopener noreferrer">{t('academy')}</a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="portal-header-right">
          {/* Administration — admins/editors only */}
          {mounted && user && ['admin', 'editor'].includes(user.role) && (
            <div className="portal-header-menu">
              <Link href="/admin" className="portal-header-btn" title="Administration">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
                <span>{t('administration')}</span>
              </Link>
              <ul className="portal-dropdown-menu align-right">
                <li className="portal-dropdown-item">
                  <Link href="/admin/legal-terms" className="portal-dropdown-link">
                    <span className="portal-menu-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <span>{t('manageUsers')}</span>
                  </Link>
                </li>
                <li className="portal-dropdown-item">
                  <Link href="/admin/content" className="portal-dropdown-link">
                    <span className="portal-menu-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="2" y="4" width="20" height="14" rx="2" />
                        <line x1="2" y1="9" x2="22" y2="9" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                      </svg>
                    </span>
                    <span>Portal</span>
                  </Link>
                </li>
                <li className="portal-dropdown-item">
                  <Link href="/admin/notifications/email" className="portal-dropdown-link">
                    <span className="portal-menu-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </span>
                    <span>{t('notifications')}</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* My Library */}
          <div className="portal-header-menu">
            <Link href="/mylibrary/bookmarks" className="portal-header-btn" title="My Library">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
              </svg>
              <span>{t('myLibraryNav')}</span>
            </Link>
            <ul className="portal-dropdown-menu align-right">
              <li className="portal-dropdown-item">
                <Link href="/mylibrary/bookmarks" className="portal-dropdown-link">
                  <span className="portal-menu-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
                    </svg>
                  </span>
                  <span>{t('bookmarks')}</span>
                </Link>
              </li>
              <li className="portal-dropdown-item">
                <Link href="/mylibrary/searches" className="portal-dropdown-link">
                  <span className="portal-menu-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </span>
                  <span>{t('searches')}</span>
                </Link>
              </li>
              <li className="portal-dropdown-item">
                <Link href="/mylibrary/collections" className="portal-dropdown-link">
                  <span className="portal-menu-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="6" width="18" height="14" rx="2" />
                      <path d="M3 10h18" />
                      <path d="M8 6V4h8v2" />
                    </svg>
                  </span>
                  <span>{t('collections')}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* My Account */}
          <div className="portal-header-menu">
            {mounted && user ? (
              <>
                <button type="button" className="portal-header-btn" title={user.name || 'My Account'}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <span>{t('myAccount')}</span>
                </button>
                <div className="portal-dropdown-menu align-right portal-account-menu">
                  <div className="portal-account-name">{user.name || 'Account'}</div>
                  <ul className="portal-account-list">
                    <li className="portal-dropdown-item">
                      <Link href="/profile" className="portal-dropdown-link">
                        <span className="portal-menu-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21a8 8 0 0 1 16 0" />
                          </svg>
                        </span>
                        <span>{t('profile')}</span>
                      </Link>
                    </li>
                    <li className="portal-dropdown-item">
                      <Link href="/profile#preferences" className="portal-dropdown-link">
                        <span className="portal-menu-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                          </svg>
                        </span>
                        <span>{t('searchPreferences')}</span>
                      </Link>
                    </li>
                  </ul>
                  <div className="portal-account-divider" />
                  <ul className="portal-account-list">
                    <li className="portal-dropdown-item">
                      <button type="button" onClick={handleLogout} className="portal-dropdown-link">
                        <span className="portal-menu-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 12a6 6 0 1 1-3-5.2" />
                            <line x1="12" y1="2" x2="12" y2="11" />
                          </svg>
                        </span>
                        <span>{t('logOut')}</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <Link href="/login" className="portal-header-btn" title="My Account">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
                <span>My Account</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
