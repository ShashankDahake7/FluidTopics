'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import AnalyticsShell, { ANALYTICS_SECTIONS } from '@/components/admin/AnalyticsShell';

const ALL_ITEMS = ANALYTICS_SECTIONS.flatMap((s) => s.items);

export default function AnalyticsSectionPage() {
  const params = useParams();
  const slug = String(params.section || '');

  const item = useMemo(() => ALL_ITEMS.find((it) => it.key === slug), [slug]);
  const label = item?.label || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AnalyticsShell active={item?.key || slug} breadcrumb={label}>
      <div style={S.empty}>
        <div style={S.emptyCard}>
          <div style={S.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <rect x="7" y="12" width="3" height="6" rx="1" fill="#cbd5e1" stroke="none" />
              <rect x="12" y="8" width="3" height="10" rx="1" fill="#cbd5e1" stroke="none" />
              <rect x="17" y="4" width="3" height="14" rx="1" fill="#cbd5e1" stroke="none" />
            </svg>
          </div>
          <h2 style={S.emptyTitle}>{label}</h2>
          <p style={S.emptyText}>
            Detailed reports for this section are still being prepared. The data will appear here as soon as the new dashboards are wired up.
          </p>
        </div>
      </div>
    </AnalyticsShell>
  );
}

const S = {
  empty: {
    padding: '40px 22px',
    minHeight: '100%',
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'center',
  },
  emptyCard: {
    width: 'min(560px, 100%)',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '36px 28px',
    textAlign: 'center',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    fontFamily: 'var(--font-sans)',
  },
  emptyIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto 14px',
    borderRadius: '50%',
    background: '#f1f5f9',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  emptyText: {
    fontSize: '0.9rem',
    color: '#475569',
    margin: 0,
    lineHeight: 1.5,
  },
};
