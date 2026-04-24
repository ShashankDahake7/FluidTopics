'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(d => { setStats(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  if (loading) return (<><Header /><div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div></>);

  const cards = [
    { label: 'Documents', value: stats?.documents || 0, icon: '📄', color: '#6366f1' },
    { label: 'Topics', value: stats?.topics || 0, icon: '📚', color: '#8b5cf6' },
    { label: 'Users', value: stats?.users || 0, icon: '👥', color: '#10b981' },
  ];

  return (
    <>
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }} className="container">
        <div style={{ padding: '32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Admin Dashboard</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage content and monitor platform</p>
            </div>
            <a href="/admin/ingest" className="btn btn-primary">+ Upload Content</a>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {cards.map((c, i) => (
              <div key={i} className="card animate-fadeIn" style={{ animationDelay: `${i * 80}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '2rem' }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {[
              { href: '/admin/ingest', icon: '⬆️', title: 'Upload Content', desc: 'Ingest new documents' },
              { href: '/admin/content', icon: '📋', title: 'Manage Content', desc: 'View and manage topics' },
              { href: '/admin/analytics', icon: '📊', title: 'Analytics', desc: 'Search & engagement stats' },
            ].map((link, i) => (
              <a key={i} href={link.href} className="card card-glow" style={{ textDecoration: 'none' }}>
                <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '8px', color: 'var(--text-primary)' }}>{link.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{link.desc}</p>
              </a>
            ))}
          </div>

          {/* Recent Documents */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Recent Ingestions</h3>
            {(stats?.recentDocuments || []).length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Title', 'Format', 'Topics', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDocuments.map(doc => (
                    <tr key={doc._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={tdStyle}>{doc.title}</td>
                      <td style={tdStyle}><span className="badge">{doc.sourceFormat}</span></td>
                      <td style={tdStyle}>{doc.topicCount || 0}</td>
                      <td style={tdStyle}><span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'failed' ? 'error' : 'warning'}`}>{doc.status}</span></td>
                      <td style={tdStyle}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No documents ingested yet</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

const tdStyle = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
