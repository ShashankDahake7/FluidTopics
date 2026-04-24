'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFolders();
    loadBookmarks();
  }, []);

  const loadFolders = async () => {
    try {
      const d = await api.get('/bookmarks/folders');
      setFolders(d.collections || []);
    } catch (e) { console.error(e); }
  };

  const loadBookmarks = async (folder = '') => {
    setLoading(true);
    try {
      const params = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const d = await api.get(`/bookmarks${params}`);
      setBookmarks(d.bookmarks || []);
      setActiveFolder(folder);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const removeBookmark = async (topicId) => {
    try {
      await api.delete(`/bookmarks/${topicId}`);
      setBookmarks(bookmarks.filter(b => b.topic?._id !== topicId));
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <Header />
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>🔖 My Bookmarks</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              {bookmarks.length} saved topic{bookmarks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <a href="/profile" className="btn btn-ghost btn-sm">← Back to Profile</a>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Folder sidebar */}
          {folders.length > 1 && (
            <aside style={{ width: '200px', flexShrink: 0 }}>
              <div className="card">
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Folders</h4>
                <button onClick={() => loadBookmarks('')}
                  className={`btn btn-ghost btn-sm`}
                  style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px', fontWeight: !activeFolder ? 600 : 400 }}>
                  All ({folders.reduce((sum, f) => sum + f.count, 0)})
                </button>
                {folders.map(f => (
                  <button key={f.name} onClick={() => loadBookmarks(f.name)}
                    className={`btn btn-ghost btn-sm`}
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px', fontWeight: activeFolder === f.name ? 600 : 400 }}>
                    📁 {f.name} ({f.count})
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* Bookmarks list */}
          <div style={{ flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : bookmarks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
                <span style={{ fontSize: '3rem' }}>🔖</span>
                <h2 style={{ marginTop: '12px', color: 'var(--text-primary)' }}>No bookmarks yet</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                  Click the bookmark icon on any topic to save it here
                </p>
                <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {bookmarks.map((b, i) => (
                  <div key={b.id} className="card animate-fadeIn" style={{ animationDelay: `${i * 40}ms`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href={`/topics/${b.topic?._id}`} style={{ textDecoration: 'none', flex: 1 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.topic?.title || 'Unknown'}</h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {b.folder !== 'default' && <span className="badge badge-warning">{b.folder}</span>}
                        {(b.topic?.metadata?.tags || []).slice(0, 3).map((t, j) => <span key={j} className="badge">{t}</span>)}
                      </div>
                      {b.note && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>💬 {b.note}</p>}
                    </a>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '16px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleDateString()}</span>
                      <button onClick={() => removeBookmark(b.topic?._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
