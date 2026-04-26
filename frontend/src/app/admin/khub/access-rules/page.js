'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ── Catalogue data ─────────────────────────────────────────────────────────
const METADATA_KEYS = [
  'audience', 'ft:sourceName', 'ft:filename', 'ft:publication_title',
  'ft:isAttachment', 'Name', 'category', 'Module',
];

const GROUPS = [
  'Public (built-in)',
  'Authenticated (built-in)',
  'Everyone',
  'DB_internal',
  'Indonesia',
  'partner',
  'whatsupcoming',
  'writers',
];

const KEY_VALUE_HINTS = {
  audience:               ['Public', 'darwinbox_internal', 'Indonesian', 'partner', 'whatsupcoming', 'writers'],
  'ft:sourceName':        ['Confluence', 'Paligo', 'UD'],
  'ft:filename':          ['Darwinbox Workflows Okta.pdf', 'Darwinbox_AI_Pack-en.pdf', 'Darwinbox AI Accelerator Pack.pdf'],
  'ft:publication_title': ['100 Features', 'Darwinbox AI Pack', 'Darwinbox AI Accelerator Pack'],
  'ft:isAttachment':      ['True', 'False'],
  Name:                   ['100 Features', 'Darwinbox AI Pack', 'Darwinbox-Workflows-Okta.pdf'],
};

const SAVED_DEFAULT = 'Authenticated';   // Public | Authenticated | None
const SAVED_TOPIC_MODE = 'document';     // document | topic

// One row per rule. `requirements: [{ key, op, values:[] }]`
const SAVED_RULES = [
  {
    id: 'default',
    name: 'Default rule',
    description: 'Applies to all content except those matching another rule.',
    isDefault: true,
    requirements: [],
    groups: ['Authenticated'],
    lastUpdate: { date: '01/23/2025', time: '12:25:39 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'public-audience',
    name: 'Public Audience',
    requirements: [{ key: 'audience', op: 'matches any', values: ['Public'], warning: true }],
    groups: ['Everyone'],
    lastUpdate: { date: '01/23/2025', time: '12:29:16 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'db-internal',
    name: 'DB Internal',
    requirements: [{ key: 'audience', op: 'matches any', values: ['darwinbox_internal'], warning: true }],
    groups: ['Authenticated'],
    lastUpdate: { date: '01/23/2025', time: '12:06:22 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'confluence',
    name: 'Confluence',
    requirements: [{ key: 'ft:sourceName', op: 'matches any', values: ['Confluence'] }],
    groups: ['Authenticated'],
    lastUpdate: { date: '01/23/2025', time: '12:07:29 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'okta',
    name: 'Okta',
    requirements: [{ key: 'ft:filename', op: 'matches any', values: ['Darwinbox Workflows Okta.pdf'] }],
    groups: ['Everyone'],
    lastUpdate: { date: '01/23/2025', time: '12:08:49 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'ai-pack-1',
    name: 'AI Pack',
    requirements: [{
      key: 'ft:publication_title', op: 'matches any',
      values: ['Darwinbox AI Pack', 'Darwinbox AI Accelerator Pack'],
    }],
    groups: ['Everyone'],
    lastUpdate: { date: '02/27/2026', time: '3:26:29 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'ai-pack-2',
    name: 'AI Pack',
    requirements: [{
      key: 'ft:filename', op: 'matches any',
      values: ['Darwinbox_AI_Pack-en.pdf', 'Darwinbox AI Accelerator Pack.pdf', 'AI Accelerator Pack + Knowledge Management Platform .pdf'],
    }],
    groups: ['Everyone'],
    lastUpdate: { date: '03/11/2026', time: '3:18:54 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'images-public',
    name: 'Images Public',
    requirements: [{ key: 'ft:isAttachment', op: 'matches any', values: ['True'], warning: true }],
    groups: ['Everyone'],
    lastUpdate: { date: '01/24/2025', time: '4:20:18 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
  {
    id: 'writers',
    name: 'Writers',
    requirements: [{ key: 'audience', op: 'matches any', values: ['writers'], warning: true }],
    groups: ['writers'],
    lastUpdate: { date: '11/18/2025', time: '4:35:13 PM' },
    author: { name: 'Prem GARUDADRI', email: 'prem.g@darwinbox.in' },
    active: true,
  },
];

const newId = () => `r${Math.random().toString(36).slice(2, 9)}`;

export default function AccessRulesPage() {
  const [rules,         setRules]         = useState(SAVED_RULES);
  const [defaultRule,   setDefaultRule]   = useState(SAVED_DEFAULT);
  const [topicMode,     setTopicMode]     = useState(SAVED_TOPIC_MODE);

  const [search,        setSearch]        = useState('');
  const [filterMeta,    setFilterMeta]    = useState('');
  const [filterValue,   setFilterValue]   = useState('');
  const [filterGroup,   setFilterGroup]   = useState('');

  const [topicDrawer,   setTopicDrawer]   = useState(false);
  const [defaultDrawer, setDefaultDrawer] = useState(false);
  const [editing,       setEditing]       = useState(null); // 'new' or rule object
  const [docPopover,    setDocPopover]    = useState(false);
  const [confirmApply,  setConfirmApply]  = useState(false);

  const dirty = useMemo(() => (
    JSON.stringify(rules)         !== JSON.stringify(SAVED_RULES)
    || defaultRule                !== SAVED_DEFAULT
    || topicMode                  !== SAVED_TOPIC_MODE
  ), [rules, defaultRule, topicMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (q) {
        const haystack = [
          r.name, ...(r.requirements?.map((x) => x.key) || []),
          ...(r.requirements?.flatMap((x) => x.values) || []),
          ...r.groups,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterMeta && !r.requirements?.some((x) => x.key === filterMeta)) return false;
      if (filterValue && !r.requirements?.some((x) => x.values.includes(filterValue))) return false;
      if (filterGroup && !r.groups.includes(filterGroup)) return false;
      return true;
    });
  }, [rules, search, filterMeta, filterValue, filterGroup]);

  const upsertRule = (draft) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === draft.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = draft; return c; }
      return [...prev, draft];
    });
    setEditing(null);
  };
  const deleteRule = (id) => setRules((prev) => prev.filter((r) => r.id !== id));

  return (
    <AdminShell active="khub-access" allowedRoles={['superadmin']}>
      <div style={S.page}>
        {/* Header */}
        <header style={S.headerRow}>
          <div style={{ flex: 1 }}>
            <h1 style={S.h1}>
              Access rules
              <button type="button" onClick={() => setDocPopover((v) => !v)} style={S.helpIcon} aria-label="See documentation">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
              {docPopover && (
                <div style={S.docPopover} onMouseLeave={() => setDocPopover(false)}>
                  <a href="https://doc.fluidtopics.com/access?ft:originId=access-rules-version-2&FT_Version=Latest" target="_blank" rel="noreferrer" style={S.docLink}>
                    See Access rules documentation
                  </a>
                </div>
              )}
            </h1>
            <p style={S.subtitle}>Allow user groups to access specific contents based on their metadata.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" style={S.linkBtnPink} onClick={() => setTopicDrawer(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
              </svg>
              Configure topic access
            </button>
            <button type="button" style={S.primaryBtn} onClick={() => setEditing('new')}>
              <PlusIcon /> New access rule
            </button>
          </div>
        </header>

        {/* Filters */}
        <div style={S.filterBar}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="search"
              placeholder="Search by name, metadata or group"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={S.searchInput}
            />
          </div>
          <Combo label="Filter by metadata" value={filterMeta}  options={METADATA_KEYS} onChange={setFilterMeta} />
          <Combo label="Filter by values"   value={filterValue} options={Object.values(KEY_VALUE_HINTS).flat()} onChange={setFilterValue} />
          <Combo label="Filter by groups"   value={filterGroup} options={GROUPS} onChange={setFilterGroup} />
        </div>

        <Notice variant="warning">There is currently no document with this metadata key or value.</Notice>

        {/* Table */}
        <div style={S.tableWrap}>
          <table style={S.table}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col />
              <col style={{ width: '160px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '60px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={S.th}>Rule name</th>
                <th style={S.th}>Metadata</th>
                <th style={S.th}>Authorized groups</th>
                <th style={S.th}>Last update</th>
                <th style={S.th}>Author</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Status</th>
                <th style={S.th} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={S.emptyCell}>No access rule matches the current filters.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>{r.description}</div>}
                  </td>
                  <td style={S.td}><MetadataChips reqs={r.requirements} /></td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {r.groups.map((g) => <Chip key={g}>{g}</Chip>)}
                    </div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{r.lastUpdate.date}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.lastUpdate.time}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{r.author.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.author.email}</div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <span style={S.statusChip}>
                      <span style={S.statusDot} />
                      Active
                    </span>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <IconBtn
                      title="Edit"
                      onClick={() => (r.isDefault ? setDefaultDrawer(true) : setEditing(r))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                      </svg>
                    </IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom action bar */}
        <footer style={S.footerBar}>
          <div style={{ flex: 1, fontSize: '0.78rem', color: '#475569' }}>
            <div>Last reprocess by Prem GARUDADRI</div>
            <div style={{ color: '#64748b' }}>03/11/2026 - 3:47 PM</div>
          </div>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => setConfirmApply(true)}
            style={{
              ...S.primaryBtn,
              opacity: dirty ? 1 : 0.5,
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            Apply and reprocess
          </button>
        </footer>
      </div>

      {/* ── Drawers ─────────────────────────────────────────────────────── */}
      <Drawer open={topicDrawer} title="Configure topic access" onClose={() => setTopicDrawer(false)}>
        <ConfigureTopicAccessForm
          value={topicMode}
          onSave={(v) => { setTopicMode(v); setTopicDrawer(false); }}
          onDiscard={() => setTopicDrawer(false)}
        />
      </Drawer>

      <Drawer open={defaultDrawer} title="Edit default access rule" onClose={() => setDefaultDrawer(false)}>
        <DefaultRuleForm
          value={defaultRule}
          onSave={(v) => { setDefaultRule(v); setDefaultDrawer(false); }}
          onDiscard={() => setDefaultDrawer(false)}
        />
      </Drawer>

      <Drawer
        open={!!editing}
        title={editing && editing !== 'new' ? `Edit access rule — ${editing.name}` : 'New access rule'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <RuleEditor
            existing={editing === 'new' ? null : editing}
            onSave={upsertRule}
            onDelete={(id) => { deleteRule(id); setEditing(null); }}
            onDiscard={() => setEditing(null)}
          />
        )}
      </Drawer>

      <ConfirmModal
        open={confirmApply}
        title="Apply and reprocess Access rules?"
        body={
          <>
            This new set of rules will replace the previous one.<br /><br />
            This activation will trigger a reprocess. It may take a while.
          </>
        }
        confirmLabel="Activate and reprocess"
        onCancel={() => setConfirmApply(false)}
        onConfirm={() => { setConfirmApply(false); alert('Reprocess scheduled.\n(Demo only)'); }}
      />
    </AdminShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Chip({ children, warning, color }) {
  const palette = warning
    ? { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }
    : color === 'magenta'
      ? { bg: '#fdf2f8', text: '#a21caf', border: '#f5d0fe' }
      : { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '999px',
      background: palette.bg, color: palette.text,
      border: `1px solid ${palette.border}`,
      fontSize: '0.74rem', fontWeight: 500,
      maxWidth: '320px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {warning && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
      {children}
    </span>
  );
}

function MetadataChips({ reqs }) {
  if (!reqs?.length) return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {reqs.map((req, i) => (
        <Chip key={i} warning={req.warning} title={`${req.key} = ${req.values.join(' OR ')}`}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, marginRight: '4px' }}>{req.key}</span>
          =
          <span style={{ marginLeft: '4px' }}>{req.values.join(' OR ')}</span>
        </Chip>
      ))}
    </div>
  );
}

function Combo({ label, value, options, onChange }) {
  const uniqueOptions = Array.from(new Set(options));
  return (
    <div style={{ position: 'relative', minWidth: '170px' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.comboSelect}
      >
        <option value="">{label}</option>
        {uniqueOptions.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={S.comboCaret} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

function Notice({ variant = 'info', children }) {
  const palette = variant === 'warning'
    ? { bg: '#fef3c7', border: '#fde68a', icon: '#b45309', text: '#78350f' }
    : { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e3a8a' };
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: '4px', padding: '10px 14px',
      color: palette.text, fontSize: '0.85rem', lineHeight: 1.45,
    }}>
      <span style={{ color: palette.icon, marginTop: '2px', display: 'inline-flex' }}>
        {variant === 'warning' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8"  x2="12.01" y2="8" />
          </svg>
        )}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function IconBtn({ title, danger, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} style={{
      background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer',
      color: danger ? '#b91c1c' : '#475569',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '4px',
    }}>
      {children}
    </button>
  );
}

function PlusIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Drawer wrapper ─────────────────────────────────────────────────────────
function Drawer({ open, title, onClose, wide, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="presentation" onClick={onClose} style={S.drawerScrim}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ ...S.drawer, width: wide ? 'min(560px, 100%)' : 'min(440px, 100%)' }}
      >
        <header style={S.drawerHeader}>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}><CrossIcon /></button>
          <h2 style={S.drawerTitle}>{title}</h2>
        </header>
        <div style={S.drawerBody}>{children}</div>
      </aside>
    </div>
  );
}

// ── Configure topic access form ────────────────────────────────────────────
function ConfigureTopicAccessForm({ value, onSave, onDiscard }) {
  const [mode, setMode] = useState(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <p style={S.formLead}>Choose how access rules apply to topics in a document.</p>
        <RadioOption
          checked={mode === 'document'}
          onChange={() => setMode('document')}
          title="Apply document access rights to topics (default)."
          subtitle="Users who can access a document can read all of its topics."
        />
        <RadioOption
          checked={mode === 'topic'}
          onChange={() => setMode('topic')}
          title="Allow topics to have their own access rights."
          subtitle="Users may see only the topics their groups are authorized to access depending on defined access rules."
        />
      </div>
      <DrawerFooter
        onDiscard={onDiscard}
        onSave={() => onSave(mode)}
        saveDisabled={mode === value}
      />
    </div>
  );
}

// ── Default rule form (Public / Authenticated / None) ──────────────────────
function DefaultRuleForm({ value, onSave, onDiscard }) {
  const [v, setV] = useState(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <p style={S.formLead}>Applies to all content except those matching another rule.</p>
        <RadioOption checked={v === 'Public'}        onChange={() => setV('Public')}        title="Public" />
        <RadioOption checked={v === 'Authenticated'} onChange={() => setV('Authenticated')} title="Authenticated" />
        <RadioOption checked={v === 'None'}          onChange={() => setV('None')}          title="None" />
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '24px' }}>
          <div style={{ fontWeight: 600 }}>Last update by Prem GARUDADRI</div>
          <div>01/23/2025 - 12:25 PM</div>
        </div>
      </div>
      <DrawerFooter
        onDiscard={onDiscard}
        onSave={() => onSave(v)}
        saveDisabled={v === value}
      />
    </div>
  );
}

// ── New / edit rule editor ─────────────────────────────────────────────────
const AUTH_MODES = [
  { id: 'everyone',      label: 'Available to everyone' },
  { id: 'authenticated', label: 'Restricted to authenticated users' },
  { id: 'groups',        label: 'Restricted to the following access groups' },
  { id: 'auto',          label: 'Automatically bind metadata values to user groups with matching names' },
];

function RuleEditor({ existing, onSave, onDelete, onDiscard }) {
  const initial = existing || {
    id: newId(),
    name: '',
    description: '',
    requirements: [{ key: '', op: 'matches any', values: [] }],
    groups: ['Everyone'],
    authMode: 'everyone',
    lastUpdate: { date: '04/26/2026', time: '8:30 PM' },
    author: { name: 'Super Admin', email: 'superadmin@local' },
    active: true,
  };
  const [draft, setDraft] = useState(() => ({
    ...initial,
    authMode: initial.authMode || guessAuthMode(initial.groups),
    conditionsMode: 'any',
  }));

  const updateReq = (idx, patch) => setDraft((d) => ({
    ...d,
    requirements: d.requirements.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
  }));
  const addReq    = () => setDraft((d) => ({ ...d, requirements: [...d.requirements, { key: '', op: 'matches any', values: [] }] }));
  const removeReq = (idx) => setDraft((d) => ({ ...d, requirements: d.requirements.filter((_, i) => i !== idx) }));

  const onSubmit = () => {
    const groups =
      draft.authMode === 'everyone'      ? ['Everyone'] :
      draft.authMode === 'authenticated' ? ['Authenticated'] :
      draft.groups.length ? draft.groups : ['Authenticated'];
    onSave({ ...draft, groups, name: draft.name.trim() || 'Untitled rule' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FloatingInput label="Rule name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
        <FloatingTextarea label="Rule description" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />

        <section>
          <h3 style={S.editorSection}>Authorized groups</h3>
          {AUTH_MODES.map((m) => (
            <RadioOption
              key={m.id}
              checked={draft.authMode === m.id}
              onChange={() => setDraft((d) => ({ ...d, authMode: m.id }))}
              title={m.label}
            />
          ))}
          {draft.authMode === 'auto' && (
            <div style={{ marginTop: '8px' }}>
              <Notice variant="info">Automatic user group binding is limited to one metadata key per rule.</Notice>
            </div>
          )}
          {draft.authMode === 'groups' && (
            <div style={{ marginTop: '12px' }}>
              <FloatingInput
                label="Access groups (comma separated)"
                value={(draft.groups || []).join(', ')}
                onChange={(v) => setDraft((d) => ({ ...d, groups: v.split(',').map((x) => x.trim()).filter(Boolean) }))}
              />
            </div>
          )}
        </section>

        <section>
          <h3 style={S.editorSection}>Metadata requirements</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}>
            <span>Conditions</span>
            <select
              value={draft.conditionsMode}
              onChange={(e) => setDraft((d) => ({ ...d, conditionsMode: e.target.value }))}
              style={S.miniSelect}
            >
              <option value="any">match any</option>
              <option value="all">match all</option>
            </select>
            <span>of below:</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {draft.requirements.map((req, idx) => (
              <div key={idx} style={S.reqRow}>
                <select
                  value={req.key}
                  onChange={(e) => updateReq(idx, { key: e.target.value })}
                  style={{ ...S.reqSelect, flex: '1 1 160px' }}
                >
                  <option value="">Metadata key</option>
                  {METADATA_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select
                  value={req.op}
                  onChange={(e) => updateReq(idx, { op: e.target.value })}
                  style={{ ...S.reqSelect, flex: '0 0 130px' }}
                >
                  <option value="matches any">contains any</option>
                  <option value="matches all">contains all</option>
                  <option value="equals">equals</option>
                </select>
                <input
                  type="text"
                  placeholder="Metadata values (comma separated)"
                  value={req.values.join(', ')}
                  onChange={(e) => updateReq(idx, { values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  style={{ ...S.reqInput, flex: '2 1 200px' }}
                />
                <IconBtn title="Remove" onClick={() => removeReq(idx)} danger>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                  </svg>
                </IconBtn>
              </div>
            ))}
          </div>

          <button type="button" onClick={addReq} style={S.requirementAdd}>
            <PlusIcon size={12} /> Add metadata requirement
          </button>
        </section>
      </div>

      <DrawerFooter
        onDiscard={onDiscard}
        onSave={onSubmit}
        onDelete={existing && !existing.isDefault ? () => onDelete(existing.id) : null}
      />
    </div>
  );
}

function guessAuthMode(groups) {
  if (!groups?.length) return 'everyone';
  if (groups[0] === 'Everyone')      return 'everyone';
  if (groups[0] === 'Authenticated') return 'authenticated';
  return 'groups';
}

// ── Drawer footer with Discard / Save buttons ──────────────────────────────
function DrawerFooter({ onDiscard, onSave, onDelete, saveDisabled }) {
  return (
    <div style={S.drawerFooter}>
      {onDelete && (
        <button type="button" onClick={onDelete} style={S.deleteBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
          </svg>
          Delete
        </button>
      )}
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onDiscard} style={S.linkBtn}>
        <CrossIcon /> Discard
      </button>
      <button
        type="button"
        disabled={saveDisabled}
        onClick={onSave}
        style={{
          ...S.primaryBtn,
          opacity: saveDisabled ? 0.5 : 1,
          cursor: saveDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        <CheckIcon /> Save
      </button>
    </div>
  );
}

// ── Radio option (used in drawers) ─────────────────────────────────────────
function RadioOption({ checked, onChange, title, subtitle }) {
  return (
    <label style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      padding: '8px 0', cursor: 'pointer',
    }}>
      <span style={{
        marginTop: '2px',
        width: '16px', height: '16px', borderRadius: '999px',
        border: '1.5px solid ' + (checked ? '#a21caf' : '#cbd5e1'),
        background: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && <span style={{
          width: '8px', height: '8px', borderRadius: '999px', background: '#a21caf',
        }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <div>
        <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
    </label>
  );
}

// ── Floating-label inputs (consistent with Pretty URL) ─────────────────────
function FloatingInput({ label, value, onChange, type = 'text' }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div style={{ position: 'relative', background: '#fff', borderRadius: '4px' }} onClick={() => inputRef.current?.focus()}>
      <fieldset aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
        borderRadius: '4px', margin: 0, padding: '0 8px',
        pointerEvents: 'none', textAlign: 'left', minWidth: 0,
      }}>
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: '11px', visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <input
        ref={inputRef} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          position: 'relative', width: '100%', padding: '12px',
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '0.9rem', color: '#0f172a',
          fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
        }}
      />
      {!isFloated && (
        <label style={{
          position: 'absolute', left: '12px', top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.9rem', color: '#94a3b8',
          pointerEvents: 'none', background: 'transparent',
        }}>{label}</label>
      )}
    </div>
  );
}

function FloatingTextarea({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div style={{ position: 'relative', background: '#fff', borderRadius: '4px' }} onClick={() => ref.current?.focus()}>
      <fieldset aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
        borderRadius: '4px', margin: 0, padding: '0 8px',
        pointerEvents: 'none', textAlign: 'left', minWidth: 0,
      }}>
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: '11px', visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <textarea
        ref={ref} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        rows={3}
        style={{
          position: 'relative', width: '100%', padding: '12px',
          background: 'transparent', border: 'none', outline: 'none', resize: 'vertical',
          fontSize: '0.9rem', color: '#0f172a', minHeight: '70px',
          fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
        }}
      />
      {!isFloated && (
        <label style={{
          position: 'absolute', left: '12px', top: '12px',
          fontSize: '0.9rem', color: '#94a3b8',
          pointerEvents: 'none', background: 'transparent',
        }}>{label}</label>
      )}
    </div>
  );
}

// ── Confirm modal ──────────────────────────────────────────────────────────
function ConfirmModal({ open, title, body, confirmLabel = 'Confirm', onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={S.modalDialog}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}><CrossIcon /></button>
        </header>
        <div style={S.modalBody}>{body}</div>
        <div style={S.modalFooter}>
          <button type="button" onClick={onCancel} style={S.linkBtn}>Cancel</button>
          <button type="button" onClick={onConfirm} style={S.primaryBtn}><CheckIcon /> {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px' },
  headerRow: { display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative' },
  h1: {
    fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0,
    display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative',
  },
  helpIcon: {
    background: 'transparent', border: 'none', padding: '2px',
    color: '#94a3b8', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
  },
  docPopover: {
    position: 'absolute', top: '100%', left: '24px', marginTop: '6px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    boxShadow: '0 8px 16px rgba(15,23,42,0.12)',
    padding: '10px 14px', zIndex: 5,
  },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569' },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  linkBtnPink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', padding: '8px 8px',
    color: '#a21caf', fontSize: '0.86rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'transparent', color: '#475569',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  filterBar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '12px 16px', flexWrap: 'wrap',
  },
  searchInput: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.88rem', color: '#0f172a',
    outline: 'none', boxSizing: 'border-box',
  },
  comboSelect: {
    width: '100%', padding: '8px 28px 8px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.85rem', color: '#0f172a',
    outline: 'none', appearance: 'none', cursor: 'pointer',
  },
  comboCaret: {
    position: 'absolute', right: '8px', top: '50%',
    transform: 'translateY(-50%)', color: '#94a3b8',
    pointerEvents: 'none', display: 'inline-flex',
  },
  tableWrap: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' },
  th: {
    textAlign: 'left', padding: '10px 14px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', color: '#0f172a', verticalAlign: 'middle' },
  emptyCell: { padding: '40px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' },
  statusChip: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '3px 10px', borderRadius: '999px',
    background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0',
    fontSize: '0.74rem', fontWeight: 600,
  },
  statusDot: {
    width: '7px', height: '7px', borderRadius: '999px', background: '#16a34a',
  },
  footerBar: {
    position: 'sticky', bottom: 0,
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '12px 16px', background: '#f8fafc',
    borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px',
  },

  drawerScrim: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(15,23,42,0.4)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    height: '100%', background: '#fff',
    boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-sans)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  drawerTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  drawerBody: {
    flex: 1, overflowY: 'auto',
    padding: '20px 22px',
    display: 'flex', flexDirection: 'column',
  },
  drawerFooter: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '14px 0 0', borderTop: '1px solid #e2e8f0', marginTop: '20px',
  },
  formLead: { margin: '0 0 16px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 },
  editorSection: { margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' },
  reqRow: {
    display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
  },
  reqSelect: {
    padding: '8px 28px 8px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.85rem', color: '#0f172a',
    outline: 'none', appearance: 'none', cursor: 'pointer',
  },
  reqInput: {
    padding: '8px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.85rem', color: '#0f172a',
    outline: 'none', boxSizing: 'border-box',
  },
  miniSelect: {
    padding: '4px 22px 4px 8px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.8rem', color: '#0f172a',
    outline: 'none', appearance: 'none',
  },
  requirementAdd: {
    background: 'transparent', border: 'none',
    color: '#a21caf', cursor: 'pointer',
    padding: '8px 0', marginTop: '4px',
    fontSize: '0.82rem', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: '4px',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: '#fff', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500,
  },

  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  modalDialog: {
    width: 'min(440px, 100%)', background: '#fff',
    borderRadius: '8px', boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
  },
  modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: '18px', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
  },
  docLink: { color: '#a21caf', fontWeight: 600, textDecoration: 'none', fontSize: '0.86rem' },
};
