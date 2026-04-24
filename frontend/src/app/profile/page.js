'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState('');
  const [products, setProducts] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get('/user/profile');
      setProfile(data);
      setInterests((data.interests || []).join(', '));
      setProducts((data.products || []).join(', '));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await api.patch('/user/preferences', {
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        products: products.split(',').map(s => s.trim()).filter(Boolean),
      });
      await loadProfile();
      setEditing(false);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <><Header /><div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div></>;

  return (
    <>
      <Header />
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>My Profile</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '32px' }}>
          Your activity and preferences shape your personalized experience
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Activity Stats */}
          <div className="card">
            <h3 style={sH3}>📊 Activity Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              {[
                { label: 'Topics Viewed', value: profile?.totalViews || 0, icon: '👁' },
                { label: 'Searches', value: profile?.totalSearches || 0, icon: '🔍' },
                { label: 'Bookmarks', value: profile?.bookmarkCount || 0, icon: '🔖' },
                { label: 'History Items', value: profile?.recentHistory?.length || 0, icon: '📜' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-tertiary)', marginTop: '4px' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={sH3}>⚙️ Preferences</h3>
              {!editing && (
                <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit</button>
              )}
            </div>
            {editing ? (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={sLabel}>Interest Tags (comma-separated)</label>
                  <input className="input" value={interests} onChange={e => setInterests(e.target.value)}
                    placeholder="e.g. api, getting-started, security" />
                </div>
                <div>
                  <label style={sLabel}>Products (comma-separated)</label>
                  <input className="input" value={products} onChange={e => setProducts(e.target.value)}
                    placeholder="e.g. Fluid Topics, Platform SDK" />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={savePrefs} className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={sLabel}>Interests</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(profile?.interests || []).length > 0
                      ? profile.interests.map((t, i) => <span key={i} className="badge">{t}</span>)
                      : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None set — edit to personalize</span>}
                  </div>
                </div>
                <div>
                  <span style={sLabel}>Products</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(profile?.products || []).length > 0
                      ? profile.products.map((p, i) => <span key={i} className="badge badge-success">{p}</span>)
                      : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None set</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auto-learned Interests */}
        {(profile?.topTags?.length > 0 || profile?.topProducts?.length > 0) && (
          <div className="card" style={{ marginTop: '16px' }}>
            <h3 style={sH3}>🧠 Auto-Learned Interests</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Built automatically from your reading behavior
            </p>
            <div style={{ display: 'flex', gap: '32px', marginTop: '16px' }}>
              {profile.topTags?.length > 0 && (
                <div style={{ flex: 1 }}>
                  <span style={sLabel}>Top Tags</span>
                  <div style={{ marginTop: '8px' }}>
                    {profile.topTags.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px',
                            width: `${Math.min((t.count / Math.max(...profile.topTags.map(x => x.count))) * 100, 100)}%`,
                            background: 'var(--gradient-hero)',
                          }} />
                        </div>
                        <span className="badge" style={{ minWidth: '80px', justifyContent: 'center' }}>{t.tag}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {profile.topProducts?.length > 0 && (
                <div style={{ flex: 1 }}>
                  <span style={sLabel}>Top Products</span>
                  <div style={{ marginTop: '8px' }}>
                    {profile.topProducts.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <span className="badge badge-success">{p.product}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.count} views</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent History */}
        {profile?.recentHistory?.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={sH3}>🕐 Recent Reading</h3>
              <a href="/profile/history" className="btn btn-ghost btn-sm">View All →</a>
            </div>
            <div style={{ marginTop: '12px' }}>
              {profile.recentHistory.slice(0, 8).map((h, i) => (
                <a key={i} href={`/topics/${h.topic?._id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)', textDecoration: 'none' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{h.topic?.title || 'Unknown'}</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      {(h.topic?.metadata?.tags || []).slice(0, 2).map((t, j) => <span key={j} className="badge" style={{ fontSize: '0.65rem' }}>{t}</span>)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {h.visitCount}x · {new Date(h.lastVisitedAt).toLocaleDateString()}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <a href="/profile/bookmarks" className="btn btn-secondary">🔖 My Bookmarks</a>
          <a href="/profile/history" className="btn btn-secondary">📜 Full History</a>
          <a href="/profile/recommendations" className="btn btn-primary">✨ For You</a>
        </div>
      </main>
    </>
  );
}

const sH3 = { fontSize: '1rem', fontWeight: 600 };
const sLabel = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' };
