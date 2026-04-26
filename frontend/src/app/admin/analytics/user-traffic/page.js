'use client';
import { useMemo, useState } from 'react';
import AnalyticsShell from '@/components/admin/AnalyticsShell';

/* ------------------------------ Constants ------------------------------ */

const MONTHS = [
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025',   'February 2025', 'March 2025',    'April 2025',
  'May 2025',       'June 2025',     'July 2025',     'August 2025',
  'September 2025', 'October 2025',  'November 2025', 'December 2025',
  'January 2026',   'February 2026', 'March 2026',    'April 2026',
];

const MONTH_LABELS = [
  'September 2024', 'November 2024', 'January 2025', 'March 2025',
  'May 2025',       'July 2025',     'September 2025', 'November 2025',
  'January 2026',   'March 2026',
];

const SERIES_COLORS = {
  'Darwinbox_fluidtopics':       '#9D207B',
  'darwinbox-clients-sso-prod':  '#CFB017',
  'db_clients-qa':               '#361FAD',
  'dbox-qa-sso':                 '#45A191',
  'internal':                    '#BD0F49',
  'sso-clients-qa':              '#7A891A',
  'sso-stage-realm':             '#1980B2',
  'test-qa-dbox':                '#B4643C',
};

const SERIES_NAMES = Object.keys(SERIES_COLORS);

const ACTIVE_USERS = {
  'Darwinbox_fluidtopics':      [1334, 1437, 1513, 1437, 1617, 1608, 1607, 1664, 1825, 1727, 1905, 1667, 1744, 1745, 803,  624,  648,  734,  691,  642],
  'darwinbox-clients-sso-prod': [1364, 1379, 1500, 1852, 2075, 2169, 1990, 1996, 2014, 1945, 2103, 2099, 2141, 1992, 2079, 2016, 2064, 2007, 2300, 1965],
  'db_clients-qa':              [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'dbox-qa-sso':                [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'internal':                   [120, 112, 107, 124, 124, 99, 93, 81, 78, 64, 71, 61, 59, 49, 51, 42, 51, 41, 50, 38],
  'sso-clients-qa':             [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'sso-stage-realm':            [0, 0, 64, 111, 129, 118, 156, 158, 140, 146, 179, 156, 188, 163, 164, 137, 165, 167, 153, 152],
  'test-qa-dbox':               [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const TOTAL_USERS = {
  'Darwinbox_fluidtopics':      [243, 274, 289, 308, 307, 315, 323, 340, 351, 354, 396, 406, 421, 434, 548, 618, 681, 753, 797, 832],
  'darwinbox-clients-sso-prod': [909, 1135, 1381, 1761, 2241, 2656, 3023, 3398, 3670, 3956, 4291, 4632, 4986, 5256, 5644, 6024, 6436, 6829, 7306, 7719],
  'db_clients-qa':              [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  'dbox-qa-sso':                [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  'internal':                   [929, 916, 564, 550, 599, 500, 372, 354, 343, 334, 321, 291, 279, 267, 264, 268, 268, 258, 257, 258],
  'sso-clients-qa':             [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  'sso-stage-realm':            [0, 0, 60, 152, 230, 293, 386, 475, 533, 597, 692, 772, 852, 909, 968, 1049, 1127, 1205, 1271, 1343],
  'test-qa-dbox':               [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
};

const PERIOD_OPTIONS = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

/* ------------------------------ Icons ------------------------------ */

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

/* ------------------------------ Page ------------------------------ */

export default function UserTrafficPage() {
  const [period, setPeriod] = useState('MONTHLY');
  const [stacked, setStacked] = useState(false);

  return (
    <AnalyticsShell
      active="user-traffic"
      breadcrumb={{ prefix: 'Users', title: 'User traffic' }}
      feedbackSubject="Feedback about user traffic"
    >
      <main style={PS.main}>
        <header style={PS.resultHead}>
          <span style={PS.headTagline}>
            Data is based on the number of authenticated users who accessed the portal or a public API.
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
              style={{ ...PS.iconBtn, color: '#1d4ed8' }}
              title="Download as XLSX"
              aria-label="Download as XLSX"
            >
              <IconDownload />
            </button>
          </div>
        </header>

        <section style={PS.body}>
          <div style={PS.chartCard}>
            <LineChart
              title="Active users"
              series={ACTIVE_USERS}
              months={MONTHS}
              monthLabels={MONTH_LABELS}
              yTicks={[0, 500, 1000, 1500, 2000, 2500]}
              stacked={stacked}
            />
          </div>
          <div style={PS.chartCard}>
            <LineChart
              title="Total users"
              series={TOTAL_USERS}
              months={MONTHS}
              monthLabels={MONTH_LABELS}
              yTicks={[0, 2000, 4000, 6000, 8000, 10000]}
              stacked={stacked}
            />
          </div>
        </section>
      </main>
    </AnalyticsShell>
  );
}

/* ------------------------------ Chart ------------------------------ */

function LineChart({ title, series, months, monthLabels, yTicks, stacked }) {
  const width = 1200;
  const height = 280;
  const padL = 70;
  const padR = 24;
  const padT = 36;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yMax = yTicks[yTicks.length - 1];
  const xStep = innerW / (months.length - 1);
  const xPos = (i) => padL + i * xStep;
  const yPos = (v) => padT + innerH - (Math.min(v, yMax) / yMax) * innerH;

  const seriesEntries = useMemo(() => SERIES_NAMES.map((name) => ({
    name,
    color: SERIES_COLORS[name],
    values: series[name] || [],
  })), [series]);

  const stackedSeries = useMemo(() => {
    if (!stacked) return seriesEntries;
    const running = months.map(() => 0);
    return seriesEntries.map(({ name, color, values }) => {
      const stackedVals = values.map((v, i) => {
        running[i] += v;
        return running[i];
      });
      return { name, color, values: stackedVals };
    });
  }, [seriesEntries, stacked, months.length]);

  const labelTickIdx = useMemo(() => monthLabels.map((label) => months.indexOf(label)).filter((i) => i >= 0), [months, monthLabels]);

  const ongoingX = xPos(months.length - 1);
  const lastTickX = xPos(months.length - 2);

  return (
    <div style={CS.wrap}>
      <h3 style={CS.title}>{title}</h3>
      <div style={CS.svgWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yPos(t)} x2={padL + innerW} y2={yPos(t)} stroke="#e0e6f1" />
              <text x={padL - 8} y={yPos(t) + 3} fontSize="11" fill="#6e7079" textAnchor="end" fontFamily="Inter, sans-serif">
                {t.toLocaleString('en-US')}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#6e7079" />

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

          {stackedSeries.map(({ name, color, values }) => {
            const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            return (
              <g key={name}>
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="bevel" />
                {values.map((v, i) => (
                  <circle key={i} cx={xPos(i)} cy={yPos(v)} r="3.2" fill="#ffffff" stroke={color} strokeWidth="1" opacity={i === values.length - 1 ? 0.55 : 1} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={CS.legend}>
        {SERIES_NAMES.map((name) => (
          <span key={name} style={CS.legendItem}>
            <span style={{ ...CS.legendDot, background: SERIES_COLORS[name] }} />
            <span>{name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

const PS = {
  main: { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px - 56px)', background: '#ffffff' },
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
  body: { padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: '16px' },
  chartCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px 18px 18px',
  },
};

const CS = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  title: { margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#1f2937' },
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
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
};
