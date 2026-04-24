'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('overview');

  useEffect(() => { fetchAll(); }, [days]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([
        api.get(`/analytics/dashboard?days=${days}`),
        api.get(`/analytics/content-gaps?days=${days}`),
      ]);
      setStats(s);
      setGaps(g.gaps || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const exportData = async (type) => {
    try {
      const d = await api.get(`/analytics/export?type=${type}&days=${days}`);
      const csv = jsonToCsv(d.data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `analytics_${type}_${days}d.csv`; a.click();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <><Header /><div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div></>;

  return (
    <>
      <Header />
      <main className="container" style={{ position: 'relative', zIndex: 1, padding: '32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>📊 Analytics</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Platform performance & engagement</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="input" style={{ width: 'auto' }}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <button onClick={() => exportData('search')} className="btn btn-secondary btn-sm">📥 Export</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Searches', value: stats?.totalSearches || 0, icon: '🔍', color: '#6366f1' },
            { label: 'Views', value: stats?.totalViews || 0, icon: '👁', color: '#8b5cf6' },
            { label: 'Clicks', value: stats?.totalClicks || 0, icon: '🖱️', color: '#a78bfa' },
            { label: 'CTR', value: `${stats?.clickThroughRate || 0}%`, icon: '📈', color: '#10b981' },
            { label: 'Search Success', value: `${stats?.searchSuccessRate || 0}%`, icon: '✅', color: stats?.searchSuccessRate >= 85 ? '#10b981' : '#f59e0b' },
            { label: 'Avg Response', value: `${stats?.avgSearchResponseTime || 0}ms`, icon: '⚡', color: stats?.avgSearchResponseTime < 200 ? '#10b981' : '#f59e0b' },
          ].map((c, i) => (
            <div key={i} className="card animate-fadeIn" style={{ animationDelay: `${i * 40}ms`, padding: '16px' }}>
              <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color, marginTop: '4px' }}>{c.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          {['overview', 'queries', 'content', 'engagement'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Daily Trends */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={h3}>📈 Daily Trends</h3>
              {(stats?.dailyStats || []).length > 0 ? (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>● Searches</span>
                    <span style={{ fontSize: '0.75rem', color: '#8b5cf6' }}>● Views</span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>● Clicks</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '120px' }}>
                    {stats.dailyStats.map((d, i) => {
                      const max = Math.max(...stats.dailyStats.map(s => (s.searches || 0) + (s.views || 0) + (s.clicks || 0)), 1);
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: '1px', height: '100%' }}
                          title={`${d.date}: ${d.searches} searches, ${d.views} views, ${d.clicks} clicks`}>
                          <div style={{ height: `${((d.searches || 0) / max) * 100}%`, background: '#6366f1', borderRadius: '2px', minHeight: d.searches ? '2px' : 0 }} />
                          <div style={{ height: `${((d.views || 0) / max) * 100}%`, background: '#8b5cf6', borderRadius: '2px', minHeight: d.views ? '2px' : 0 }} />
                          <div style={{ height: `${((d.clicks || 0) / max) * 100}%`, background: '#10b981', borderRadius: '2px', minHeight: d.clicks ? '2px' : 0 }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>No daily data yet</p>}
            </div>
            {/* Top Viewed */}
            <div className="card">
              <h3 style={h3}>🏆 Top Viewed Topics</h3>
              {(stats?.topViewedTopics || []).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <a href={`/topics/${t._id}`} style={{ fontSize: '0.85rem', color: 'var(--accent-tertiary)' }}>{t.title}</a>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.viewCount} views</span>
                </div>
              ))}
              {(stats?.topViewedTopics || []).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No data</p>}
            </div>
            {/* User Activity */}
            <div className="card">
              <h3 style={h3}>👥 User Activity</h3>
              <div style={{ marginTop: '12px' }}>
                {[
                  { label: 'Active Users', value: stats?.userActivity?.activeUsers || 0 },
                  { label: 'Avg Views/User', value: Math.round(stats?.userActivity?.avgViews || 0) },
                  { label: 'Avg Searches/User', value: Math.round(stats?.userActivity?.avgSearches || 0) },
                  { label: 'Total Readers', value: stats?.engagement?.totalReaders || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-tertiary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'queries' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card">
              <h3 style={h3}>🔍 Top Queries</h3>
              {(stats?.topQueries || []).map((q, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{q.query}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{q.count}x</span>
                    <span style={{ color: q.avgResults > 0 ? 'var(--success)' : 'var(--error)' }}>~{q.avgResults} results</span>
                    {q.avgResponseTime && <span style={{ color: 'var(--text-muted)' }}>{q.avgResponseTime}ms</span>}
                  </div>
                </div>
              ))}
              {(stats?.topQueries || []).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No search data</p>}
            </div>
            <div className="card">
              <h3 style={h3}>❌ Failed Searches</h3>
              {(stats?.failedSearches || []).map((q, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--error)' }}>{q.query}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{q.count}x</span>
                </div>
              ))}
              {(stats?.failedSearches || []).length === 0 && <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>No failed searches 🎉</p>}
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card">
              <h3 style={h3}>📦 Product Breakdown</h3>
              {(stats?.contentStats?.productBreakdown || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.product}</span>
                  <span className="badge">{p.topicCount} topics</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={h3}>🕳️ Content Gaps</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Searches that returned no results</p>
              {gaps.length > 0 ? gaps.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--error)' }}>{g.query}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{g.searchCount}x</span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.uniqueUserCount} users</span>
                  </div>
                </div>
              )) : <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>No gaps found 🎉</p>}
            </div>
          </div>
        )}

        {tab === 'engagement' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card">
              <h3 style={h3}>📖 Reading Engagement</h3>
              <div style={{ marginTop: '12px' }}>
                {[
                  { label: 'Total Readers', value: stats?.engagement?.totalReaders || 0 },
                  { label: 'Avg Visits/Topic', value: (stats?.engagement?.avgVisits || 0).toFixed(1) },
                  { label: 'Avg Time Spent', value: `${Math.round(stats?.engagement?.avgDuration || 0)}s` },
                  { label: 'Avg Scroll Depth', value: `${Math.round(stats?.engagement?.avgScrollDepth || 0)}%` },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-tertiary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 style={h3}>📊 Content Stats</h3>
              <div style={{ marginTop: '12px' }}>
                {[
                  { label: 'Documents', value: stats?.contentStats?.documents || 0 },
                  { label: 'Topics', value: stats?.contentStats?.topics || 0 },
                  { label: 'Users', value: stats?.contentStats?.users || 0 },
                  { label: 'Products', value: stats?.contentStats?.productBreakdown?.length || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-tertiary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const h3 = { fontSize: '1rem', fontWeight: 600, marginBottom: '8px' };

function jsonToCsv(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}
