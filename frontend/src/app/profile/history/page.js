'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) { router.replace('/login'); return; }
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const d = await api.get('/user/history?limit=50');
      setHistory(d.history || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!confirm('Clear all reading history?')) return;
    try { await api.delete('/user/history'); setHistory([]); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <Header />
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Reading History</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Topics you have recently viewed</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/profile" className="btn btn-secondary btn-sm">← Profile</a>
              {history.length > 0 && (
                <button onClick={clearHistory} className="btn btn-secondary btn-sm" style={{ color: 'var(--error)' }}>Clear all</button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner" /></div>
          ) : history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📜</div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>No history yet</h2>
              <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    {['Topic', 'Tags', 'Visits', 'Last Read'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={td}><a href={`/topics/${h.topic?._id}`} style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{h.topic?.title || 'Unknown'}</a></td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(h.topic?.metadata?.tags || []).slice(0, 2).map((t, j) => <span key={j} className="badge" style={{ fontSize: '0.65rem' }}>{t}</span>)}
                        </div>
                      </td>
                      <td style={td}><span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{h.visitCount}×</span></td>
                      <td style={td}>{new Date(h.lastVisitedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const td = { padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
