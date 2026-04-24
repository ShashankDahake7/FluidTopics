'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function ContentPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetch(1); }, []);

  const fetch = async (pg) => {
    setLoading(true);
    try {
      const d = await api.get(`/topics?page=${pg}&limit=30`);
      setTopics(d.topics || []);
      setTotalPages(d.totalPages || 1);
      setPage(pg);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <>
      <Header />
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Content Management</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '24px' }}>Browse and manage all indexed topics</p>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div> : (
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Title', 'Level', 'Tags', 'Views', 'Updated'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topics.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={td}><a href={`/topics/${t._id}`} style={{ color: 'var(--accent-tertiary)' }}>{t.title}</a></td>
                    <td style={td}>H{t.hierarchy?.level || 1}</td>
                    <td style={td}>{(t.metadata?.tags || []).slice(0, 2).map((tag, i) => <span key={i} className="badge" style={{ marginRight: '4px' }}>{tag}</span>)}</td>
                    <td style={td}>{t.viewCount || 0}</td>
                    <td style={td}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px 0' }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                  <button key={i} onClick={() => fetch(i + 1)} className={`btn ${page === i + 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}>{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

const td = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
