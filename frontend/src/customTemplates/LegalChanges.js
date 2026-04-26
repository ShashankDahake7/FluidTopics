'use client';
import { useTranslation } from '@/lib/i18n';

// Hard-coded sample data — mirrors the rows shown in the design mock.
// In production this would be fetched from a `/api/legal-changes` endpoint;
// kept inline here so the template renders immediately.
const ROWS = [
  {
    country: 'Philippines',
    legalInfo: 'SSS',
    module: 'Payroll',
    effective: '01-Jan-2025',
    release: '06-Jan-2025',
    status: 'Implemented',
    detailLabel: 'SSS Contribution Slab/Rate Change',
    detailHref: '#',
  },
  {
    country: 'India',
    legalInfo: 'Budget Changes FY 2025-2026',
    module: 'Payroll',
    effective: '01-April-2025',
    release: '07-April-2025',
    status: 'Implemented',
    detailLabel: 'Budget Changes FY 2025-26',
    detailHref: '#',
  },
  {
    country: 'India',
    legalInfo: 'Change in LWF slabs for Haryana',
    module: 'Payroll',
    effective: '01-Jan-2025',
    release: '25-March-2025',
    status: 'Implemented',
    detailLabel: 'Change in LWF slabs for Haryana',
    detailHref: '#',
  },
  {
    country: 'India',
    legalInfo: 'Income Tax 2025 Changes',
    module: 'Payroll',
    effective: '15-April-2026',
    release: '15-April-2026',
    status: 'Upcoming',
    detailLabel: 'Income Tax Act 2025 Changes',
    detailHref: '#',
  },
  {
    country: 'India',
    legalInfo: 'Labor Code Changes Highlights',
    module: 'Payroll',
    effective: '21-November-2025',
    release: '15-April-2026',
    status: 'Upcoming',
    detailLabel: 'Labor Code Changes Highlights 2025',
    detailHref: '#',
  },
];

const STATUS_STYLE = {
  Implemented: { background: '#ecfdf5', color: '#047857' },
  Upcoming: { background: '#fef3c7', color: '#92400e' },
  Pending: { background: '#eff6ff', color: '#1d4ed8' },
};

export default function LegalChanges() {
  const { t } = useTranslation();
  const statusLabel = (st) => st === 'Implemented' ? t('statusImplemented') : st === 'Upcoming' ? t('statusUpcoming') : st;
  return (
    <div style={s.page}>
      <h1 style={s.title}>{t('legalChanges')}</h1>
      <p style={s.lead}>{t('legalChangesLead')}</p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('country')}</th>
              <th style={s.th}>{t('legalInfo')}</th>
              <th style={s.th}>{t('moduleCol')}</th>
              <th style={s.th}>{t('lcEffective')}</th>
              <th style={s.th}>{t('plannedRelease')}</th>
              <th style={s.th}>{t('implementationStatus')}</th>
              <th style={s.th}>{t('moreDetails')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={i % 2 ? s.rowAlt : undefined}>
                <td style={s.td}>{r.country}</td>
                <td style={s.td}>{r.legalInfo}</td>
                <td style={s.td}>{r.module}</td>
                <td style={s.tdNum}>{r.effective}</td>
                <td style={s.tdNum}>{r.release}</td>
                <td style={s.td}>
                  <span style={{ ...s.statusPill, ...(STATUS_STYLE[r.status] || {}) }}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td style={s.td}>
                  <a href={r.detailHref} style={s.link}>{r.detailLabel}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 32px 80px',
    fontFamily: 'var(--font-sans)',
  },
  title: {
    fontSize: '1.6rem', fontWeight: 700,
    color: '#1d4ed8', margin: '0 0 14px',
    letterSpacing: '-0.01em',
  },
  lead: {
    fontSize: '0.95rem', color: '#1f2937',
    lineHeight: 1.7, margin: '0 0 24px',
  },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#ffffff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    background: '#FFFFFF',
    color: '#0f172a',
    fontWeight: 700,
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '0.85rem',
    verticalAlign: 'top',
  },
  td: {
    padding: '12px 14px',
    color: '#1f2937',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  tdNum: {
    padding: '12px 14px',
    color: '#1f2937',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  rowAlt: { background: '#fafbfc' },
  statusPill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  link: {
    color: '#1d4ed8',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
