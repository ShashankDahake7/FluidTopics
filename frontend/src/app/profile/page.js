'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState('');
  const [products, setProducts] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) {
      router.replace('/login');
      return;
    }
    loadProfile();
  }, []);

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

  if (loading) return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    </>
  );

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>My Profile</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
              Your activity and preferences shape your personalized experience
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Activity Stats */}
            <div className="card">
              <h3 style={sH3}>Activity Overview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                {[
                  { label: 'Topics Viewed', value: profile?.totalViews || 0 },
                  { label: 'Searches', value: profile?.totalSearches || 0 },
                  { label: 'Bookmarks', value: profile?.bookmarkCount || 0 },
                  { label: 'History Items', value: profile?.recentHistory?.length || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={sH3}>Preferences</h3>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit</button>
                )}
              </div>
              {editing ? (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={sLabel}>Interest tags <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                    <input className="input" value={interests} onChange={e => setInterests(e.target.value)}
                      placeholder="e.g. api, getting-started, security" />
                  </div>
                  <div>
                    <label style={sLabel}>Products <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                    <input className="input" value={products} onChange={e => setProducts(e.target.value)}
                      placeholder="e.g. Platform SDK" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={savePrefs} className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <span style={sLabel}>Interests</span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {(profile?.interests || []).length > 0
                        ? profile.interests.map((t, i) => <span key={i} className="badge">{t}</span>)
                        : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>None set — edit to personalise</span>}
                    </div>
                  </div>
                  <div>
                    <span style={sLabel}>Products</span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {(profile?.products || []).length > 0
                        ? profile.products.map((p, i) => <span key={i} className="badge badge-success">{p}</span>)
                        : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>None set</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Auto-learned Interests */}
          {(profile?.topTags?.length > 0 || profile?.topProducts?.length > 0) && (
            <div className="card" style={{ marginTop: '14px' }}>
              <h3 style={sH3}>Auto-Learned Interests</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Built automatically from your reading behaviour
              </p>
              <div style={{ display: 'flex', gap: '32px', marginTop: '16px' }}>
                {profile.topTags?.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <span style={sLabel}>Top Tags</span>
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {profile.topTags.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '3px',
                              width: `${Math.min((t.count / Math.max(...profile.topTags.map(x => x.count))) * 100, 100)}%`,
                              background: 'var(--accent-primary)',
                            }} />
                          </div>
                          <span className="badge" style={{ minWidth: '72px', justifyContent: 'center' }}>{t.tag}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '28px', textAlign: 'right' }}>{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {profile.topProducts?.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <span style={sLabel}>Top Products</span>
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {profile.topProducts.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
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
            <div className="card" style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={sH3}>Recent Reading</h3>
                <a href="/profile/history" className="btn btn-ghost btn-sm">View all →</a>
              </div>
              {profile.recentHistory.slice(0, 8).map((h, i) => (
                <a key={i} href={`/topics/${h.topic?._id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)', textDecoration: 'none' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{h.topic?.title || 'Unknown'}</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                      {(h.topic?.metadata?.tags || []).slice(0, 2).map((t, j) => <span key={j} className="badge" style={{ fontSize: '0.65rem' }}>{t}</span>)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '12px' }}>
                    {h.visitCount}× · {new Date(h.lastVisitedAt).toLocaleDateString('en-US')}
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Quick Links */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <a href="/profile/bookmarks" className="btn btn-secondary">My Bookmarks</a>
            <a href="/profile/history" className="btn btn-secondary">Reading History</a>
            <a href="/profile/recommendations" className="btn btn-primary">Recommended for you</a>
          </div>
        </main>
      </div>
    </>
  );
}

const sH3 = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' };
const sLabel = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
