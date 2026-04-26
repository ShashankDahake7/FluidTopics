'use client';

import AdminShell from '@/components/admin/AdminShell';

export default function AdminTenantPage() {
  return (
    <AdminShell active="tenant-overview" allowedRoles={['superadmin']}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>My tenant</h1>
      <p style={{ color: '#64748b', maxWidth: 560, lineHeight: 1.55 }}>
        Tenant-level branding, domains, and platform defaults. Use Authentication under Administration for sign-in methods
        and session policy.
      </p>
      <p style={{ marginTop: 16 }}>
        <a href="/admin/authentication" style={{ color: '#1d4ed8', fontWeight: 600 }}>
          Open authentication settings →
        </a>
      </p>
    </AdminShell>
  );
}
