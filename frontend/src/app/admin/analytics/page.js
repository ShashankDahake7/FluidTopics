'use client';
import { useState, useEffect } from 'react';
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

  if (loading) return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    </>
  );

  const kpis = [
    { label: 'Searches', value: stats?.totalSearches || 0, color: 'var(--accent-primary)' },
    { label: 'Views', value: stats?.totalViews || 0, color: '#7c3aed' },
    { label: 'Clicks', value: stats?.totalClicks || 0, color: '#0891b2' },
    { label: 'CTR', value: `${stats?.clickThroughRate || 0}%`, color: 'var(--success)' },
    { label: 'Search Success', value: `${stats?.searchSuccessRate || 0}%`, color: stats?.searchSuccessRate >= 85 ? 'var(--success)' : 'var(--warning)' },
    { label: 'Avg Response', value: `${stats?.avgSearchResponseTime || 0}ms`, color: stats?.avgSearchResponseTime < 200 ? 'var(--success)' : 'var(--warning)' },
  ];

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Analytics</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Platform performance & engagement</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="input" style={{ width: 'auto' }}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button onClick={() => exportData('search')} className="btn btn-secondary btn-sm">Export CSV</button>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '24px' }}>
            {kpis.map((c, i) => (
              <div key={i} className="card animate-fadeIn" style={{ animationDelay: `${i * 35}ms`, padding: '16px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
            {['overview', 'queries', 'content', 'engagement'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="btn btn-ghost btn-sm"
                style={{
                  textTransform: 'capitalize', borderRadius: '0',
                  borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: tab === t ? 600 : 400,
                }}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3 style={h3}>Daily Trends</h3>
                {(stats?.dailyStats || []).length > 0 ? (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                      {[['#4f46e5', 'Searches'], ['#7c3aed', 'Views'], ['#059669', 'Clicks']].map(([color, label]) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                          {label}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '100px' }}>
                      {stats.dailyStats.map((d, i) => {
                        const max = Math.max(...stats.dailyStats.map(s => (s.searches || 0) + (s.views || 0) + (s.clicks || 0)), 1);
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: '1px', height: '100%' }}
                            title={`${d.date}: ${d.searches} searches, ${d.views} views, ${d.clicks} clicks`}>
                            <div style={{ height: `${((d.searches || 0) / max) * 100}%`, background: '#4f46e5', borderRadius: '2px 2px 0 0', minHeight: d.searches ? '2px' : 0 }} />
                            <div style={{ height: `${((d.views || 0) / max) * 100}%`, background: '#7c3aed', borderRadius: '2px 2px 0 0', minHeight: d.views ? '2px' : 0 }} />
                            <div style={{ height: `${((d.clicks || 0) / max) * 100}%`, background: '#059669', borderRadius: '2px 2px 0 0', minHeight: d.clicks ? '2px' : 0 }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No daily data yet</p>}
              </div>

              <div className="card">
                <h3 style={h3}>Top Viewed Topics</h3>
                {(stats?.topViewedTopics || []).map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <a href={`/topics/${t._id}`} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>{t.title}</a>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>{t.viewCount}</span>
                  </div>
                ))}
                {(stats?.topViewedTopics || []).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data</p>}
              </div>

              <div className="card">
                <h3 style={h3}>User Activity</h3>
                <div style={{ marginTop: '8px' }}>
                  {[
                    { label: 'Active Users', value: stats?.userActivity?.activeUsers || 0 },
                    { label: 'Avg Views / User', value: Math.round(stats?.userActivity?.avgViews || 0) },
                    { label: 'Avg Searches / User', value: Math.round(stats?.userActivity?.avgSearches || 0) },
                    { label: 'Total Readers', value: stats?.engagement?.totalReaders || 0 },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'queries' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="card">
                <h3 style={h3}>Top Queries</h3>
                {(stats?.topQueries || []).map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{q.query}</span>
                    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{q.count}×</span>
                      <span style={{ color: q.avgResults > 0 ? 'var(--success)' : 'var(--error)' }}>{q.avgResults} results</span>
                    </div>
                  </div>
                ))}
                {(stats?.topQueries || []).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No search data</p>}
              </div>
              <div className="card">
                <h3 style={h3}>Failed Searches</h3>
                {(stats?.failedSearches || []).map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--error)' }}>{q.query}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{q.count}×</span>
                  </div>
                ))}
                {(stats?.failedSearches || []).length === 0 && (
                  <p style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>No failed searches ✓</p>
                )}
              </div>
            </div>
          )}

          {tab === 'content' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="card">
                <h3 style={h3}>Product Breakdown</h3>
                {(stats?.contentStats?.productBreakdown || []).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.product}</span>
                    <span className="badge">{p.topicCount} topics</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 style={h3}>Content Gaps</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Searches that returned no results</p>
                {gaps.length > 0 ? gaps.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--error)' }}>{g.query}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.searchCount}× · {g.uniqueUserCount} users</span>
                  </div>
                )) : <p style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>No gaps found ✓</p>}
              </div>
            </div>
          )}

          {tab === 'engagement' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="card">
                <h3 style={h3}>Reading Engagement</h3>
                {[
                  { label: 'Total Readers', value: stats?.engagement?.totalReaders || 0 },
                  { label: 'Avg Visits / Topic', value: (stats?.engagement?.avgVisits || 0).toFixed(1) },
                  { label: 'Avg Time Spent', value: `${Math.round(stats?.engagement?.avgDuration || 0)}s` },
                  { label: 'Avg Scroll Depth', value: `${Math.round(stats?.engagement?.avgScrollDepth || 0)}%` },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 style={h3}>Content Stats</h3>
                {[
                  { label: 'Documents', value: stats?.contentStats?.documents || 0 },
                  { label: 'Topics', value: stats?.contentStats?.topics || 0 },
                  { label: 'Users', value: stats?.contentStats?.users || 0 },
                  { label: 'Products', value: stats?.contentStats?.productBreakdown?.length || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const h3 = { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' };

function jsonToCsv(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}
