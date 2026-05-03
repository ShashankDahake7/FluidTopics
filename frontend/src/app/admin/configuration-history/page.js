'use client';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// `value` must match `ConfigChange.category` strings written by `logConfigChange`
// (and future loggers). Slugs like `rightRules` never matched the DB — filters failed.
const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'Access rules', label: 'Access rules' },
  { value: 'Alerts', label: 'Alerts' },
  { value: 'Authentication', label: 'Authentication' },
  { value: 'Confidentiality', label: 'Confidentiality' },
  { value: 'Content Styles', label: 'Content Styles' },
  { value: 'Custom JavaScript', label: 'Custom JavaScript' },
  { value: 'Default user roles', label: 'Default user roles' },
  { value: 'Email notifications', label: 'Email notifications' },
  { value: 'Enrich and Clean', label: 'Enrich and Clean' },
  { value: 'Feedback', label: 'Feedback' },
  { value: 'General portal parameters', label: 'General portal parameters' },
  { value: 'Homepage', label: 'Homepage' },
  { value: 'Index metadata', label: 'Index metadata' },
  { value: 'Integration security', label: 'Integration security' },
  { value: 'Languages', label: 'Languages' },
  { value: 'Legal terms', label: 'Legal terms' },
  { value: 'Metadata configuration', label: 'Metadata configuration' },
  { value: 'Metadata descriptors', label: 'Metadata descriptors' },
  { value: 'OpenSearch', label: 'OpenSearch' },
  { value: 'Pretty URL', label: 'Pretty URL' },
  { value: 'Print templates', label: 'Print templates' },
  { value: 'Rating', label: 'Rating' },
  { value: 'Reader page', label: 'Reader page' },
  { value: 'Related links', label: 'Related links' },
  { value: 'Search page', label: 'Search page' },
  { value: 'Sources', label: 'Sources' },
  { value: 'Theme', label: 'Theme' },
  { value: 'Vocabularies', label: 'Vocabularies' },
  { value: 'Web search engines', label: 'Web search engines' },
];

const PAGE_SIZE = 10;

export default function ConfigurationHistoryPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [diffOpen, setDiffOpen] = useState(null); // { row, mode: 'changes' | 'compare' }
  const [history, setHistory] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(PAGE_SIZE));
    if (category) qs.set('category', category);
    api.get(`/config-history?${qs.toString()}`)
      .then((data) => {
        setHistory(Array.isArray(data.items) ? data.items : []);
        setTotalPages(Math.max(1, data.totalPages || 1));
        setPage(data.page || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, page]);

  return (
    <AdminShell active="tenant-history" allowedRoles={['superadmin', 'admin']} fullWidth>
      <div style={{ paddingBottom: '40px' }}>
        <h1 style={S.h1}>
          Configuration history{' '}
          <span style={S.alphaChip} title="Ongoing improvements">Alpha</span>
        </h1>
        <p style={S.subtitle}>Inspect portal configuration changes.</p>

        <div style={S.toolbar}>
          <div style={{ minWidth: '240px' }}>
            <Select
              label="Category"
              value={category}
              onChange={(v) => { setCategory(v); setPage(1); }}
              options={CATEGORIES}
            />
          </div>
          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onSet={(p) => setPage(p)}
          />
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '18%' }}>Date</th>
                <th style={{ ...S.th, width: '34%' }}>Author</th>
                <th style={{ ...S.th, width: '22%' }}>Categories</th>
                <th style={{ ...S.th, width: '26%', textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={r._id} style={S.tr}>
                  <td style={S.td}>
                    {new Date(r.createdAt).toLocaleString()}
                    {i === 0 && page === 1 && !category && <span style={S.currentChip}>Current</span>}
                  </td>
                  <td style={S.td}>{r.author} {r.authorEmail ? `<${r.authorEmail}>` : ''}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={S.catChip}>{r.category}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button
                      type="button"
                      style={S.linkBtn}
                      onClick={() => setDiffOpen({ row: r, mode: 'changes' })}
                    >
                      <ListIcon /> <span>Show changes</span>
                    </button>
                    {!(i === 0 && page === 1 && !category) && (
                      <button
                        type="button"
                        style={{ ...S.linkBtn, marginLeft: '8px' }}
                        onClick={() => setDiffOpen({ row: r, mode: 'compare' })}
                      >
                        <CompareIcon /> <span>Compare with current</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && history.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 12px', color: '#94a3b8' }}>
                    No configuration changes match the selected category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {diffOpen && (
        <DiffDialog
          row={diffOpen.row}
          mode={diffOpen.mode}
          onClose={() => setDiffOpen(null)}
        />
      )}
    </AdminShell>
  );
}

// ── Pager ─────────────────────────────────────────────────────────────────
function Pager({ page, totalPages, onPrev, onNext, onSet }) {
  return (
    <div style={S.pager}>
      <button type="button" onClick={onPrev} disabled={page <= 1} style={S.pagerArrow} aria-label="Previous page">
        <ChevronLeft />
      </button>
      <input
        type="number"
        value={page}
        min={1}
        max={totalPages}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onSet(Math.max(1, Math.min(totalPages, v)));
        }}
        style={S.pagerInput}
        aria-label="Current page"
      />
      <span style={S.pagerSep}>/&nbsp;{totalPages}</span>
      <button type="button" onClick={onNext} disabled={page >= totalPages} style={S.pagerArrow} aria-label="Next page">
        <ChevronRight />
      </button>
    </div>
  );
}

// ── Floating-label select ─────────────────────────────────────────────────
function Select({ label, value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  const isFloated = focused || !!value;
  return (
    <div style={{ position: 'relative', background: '#fff', borderRadius: '4px' }}>
      <fieldset
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
          borderRadius: '4px', margin: 0, padding: '0 8px',
          pointerEvents: 'none', textAlign: 'left', minWidth: 0,
        }}
      >
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem',
          color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: '11px', visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0,
        }}>{label}</legend>
      </fieldset>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'relative', width: '100%',
          padding: '12px 32px 12px 12px',
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '0.9rem', color: '#0f172a',
          fontFamily: 'var(--font-sans)',
          appearance: 'none', cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {options.map((o) => (
          <option key={`${o.value}-${o.label}`} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span style={{
        position: 'absolute', right: '10px', top: '50%',
        transform: 'translateY(-50%)', pointerEvents: 'none', color: '#475569',
      }}>
        <Caret />
      </span>
    </div>
  );
}

// ── Diff dialog ───────────────────────────────────────────────────────────
function DiffDialog({ row, mode, onClose }) {
  const author = row.author.match(/^[^<]+/)?.[0]?.trim() || row.author;
  const isCompare = mode === 'compare';
  const [view, setView] = useState('side'); // 'side' | 'inline'
  const [currentSnap, setCurrentSnap] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  useEffect(() => {
    if (!isCompare) {
      setCurrentSnap(null);
      return undefined;
    }
    let cancelled = false;
    setLoadingCurrent(true);
    const qs = new URLSearchParams({ category: row.category });
    api.get(`/config-history/current?${qs}`)
      .then((d) => {
        if (!cancelled) setCurrentSnap(d.snapshot ?? null);
      })
      .catch(() => {
        if (!cancelled) setCurrentSnap(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCurrent(false);
      });
    return () => { cancelled = true; };
  }, [isCompare, row.category]);

  const subtitle = isCompare
    ? <>This screen compares the configuration after <strong>{author}</strong>&apos;s save on <strong>{new Date(row.createdAt).toLocaleString()}</strong> with the <strong>current</strong> portal settings.</>
    : <><strong>{author}</strong> applied the following changes on <strong>{new Date(row.createdAt).toLocaleString()}</strong>.</>;

  const sections = useMemo(() => {
    if (!isCompare) {
      return [{ label: row.category, before: row.before, after: row.after }];
    }
    return [{
      label: row.category,
      before: row.after,
      after: currentSnap ?? row.after,
    }];
  }, [isCompare, row.category, row.before, row.after, currentSnap]);

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.diffModal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>Configuration changes</span>
          <button type="button" onClick={onClose} style={S.iconBtn} aria-label="Close" title="Close">
            <CrossIcon />
          </button>
        </div>

        <div style={S.diffBody}>
          <p style={S.diffSubtitle}>{subtitle}</p>
          {isCompare && loadingCurrent && (
            <p style={{ ...S.diffSubtitle, marginTop: 0 }}>Loading current configuration…</p>
          )}

          <Tabs
            options={[
              { value: 'side',   label: 'SIDE-BY-SIDE' },
              { value: 'inline', label: 'INLINE' },
            ]}
            value={view}
            onChange={setView}
          />

          <div style={{ marginTop: '14px' }}>
            {sections.map((s) => (
              <DiffSection
                key={s.label}
                label={s.label}
                before={s.before}
                after={s.after}
                view={view}
                rightHeader={isCompare ? 'Current configuration' : 'Applied changes'}
                leftHeader={isCompare ? 'Configuration after selected save' : 'Previous configuration'}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffSection({ label, before, after, view, rightHeader, leftHeader = 'Previous configuration' }) {
  const [open, setOpen] = useState(true);
  const beforeLines = useMemo(() => JSON.stringify(before, null, 4).split('\n'), [before]);
  const afterLines  = useMemo(() => JSON.stringify(after,  null, 4).split('\n'), [after]);
  const inlineDiff  = useMemo(() => diffLines(beforeLines, afterLines), [beforeLines, afterLines]);

  return (
    <div style={S.diffSection}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={S.diffSectionHead}>
        <span style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms', display: 'inline-flex' }}>
          <Caret />
        </span>
        <span style={{ marginLeft: '8px', color: '#0f172a', fontWeight: 600 }}>{label}</span>
      </button>
      {open && (view === 'side'
        ? (
            <div style={S.sbsGrid}>
              <DiffPanel title={leftHeader} lines={beforeLines} sideMarker="left"  diff={inlineDiff} />
              <DiffPanel title={rightHeader}            lines={afterLines}  sideMarker="right" diff={inlineDiff} />
            </div>
          )
        : <InlinePanel diff={inlineDiff} />
      )}
    </div>
  );
}

// Side-by-side panel: shows highlighted lines (red on the "before" panel,
// green on the "after" panel). We walk the unified diff so the alignment
// matches between left and right.
function DiffPanel({ title, sideMarker, diff }) {
  const rows = [];
  let i = 1;
  for (const op of diff) {
    if (op.type === ' ') {
      rows.push({ no: i++, text: op.text, kind: 'eq' });
    } else if (op.type === '-') {
      if (sideMarker === 'left') rows.push({ no: i++, text: op.text, kind: 'del' });
      else                       rows.push({ no: '',   text: '',      kind: 'pad' });
    } else if (op.type === '+') {
      if (sideMarker === 'right') rows.push({ no: i++, text: op.text, kind: 'add' });
      else                        rows.push({ no: '',   text: '',      kind: 'pad' });
    }
  }
  return (
    <div style={S.diffPanel}>
      <div style={S.diffPanelHead}>{title}</div>
      <div style={S.diffPanelBody}>
        <pre style={S.codePre}>
          {rows.map((r, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr',
                background: r.kind === 'del' ? '#fee2e2'
                          : r.kind === 'add' ? '#dcfce7'
                          : 'transparent',
              }}
            >
              <span style={S.gutter}>{r.no}</span>
              <span style={{ whiteSpace: 'pre' }}>{r.text}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function InlinePanel({ diff }) {
  return (
    <div style={S.diffPanel}>
      <div style={S.diffPanelBody}>
        <pre style={S.codePre}>
          {diff.map((op, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 1fr',
                background: op.type === '-' ? '#fee2e2'
                          : op.type === '+' ? '#dcfce7'
                          : 'transparent',
                color: op.type === '-' ? '#991b1b'
                     : op.type === '+' ? '#166534'
                     : '#0f172a',
              }}
            >
              <span style={{ ...S.gutter, color: op.type === '-' ? '#dc2626' : op.type === '+' ? '#15803d' : '#94a3b8' }}>
                {op.type === ' ' ? '' : op.type}
              </span>
              <span style={{ whiteSpace: 'pre' }}>{op.text}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// LCS-based unified diff for two arrays of lines.
function diffLines(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: ' ', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: '-', text: a[i] }); i++; }
    else { out.push({ type: '+', text: b[j] }); j++; }
  }
  while (i < m) out.push({ type: '-', text: a[i++] });
  while (j < n) out.push({ type: '+', text: b[j++] });
  return out;
}

// ── Tabs (segmented pill, like the FT toggle) ─────────────────────────────
function Tabs({ options, value, onChange }) {
  return (
    <div style={S.tabs}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1px solid ' + (active ? '#a21caf' : '#cbd5e1'),
              background: active ? '#fdf4ff' : '#fff',
              color: active ? '#a21caf' : '#475569',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function Caret() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4l-5 5 5 5" />
      <path d="M15 20l5-5-5-5" />
      <path d="M4 9h16" />
      <path d="M20 15H4" />
    </svg>
  );
}


// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  alphaChip: {
    display: 'inline-block',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    padding: '2px 8px',
    verticalAlign: 'middle',
  },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '4px 0 18px' },

  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
    flexWrap: 'wrap',
  },

  pager: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#475569',
    fontSize: '0.86rem',
  },
  pagerArrow: {
    width: '28px', height: '28px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  pagerInput: {
    width: '52px',
    padding: '4px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '0.86rem',
    color: '#0f172a',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  pagerSep: { padding: '0 4px' },

  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', color: '#0f172a' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },

  catChip: {
    display: 'inline-block',
    padding: '2px 8px',
    border: '1px solid #cbd5e1',
    color: '#334155',
    background: '#f1f5f9',
    borderRadius: '4px',
    fontSize: '0.78rem',
  },

  currentChip: {
    display: 'inline-block',
    marginLeft: '10px',
    padding: '0 8px',
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    fontSize: '0.74rem',
    lineHeight: '20px',
  },

  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent',
    color: '#a21caf',
    border: 'none', cursor: 'pointer',
    fontSize: '0.84rem',
    padding: '4px 6px',
    borderRadius: '4px',
    fontFamily: 'var(--font-sans)',
  },

  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px',
    background: 'transparent', color: '#475569',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  },

  modalBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  diffModal: {
    background: '#fff', borderRadius: '8px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    width: 'min(960px, 96vw)', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
  },
  modalHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
  },

  diffBody: { padding: '18px 20px 20px', overflowY: 'auto' },
  diffSubtitle: {
    margin: '0 0 14px',
    color: '#0f172a',
    fontSize: '0.95rem',
  },

  tabs: {
    display: 'inline-flex',
    gap: '6px',
    padding: '2px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: '999px',
  },

  diffSection: {
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '12px',
    background: '#fff',
  },
  diffSectionHead: {
    width: '100%',
    display: 'flex', alignItems: 'center',
    padding: '8px 10px',
    background: '#f8fafc',
    border: 'none',
    borderBottom: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    color: '#0f172a',
  },

  sbsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '12px',
    background: '#fff',
  },
  diffPanel: { border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#fff' },
  diffPanelHead: {
    padding: '6px 10px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '0.78rem',
    color: '#475569',
    fontWeight: 600,
  },
  diffPanelBody: {
    maxHeight: '46vh',
    overflow: 'auto',
  },
  codePre: {
    margin: 0,
    padding: 0,
    fontFamily: 'var(--font-mono, ui-monospace, "SFMono-Regular", Menlo, monospace)',
    fontSize: '0.78rem',
    lineHeight: '1.55',
    color: '#0f172a',
    minWidth: 'max-content',
  },
  gutter: {
    textAlign: 'right',
    paddingRight: '8px',
    color: '#94a3b8',
    userSelect: 'none',
    background: 'transparent',
  },
};
