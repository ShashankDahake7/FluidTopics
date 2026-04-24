'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) { router.replace('/login'); return; }
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
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>My Bookmarks</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                {bookmarks.length} saved topic{bookmarks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <a href="/profile" className="btn btn-secondary btn-sm">← Profile</a>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {/* Folder sidebar */}
            {folders.length > 1 && (
              <aside style={{ width: '200px', flexShrink: 0 }}>
                <div className="card" style={{ padding: '14px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Folders</h4>
                  <button onClick={() => loadBookmarks('')}
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', fontWeight: !activeFolder ? 600 : 400, color: !activeFolder ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                    All ({folders.reduce((sum, f) => sum + f.count, 0)})
                  </button>
                  {folders.map(f => (
                    <button key={f.name} onClick={() => loadBookmarks(f.name)}
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', fontWeight: activeFolder === f.name ? 600 : 400, color: activeFolder === f.name ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                      {f.name} ({f.count})
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
                <div className="card" style={{ textAlign: 'center', padding: '56px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔖</div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>No bookmarks yet</h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.875rem' }}>
                    Click the star on any topic to save it here
                  </p>
                  <a href="/topics" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Topics</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bookmarks.map((b, i) => (
                    <div key={b.id} className="card animate-fadeIn" style={{ animationDelay: `${i * 35}ms`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <a href={`/topics/${b.topic?._id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.topic?.title || 'Unknown'}</h3>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                          {b.folder !== 'default' && <span className="badge badge-warning">{b.folder}</span>}
                          {(b.topic?.metadata?.tags || []).slice(0, 3).map((t, j) => <span key={j} className="badge">{t}</span>)}
                        </div>
                        {b.note && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '5px' }}>{b.note}</p>}
                      </a>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleDateString('en-US')}</span>
                        <button onClick={() => removeBookmark(b.topic?._id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--error)', borderColor: 'var(--border-color)', padding: '4px 10px', fontSize: '0.78rem' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
