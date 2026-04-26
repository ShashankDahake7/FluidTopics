'use client';
import { useTranslation } from '@/lib/i18n';

export default function ComingSoon() {
  const { t } = useTranslation();
  return (
    <div style={s.page}>
      <h1 style={s.title}>{t('comingSoon')}</h1>
      <div style={s.divider} />
      <p style={s.lead}>
        <strong>{t('comingSoonBody')}</strong>
      </p>
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
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#1d4ed8',
    letterSpacing: '-0.01em',
    margin: '0 0 14px',
  },
  divider: {
    height: '1px',
    background: '#e5e7eb',
    margin: '0 0 28px',
  },
  lead: {
    fontSize: '1rem',
    color: '#0f172a',
    lineHeight: 1.7,
    margin: 0,
  },
};
