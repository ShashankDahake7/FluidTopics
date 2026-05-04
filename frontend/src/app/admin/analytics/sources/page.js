'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';
import api from '@/lib/api';

/* ------------------------------ Constants ------------------------------ */

const MONTHS = [
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025',   'February 2025', 'March 2025',    'April 2025',
  'May 2025',       'June 2025',     'July 2025',     'August 2025',
  'September 2025', 'October 2025',  'November 2025', 'December 2025',
  'January 2026',   'February 2026', 'March 2026',    'April 2026',
];

const MONTH_LABELS = [
  'September 2024', 'December 2024', 'March 2025', 'June 2025',
  'September 2025', 'December 2025', 'March 2026',
];

/*
 * Source type series — colors mirror the Angular blueprint (color-chart-1..4-base).
 * Mock value series are derived from the chart geometry shown in the blueprint
 * (Y-axis 0–18,000, last bucket = ongoing partial period).
 */
const SOURCE_TYPE_META = [
  { key: 'direct',   label: 'Direct',   color: '#9D207B', description: 'Unknown origin, mainly clicked browser bookmarks or URL typed manually into the browser.' },
  { key: 'organic',  label: 'Organic',  color: '#CFB017', description: 'Unpaid search result, via a search engine such as Google, Bing, Yahoo, etc.' },
  { key: 'referral', label: 'Referral', color: '#361FAD', description: 'Paid search ads (SEA), or websites that are not search engines nor social media.' },
  { key: 'social',   label: 'Social',   color: '#45A191', description: 'Social network platform such as Facebook, Twitter, LinkedIn, etc.' },
];

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const Y_TICKS_LINEAR = [0, 3000, 6000, 9000, 12000, 15000, 18000];
const Y_TICKS_LOG = [1, 10, 100, 1000, 10000, 100000];

const LANGUAGE_OPTIONS = [
  { value: 'all',   label: 'All' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
];

const AUTH_OPTIONS = [
  { value: 'all',             label: 'All' },
  { value: 'authenticated',   label: 'Authenticated' },
  { value: 'unauthenticated', label: 'Unauthenticated' },
];

const TARGET_GROUPS = [
  {
    key: 'homepages',
    label: 'Homepages',
    items: [
      { key: 'home-classic',           label: 'Classic Homepage' },
      { key: 'home-default',           label: 'Default homepage' },
      { key: 'home-default-2',         label: 'Default homepage 2', suffix: ' - Italian (Italy)' },
      { key: 'homepage-en',            label: 'Homepage',           suffix: ' - English (United States)' },
    ],
  },
  {
    key: 'custom-pages',
    label: 'Custom pages',
    items: [
      { key: 'p-askdarwin',     label: 'Ask Darwin',         url: '/p/askdarwin' },
      { key: 'p-comingsoon',    label: 'Coming Soon',        url: '/p/comingsoon' },
      { key: 'p-countryguide',  label: 'countryguide',       url: '/p/countryguide' },
      { key: 'p-faqs',          label: 'FAQs',               url: '/p/faqs' },
      { key: 'p-prem23',        label: 'HomepagePrem23april',url: '/p/HomepagePrem23april' },
      { key: 'p-legalchanges',  label: 'Legal Changes',      url: '/p/legalchanges' },
      { key: 'p-releasenotes',  label: 'Release Notes',      url: '/p/ReleaseNotes' },
      { key: 'p-testhome',      label: 'Test Home',          url: '/p/testhome' },
      { key: 'p-testbga',       label: 'TestBGA',            url: '/p/testbga' },
      { key: 'p-upcoming',      label: "What's Upcoming",    url: '/p/upcoming' },
    ],
  },
  {
    key: 'search-pages',
    label: 'Search pages',
    items: [
      { key: 'search-classic', label: 'Classic Search page' },
      { key: 'search-default', label: 'Default search' },
    ],
  },
  {
    key: 'reader-pages',
    label: 'Reader pages',
    items: [
      { key: 'reader-classic', label: 'Classic Reader page' },
      { key: 'reader-default', label: 'Default reader' },
    ],
  },
  {
    key: 'viewer-pages',
    label: 'Viewer pages',
    items: [
      { key: 'viewer-page', label: 'Viewer page' },
    ],
  },
];

const ALL_TARGET_KEYS = TARGET_GROUPS.flatMap((g) => g.items.map((it) => it.key));

const TABS = [
  { key: 'evolution',   label: 'Evolution' },
  { key: 'destination', label: 'Destination' },
  { key: 'details',     label: 'Details' },
];

/* ------------------------------ Icons ------------------------------ */

const IconFilters = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2.2" fill="#fff" />
    <circle cx="15" cy="12" r="2.2" fill="#fff" />
    <circle cx="8" cy="18" r="2.2" fill="#fff" />
  </svg>
);

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconStacked = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="14" width="4" height="7" />
    <rect x="10" y="9" width="4" height="12" />
    <rect x="17" y="4" width="4" height="17" />
  </svg>
);

const IconLine = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 17 9 11 13 15 21 7" />
  </svg>
);

const IconLog = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <text x="3" y="16" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">log</text>
    <text x="14" y="11" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">10</text>
    <line x1="3" y1="20" x2="21" y2="20" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 12 10 18 20 6" />
  </svg>
);

const IconHelp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-0.9 0.4-1.5 1-1.5 2.2" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconLineChartTab = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" />
    <polyline points="7 14 11 10 14 13 21 6" />
  </svg>
);

const IconSankey = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="3" height="6" />
    <rect x="3" y="14" width="3" height="6" />
    <rect x="18" y="3" width="3" height="7" />
    <rect x="18" y="13" width="3" height="8" />
    <path d="M6 7C12 7 12 6 18 6" />
    <path d="M6 17C12 17 12 17 18 17" />
    <path d="M6 8C12 8 12 16 18 16" />
  </svg>
);

const IconSunburst = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 8.8V3" />
    <path d="M12 15.2V21" />
    <path d="M8.8 12H3" />
    <path d="M15.2 12H21" />
    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.5" />
  </svg>
);

/* ------------------------------ Page ------------------------------ */

export default function SourcesPage() {
  const [activeTab, setActiveTab] = useState('evolution');
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [language, setLanguage] = useState('en-US');
  const [authStatus, setAuthStatus] = useState('all');

  // --- Real data state ---
  const [evoData, setEvoData] = useState(null);
  const [destData, setDestData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [selectedSources, setSelectedSources] = useState(
    () => new Set(SOURCE_TYPE_META.map((s) => s.key)),
  );
  const [selectedTargets, setSelectedTargets] = useState(
    () => new Set(ALL_TARGET_KEYS),
  );

  const allSourcesOn = selectedSources.size === SOURCE_TYPE_META.length;
  const noneSources  = selectedSources.size === 0;

  const toggleAllSources = () => {
    setSelectedSources(allSourcesOn ? new Set() : new Set(SOURCE_TYPE_META.map((s) => s.key)));
  };

  const toggleSource = (key) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allTargetsOn = selectedTargets.size === ALL_TARGET_KEYS.length;
  const noneTargets  = selectedTargets.size === 0;

  const toggleAllTargets = () => {
    setSelectedTargets(allTargetsOn ? new Set() : new Set(ALL_TARGET_KEYS));
  };

  const toggleTargetGroup = (group) => {
    const keys = group.items.map((it) => it.key);
    const everyOn = keys.every((k) => selectedTargets.has(k));
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (everyOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const toggleTarget = (key) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Fetch real data
  const groupByPeriod = period === 'DAILY' ? 'day' : period === 'WEEKLY' ? 'week' : 'month';
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - (groupByPeriod === 'day' ? 2 : 20));
    return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
  }, [groupByPeriod]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [evo, dest, detail] = await Promise.all([
        api.post('/analytics/v1/traffic/sources/evolution', { ...dateRange, groupByPeriod, filters: { sourceTypes: ['direct','organic','referral','social'] } }),
        api.post('/analytics/v1/traffic/sources/destination', { ...dateRange }),
        api.post('/analytics/v1/traffic/sources/detail', { ...dateRange }),
      ]);
      setEvoData(evo);
      setDestData(dest);
      setDetailData(detail);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, groupByPeriod]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Transform evolution API data into the shape the chart expects
  const { dynamicMonths, sourceSeries } = useMemo(() => {
    if (!evoData?.results?.length) return { dynamicMonths: [], sourceSeries: [] };
    const firstResult = evoData.results[0];
    const months = firstResult.periods.map(p =>
      new Date(p.periodStartDate).toLocaleDateString('en-US', {
        month: groupByPeriod === 'day' ? 'short' : 'long',
        year: 'numeric',
        ...(groupByPeriod === 'day' && { day: 'numeric' })
      })
    );
    const series = evoData.results.map(r => {
      const meta = SOURCE_TYPE_META.find(m => m.key === r.name) || { key: r.name, label: r.name, color: '#888' };
      return { ...meta, values: r.periods.map(p => p.count) };
    });
    return { dynamicMonths: months, sourceSeries: series };
  }, [evoData, groupByPeriod]);

  const visibleSeries = useMemo(
    () => sourceSeries.filter((s) => selectedSources.has(s.key)),
    [selectedSources, sourceSeries],
  );

  return (
    <AnalyticsShell
      active="sources"
      breadcrumb={{ prefix: 'Traffic', title: 'Sources' }}
      toolbarExtras={
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          title={drawerOpen ? 'Hide filters' : 'Show filters'}
          aria-label={drawerOpen ? 'Hide filters' : 'Show filters'}
          aria-pressed={drawerOpen}
          style={{
            ...PS.toolbarIconBtn,
            background: drawerOpen ? '#eff6ff' : 'transparent',
            color: drawerOpen ? '#1d4ed8' : '#475569',
          }}
        >
          <IconFilters />
        </button>
      }
    >
      <div style={PS.layout}>
        <main style={{ ...PS.main, marginRight: drawerOpen ? '330px' : 0 }}>
          <nav style={PS.tabs} role="tablist" aria-label="Sources view">
            {TABS.map((t) => {
              const isActive = activeTab === t.key;
              const Icon = t.key === 'evolution' ? IconLineChartTab
                : t.key === 'destination' ? IconSankey
                : IconSunburst;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    ...PS.tab,
                    color: isActive ? '#1d4ed8' : '#475569',
                    borderBottomColor: isActive ? '#1d4ed8' : 'transparent',
                  }}
                >
                  <span style={PS.tabIcon} aria-hidden="true"><Icon /></span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {activeTab === 'evolution' && (
            <>
              <header style={PS.resultHead}>
                <span style={PS.headTagline}>
                  Evolution of user traffic from external sources.
                </span>
                <div style={PS.headControls}>
                  <div role="radiogroup" aria-label="Group by period" style={PS.switch}>
                    {PERIOD_OPTIONS.map((opt) => {
                      const active = period === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPeriod(opt.value)}
                          style={{
                            ...PS.switchOption,
                            background: active ? '#1d4ed8' : 'transparent',
                            color: active ? '#ffffff' : '#0f172a',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    style={PS.iconBtn}
                    title={stacked ? 'Switch to line graph' : 'Switch to stacked graph'}
                    aria-label={stacked ? 'Switch to line graph' : 'Switch to stacked graph'}
                    onClick={() => setStacked((v) => !v)}
                  >
                    {stacked ? <IconLine /> : <IconStacked />}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...PS.iconBtn,
                      background: logScale ? '#eff6ff' : 'transparent',
                      color: logScale ? '#1d4ed8' : '#475569',
                    }}
                    title={logScale ? 'Switch to linear scale' : 'Switch to logarithmic scale'}
                    aria-label={logScale ? 'Switch to linear scale' : 'Switch to logarithmic scale'}
                    aria-pressed={logScale}
                    onClick={() => setLogScale((v) => !v)}
                  >
                    <IconLog />
                  </button>
                  <button
                    type="button"
                    style={{ ...PS.iconBtn, color: '#1d4ed8' }}
                    title="Download as XLSX"
                    aria-label="Download as XLSX"
                  >
                    <IconDownload />
                  </button>
                </div>
              </header>

              <section style={PS.body}>
                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading…</div>
                ) : errorMsg ? (
                  <div style={{ padding: '40px', color: '#dc2626' }}>Error: {errorMsg}</div>
                ) : (
                  <div style={PS.chartCard}>
                    <SourcesChart
                      series={visibleSeries}
                      months={dynamicMonths}
                      stacked={stacked}
                      logScale={logScale}
                      empty={noneSources}
                    />
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'destination' && (
            <section style={PS.body}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading…</div>
              ) : !destData?.results?.length ? (
                <div style={{ padding: '40px', color: '#64748b' }}>No destination data available.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={TBL.table}>
                    <thead><tr>
                      <th style={TBL.th}>Source Type</th>
                      <th style={TBL.th}>Source</th>
                      <th style={TBL.th}>Target Page</th>
                      <th style={{...TBL.th, textAlign:'right'}}>Count</th>
                    </tr></thead>
                    <tbody>
                      {destData.results.slice(0, 50).map((r, i) => (
                        <tr key={i} style={i % 2 ? TBL.rowAlt : {}}>
                          <td style={TBL.td}>{r.type}</td>
                          <td style={{...TBL.td, maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.source}</td>
                          <td style={TBL.td}>{r.targetPageType}</td>
                          <td style={{...TBL.td, textAlign:'right', fontWeight:600}}>{r.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'details' && (
            <section style={PS.body}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading…</div>
              ) : !detailData?.results?.length ? (
                <div style={{ padding: '40px', color: '#64748b' }}>No detail data available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {detailData.results.map((cat) => (
                    <div key={cat.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: (SOURCE_TYPE_META.find(m=>m.key===cat.name)||{}).color || '#888' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', textTransform: 'capitalize' }}>{cat.name}</span>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>({(cat.value||0).toLocaleString()} visits)</span>
                      </div>
                      {cat.children?.length > 0 && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {cat.children.map((ch) => (
                            <li key={ch.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', padding: '3px 0' }}>
                              <span>{ch.name}</span>
                              <span style={{ fontWeight: 600 }}>{(ch.value||0).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        {drawerOpen && (
          <aside style={PS.drawer} aria-label="Filter sources">
            <header style={PS.drawerHead}>
              <h3 style={PS.drawerTitle}>Filter sources</h3>
              <button
                type="button"
                style={PS.drawerCloseBtn}
                onClick={() => setDrawerOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </header>

            <div style={PS.drawerBody}>
              <FieldSelect
                label="Interface language"
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
              />

              <FieldSelect
                label="Authentication status"
                value={authStatus}
                onChange={setAuthStatus}
                options={AUTH_OPTIONS}
              />

              <div style={PS.categoryTitleRow}>
                <span style={PS.categoryTitle}>Source types</span>
                <SourceTypesPopover />
              </div>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allSourcesOn}
                    indeterminate={!allSourcesOn && !noneSources}
                    onChange={toggleAllSources}
                  />
                  <span>Select all</span>
                </label>
              </div>

              <ul style={{ ...PS.list, paddingLeft: '28px' }}>
                {SOURCE_TYPE_META.map((s) => (
                  <li key={s.key}>
                    <label style={PS.checkRow}>
                      <Checkbox
                        checked={selectedSources.has(s.key)}
                        onChange={() => toggleSource(s.key)}
                      />
                      <span style={{ ...PS.colorDot, background: s.color }} aria-hidden="true" />
                      <span>{s.label}</span>
                    </label>
                  </li>
                ))}
              </ul>

              <div style={{ ...PS.categoryTitleRow, marginTop: '14px' }}>
                <span style={PS.categoryTitle}>Target pages</span>
              </div>

              <div style={PS.selectAllRow}>
                <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                  <Checkbox
                    checked={allTargetsOn}
                    indeterminate={!allTargetsOn && !noneTargets}
                    onChange={toggleAllTargets}
                  />
                  <span>Select all</span>
                </label>
              </div>

              {TARGET_GROUPS.map((group) => {
                const keys = group.items.map((it) => it.key);
                const onCount = keys.filter((k) => selectedTargets.has(k)).length;
                const groupChecked = onCount === keys.length;
                const groupIndeterminate = onCount > 0 && onCount < keys.length;
                return (
                  <div key={group.key} style={PS.categoryGroup}>
                    <div style={PS.categoryHeader}>
                      <label style={{ ...PS.checkRow, fontWeight: 600 }}>
                        <Checkbox
                          checked={groupChecked}
                          indeterminate={groupIndeterminate}
                          onChange={() => toggleTargetGroup(group)}
                        />
                        <span>{group.label}</span>
                      </label>
                    </div>
                    <ul style={PS.list}>
                      {group.items.map((it) => (
                        <li key={it.key}>
                          <label style={PS.checkRow}>
                            <Checkbox
                              checked={selectedTargets.has(it.key)}
                              onChange={() => toggleTarget(it.key)}
                            />
                            <span>
                              <span>{it.label}</span>
                              {it.suffix && <span style={PS.targetSuffix}>{it.suffix}</span>}
                            </span>
                          </label>
                          {it.url && <div style={PS.targetUrl}>{it.url}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <footer style={PS.drawerFoot}>
              <button type="button" style={PS.applyBtn}>Apply</button>
            </footer>
          </aside>
        )}
      </div>
    </AnalyticsShell>
  );
}

/* ---------------------------- Source types popover ---------------------------- */

function SourceTypesPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <span style={POP.wrap} ref={ref}>
      <button
        type="button"
        style={POP.btn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="What are the different source types?"
        aria-label="Open help: What are the different source types?"
      >
        <IconHelp />
      </button>

      {open && (
        <div role="dialog" style={POP.panel}>
          <div style={POP.head}>
            <span style={POP.title}>What are the different source types?</span>
            <button
              type="button"
              style={POP.close}
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="close info"
            >
              <IconClose />
            </button>
          </div>
          <ul style={POP.list}>
            {SOURCE_TYPE_META.map((s) => (
              <li key={s.key} style={POP.item}>
                <span style={{ ...POP.dot, background: s.color }} aria-hidden="true" />
                <span style={POP.itemLabel}>{s.label}:</span>
                <span style={POP.itemDesc}>{s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

/* ------------------------------ FieldSelect ------------------------------ */

function FieldSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div style={FS.field} ref={ref}>
      <label style={FS.label}>{label}</label>
      <button
        type="button"
        style={FS.input}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <span style={FS.caret}><IconChevron /></span>
      </button>
      {open && (
        <ul style={FS.menu} role="listbox">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  style={{
                    ...FS.option,
                    background: selected ? '#eff6ff' : 'transparent',
                    color: selected ? '#1d4ed8' : '#0f172a',
                    fontWeight: selected ? 600 : 500,
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ Checkbox ------------------------------ */

function Checkbox({ checked, indeterminate, onChange }) {
  const filled = checked || indeterminate;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
      style={{
        ...CK.box,
        background: filled ? '#1d4ed8' : '#ffffff',
        borderColor: filled ? '#1d4ed8' : '#94a3b8',
      }}
    >
      {indeterminate ? <span style={CK.dash} /> : checked ? <IconCheck /> : null}
    </span>
  );
}

/* ------------------------------ Chart ------------------------------ */

function SourcesChart({ series, months = [], stacked, logScale, empty }) {
  const width = 1100;
  const height = 360;
  const padL = 80;
  const padR = 24;
  const padT = 40;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yTicks = logScale ? Y_TICKS_LOG : Y_TICKS_LINEAR;

  const transform = (v) => (logScale ? Math.log10(Math.max(v, 1)) : v);

  const yMin = 0;
  const yMax = logScale
    ? Math.log10(yTicks[yTicks.length - 1])
    : yTicks[yTicks.length - 1];

  const N = months.length || 1;
  const xStep = N > 1 ? innerW / (N - 1) : innerW;
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => {
    const t = transform(v);
    if (yMax === yMin) return padT + innerH;
    const norm = (t - yMin) / (yMax - yMin);
    return padT + innerH - Math.max(0, Math.min(1, norm)) * innerH;
  };

  const stackedSeries = useMemo(() => {
    if (!stacked) return series;
    const running = months.map(() => 0);
    return series.map(({ label, color, key, values }) => {
      const stackedVals = values.map((v, i) => {
        running[i] += v;
        return running[i];
      });
      return { key, label, color, values: stackedVals };
    });
  }, [series, stacked]);

  // Show a subset of x labels to avoid overlap
  const labelCount = Math.max(1, Math.floor(innerW / 130));
  const labelStep = Math.max(1, Math.ceil(N / labelCount));
  const labelTickIdx = useMemo(() => {
    const idx = [];
    for (let i = 0; i < N; i += labelStep) idx.push(i);
    return idx;
  }, [N, labelStep]);

  const ongoingX = N > 1 ? xPos(N - 1) : padL + innerW;
  const lastTickX = N > 2 ? xPos(N - 2) : padL;

  const formatY = (v) => (v >= 1000 ? v.toLocaleString('en-US') : String(v));

  return (
    <div style={CS.wrap}>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          <text x={padL} y={padT - 18} fontSize="11" fill="#6E7079" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600">
            VISITS
          </text>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
              <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
                {formatY(t)}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6e7079" />
          <text x={padL + innerW + 6} y={padT + innerH + 3} fontSize="11" fill="#6E7079" fontFamily="Inter, sans-serif">
            DATE
          </text>

          {labelTickIdx.map((idx) => (
            <g key={idx}>
              <line x1={xPos(idx)} y1={padT + innerH} x2={xPos(idx)} y2={padT + innerH + 5} stroke="#6e7079" />
              <text x={xPos(idx)} y={padT + innerH + 18} fontSize="11" fill="#6e7079" textAnchor="middle" fontFamily="Inter, sans-serif">
                {months[idx]}
              </text>
            </g>
          ))}

          <rect x={lastTickX} y={padT - 10} width={ongoingX - lastTickX} height={innerH + 10} fill="rgba(33,150,243,0.06)" />
          <text x={(lastTickX + ongoingX) / 2} y={padT - 14} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Inter, sans-serif">
            Ongoing period
          </text>

          {!empty && stackedSeries.map(({ key, label, color, values }) => {
            const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            const isFlatZero = values.every((v) => v === 0);
            return (
              <g key={key} opacity={isFlatZero ? 0.55 : 1}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
                {values.map((v, i) => (
                  <circle
                    key={i}
                    cx={xPos(i)}
                    cy={yPos(v)}
                    r="3"
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth="1"
                    opacity={i === values.length - 1 ? 0.55 : 1}
                  >
                    <title>{`${label} — ${months[i] || ''}: ${v.toLocaleString('en-US')}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {empty && (
            <text x={padL + innerW / 2} y={padT + innerH / 2} fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="Inter, sans-serif">
              No source types selected
            </text>
          )}
        </svg>
      </div>

      <div style={CS.legend}>
        {series.map(({ key, label, color }) => (
          <span key={key} style={CS.legendItem}>
            <span style={{ ...CS.legendDot, background: color }} />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

const PS = {
  layout: {
    position: 'relative',
    display: 'flex',
    minHeight: 'calc(100vh - 60px - 56px)',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    transition: 'margin-right 200ms ease',
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 22px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'color 120ms ease, border-color 120ms ease',
  },
  tabIcon: { display: 'inline-flex' },

  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 22px',
    borderBottom: '1px solid #e5e7eb',
  },
  headTagline: { fontSize: '0.85rem', color: '#475569', flex: 1 },
  headControls: { display: 'inline-flex', alignItems: 'center', gap: '12px' },
  switch: {
    display: 'inline-flex',
    padding: '3px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#ffffff',
  },
  switchOption: {
    padding: '5px 14px',
    fontSize: '0.78rem',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
  },
  toolbarIconBtn: {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 18px',
  },

  placeholder: {
    margin: '40px 22px',
    padding: '40px',
    background: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    textAlign: 'center',
  },
  placeholderTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  placeholderText: { margin: '8px 0 0', color: '#475569', fontSize: '0.85rem' },

  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '330px',
    background: '#ffffff',
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-2px 0 8px rgba(15, 23, 42, 0.04)',
    zIndex: 5,
  },
  drawerHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
  },
  drawerTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  drawerCloseBtn: {
    width: '30px',
    height: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '14px 16px 18px' },

  categoryTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    margin: '14px 0 6px',
  },
  categoryTitle: { fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' },

  selectAllRow: {
    paddingBottom: '6px',
    marginBottom: '4px',
  },
  categoryGroup: { padding: '6px 0' },
  categoryHeader: { paddingBottom: '2px' },

  list: {
    listStyle: 'none',
    padding: '0 0 0 28px',
    margin: '4px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '5px 4px',
    fontSize: '0.83rem',
    color: '#1f2937',
    cursor: 'pointer',
    userSelect: 'none',
  },
  colorDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '2px',
    flexShrink: 0,
  },
  targetSuffix: { color: '#1f2937' },
  targetUrl: {
    fontSize: '0.72rem',
    color: '#64748b',
    paddingLeft: '32px',
    marginTop: '-2px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  drawerFoot: {
    borderTop: '1px solid #e5e7eb',
    padding: '12px 18px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  applyBtn: {
    padding: '8px 22px',
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const FS = {
  field: { position: 'relative', marginBottom: '14px' },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#0f172a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  caret: { color: '#64748b', display: 'inline-flex' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    margin: 0,
    padding: '4px',
    listStyle: 'none',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
    zIndex: 10,
    maxHeight: '220px',
    overflowY: 'auto',
  },
  option: {
    width: '100%',
    padding: '7px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const POP = {
  wrap: { position: 'relative', display: 'inline-flex' },
  btn: {
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: '320px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
    padding: '12px 14px',
    zIndex: 20,
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  close: {
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  item: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    fontSize: '0.78rem',
    color: '#1f2937',
    lineHeight: 1.45,
  },
  dot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
    marginRight: '2px',
    transform: 'translateY(2px)',
  },
  itemLabel: { fontWeight: 600, marginRight: '2px' },
  itemDesc: { color: '#334155' },
};

const CS = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  svgWrap: { width: '100%' },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 18px',
    marginTop: '6px',
    padding: '6px 4px 0',
    borderTop: '1px solid #f1f5f9',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.76rem',
    color: '#334155',
  },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
};

const CK = {
  box: {
    width: '18px',
    height: '18px',
    border: '2px solid #94a3b8',
    borderRadius: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  dash: {
    width: '10px',
    height: '2px',
    background: '#ffffff',
    borderRadius: '1px',
  },
};

const TBL = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#1f2937' },
  th: { textAlign: 'left', padding: '10px 14px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.3px' },
  td: { padding: '9px 14px', borderBottom: '1px solid #f1f5f9' },
  rowAlt: { background: '#f8fafc' },
};
