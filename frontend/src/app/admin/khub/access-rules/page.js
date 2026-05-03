'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS_PALETTE = {
  Active:    { bg: '#dcfce7', text: '#166534', border: '#bbf7d0', dot: '#16a34a' },
  Inactive:  { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  Processing:{ bg: '#dbeafe', text: '#1e3a8a', border: '#bfdbfe', dot: '#2563eb' },
  New:       { bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#d97706' },
  Modified:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#d97706' },
  Deleted:   { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', dot: '#dc2626' },
};

const AUTH_MODES = [
  { id: 'everyone',      label: 'Available to everyone' },
  { id: 'authenticated', label: 'Restricted to authenticated users' },
  { id: 'groups',        label: 'Restricted to the following access groups' },
  { id: 'auto',          label: 'Automatically bind metadata values to user groups with matching names' },
];

// ── Page ───────────────────────────────────────────────────────────────────
export default function AccessRulesPage() {
  const [loading,       setLoading]       = useState(true);
  const [config,        setConfig]        = useState(null);
  const [rules,         setRules]         = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [metadataKeys,  setMetadataKeys]  = useState([]);
  const [valueCache,    setValueCache]    = useState({});

  const [search,        setSearch]        = useState('');
  const [filterMeta,    setFilterMeta]    = useState('');
  const [filterGroup,   setFilterGroup]   = useState('');

  const [topicDrawer,   setTopicDrawer]   = useState(false);
  const [defaultDrawer, setDefaultDrawer] = useState(false);
  const [editing,       setEditing]       = useState(null); // 'new' | rule object
  const [confirmApply,  setConfirmApply]  = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [docPopover,    setDocPopover]    = useState(false);
  const [error,         setError]         = useState('');
  const [busy,          setBusy]          = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [snapshot, gs, keys] = await Promise.all([
        api.get('/admin/access-rules'),
        api.get('/admin/access-rules/groups').catch(() => ({ groups: [] })),
        api.get('/admin/access-rules/metadata-keys').catch(() => ({ keys: [] })),
      ]);
      setConfig(snapshot.config);
      setRules(snapshot.rules);
      setGroups(gs.groups || []);
      setMetadataKeys(keys.keys || []);
    } catch (e) {
      setError(e?.message || 'Failed to load access rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const loadValuesFor = useCallback(async (key) => {
    if (!key || valueCache[key]) return;
    try {
      const r = await api.get(`/admin/access-rules/metadata-values?key=${encodeURIComponent(key)}`);
      setValueCache((c) => ({ ...c, [key]: r.values || [] }));
    } catch { /* ignore */ }
  }, [valueCache]);

  const visibleRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules
      .filter((r) => {
        if (q) {
          const haystack = [
            r.name,
            ...(r.requirements?.map((x) => x.key) || []),
            ...(r.requirements?.flatMap((x) => x.values) || []),
            ...(r.groups?.map((g) => g.name || '') || []),
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filterMeta  && !r.requirements?.some((x) => x.key === filterMeta))    return false;
        if (filterGroup && !(r.groups || []).some((g) => g.name === filterGroup)) return false;
        return true;
      });
  }, [rules, search, filterMeta, filterGroup]);

  const isLegacy = config?.mode === 'legacy';
  const dirty    = useMemo(() => rules.some((r) =>
    ['New', 'Modified', 'Deleted', 'Inactive'].includes(r.status) || r.inactiveSet
  ), [rules]);

  // ── CRUD handlers ──────────────────────────────────────────────────────
  const onSaveRule = async (draft) => {
    setBusy(true); setError('');
    try {
      const body = {
        name:             draft.name,
        description:      draft.description,
        requirements:     draft.requirements,
        requirementsMode: draft.requirementsMode,
        authMode:         draft.authMode,
        autoBindKey:      draft.autoBindKey,
        groups:           draft.groups,
        targetTopics:     draft.targetTopics,
      };
      if (draft.id && draft.id !== 'new') {
        await api.put(`/admin/access-rules/rules/${draft.id}`, body);
      } else {
        await api.post('/admin/access-rules/rules', { ...body, draftSet: isLegacy });
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Save failed.');
    } finally { setBusy(false); }
  };

  const onDeleteRule = async (id) => {
    setBusy(true); setError('');
    try {
      await api.delete(`/admin/access-rules/rules/${id}`);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Delete failed.');
    } finally { setBusy(false); }
  };

  const onSaveDefault = async (value) => {
    setBusy(true); setError('');
    try {
      const patch = isLegacy ? { legacyDefaultGroup: value } : { defaultRule: value };
      await api.put('/admin/access-rules/config', patch);
      setDefaultDrawer(false);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Save failed.');
    } finally { setBusy(false); }
  };

  const onSaveTopicMode = async (mode) => {
    setBusy(true); setError('');
    try {
      await api.put('/admin/access-rules/config', { topicLevelEnabled: mode === 'topic' });
      setTopicDrawer(false);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Save failed.');
    } finally { setBusy(false); }
  };

  const onApply = async () => {
    setBusy(true); setError('');
    try {
      if (isLegacy) {
        await api.post('/admin/access-rules/activate-enhanced', {});
      } else {
        await api.post('/admin/access-rules/reprocess', {});
      }
      setConfirmApply(false);
      setConfirmActivate(false);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Reprocess failed.');
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <AdminShell
        active="khub-access"
        allowedRoles={['superadmin', 'admin']}
        allowedAdminRoles={['KHUB_ADMIN']}
        fullWidth
      >
        <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
      </AdminShell>
    );
  }

  const defaultLabel = isLegacy
    ? labelForDefault(config?.legacyDefaultGroup, groups, true)
    : labelForDefault(config?.defaultRule, groups, false);

  return (
    <AdminShell
      active="khub-access"
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['KHUB_ADMIN']}
      fullWidth
    >
      <div style={S.page}>
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
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    {isLegacy ? 'Legacy access rules' : 'Enhanced access rules'} are active.
                  </span>
                </div>
              )}
            </h1>
            <p style={S.subtitle}>Allow user groups to access specific contents based on their metadata.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isLegacy && (
              <button type="button" style={S.linkBtnPink} onClick={() => setTopicDrawer(true)}>
                <CogIcon /> Configure topic access
              </button>
            )}
            <button type="button" style={S.primaryBtn} onClick={() => setEditing('new')}>
              <PlusIcon /> New access rule
            </button>
          </div>
        </header>

        {isLegacy && (
          <Notice variant="warning">
            This portal is using the legacy access rules. Stage replacement rules below, then click <strong>Activate new set</strong>; once enhanced rules are active, all previous rules are deleted.
          </Notice>
        )}
        {error && <Notice variant="warning">{error}</Notice>}

        <div style={S.filterBar}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="search"
              placeholder="Search by name, metadata or group"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={S.searchInput}
            />
          </div>
          <Combo label="Filter by metadata" value={filterMeta}  options={metadataKeys} onChange={setFilterMeta} />
          <Combo label="Filter by groups"   value={filterGroup} options={groups.map((g) => g.name)} onChange={setFilterGroup} />
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 60 }} />
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
              <tr style={S.tr}>
                <td style={S.td}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Default rule</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                    Applies to all content except those matching another rule.
                  </div>
                </td>
                <td style={S.td}><span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span></td>
                <td style={S.td}><Chip>{defaultLabel}</Chip></td>
                <td style={S.td}>
                  <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{config?.lastReprocessAt ? new Date(config.lastReprocessAt).toLocaleDateString() : '—'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{config?.lastReprocessAt ? new Date(config.lastReprocessAt).toLocaleTimeString() : ''}</div>
                </td>
                <td style={S.td}>
                  <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{config?.lastReprocessBy || '—'}</div>
                </td>
                <td style={{ ...S.td, textAlign: 'center' }}><StatusChip status="Active" /></td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <IconBtn title="Edit default" onClick={() => setDefaultDrawer(true)}><PencilIcon /></IconBtn>
                </td>
              </tr>

              {visibleRules.length === 0 ? (
                <tr><td colSpan={7} style={S.emptyCell}>No access rule matches the current filters.</td></tr>
              ) : visibleRules.map((r) => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.name || 'Untitled rule'}</div>
                    {r.description && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{r.description}</div>}
                  </td>
                  <td style={S.td}><MetadataChips reqs={r.requirements} /></td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.authMode === 'everyone'      && <Chip>Everyone</Chip>}
                      {r.authMode === 'authenticated' && <Chip>Authenticated</Chip>}
                      {r.authMode === 'auto'          && <Chip color="magenta">auto-bind: {r.autoBindKey || '?'}</Chip>}
                      {r.authMode === 'groups'        && (r.groups || []).map((g) => <Chip key={g.id}>{g.name || g.id}</Chip>)}
                    </div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString() : ''}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{r.author?.name || '—'}</div>
                    {r.author?.email && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.author.email}</div>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}><StatusChip status={r.status} /></td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <IconBtn title="Edit" onClick={() => setEditing(r)}><PencilIcon /></IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer style={S.footerBar}>
          <div style={{ flex: 1, fontSize: '0.78rem', color: '#475569' }}>
            {config?.lastReprocessAt ? (
              <>
                <div>Last reprocess by {config.lastReprocessBy || '—'}</div>
                <div style={{ color: '#64748b' }}>{new Date(config.lastReprocessAt).toLocaleString()}</div>
              </>
            ) : (
              <div style={{ color: '#64748b' }}>No reprocess has run yet.</div>
            )}
          </div>
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => (isLegacy ? setConfirmActivate(true) : setConfirmApply(true))}
            style={{
              ...S.primaryBtn,
              opacity: dirty && !busy ? 1 : 0.5,
              cursor:  dirty && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {isLegacy ? 'Activate new set' : 'Apply and reprocess'}
          </button>
        </footer>
      </div>

      <Drawer open={topicDrawer} title="Configure topic access" onClose={() => setTopicDrawer(false)}>
        <ConfigureTopicAccessForm
          value={config?.topicLevelEnabled ? 'topic' : 'document'}
          onSave={onSaveTopicMode}
          onDiscard={() => setTopicDrawer(false)}
        />
      </Drawer>

      <Drawer open={defaultDrawer} title="Edit default access rule" onClose={() => setDefaultDrawer(false)}>
        <DefaultRuleForm
          value={isLegacy ? config?.legacyDefaultGroup : config?.defaultRule}
          legacy={isLegacy}
          groups={groups}
          onSave={onSaveDefault}
          onDiscard={() => setDefaultDrawer(false)}
        />
      </Drawer>

      <Drawer
        open={!!editing}
        title={editing && editing !== 'new' ? `Edit access rule — ${editing.name || 'Untitled rule'}` : 'New access rule'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <RuleEditor
            existing={editing === 'new' ? null : editing}
            metadataKeys={metadataKeys}
            valueCache={valueCache}
            onLoadValues={loadValuesFor}
            groups={groups}
            allowTopicLevel={!!config?.topicLevelEnabled}
            onSave={onSaveRule}
            onDelete={(id) => setConfirmDelete(editing === 'new' ? null : editing)}
            onDiscard={() => setEditing(null)}
            busy={busy}
          />
        )}
      </Drawer>

      <ConfirmModal
        open={confirmApply}
        title="Apply and reprocess Access rules?"
        body={<>Pending changes will be promoted to <strong>Active</strong> and deleted rules will be purged.<br /><br />Reprocessing blocks publishing. The larger the corpus, the longer it takes.</>}
        confirmLabel="Apply and reprocess"
        onCancel={() => setConfirmApply(false)}
        onConfirm={onApply}
        busy={busy}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete this access rule?"
        body={<>The rule will be marked as <strong>Deleted</strong> and removed permanently the next time you apply and reprocess.</>}
        confirmLabel="Delete rule"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const id = confirmDelete?.id;
          setConfirmDelete(null);
          if (id) await onDeleteRule(id);
        }}
        busy={busy}
      />

      <ConfirmModal
        open={confirmActivate}
        title="Activate enhanced access rules?"
        body={<>This new set of rules will replace the previous one. All legacy access rules will be deleted.<br /><br />Activating the enhanced Access rules is final.</>}
        confirmLabel="Activate and reprocess"
        onCancel={() => setConfirmActivate(false)}
        onConfirm={onApply}
        busy={busy}
      />
    </AdminShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function labelForDefault(value, groups, legacy) {
  if (!value) return legacy ? 'Public' : 'Public';
  if (value === 'public')        return 'Public';
  if (value === 'authenticated') return 'Authenticated';
  if (value === 'none')          return 'None';
  const g = groups.find((x) => x._id === value || x.id === value);
  return g ? g.name : value;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const p = STATUS_PALETTE[status] || STATUS_PALETTE.Inactive;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      background: p.bg, color: p.text, border: `1px solid ${p.border}`,
      fontSize: '0.74rem', fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: p.dot }} />
      {status}
    </span>
  );
}

function Chip({ children, warning, color }) {
  const palette = warning
    ? { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }
    : color === 'magenta'
      ? { bg: '#fdf2f8', text: '#a21caf', border: '#f5d0fe' }
      : { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      background: palette.bg, color: palette.text, border: `1px solid ${palette.border}`,
      fontSize: '0.74rem', fontWeight: 500, maxWidth: 320,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {children}
    </span>
  );
}

function MetadataChips({ reqs }) {
  if (!reqs?.length) return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {reqs.map((req, i) => (
        <Chip key={i} title={`${req.key} ${req.op} ${req.values.join(', ')}`}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, marginRight: 4 }}>{req.key}</span>
          =
          <span style={{ marginLeft: 4 }}>{req.values.join(req.op === 'all' ? ' AND ' : ' OR ')}</span>
        </Chip>
      ))}
    </div>
  );
}

function Combo({ label, value, options, onChange }) {
  const uniqueOptions = Array.from(new Set(options || []));
  return (
    <div style={{ position: 'relative', minWidth: 170 }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={S.comboSelect}>
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
      display: 'flex', gap: 10, alignItems: 'flex-start',
      background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 4,
      padding: '10px 14px', color: palette.text, fontSize: '0.85rem', lineHeight: 1.45,
    }}>
      <span style={{ color: palette.icon, marginTop: 2, display: 'inline-flex' }}>
        {variant === 'warning' ? <WarnIcon /> : <InfoIcon />}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function IconBtn({ title, danger, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} style={{
      background: 'transparent', border: 'none', padding: 6, cursor: 'pointer',
      color: danger ? '#b91c1c' : '#475569',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4,
    }}>{children}</button>
  );
}

function PlusIcon({ size = 14 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5"  y1="12" x2="19" y2="12" /></svg>); }
function CheckIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>); }
function CrossIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>); }
function PencilIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" /></svg>); }
function CogIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>); }
function WarnIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>); }
function InfoIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>); }
function TrashIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>); }

// ── Drawer ─────────────────────────────────────────────────────────────────
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
      <aside role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ ...S.drawer, width: wide ? 'min(560px, 100%)' : 'min(440px, 100%)' }}>
        <header style={S.drawerHeader}>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}><CrossIcon /></button>
          <h2 style={S.drawerTitle}>{title}</h2>
        </header>
        <div style={S.drawerBody}>{children}</div>
      </aside>
    </div>
  );
}

function ConfigureTopicAccessForm({ value, onSave, onDiscard }) {
  const [mode, setMode] = useState(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <p style={S.formLead}>Choose how access rules apply to topics in a document.</p>
        <RadioOption checked={mode === 'document'} onChange={() => setMode('document')}
          title="Apply document access rights to topics (default)."
          subtitle="Users who can access a document can read all of its topics." />
        <RadioOption checked={mode === 'topic'} onChange={() => setMode('topic')}
          title="Allow topics to have their own access rights."
          subtitle="Users may see only the topics their groups are authorized to access depending on defined access rules." />
      </div>
      <DrawerFooter onDiscard={onDiscard} onSave={() => onSave(mode)} saveDisabled={mode === value} />
    </div>
  );
}

function DefaultRuleForm({ value, legacy, groups, onSave, onDiscard }) {
  const [v, setV] = useState(value || (legacy ? 'public' : 'public'));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <p style={S.formLead}>Applies to all content except those matching another rule.</p>
        <RadioOption checked={v === 'public'}        onChange={() => setV('public')}        title="Public" />
        <RadioOption checked={v === 'authenticated'} onChange={() => setV('authenticated')} title="Authenticated" />
        {!legacy && (
          <RadioOption
            checked={v === 'none'}
            onChange={() => setV('none')}
            title="None"
            subtitle="No one can read documents, except ADMIN, KHUB_ADMIN, and CONTENT_PUBLISHER users."
          />
        )}
        {legacy && groups?.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 6 }}>Or pin access to a single group:</div>
            <select value={['public', 'authenticated', 'none'].includes(v) ? '' : v} onChange={(e) => setV(e.target.value)} style={S.miniSelect}>
              <option value="">— Select a group —</option>
              {groups.map((g) => <option key={g._id || g.id} value={g._id || g.id}>{g.name}</option>)}
            </select>
            {legacy && !['public', 'authenticated'].includes(v) && (
              <Notice variant="warning">Setting the default group to anything other than Public keeps bots from crawling the portal.</Notice>
            )}
          </div>
        )}
      </div>
      <DrawerFooter onDiscard={onDiscard} onSave={() => onSave(v)} saveDisabled={v === value} />
    </div>
  );
}

// ── Rule editor ────────────────────────────────────────────────────────────
function RuleEditor({ existing, metadataKeys, valueCache, onLoadValues, groups, allowTopicLevel, onSave, onDelete, onDiscard, busy }) {
  const initial = existing || {
    id:               'new',
    name:             '',
    description:      '',
    requirements:     [{ key: '', op: 'any', values: [] }],
    requirementsMode: 'any',
    authMode:         'everyone',
    autoBindKey:      '',
    groups:           [],
    targetTopics:     false,
  };

  const [draft, setDraft] = useState(() => ({
    ...initial,
    groups: (initial.groups || []).map((g) => g.id || g._id || g),
  }));

  useEffect(() => {
    draft.requirements?.forEach((r) => r.key && onLoadValues?.(r.key));
    if (draft.authMode === 'auto' && draft.autoBindKey) onLoadValues?.(draft.autoBindKey);
  }, [draft, onLoadValues]);

  const updateReq = (idx, patch) => setDraft((d) => ({
    ...d,
    requirements: d.requirements.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
  }));
  const addReq    = () => setDraft((d) => ({ ...d, requirements: [...d.requirements, { key: '', op: 'any', values: [] }] }));
  const removeReq = (idx) => setDraft((d) => ({ ...d, requirements: d.requirements.filter((_, i) => i !== idx) }));

  const toggleGroup = (gid) => setDraft((d) => ({
    ...d,
    groups: d.groups.includes(gid) ? d.groups.filter((x) => x !== gid) : [...d.groups, gid],
  }));

  const onSubmit = () => {
    onSave({
      ...draft,
      name: (draft.name || '').trim(),
      requirements: (draft.requirements || []).filter((r) => r.key && r.values.length),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FloatingInput label="Rule name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
        <FloatingTextarea label="Rule description" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />

        <section>
          <h3 style={S.editorSection}>Authorized groups</h3>
          {AUTH_MODES.map((m) => (
            <RadioOption key={m.id} checked={draft.authMode === m.id} onChange={() => setDraft((d) => ({ ...d, authMode: m.id }))} title={m.label} />
          ))}
          {draft.authMode === 'auto' && (
            <div style={{ marginTop: 8 }}>
              <Notice variant="info">Automatic user group binding uses one metadata key per rule. Group names must match metadata values.</Notice>
              <div style={{ marginTop: 10 }}>
                <label style={S.miniLabel}>Metadata key to bind</label>
                <select value={draft.autoBindKey} onChange={(e) => setDraft((d) => ({ ...d, autoBindKey: e.target.value }))} style={S.miniSelect}>
                  <option value="">— Select metadata key —</option>
                  {metadataKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
          )}
          {draft.authMode === 'groups' && (
            <div style={{ marginTop: 12 }}>
              <label style={S.miniLabel}>Pick groups</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {groups.length === 0 && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No groups defined. Create one from Manage Users.</span>}
                {groups.map((g) => {
                  const id = g._id || g.id;
                  const sel = draft.groups.includes(id);
                  return (
                    <button key={id} type="button" onClick={() => toggleGroup(id)}
                      style={{
                        padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer',
                        background: sel ? '#a21caf' : '#fff',
                        color:      sel ? '#fff' : '#0f172a',
                        border:    `1px solid ${sel ? '#a21caf' : '#cbd5e1'}`,
                      }}
                    >{g.name}</button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {allowTopicLevel && (
          <section>
            <h3 style={S.editorSection}>Topic-level rule</h3>
            <RadioOption
              checked={!draft.targetTopics}
              onChange={() => setDraft((d) => ({ ...d, targetTopics: false }))}
              title="Apply to documents matching the requirements (default)"
            />
            <RadioOption
              checked={!!draft.targetTopics}
              onChange={() => setDraft((d) => ({ ...d, targetTopics: true }))}
              title="Apply at the topic level"
              subtitle="Children topics inherit access rules from their parent unless defined otherwise."
            />
          </section>
        )}

        <section>
          <h3 style={S.editorSection}>Metadata requirements</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
            <span>Conditions</span>
            <select value={draft.requirementsMode} onChange={(e) => setDraft((d) => ({ ...d, requirementsMode: e.target.value }))} style={S.miniSelect}>
              <option value="any">match any</option>
              <option value="all">match all</option>
            </select>
            <span>of below:</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.requirements.map((req, idx) => (
              <div key={idx} style={S.reqRow}>
                <select value={req.key} onChange={(e) => { updateReq(idx, { key: e.target.value, values: [] }); onLoadValues?.(e.target.value); }} style={{ ...S.reqSelect, flex: '1 1 160px' }}>
                  <option value="">Metadata key</option>
                  {metadataKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select value={req.op} onChange={(e) => updateReq(idx, { op: e.target.value })} style={{ ...S.reqSelect, flex: '0 0 130px' }}>
                  <option value="any">contains any</option>
                  <option value="all">contains all</option>
                  <option value="equals">equals</option>
                </select>
                <select multiple value={req.values} onChange={(e) => updateReq(idx, { values: Array.from(e.target.selectedOptions, (o) => o.value) })}
                  style={{ ...S.reqInput, flex: '2 1 200px', minHeight: 60 }}>
                  {(valueCache[req.key] || []).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <IconBtn title="Remove" onClick={() => removeReq(idx)} danger><TrashIcon /></IconBtn>
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
        onDelete={existing ? () => onDelete(existing.id) : null}
        busy={busy}
      />
    </div>
  );
}

function DrawerFooter({ onDiscard, onSave, onDelete, saveDisabled, busy }) {
  return (
    <div style={S.drawerFooter}>
      {onDelete && (
        <button type="button" onClick={onDelete} style={S.deleteBtn}><TrashIcon /> Delete</button>
      )}
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onDiscard} style={S.linkBtn}><CrossIcon /> Discard</button>
      <button type="button" disabled={saveDisabled || busy} onClick={onSave}
        style={{ ...S.primaryBtn, opacity: saveDisabled || busy ? 0.5 : 1, cursor: saveDisabled || busy ? 'not-allowed' : 'pointer' }}
      >
        <CheckIcon /> {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function RadioOption({ checked, onChange, title, subtitle }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', cursor: 'pointer' }}>
      <span style={{
        marginTop: 2, width: 16, height: 16, borderRadius: 999,
        border: `1.5px solid ${checked ? '#a21caf' : '#cbd5e1'}`, background: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#a21caf' }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <div>
        <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
    </label>
  );
}

function FloatingInput({ label, value, onChange, type = 'text' }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div style={{ position: 'relative', background: '#fff', borderRadius: 4 }} onClick={() => inputRef.current?.focus()}>
      <fieldset aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
        borderRadius: 4, margin: 0, padding: '0 8px', pointerEvents: 'none', textAlign: 'left', minWidth: 0,
      }}>
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%', padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: 11, visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <input ref={inputRef} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          position: 'relative', width: '100%', padding: 12,
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '0.9rem', color: '#0f172a', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
        }} />
      {!isFloated && (
        <label style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8', pointerEvents: 'none' }}>{label}</label>
      )}
    </div>
  );
}

function FloatingTextarea({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div style={{ position: 'relative', background: '#fff', borderRadius: 4 }} onClick={() => ref.current?.focus()}>
      <fieldset aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
        borderRadius: 4, margin: 0, padding: '0 8px', pointerEvents: 'none', textAlign: 'left', minWidth: 0,
      }}>
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%', padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: 11, visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <textarea ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={3}
        style={{
          position: 'relative', width: '100%', padding: 12,
          background: 'transparent', border: 'none', outline: 'none', resize: 'vertical',
          fontSize: '0.9rem', color: '#0f172a', minHeight: 70,
          fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
        }} />
      {!isFloated && (
        <label style={{ position: 'absolute', left: 12, top: 12, fontSize: '0.9rem', color: '#94a3b8', pointerEvents: 'none' }}>{label}</label>
      )}
    </div>
  );
}

function ConfirmModal({ open, title, body, confirmLabel = 'Confirm', onCancel, onConfirm, busy }) {
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
          <button type="button" onClick={onConfirm} disabled={busy} style={{ ...S.primaryBtn, opacity: busy ? 0.5 : 1 }}>
            <CheckIcon /> {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 },
  headerRow: { display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' },
  helpIcon: { background: 'transparent', border: 'none', padding: 2, color: '#94a3b8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' },
  docPopover: { position: 'absolute', top: '100%', left: 24, marginTop: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, boxShadow: '0 8px 16px rgba(15,23,42,0.12)', padding: '10px 14px', zIndex: 5 },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#a21caf', color: '#fff', border: '1px solid #a21caf', borderRadius: 4, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600, fontFamily: 'var(--font-sans)' },
  linkBtnPink: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: '8px 8px', color: '#a21caf', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  linkBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'transparent', color: '#475569', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500, fontFamily: 'var(--font-sans)' },
  filterBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, padding: '12px 16px', flexWrap: 'wrap' },
  searchInput: { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' },
  comboSelect: { width: '100%', padding: '8px 28px 8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.85rem', color: '#0f172a', outline: 'none', appearance: 'none', cursor: 'pointer' },
  comboCaret: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'inline-flex' },
  tableWrap: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' },
  th: { textAlign: 'left', padding: '10px 14px', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0', background: '#fff', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', color: '#0f172a', verticalAlign: 'middle' },
  emptyCell: { padding: '40px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' },
  footerBar: { position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' },

  drawerScrim: { position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.4)', display: 'flex', justifyContent: 'flex-end' },
  drawer: { height: '100%', background: '#fff', boxShadow: '-12px 0 32px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' },
  drawerHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  drawerTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column' },
  drawerFooter: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 0', borderTop: '1px solid #e2e8f0', marginTop: 20 },
  formLead: { margin: '0 0 16px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 },
  editorSection: { margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' },
  reqRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reqSelect: { padding: '8px 28px 8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.85rem', color: '#0f172a', outline: 'none', appearance: 'none', cursor: 'pointer' },
  reqInput: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.85rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' },
  miniSelect: { padding: '4px 22px 4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', fontSize: '0.8rem', color: '#0f172a', outline: 'none', appearance: 'none' },
  miniLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: 4 },
  requirementAdd: { background: 'transparent', border: 'none', color: '#a21caf', cursor: 'pointer', padding: '8px 0', marginTop: 4, fontSize: '0.82rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 },
  deleteBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500 },

  modalOverlay: { position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalDialog: { width: 'min(440px, 100%)', background: '#fff', borderRadius: 8, boxShadow: '0 12px 32px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-sans)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' },
  modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  modalClose: { width: 30, height: 30, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 18, color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e2e8f0' },
};
