'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function ContentPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchPage(1); }, []);

  const fetchPage = async (pg) => {
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
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Content Management</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Browse and manage all indexed topics</p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    {['Title', 'Level', 'Tags', 'Views', 'Updated'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t, i) => (
                    <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 120ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={td}>
                        <a href={`/topics/${t._id}`} style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{t.title}</a>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px', background: 'rgba(79,70,229,0.08)', borderRadius: '4px', color: 'var(--accent-primary)' }}>
                          H{t.hierarchy?.level || 1}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(t.metadata?.tags || []).slice(0, 2).map((tag, j) => <span key={j} className="badge">{tag}</span>)}
                        </div>
                      </td>
                      <td style={td}>{t.viewCount || 0}</td>
                      <td style={td}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px' }}>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                    <button key={i} onClick={() => fetchPage(i + 1)}
                      className={`btn ${page === i + 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const td = { padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
