'use client';
import { useTranslation } from '@/lib/i18n';

export default function FAQs() {
  const { t } = useTranslation();
  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>{t('faqsTitle')}</h1>

      <h2 style={s.sectionTitle}>Help Portal Access - Darwinbox Product Documentation</h2>
      <p style={s.para}>
        The <strong>Darwinbox Help Portal</strong> provides detailed product
        documentation and is accessible to the following user groups:
      </p>
      <ul style={s.list}>
        <li><strong>Darwinbox Clients</strong></li>
        <li><strong>Darwinbox Partners</strong></li>
        <li><strong>Darwinbox Employees</strong></li>
      </ul>

      <h2 style={s.heading}>{t('faqsHeading')}</h2>

      {/* Q1 */}
      <h3 style={s.qHeading}>1. Who can access the Help Portal?</h3>

      <p style={s.subHeading}><strong>Darwinbox Clients:</strong></p>
      <ul style={s.list}>
        <li>All <strong>Production</strong> and <strong>Staging</strong> instances have access.</li>
        <li>
          Access is automatically provided to:
          <ul style={s.subList}>
            <li>Administrators</li>
            <li>Permission Role Holders</li>
          </ul>
        </li>
        <li>For other users, access must be granted by the client administrator using Permission settings.</li>
      </ul>

      <p style={s.subHeading}><strong>Darwinbox Partners:</strong></p>
      <ul style={s.list}>
        <li>
          Access is available by default to:
          <ul style={s.subList}>
            <li>Administrators</li>
            <li>Permission Role Holders</li>
          </ul>
        </li>
        <li>
          Other partner users must request access from their respective administrator.
          Admins can grant the access using Permission settings.
        </li>
      </ul>

      <p style={s.subHeading}><strong>Darwinbox Employees:</strong></p>
      <ul style={s.list}>
        <li>All employees have default access.</li>
        <li>
          You can access it via:
          <ul style={s.subList}>
            <li>The <strong>Help Portal</strong> icon under <strong>My Access</strong>, or</li>
            <li>
              By visiting{' '}
              <a href="https://help.darwinbox.com" target="_blank" rel="noopener noreferrer" style={s.link}>
                https://help.darwinbox.com
              </a>{' '}
              and clicking <strong>Darwinbox Employees</strong>.
            </li>
          </ul>
        </li>
      </ul>

      <p style={s.para}>
        <strong>Note:</strong> You must be logged into your <strong>Darwinbox instance</strong>.
        If you&apos;re logged into a <strong>client instance</strong>, access issues may occur.
      </p>

      {/* Q2 */}
      <h3 style={s.qHeading}>
        2. I have access to Darwinbox Academy. Do I automatically get Help Portal access?
      </h3>
      <p style={s.para}>
        Yes. If you can log into the <strong>Academy</strong>, you can also access the{' '}
        <strong>Help Portal</strong> with the same credentials.
      </p>
      <p style={s.subHeading}>To access:</p>
      <ol style={s.olist}>
        <li>Login to your Darwinbox Academy instance.</li>
        <li>Switch to <strong>Admin Mode</strong>.</li>
        <li>Go to <strong>Admin Access</strong>.</li>
        <li>Click the <strong>Help Portal</strong> icon.</li>
      </ol>

      {/* Q3 */}
      <h3 style={s.qHeading}>
        3. I&apos;m an Admin/Permission Holder/Employee but can&apos;t access the Help Portal. What should I do?
      </h3>
      <p style={s.subHeading}>Try the following steps:</p>
      <ol style={s.olist}>
        <li><strong>Log out</strong> of your Darwinbox instance or Microsoft account.</li>
        <li><strong>Log in again</strong> to ensure your session is refreshed.</li>
        <li>Check if your <strong>password has expired</strong> (Darwinbox or Microsoft). If so, update it.</li>
      </ol>

      <p style={s.para}>Most access issues are due to expired sessions or outdated login credentials.</p>
    </div>
  );
}

const s = {
  page: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '36px 32px 64px',
    fontFamily: 'var(--font-sans)',
    color: '#0f172a',
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#1d4ed8',
    margin: '0 0 24px',
    letterSpacing: '-0.01em',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '8px 0 12px',
  },
  heading: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '28px 0 14px',
  },
  qHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '24px 0 10px',
  },
  subHeading: {
    fontSize: '0.95rem',
    color: '#0f172a',
    margin: '14px 0 6px',
  },
  para: {
    fontSize: '0.95rem',
    color: '#1f2937',
    lineHeight: 1.7,
    margin: '8px 0',
  },
  list: {
    margin: '6px 0 12px',
    padding: '0 0 0 22px',
    fontSize: '0.95rem',
    color: '#1f2937',
    lineHeight: 1.7,
  },
  subList: {
    margin: '4px 0 4px',
    padding: '0 0 0 22px',
    listStyleType: 'circle',
  },
  olist: {
    margin: '6px 0 12px',
    padding: '0 0 0 22px',
    fontSize: '0.95rem',
    color: '#1f2937',
    lineHeight: 1.7,
  },
  link: {
    color: '#1d4ed8',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
