'use strict';

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, ResponsiveContainer
} from 'recharts';

/* ------------------------------ Icons ------------------------------ */

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconStacked = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const IconLogarithmic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a8 8 0 0 1 16 0" />
    <path d="M4 14h16" />
    <path d="M12 14v7" />
  </svg>
);

/* ------------------------------ Config ------------------------------ */

const ASSET_TYPES = [
  { id: 'bookmarks', label: 'Bookmarks', color: '#9D207B' },
  { id: 'personalBooks', label: 'Personal books', color: '#CFB017' },
  { id: 'personalTopics', label: 'Personal topics', color: '#361FAD' },
  { id: 'savedSearches', label: 'All saved searches', color: '#45A191' },
  { id: 'savedSearchesWithAlert', label: 'Saved searches with alerts', color: '#BD0F49' },
  { id: 'collections', label: 'Collections', color: '#7A891A' },
];

/* ------------------------------ Components ------------------------------ */

export default function UserAssetsPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [groupBy, setGroupBy] = useState('month');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Resize logic for responsive chart without triggering React 19 ResponsiveContainer bugs
  const chartRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 1000, height: 550 });

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setChartSize({
          width: entry.contentRect.width,
          height: Math.max(550, entry.contentRect.height)
        });
      }
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  // Filters State
  const [filters, setFilters] = useState(
    ASSET_TYPES.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {})
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const json = await api.post('/analytics/v1/users/assets/time-report', {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupByPeriod: groupBy,
        filters: { type: ASSET_TYPES.map(t => t.id) }
      });
      if (json.results) {
        setData(json.results);
      } else if (json.error) {
        setErrorMsg(json.error);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupBy]);

  const toggleAll = (checked) => {
    const next = {};
    ASSET_TYPES.forEach(t => next[t.id] = checked);
    setFilters(next);
  };

  const isAllChecked = Object.values(filters).every(Boolean);

  // Transform Data for Recharts
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // We expect `data` to be an array of `{ type, periods: [{ periodStartDate, count }] }`
    const firstType = data[0];
    if (!firstType || !firstType.periods) return [];
    if (firstType.periods.length === 0) return [];

    return firstType.periods.map((p, idx) => {
      const dataPoint = {
        name: new Date(p.periodStartDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          ...(groupBy === 'day' && { day: 'numeric' })
        })
      };

      data.forEach(assetType => {
        const period = assetType.periods[idx];
        if (period) {
          dataPoint[assetType.type] = period.count;
        }
      });
      return dataPoint;
    });
  }, [data, groupBy]);

  return (
    <AnalyticsShell
      active="user-assets"
      title="User assets"
      breadcrumb={[{ label: 'Knowledge Hub' }, { label: 'User assets' }]}
      toolbarExtras={
        <div style={PS.toolbarRight}>
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            style={{
              ...PS.toolbarIconBtn,
              color: '#475569',
            }}
          >
            <IconFilters />
          </button>
        </div>
      }
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the types of user assets created in the portal.
            </span>
            <div style={PS.headerControls}>
              <div style={PS.toggleGroup}>
                {['day', 'week', 'month'].map(period => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setGroupBy(period)}
                    style={{
                      ...PS.toggleBtn,
                      ...(groupBy === period ? PS.toggleBtnActive : {}),
                    }}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
              <div style={PS.iconActions}>
                <button type="button" style={PS.iconActionBtn} title="Switch to stacked graph">
                  <IconStacked />
                </button>
                <button type="button" style={PS.iconActionBtn} title="Switch to logarithmic scale">
                  <IconLogarithmic />
                </button>
                <button type="button" style={PS.exportBtn}>
                  <IconDownload />
                </button>
              </div>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
               <div style={PS.loading}>Loading charts...</div>
            ) : errorMsg ? (
               <div style={{ color: 'red', padding: '20px' }}>Error: {errorMsg}</div>
            ) : chartData.length === 0 ? (
               <div style={{ color: 'red', padding: '20px' }}>Data is empty!</div>
            ) : (
               <div style={PS.chartSection}>
                 <h3 style={PS.chartTitle}>USER ASSET COUNT</h3>
                 <div style={PS.chartWrapper}>
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e6f1" />
                     <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6e7079' }} tickLine={false} axisLine={{ stroke: '#e0e6f1' }} minTickGap={30} />
                     <YAxis tick={{ fontSize: 12, fill: '#6e7079' }} tickLine={false} axisLine={{ stroke: '#e0e6f1' }} />
                     <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                     
                     {ASSET_TYPES.map((asset) => (
                       filters[asset.id] && (
                         <Line
                           key={asset.id}
                           type="monotone"
                           dataKey={asset.id}
                           name={asset.label}
                           stroke={asset.color}
                           strokeWidth={2}
                           dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                           activeDot={{ r: 6, fill: '#fff', strokeWidth: 2 }}
                         />
                       )
                     ))}
                     <Brush dataKey="name" height={30} stroke="#cbd5e1" fill="#f8fafc" />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               </div>
            )}
          </section>
        </main>

        <aside style={{ ...PS.drawer, marginRight: drawerOpen ? 0 : -330, visibility: drawerOpen ? 'visible' : 'hidden' }}>
          <header style={PS.drawerHead}>
            <h3 style={PS.drawerTitle}>Filter asset types</h3>
            <button type="button" style={PS.drawerCloseBtn} onClick={() => setDrawerOpen(false)}>
              <IconClose />
            </button>
          </header>
          <div style={PS.drawerBody}>
            <label style={PS.checkboxWrap}>
              <input 
                type="checkbox" 
                checked={isAllChecked} 
                onChange={(e) => toggleAll(e.target.checked)} 
                style={PS.checkbox}
              />
              <span style={PS.checkboxLabel}>Select all</span>
            </label>
            
            <div style={PS.filterList}>
              {ASSET_TYPES.map(asset => (
                <label key={asset.id} style={PS.checkboxWrap}>
                  <input 
                    type="checkbox" 
                    checked={filters[asset.id]} 
                    onChange={(e) => setFilters(prev => ({ ...prev, [asset.id]: e.target.checked }))} 
                    style={PS.checkbox}
                  />
                  <span style={{ ...PS.colorDot, backgroundColor: asset.color }} />
                  <span style={PS.checkboxLabelLight}>{asset.label}</span>
                </label>
              ))}
            </div>
            
            <div style={PS.drawerSpace} />
            <div style={PS.drawerFooter}>
              <button type="button" style={PS.applyBtn} onClick={() => fetchData()}>Apply</button>
            </div>
          </div>
        </aside>
      </div>
    </AnalyticsShell>
  );
}

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff', overflow: 'hidden', position: 'relative' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  toolbarRight: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  toolbarIconBtn: {
    width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '50%',
  },
  resultHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  headerControls: { display: 'flex', alignItems: 'center', gap: '16px' },
  
  toggleGroup: {
    display: 'flex', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden',
  },
  toggleBtn: {
    padding: '6px 14px', fontSize: '0.8rem', fontWeight: 500, color: '#475569', background: 'transparent',
    border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer',
  },
  toggleBtnActive: { background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 },
  
  iconActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  iconActionBtn: {
    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', borderRadius: '4px',
  },
  exportBtn: {
    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', borderRadius: '4px',
  },
  
  body: { padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' },
  loading: { padding: '40px', textAlign: 'center', color: '#64748b' },
  
  chartSection: { display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, minWidth: 0 },
  chartTitle: { fontSize: '0.75rem', fontWeight: 600, color: '#6e7079', letterSpacing: '0.5px' },
  chartWrapper: { width: '100%', flex: 1, minHeight: '550px', minWidth: 0 },

  drawer: {
    width: '330px', flexShrink: 0, borderLeft: '1px solid #e5e7eb', background: '#ffffff',
    display: 'flex', flexDirection: 'column', transition: 'margin-right 200ms ease, visibility 200ms',
  },
  drawerHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0 },
  drawerCloseBtn: {
    width: '32px', height: '32px', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer',
    borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  drawerBody: { padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' },
  
  checkboxWrap: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#2196F3' },
  checkboxLabel: { fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' },
  checkboxLabelLight: { fontSize: '0.88rem', fontWeight: 500, color: '#334155' },
  colorDot: { width: '8px', height: '8px', borderRadius: '50%' },
  
  filterList: { display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '6px', marginTop: '4px' },
  
  drawerSpace: { flex: 1 },
  drawerFooter: { padding: '12px 18px', background: '#ffffff', borderTop: '1px solid #e5e7eb' },
  applyBtn: {
    width: '100%', padding: '10px 14px', background: '#2196F3', color: '#ffffff',
    border: 'none', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
};
