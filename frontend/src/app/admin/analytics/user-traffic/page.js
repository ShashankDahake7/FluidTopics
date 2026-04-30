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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconStackedChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

/* ------------------------------ Components ------------------------------ */

const REALM_COLORS = {
  internal: '#9D207B',
  sso: '#CFB017',
  ldap: '#361FAD',
  oidc: '#45A191',
};

export default function UserTrafficPage() {
  const [groupBy, setGroupBy] = useState('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const json = await api.post('/analytics/v1/traffic/user-activity', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        groupByPeriod: groupBy
      });
      if (json.results) {
        setData(json.results);
      } else if (json.error) {
        setErrorMsg(json.error);
      } else {
        setErrorMsg('Unknown response format: ' + JSON.stringify(json).substring(0, 100));
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
  }, [groupBy, startDate, endDate]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const firstRealm = data[0];
    if (!firstRealm || !firstRealm.periods) return [];
    
    return firstRealm.periods.map((p, idx) => {
      const dataPoint = {
        name: new Date(p.periodStartDate).toLocaleDateString('en-GB', { 
          day: '2-digit', month: 'short', year: 'numeric'
        }),
      };
      
      data.forEach(realm => {
        const period = realm.periods[idx];
        if (period) {
          dataPoint[`${realm.realm}_active`] = period.activeCount;
          dataPoint[`${realm.realm}_total`] = period.totalCount;
        }
      });
      return dataPoint;
    });
  }, [data]);

  // Custom legend removed for safety

  return (
    <AnalyticsShell
      active="user-traffic"
      title="User traffic"
      breadcrumb={[{ label: 'Users' }, { label: 'User traffic' }]}
    >
      <div style={PS.layout}>
        <main style={PS.main}>
          <header style={PS.resultHead}>
            <span style={PS.headTagline}>
              Data is based on the number of authenticated users who accessed the portal or a public API.
            </span>
            <div style={PS.headerControls}>
              <div style={PS.dateControls}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={PS.dateInput} />
                <span style={PS.dateSeparator}>to</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={PS.dateInput} />
              </div>
              <div style={PS.toggleGroup}>
                {['day', 'week', 'month'].map(period => (
                  <button
                    key={period}
                    type="button"
                    style={{
                      ...PS.toggleBtn,
                      ...(groupBy === period ? PS.toggleBtnActive : {}),
                      borderRight: period === 'month' ? 'none' : '1px solid #cbd5e1'
                    }}
                    onClick={() => setGroupBy(period)}
                  >
                    {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
              <button type="button" style={PS.iconBtn} title="Switch to stacked graph">
                <IconStackedChart />
              </button>
              <button type="button" style={PS.iconBtn} title="Download as XLSX">
                <IconDownload />
              </button>
            </div>
          </header>

          <section style={PS.body}>
            {loading ? (
               <div style={PS.loading}>Loading charts...</div>
            ) : errorMsg ? (
               <div style={{ color: 'red', padding: '20px' }}>Error: {errorMsg}</div>
            ) : data.length === 0 ? (
               <div style={{ color: 'red', padding: '20px' }}>Data is empty!</div>
            ) : (
               <>
                  <div style={PS.chartSection}>
                    <h3 style={PS.chartTitle}>USER ACTIVITY OVER TIME</h3>
                    <div style={PS.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="top" height={36} />
                        
                        {data.map((realm) => (
                          <Line
                            key={realm.realm}
                            type="monotone"
                            dataKey={`${realm.realm}_active`}
                            name={`${realm.realm}_active`}
                            stroke={REALM_COLORS[realm.realm] || '#3b82f6'}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, fill: '#fff', strokeWidth: 2 }}
                          />
                        ))}
                        <Brush dataKey="name" height={30} stroke="#cbd5e1" fill="#f8fafc" />
                      </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={PS.chartSection}>
                    <h3 style={PS.chartTitle}>Total users</h3>
                    <div style={PS.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="top" height={36} />
                        
                        {data.map((realm) => (
                          <Line
                            key={realm.realm}
                            type="monotone"
                            dataKey={`${realm.realm}_total`}
                            name={`${realm.realm}_total`}
                            stroke={REALM_COLORS[realm.realm] || '#3b82f6'}
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#fff', strokeWidth: 2 }}
                          />
                        ))}
                        <Brush dataKey="name" height={30} stroke="#cbd5e1" fill="#f8fafc" />
                      </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
               </>
            )}
          </section>
        </main>
      </div>
    </AnalyticsShell>
  );
}

const PS = {
  layout: { display: 'flex', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff', position: 'relative' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569' },
  headerControls: { display: 'flex', alignItems: 'center', gap: '16px' },
  
  dateControls: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' },
  dateInput: { padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' },
  dateSeparator: { fontSize: '0.85rem', color: '#64748b' },
  
  toggleGroup: {
    display: 'flex',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: '6px 16px',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#475569',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    background: '#f1f5f9',
    color: '#0f172a',
    fontWeight: 600,
  },
  
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  downloadBtn: {
    // keeping for reference
  },
  
  body: { padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '48px', flex: 1, overflowY: 'auto' },
  loading: { textAlign: 'center', padding: '40px', color: '#64748b' },
  
  chartSection: { display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, minWidth: 0 },
  chartTitle: { fontSize: '0.75rem', fontWeight: 600, color: '#6e7079', letterSpacing: '0.5px' },
  chartWrapper: { width: '100%', flex: 1, minHeight: '550px', minWidth: 0 },
  
  legendContainer: { display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendIcon: { width: '12px', height: '12px', borderRadius: '50%', border: '3px solid', background: '#fff' },
  legendText: { fontSize: '0.8rem', color: '#475569', fontWeight: 500 },
};
