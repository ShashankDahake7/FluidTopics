'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(d => { setStats(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  if (loading) return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    </>
  );

  const kpis = [
    { label: 'Documents', value: stats?.documents || 0, icon: '📄', color: 'var(--accent-primary)' },
    { label: 'Topics', value: stats?.topics || 0, icon: '📚', color: '#7c3aed' },
    { label: 'Users', value: stats?.users || 0, icon: '👥', color: 'var(--success)' },
  ];

  const quickLinks = [
    { href: '/admin/ingest', icon: '⬆️', title: 'Upload Content', desc: 'Ingest new documents' },
    { href: '/admin/content', icon: '📋', title: 'Manage Content', desc: 'View and manage topics' },
    { href: '/admin/analytics', icon: '📊', title: 'Analytics', desc: 'Search & engagement stats' },
    { href: '/admin/designer', icon: '🎨', title: 'Portal Designer', desc: 'Design custom portal pages', accent: true },
    { href: '/portal',         icon: '🌐', title: 'View Portal',     desc: 'Browse published documentation' },
  ];

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Admin Dashboard</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Manage content and monitor the platform</p>
            </div>
            <a href="/admin/ingest" className="btn btn-primary">+ Upload content</a>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {kpis.map((c, i) => (
              <div key={i} className="card animate-fadeIn" style={{ animationDelay: `${i * 60}ms` }}>
                <div style={{ display: 'flex', align: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                    {c.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 700, color: c.color, lineHeight: 1 }}>{c.value.toLocaleString('en-US')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>{c.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {quickLinks.map((link, i) => (
              <a key={i} href={link.href} className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '6px', ...(link.accent ? { borderColor: 'var(--accent-primary)', background: 'rgba(79,70,229,0.03)' } : {}) }}>
                <span style={{ fontSize: '1.4rem' }}>{link.icon}</span>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: link.accent ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{link.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{link.desc}</p>
              </a>
            ))}
          </div>

          {/* Recent Documents */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px' }}>Recent Ingestions</h3>
            {(stats?.recentDocuments || []).length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Title', 'Format', 'Topics', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDocuments.map(doc => (
                    <tr key={doc._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={td}>{doc.title}</td>
                      <td style={td}><span className="badge">{doc.sourceFormat}</span></td>
                      <td style={td}>{doc.topicCount || 0}</td>
                      <td style={td}><span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'failed' ? 'error' : 'warning'}`}>{doc.status}</span></td>
                      <td style={td}>{new Date(doc.createdAt).toLocaleDateString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No documents ingested yet</p>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

const td = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
