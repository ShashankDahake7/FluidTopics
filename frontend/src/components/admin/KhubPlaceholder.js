'use client';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Lightweight placeholder used by Knowledge Hub sub-pages that haven't
 * been fully implemented yet. Keeps the sidebar links live so super-admins
 * can navigate without 404s.
 */
export default function KhubPlaceholder({ active, title, subtitle }) {
  return (
    <AdminShell active={active} allowedRoles={['superadmin']}>
      <h1 style={S.h1}>
        {title}{' '}
        <span title={subtitle} style={S.infoIcon}>ⓘ</span>
      </h1>
      <p style={S.subtitle}>{subtitle}</p>
      <div style={S.empty}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div style={{ fontWeight: 600, color: '#475569' }}>This page is coming soon.</div>
        <div>Configuration for <strong>{title}</strong> will be available shortly.</div>
      </div>
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  infoIcon: {
    fontSize: '0.95rem', color: '#94a3b8', cursor: 'help',
    display: 'inline-block', verticalAlign: 'middle',
  },
  empty: {
    border: '1px dashed #cbd5e1', borderRadius: '6px',
    padding: '60px 24px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    color: '#94a3b8', fontSize: '0.9rem',
    background: '#f8fafc',
  },
};
