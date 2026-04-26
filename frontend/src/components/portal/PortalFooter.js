'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { DARWINBOX_URL } from '@/lib/darwinboxSocial';
import './portal.css';

const Social = ({ label, href, children }) => (
  <a className="portal-footer-social" href={href} aria-label={label} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export default function PortalFooter() {
  const year = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="portal-footer">
      <div className="portal-footer-inner">
        <div className="portal-footer-row">
          <Link href="/dashboard" className="portal-footer-logo" aria-label="Darwinbox">
            <img src="/ft-header-logo-light.png" alt="Darwinbox" />
          </Link>

          <div className="portal-footer-copy">
            {t('copyrightLine', { year })}
          </div>

          <div className="portal-footer-socials">
            <Social label="Facebook" href={DARWINBOX_URL.facebook}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 22v-8.4h2.85l.43-3.3H13.5V8.2c0-.95.27-1.6 1.65-1.6H17V3.65A23.6 23.6 0 0 0 14.45 3.5C12 3.5 10.3 5 10.3 7.78V10.3H7.4v3.3h2.9V22h3.2Z" />
              </svg>
            </Social>
            <Social label="LinkedIn" href={DARWINBOX_URL.linkedin}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21H17.6v-5.55c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92V21H9V9Z" />
              </svg>
            </Social>
            <Social label="Twitter" href={DARWINBOX_URL.twitter}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 5.8c-.7.3-1.5.55-2.3.65a4 4 0 0 0 1.75-2.2 8.1 8.1 0 0 1-2.55.97 4 4 0 0 0-6.93 3.65A11.4 11.4 0 0 1 3.4 4.55a4 4 0 0 0 1.25 5.35c-.65 0-1.27-.2-1.8-.5v.05a4.02 4.02 0 0 0 3.22 3.94c-.6.16-1.23.18-1.8.07a4.02 4.02 0 0 0 3.75 2.8A8.1 8.1 0 0 1 2 17.95 11.4 11.4 0 0 0 8.2 19.8c7.4 0 11.45-6.13 11.45-11.45v-.52A8.1 8.1 0 0 0 22 5.8Z" />
              </svg>
            </Social>
            <Social label="Instagram" href={DARWINBOX_URL.instagram}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            </Social>
          </div>
        </div>
      </div>
    </footer>
  );
}
