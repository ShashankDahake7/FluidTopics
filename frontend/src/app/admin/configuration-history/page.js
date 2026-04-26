'use client';
import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

const CATEGORIES = [
  { value: '',                    label: 'All categories' },
  { value: 'rightRules',          label: 'Access rules' },
  { value: 'alerts',              label: 'Alerts' },
  { value: 'authentication',      label: 'Authentication' },
  { value: 'confidentiality',     label: 'Confidentiality' },
  { value: 'contentStyles',       label: 'Content styles' },
  { value: 'customJs',            label: 'Custom JavaScript' },
  { value: 'defaultRoles',        label: 'Default user roles' },
  { value: 'emails',              label: 'Email notifications' },
  { value: 'enrichAndClean',      label: 'Enrich and Clean' },
  { value: 'features',            label: 'Feature toggles' },
  { value: 'feedbackMails',       label: 'Feedback' },
  { value: 'portal',              label: 'General portal parameters' },
  { value: 'homePage',            label: 'Homepage' },
  { value: 'integration',         label: 'Integration security' },
  { value: 'languages',           label: 'Languages' },
  { value: 'legalTerms',          label: 'Legal terms' },
  { value: 'metadata',            label: 'Metadata configuration' },
  { value: 'metadataDescriptors', label: 'Metadata descriptors' },
  { value: 'openSearch',          label: 'OpenSearch' },
  { value: 'prettyUrl',           label: 'Pretty URL' },
  { value: 'pdfTemplate',         label: 'Print templates' },
  { value: 'rating',              label: 'Rating' },
  { value: 'readerPage',          label: 'Reader page' },
  { value: 'dynamicSuggestions',  label: 'Related links' },
  { value: 'searchPage',          label: 'Search' },
  { value: 'sources',             label: 'Sources' },
  { value: 'theme',               label: 'Theme' },
  { value: 'vocabularies',        label: 'Vocabularies' },
  { value: 'webSearchEngine',     label: 'Web search engines' },
];

// ── Sample configuration snapshots (used to drive the diff dialog) ────────
const ACCESS_RULES_V1 = {
  defaultRights: { accessLevel: 'AUTHENTICATED', groups: [] },
  rules: [
    {
      name: 'Public Audience', description: '',
      rule: {
        matchType: 'OR',
        rights: { accessLevel: 'PUBLIC', groups: [] },
        requirements: [{ key: 'audience', values: ['Public'], matchType: 'OR' }],
      },
    },
    {
      name: 'DB Internal', description: '',
      rule: {
        matchType: 'OR',
        rights: { accessLevel: 'AUTHENTICATED', groups: ['darwinbox'] },
        requirements: [{ key: 'audience', values: ['Internal'], matchType: 'OR' }],
      },
    },
    {
      name: 'AI Pack', description: '',
      rule: {
        matchType: 'OR',
        rights: { accessLevel: 'PUBLIC', groups: [] },
        requirements: [{
          key: 'ft:filename',
          values: ['Darwinbox AI Pack-en.pdf', 'Darwinbox AI Accelerator Pack.pdf'],
          matchType: 'OR',
        }],
      },
    },
    {
      name: 'Images Public', description: '',
      rule: {
        matchType: 'OR',
        rights: { accessLevel: 'PUBLIC', groups: [] },
        requirements: [{ key: 'ft:contentType', values: ['image'], matchType: 'OR' }],
      },
    },
  ],
};

const ACCESS_RULES_V2 = JSON.parse(JSON.stringify(ACCESS_RULES_V1));
ACCESS_RULES_V2.rules[2].rule.requirements[0].values = [
  'Darwinbox AI Pack-en.pdf',
  'AI Accelerator Pack + Knowledge Management Platform .pdf',
];

const ACCESS_RULES_V3 = JSON.parse(JSON.stringify(ACCESS_RULES_V2));
ACCESS_RULES_V3.rules[1].rule.rights.groups = ['darwinbox', 'darwinbox-india'];

const LANGUAGES_V1 = { defaultLanguage: 'en', languages: ['en', 'fr'] };
const LANGUAGES_V2 = { defaultLanguage: 'en', languages: ['en', 'fr', 'de'] };

const FEATURES_V1 = { ai_search: false, related_links: true, ratings: false };
const FEATURES_V2 = { ai_search: true,  related_links: true, ratings: true };

const VOCAB_V1 = { taxonomy: ['Product', 'Audience', 'Language'] };
const VOCAB_V2 = { taxonomy: ['Product', 'Audience', 'Language', 'Region'] };

const SEARCH_V1 = { defaultSorting: 'relevance', resultsPerPage: 10 };
const SEARCH_V2 = { defaultSorting: 'lastModification', resultsPerPage: 20 };

const SAMPLES = {
  'Access rules':     [ACCESS_RULES_V1, ACCESS_RULES_V2, ACCESS_RULES_V3],
  'Languages':        [LANGUAGES_V1, LANGUAGES_V2],
  'Vocabularies':     [VOCAB_V1, VOCAB_V2],
  'Feature toggles':  [FEATURES_V1, FEATURES_V2],
  'Search':           [SEARCH_V1, SEARCH_V2],
};

function snapshotFor(label, version /* 'before' | 'after' | 'current' */) {
  const arr = SAMPLES[label];
  if (!arr) return { _placeholder: `${label} configuration` };
  if (version === 'before')  return arr[0];
  if (version === 'after')   return arr[arr.length > 1 ? 1 : 0];
  if (version === 'current') return arr[arr.length - 1];
  return arr[0];
}

// ── Mirrors the timeline in the reference screenshot ──────────────────────
const HISTORY = [
  { date: '3/11/2026, 3:19 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Access rules'],            current: true },
  { date: '3/11/2026, 3:04 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Access rules'] },
  { date: '3/11/2026, 2:31 PM', author: 'System Maintenance Job <system-maintenance-job@fluidtopics.com>', categories: ['Access rules'] },
  { date: '2/27/2026, 3:26 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Access rules'] },
  { date: '2/27/2026, 3:20 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Access rules'] },
  { date: '2/27/2026, 3:10 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Access rules'] },
  { date: '2/27/2026, 3:10 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Languages', 'Vocabularies'] },
  { date: '1/28/2026, 3:09 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                            categories: ['Feature toggles', 'Languages'] },
  { date: '1/8/2026, 4:47 PM',  author: 'Pedro Salles <pedro-henrique.salles@fluidtopics.com>',            categories: ['Search', 'Feature toggles'] },
  { date: '11/18/2025, 4:35 PM', author: 'Prem GARUDADRI <prem.g@darwinbox.in>',                           categories: ['Access rules'] },
];

const PAGE_SIZE = 10;
const TOTAL_FAKE = 225;

export default function ConfigurationHistoryPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [diffOpen, setDiffOpen] = useState(null); // { row, mode: 'changes' | 'compare' }

  const rows = useMemo(() => {
    if (!category) return HISTORY;
    const label = CATEGORIES.find((c) => c.value === category)?.label;
    if (!label) return HISTORY;
    return HISTORY.filter((r) => r.categories.includes(label));
  }, [category]);

  const totalPages = Math.max(1, Math.ceil((category ? rows.length : TOTAL_FAKE) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <AdminShell active="tenant-history" allowedRoles={['superadmin']}>
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={S.h1}>Configuration history</h1>
          <span style={S.alphaChip}>
            <FlaskIcon /> Alpha
          </span>
        </div>
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
            page={safePage}
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
              {pageRows.map((r, i) => (
                <tr key={`${r.date}-${i}`} style={S.tr}>
                  <td style={S.td}>
                    {r.date}
                    {r.current && <span style={S.currentChip}>Current</span>}
                  </td>
                  <td style={S.td}>{r.author}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {r.categories.map((c) => (
                        <span key={c} style={S.catChip}>{c}</span>
                      ))}
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
                    {!r.current && (
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
              {pageRows.length === 0 && (
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

  const subtitle = isCompare
    ? <>This screen compares the current configuration with the one applied by <strong>{author}</strong> on <strong>{row.date}</strong>.</>
    : <><strong>{author}</strong> applied the following changes on <strong>{row.date}</strong>.</>;

  // Build per-category diff data. For "Compare with current", left-hand
  // side is the row's snapshot, right-hand is the most recent (current).
  const sections = row.categories.map((label) => {
    const before = isCompare ? snapshotFor(label, 'after')   : snapshotFor(label, 'before');
    const after  = isCompare ? snapshotFor(label, 'current') : snapshotFor(label, 'after');
    return { label, before, after };
  });

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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffSection({ label, before, after, view, rightHeader }) {
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
              <DiffPanel title="Previous configuration" lines={beforeLines} sideMarker="left"  diff={inlineDiff} />
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
function FlaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M10 3v6L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '4px 0 18px' },

  alphaChip: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '2px 10px',
    background: '#e0f2fe', color: '#0369a1',
    border: '1px solid #bae6fd',
    borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: 600,
  },

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
