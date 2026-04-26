'use client';
import { useTranslation } from '@/lib/i18n';

// Release-notes archive grouped by year. Newest year first; each entry is
// a link out to the corresponding notes page (placeholder hrefs for now —
// swap with real URLs as those pages get registered).
const ARCHIVE = [
  {
    year: 2026,
    items: [
      { label: 'Release Notes February 2026', href: '#' },
    ],
  },
  {
    year: 2025,
    items: [
      { label: 'Release Notes November 2025', href: '#' },
      { label: 'Release Notes August 2025',   href: '#' },
      { label: 'Release Notes May 2025',      href: '#' },
      { label: 'Release Notes February 2025', href: '#' },
    ],
  },
  {
    year: 2024,
    items: [
      { label: 'Release Notes November 2024', href: '#' },
      { label: 'Release Notes August 2024',   href: '#' },
      { label: 'Release Notes May 2024',      href: '#' },
      { label: 'Release Notes February 2024', href: '#' },
    ],
  },
  {
    year: 2023,
    items: [
      { label: 'Release Notes November 2023', href: '#' },
      { label: 'Release Notes August 2023',   href: '#' },
      { label: 'Release Notes May 2023',      href: '#' },
      { label: 'Release Notes February 2023', href: '#' },
    ],
  },
];

export default function ReleaseNotes() {
  const { t } = useTranslation();
  return (
    <div style={s.page}>
      <h1 style={s.title}>{t('releaseNotesTitle')}</h1>

      <p style={s.lead}>{t('releaseNotesIntro1')}</p>
      <p style={s.lead}>{t('releaseNotesIntro2')}</p>

      {ARCHIVE.map((group) => (
        <section key={group.year} style={s.yearSection}>
          <h2 style={s.year}>{group.year}</h2>
          <ul style={s.list}>
            {group.items.map((item) => (
              <li key={item.label} style={s.listItem}>
                <a href={item.href} style={s.itemLink}>{item.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section style={s.previewSection}>
        <h3 style={s.previewHeading}>{t('previewProgram')}</h3>
        <p style={s.previewText}>
          {t('previewProgramBody')}{' '}
          <a href="#" style={s.linkBold}>{t('previewProgram')}</a>.
        </p>
      </section>
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
    fontSize: '1.6rem', fontWeight: 700,
    color: '#1d4ed8', letterSpacing: '-0.01em',
    margin: '0 0 18px',
  },
  lead: {
    fontSize: '0.95rem',
    color: '#1f2937',
    lineHeight: 1.7,
    margin: '0 0 8px',
  },
  yearSection: { marginTop: '28px' },
  year: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1d4ed8',
    margin: '0 0 12px',
  },
  list: {
    margin: 0,
    padding: '0 0 0 24px',
    fontSize: '0.95rem',
  },
  listItem: { margin: '6px 0', color: '#1d4ed8' },
  itemLink: {
    color: '#1d4ed8',
    fontWeight: 600,
    textDecoration: 'none',
  },
  previewSection: {
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
  previewHeading: {
    fontSize: '1rem', fontWeight: 700,
    color: '#0f172a', margin: '0 0 10px',
  },
  previewText: {
    fontSize: '0.92rem',
    color: '#1f2937',
    lineHeight: 1.7,
    margin: 0,
  },
  linkBold: {
    color: '#1d4ed8',
    fontWeight: 700,
    textDecoration: 'none',
  },
};
