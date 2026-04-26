'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

// Where readers should be sent for the latest updates. Update once per
// release cycle so the link always points to the most recent notes page.
const LATEST_RELEASE = {
  label: 'Release Notes February 2026',
  href: '/portal/templates/release-notes',
};

export default function WhatsUpcoming() {
  const { t } = useTranslation();
  return (
    <div style={s.page}>
      <h1 style={s.title}>{t('whatsUpcoming')}</h1>
      <div style={s.divider} />
      <p style={s.lead}>
        <strong>{t('whatsUpcomingBody')}</strong>
        <br />
        {t('headOverTo')}{' '}
        <Link href={LATEST_RELEASE.href} style={s.link}>{LATEST_RELEASE.label}</Link>{' '}
        {t('findLatest')}
      </p>
    </div>
  );
}

const s = {
  page: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '40px 32px 48px',
    fontFamily: 'var(--font-sans)',
  },
  title: {
    fontSize: '1.6rem', fontWeight: 700,
    color: '#1d4ed8', letterSpacing: '-0.01em',
    margin: '0 0 14px',
  },
  divider: {
    height: '1px', background: '#e5e7eb',
    margin: '0 0 28px',
  },
  lead: {
    fontSize: '1rem',
    color: '#0f172a',
    lineHeight: 1.7,
    margin: 0,
  },
  link: {
    color: '#1d4ed8',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
