'use client';

import Link from 'next/link';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

const dashboardUrl =
  process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL ||
  process.env.NEXT_PUBLIC_POSTHOG_HOST ||
  'https://posthog.fun';

export default function PostHogAnalyticsPage() {
  return (
    <AnalyticsShell
      active="posthog"
      breadcrumb={{ prefix: 'Traffic', title: 'PostHog' }}
    >
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.badge}>Product analytics</div>
          <h1 style={S.title}>PostHog</h1>
          <p style={S.lead}>
            Session replay, funnels, and live events for this app are collected in your PostHog
            project. Open the dashboard to explore real traffic and events as you use Fluid Topics.
          </p>
          <div style={S.actions}>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer" style={S.primaryBtn}>
              Open PostHog dashboard
            </a>
            <Link href="/admin/analytics" style={S.secondaryBtn}>
              Back to Analytics home
            </Link>
          </div>
          <p style={S.hint}>
            Tip: click around the portal and admin; page views and interactions appear in PostHog
            within a few seconds.
          </p>
        </div>
      </div>
    </AnalyticsShell>
  );
}

const S = {
  wrap: {
    padding: '20px 22px 28px',
    minHeight: '100%',
    background: '#f8fafc',
  },
  card: {
    maxWidth: '640px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px 26px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#7c3aed',
    background: '#f3e8ff',
    padding: '4px 10px',
    borderRadius: '999px',
    marginBottom: '12px',
  },
  title: {
    margin: '0 0 10px',
    fontSize: '1.45rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  lead: {
    margin: '0 0 22px',
    fontSize: '0.95rem',
    lineHeight: 1.55,
    color: '#475569',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '18px',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#ffffff',
    background: '#7c3aed',
    borderRadius: '8px',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#1d4ed8',
    background: 'transparent',
    borderRadius: '8px',
    textDecoration: 'none',
    border: '1px solid #bfdbfe',
  },
  hint: {
    margin: 0,
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: '#94a3b8',
  },
};
