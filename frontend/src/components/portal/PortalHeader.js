'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation, LANGUAGES, uiLanguageToIso } from '@/lib/i18n';
import api, { getStoredUser, getStoredToken, syncCurrentUserFromServer } from '@/lib/api';
import './portal.css';

const ADMIN_TIER_ROLES = ['superadmin', 'admin', 'editor'];
const ADMINISTRATIVE_ROLE_IDS = [
  'USERS_ADMIN', 'CONTENT_ADMIN', 'CONTENT_PUBLISHER', 'ANALYTICS_ADMIN',
  'KHUB_ADMIN', 'PORTAL_ADMIN', 'ENRICHMENT_ADMIN', 'METADATA_ADMIN',
];

function canAccessAdminSurface(user) {
  if (!user) return false;
  if (ADMIN_TIER_ROLES.includes(user.role)) return true;
  const ar = user.adminRoles || [];
  return ar.some((r) => ADMINISTRATIVE_ROLE_IDS.includes(r));
}

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
  { label: 'Release Notes', href: 'http://localhost:3000/dashboard/templates/release-notes' },
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
      { label: 'Attendance', href: 'http://localhost:3000/dashboard/docs/69ec7edc62caf312a8e3f27e' },
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

/** Viewer + administrative roles: show entry points matching AdminShell. */
function AdministrativeRoleOnlyMenu({ t, user }) {
  const ar = new Set(user?.adminRoles || []);
  const Row = ({ href, label, children }) => (
    <li className="portal-dropdown-item">
      <Link href={href} className="portal-dropdown-link">
        <span className="portal-menu-icon">{children}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
  const khub = ['KHUB_ADMIN', 'CONTENT_ADMIN', 'CONTENT_PUBLISHER', 'METADATA_ADMIN', 'ENRICHMENT_ADMIN'].some((r) => ar.has(r));
  return (
    <>
      {ar.has('USERS_ADMIN') && (
        <Row href="/admin/users" label={t('manageUsers')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </Row>
      )}
      {khub && (
        <Row href="/admin/khub/publishing" label={t('knowledgeHub')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </Row>
      )}
      {ar.has('PORTAL_ADMIN') && (
        <Row href="/admin/notifications/email" label={t('notifications')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </Row>
      )}
      {ar.has('ANALYTICS_ADMIN') && (
        <Row href="/admin/analytics" label={t('analyticsNav')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="M7 16V9M12 16V5M17 16v-7" />
          </svg>
        </Row>
      )}
    </>
  );
}

/** Full Fluid Topics–style Administration menu (superadmin only). */
function SuperAdministrationMenu({ t, onOpenAbout }) {
  const Row = ({ href, label, children }) => (
    <li className="portal-dropdown-item">
      <Link href={href} className="portal-dropdown-link">
        <span className="portal-menu-icon">{children}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
  const ButtonRow = ({ onClick, label, children }) => (
    <li className="portal-dropdown-item">
      <button type="button" className="portal-dropdown-link" onClick={onClick}>
        <span className="portal-menu-icon">{children}</span>
        <span>{label}</span>
      </button>
    </li>
  );
  return (
    <>
      <Row href="/admin/khub/publishing" label={t('knowledgeHub')}>
        {/* Paper-plane glyph — must match the Knowledge Hub icon used in AdminShell. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </Row>
      <Row href="/admin/users" label={t('manageUsers')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </Row>
      <Row href="/admin/notifications/email" label={t('notifications')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </Row>
      <Row href="/admin/integrations" label={t('integrations')}>
        {/* Chain-link glyph — must match the Integration icon used in AdminShell. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </Row>
      <Row href="/admin/import-configuration" label={t('myTenant')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </Row>
      <li className="portal-dropdown-item" style={{ listStyle: 'none', padding: '4px 12px', pointerEvents: 'none' }} aria-hidden="true">
        <div style={{ height: 1, background: '#e2e8f0' }} />
      </li>
      <ButtonRow onClick={onOpenAbout} label={t('aboutThisTenant')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </ButtonRow>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* About this tenant modal — server + metadata details + current read */
/* ------------------------------------------------------------------ */

const ABOUT_SERVER_VERSION = '5.3.1 3ed4ccf9e7a67b331be8599871de861a79f8086e';

const ABOUT_METADATA = [
  // [key, [facets:home, facets:search, facets:behavior], [tags:search, tags:reader, tags:sort, tags:reverse]]
  ['Created_by',                       ['', '', ''],   ['✓', '', '', '']],
  ['Key',                              ['', '', ''],   ['', '', '', '']],
  ['Module',                           ['', '', ''],   ['', '', '', '']],
  ['Name',                             ['', '', ''],   ['', '', '', '']],
  ['Release_Notes',                    ['', '', ''],   ['', '', '', '']],
  ['Taxonomy',                         ['', '✓', ''],  ['', '', '', '']],
  ['author_personname',                ['', '', ''],   ['', '✓', '', '']],
  ['authorgroup_author_personname',    ['', '', ''],   ['', '', '', '']],
  ['copyright',                        ['', '', ''],   ['', '', '', '']],
  ['creationDate',                     ['✓', '', 'OR'],['', '', '', '']],
  ['data_origin_id',                   ['', '', ''],   ['', '', '', '']],
  ['ft:alertTimestamp',                ['', '', ''],   ['', '', '', '']],
  ['ft:attachmentsSize',               ['', '', ''],   ['', '', '', '']],
  ['ft:baseId',                        ['', '', ''],   ['', '', '', '']],
  ['ft:clusterId',                     ['', '', ''],   ['', '', '', '']],
  ['ft:container',                     ['', '', ''],   ['', '', '', '']],
  ['ft:contentSize',                   ['', '', ''],   ['', '', '', '']],
  ['ft:document_type',                 ['', '', ''],   ['', '', '', '']],
  ['ft:editorialType',                 ['', '', ''],   ['', '', '', '']],
  ['ft:filename',                      ['', '', ''],   ['', '', '', '']],
  ['ft:isArticle',                     ['', '', ''],   ['', '', '', '']],
  ['ft:isAttachment',                  ['', '', ''],   ['', '', '', '']],
  ['ft:isBook',                        ['', '', ''],   ['', '', '', '']],
  ['ft:isHtmlPackage',                 ['', '', ''],   ['', '', '', '']],
  ['ft:isPublication',                 ['', '', ''],   ['', '', '', '']],
  ['ft:isSynchronousAttachment',       ['', '', ''],   ['', '', '', '']],
  ['ft:isUnstructured',                ['', '', ''],   ['', '', '', '']],
  ['ft:khubVersion',                   ['', '', ''],   ['', '', '', '']],
  ['ft:lastEdition',                   ['', '', ''],   ['', '', '', '']],
  ['ft:lastPublication',               ['', '', ''],   ['', '✓', '', '']],
  ['ft:lastTechChange',                ['', '', ''],   ['', '', '', '']],
  ['ft:lastTechChangeTimestamp',       ['', '', ''],   ['', '', '', '']],
  ['ft:locale',                        ['', '', ''],   ['', '', '', '']],
  ['ft:mimeType',                      ['', '', ''],   ['', '', '', '']],
  ['ft:openMode',                      ['', '', ''],   ['', '', '', '']],
  ['ft:originId',                      ['', '', ''],   ['', '', '', '']],
  ['ft:prettyUrl',                     ['', '', ''],   ['', '', '', '']],
  ['ft:publicationId',                 ['', '', ''],   ['', '', '', '']],
  ['ft:publication_title',             ['', '', ''],   ['', '✓', '', '']],
  ['ft:publishStatus',                 ['', '', ''],   ['', '', '', '']],
  ['ft:publishUploadId',               ['', '', ''],   ['', '', '', '']],
  ['ft:searchableFromInt',             ['', '', ''],   ['', '', '', '']],
  ['ft:sourceCategory',                ['', '', ''],   ['', '', '', '']],
  ['ft:sourceId',                      ['', '', ''],   ['', '', '', '']],
  ['ft:sourceName',                    ['', '', ''],   ['', '', '', '']],
  ['ft:sourceType',                    ['', '', ''],   ['', '', '', '']],
  ['ft:structure',                     ['', '', ''],   ['', '', '', '']],
  ['ft:title',                         ['', '✓', ''], ['', '', '', '']],
  ['ft:tocPosition',                   ['', '', ''],   ['', '', '', '']],
  ['ft:topicTitle',                    ['', '', ''],   ['', '', '', '']],
  ['ft:wordCount',                     ['', '', ''],   ['', '', '', '']],
  ['generator',                        ['', '', ''],   ['', '', '', '']],
  ['paligo:resourceTitle',             ['', '', ''],   ['', '', '', '']],
  ['paligo:resourceTitleLabel',        ['', '', ''],   ['', '', '', '']],
  ['publicationDate',                  ['', '', ''],   ['✓', '✓', '', '']],
  ['subtitle',                         ['', '', ''],   ['', '', '', '']],
  ['ud:id',                            ['', '', ''],   ['', '', '', '']],
  ['xinfo:branched_topic_id',          ['', '', ''],   ['', '', '', '']],
  ['xinfo:branched_topic_uuid',        ['', '', ''],   ['', '', '', '']],
  ['xinfo:contribution_editable',      ['', '', ''],   ['', '', '', '']],
  ['xinfo:document_id',                ['', '', ''],   ['', '', '', '']],
  ['xinfo:linktype',                   ['', '', ''],   ['', '', '', '']],
  ['xinfo:origin',                     ['', '', ''],   ['', '', '', '']],
  ['xinfo:origin_id',                  ['', '', ''],   ['', '', '', '']],
  ['xinfo:pagebreak',                  ['', '', ''],   ['', '', '', '']],
  ['xinfo:taxonomy',                   ['', '', ''],   ['', '', '', '']],
  ['xinfo:version_major',              ['', '', ''],   ['', '', '', '']],
  ['xinfo:version_minor',              ['', '', ''],   ['', '', '', '']],
];

function AboutThisTenantModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ft-about-backdrop" onClick={onClose} role="presentation">
      <div
        className="ft-about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ft-about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ft-about-head">
          <h2 id="ft-about-title" className="ft-about-title">About this tenant - beta version</h2>
          <button type="button" className="ft-about-close" aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="ft-about-body" tabIndex={0}>
          <div className="ft-about-field">
            <label className="ft-about-label"><span>Server</span></label>
            <div className="ft-about-value">{ABOUT_SERVER_VERSION}</div>
          </div>

          <div className="ft-about-field">
            <label className="ft-about-label"><span>Metadata Details</span></label>
            <div className="ft-about-value">
              <div className="ft-about-table-wrap">
                <table className="ft-about-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} />
                      <th colSpan={3}>Used as Facets</th>
                      <th colSpan={4}>Used as Tags</th>
                    </tr>
                    <tr>
                      <th>homepage</th>
                      <th>searchpage</th>
                      <th>behavior</th>
                      <th>searchpage</th>
                      <th>readerpage</th>
                      <th>sort</th>
                      <th>reverse order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ABOUT_METADATA.map(([name, facets, tags]) => (
                      <tr key={name}>
                        <td className="ft-about-key">{name}</td>
                        {facets.map((v, i) => (
                          <td key={`f${i}`} className={v ? 'ft-about-mark' : ''}>{v || '\u00a0'}</td>
                        ))}
                        {tags.map((v, i) => (
                          <td key={`t${i}`} className={v ? 'ft-about-mark' : ''}>{v || '\u00a0'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ft-about-note"><strong>Configured but unavailable in current publications:</strong> title</div>
            </div>
          </div>

          <div className="ft-about-field">
            <label className="ft-about-label"><span>Your current reading</span></label>
            <div className="ft-about-value ft-about-muted">(none)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() || '';
  // Hide the "Sign In" CTA on auth-flow pages where it would just point at the
  // current page (login / register / forgot password / reset password).
  const onAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');
  const { t, lang, setLang: persistUiLanguage } = useTranslation();

  const applyUiLanguage = (code) => {
    persistUiLanguage(code);
    if (getStoredToken()) {
      api.patch('/user/preferences', { language: uiLanguageToIso(code) }).catch(() => {});
    }
  };

  useEffect(() => {
    const sync = () => {
      setUser(getStoredUser());
    };
    let cancelled = false;
    (async () => {
      try {
        await syncCurrentUserFromServer();
      } finally {
        if (!cancelled) {
          sync();
          setMounted(true);
        }
      }
    })();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('ft-auth', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('ft-auth', sync);
    };
  }, []);

  const handleLogout = async () => {
    await api.signOut();
    setUser(null);
    router.push('/login');
  };

  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        <div className="portal-header-left">
          <Link href="/dashboard" className="portal-logo" aria-label="Darwinbox Documentation">
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
          {/* Administration — tier admins + holders of administrative roles. */}
          {mounted && user && canAccessAdminSurface(user) && (
            <div className="portal-header-menu">
              {/* Pure dropdown trigger — there is no /admin landing page; users
                  pick a destination from the menu below. */}
              <button
                type="button"
                className="portal-header-btn"
                title="Administration"
                aria-haspopup="menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
                <span>{t('administration')}</span>
              </button>
              <ul className="portal-dropdown-menu align-right">
                {user.role === 'superadmin' ? (
                  <SuperAdministrationMenu t={t} onOpenAbout={() => setAboutOpen(true)} />
                ) : ADMIN_TIER_ROLES.includes(user.role) ? (
                  <>
                    <li className="portal-dropdown-item">
                      <Link href="/admin/khub/publishing" className="portal-dropdown-link">
                        <span className="portal-menu-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </span>
                        <span>{t('knowledgeHub')}</span>
                      </Link>
                    </li>
                    {(user.adminRoles || []).includes('USERS_ADMIN') && (
                    <li className="portal-dropdown-item">
                      <Link href="/admin/users" className="portal-dropdown-link">
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
                    )}
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
                  </>
                ) : (
                  <AdministrativeRoleOnlyMenu t={t} user={user} />
                )}
              </ul>
            </div>
          )}

          {/* Analytics — admin/editor tier or ANALYTICS_ADMIN (Fluid Topics header). */}
          {mounted && user && (['superadmin', 'admin', 'editor'].includes(user.role) || (user.adminRoles || []).includes('ANALYTICS_ADMIN')) && (
            <div className="portal-header-menu">
              <Link href="/admin/analytics" className="portal-header-btn" title={t('analyticsNav')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 16V9M12 16V5M17 16v-7" />
                </svg>
                <span>{t('analyticsNav')}</span>
              </Link>
            </div>
          )}

          {/* Sign In — logged-out only, suppressed on the login/auth pages themselves. */}
          {mounted && !user && !onAuthPage && (
            <Link href="/login" className="portal-header-btn" title={t('signInNav')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4v4" />
                <path d="M10 14 21 3" />
                <path d="M21 3v7h-7" />
                <path d="M3 21h12a2 2 0 0 0 2-2v-1" />
                <path d="M3 7v12a2 2 0 0 0 2 2h1" />
              </svg>
              <span>{t('signInNav')}</span>
            </Link>
          )}

          {/* My Library + My Account — signed-in users only (logged-out header shows language only). */}
          {mounted && user && (
            <>
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

              <div className="portal-header-menu">
                <button type="button" className="portal-header-btn" title={user.name || t('myAccount')}>
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
              </div>
            </>
          )}

          {/* Language — shown only for logged-out visitors (matches the public
              Darwinbox header). Once a user signs in, language is managed from
              their profile preferences instead. */}
          {mounted && !user && (
            <div className="portal-header-menu portal-header-lang">
              <button type="button" className="portal-header-btn" title={t('language')} aria-haspopup="listbox" aria-label={t('language')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                </svg>
                <span>{lang}</span>
              </button>
              <ul className="portal-dropdown-menu align-right" role="listbox">
                {LANGUAGES.map((code) => (
                  <li key={code} className="portal-dropdown-item">
                    <button
                      type="button"
                      className={`portal-dropdown-link portal-lang-option${code === lang ? ' is-current' : ''}`}
                      role="option"
                      aria-selected={code === lang}
                      onClick={() => applyUiLanguage(code)}
                    >
                      <span>{code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <AboutThisTenantModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </header>
  );
}
