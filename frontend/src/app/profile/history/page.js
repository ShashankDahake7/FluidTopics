'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistory(); }, []);

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
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>📜 Reading History</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Topics you have recently viewed</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/profile" className="btn btn-ghost btn-sm">← Profile</a>
            {history.length > 0 && <button onClick={clearHistory} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>Clear</button>}
          </div>
        </div>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div> : history.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <span style={{ fontSize: '3rem' }}>📜</span>
            <h2 style={{ marginTop: '12px' }}>No history yet</h2>
            <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
          </div>
        ) : (
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Topic', 'Tags', 'Visits', 'Last Read'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={td}><a href={`/topics/${h.topic?._id}`} style={{ color: 'var(--accent-tertiary)' }}>{h.topic?.title || 'Unknown'}</a></td>
                    <td style={td}>{(h.topic?.metadata?.tags || []).slice(0, 2).map((t, j) => <span key={j} className="badge" style={{ marginRight: '4px', fontSize: '0.65rem' }}>{t}</span>)}</td>
                    <td style={td}><span style={{ fontWeight: 600, color: 'var(--accent-tertiary)' }}>{h.visitCount}x</span></td>
                    <td style={td}>{new Date(h.lastVisitedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
const td = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
