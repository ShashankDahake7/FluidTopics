'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api, { API_BASE, getStoredUser, getStoredToken, syncCurrentUserFromServer } from '@/lib/api';
import AdminShell from '@/components/admin/AdminShell';

// ---------------------------------------------------------------------------
// Static fallbacks — superseded by /api/admin/users-vocabulary on mount.
// ---------------------------------------------------------------------------
const DEFAULT_ASSIGNABLE_TIERS = ['viewer', 'editor', 'admin'];

const ORIGINS = {
  auto:    { color: '#22c55e', label: 'authentication provider' }, // green
  manual:  { color: '#3b82f6', label: 'manually added' },          // blue
  default: { color: '#ef4444', label: 'default' },                  // red
};

const ORIGIN_QUERY_VALUES = {
  'authentication provider': 'auto',
  'manually added':          'manual',
  'default':                 'default',
};

function originLabel(origin) {
  return ORIGINS[origin]?.label || ORIGINS.manual.label;
}

const REALM_LABELS = { internal: 'Internal', sso: 'SSO', ldap: 'LDAP', oidc: 'OIDC' };

/** Manual grants on a user account — signed-in capabilities only (anonymous-session roles → Default roles). */
function accountAssignableFeatureRoles(vocab) {
  return (vocab?.featureRoles || []).filter((r) => !r.alias && r.bucket === 'authenticated');
}

function featureRoleMeta(vocab, id) {
  return (vocab?.featureRoles || []).find((r) => r.id === id);
}

/** Fluid Topics–style long descriptions for the Default roles chooser (fallback: vocabulary label). */
const DEFAULT_ROLE_LONG_LABEL = {
  PRINT_USER: 'Can use the print feature in the Reader page',
  RATING_USER: 'Can rate content',
  FEEDBACK_USER: 'Can send feedback',
  GENERATIVE_AI_USER: 'Can use AI features',
  GENERATIVE_AI_EXPORT_USER: 'Can use and export AI features',
  AI_USER: 'Can use AI features',
  AI_EXPORT_USER: 'Can use and export AI features',
  PERSONAL_BOOK_USER: 'Can create personal books',
  PERSONAL_BOOK_SHARE_USER: 'Can create and share personal books',
  HTML_EXPORT_USER: 'Can create personal books and download to HTML',
  PDF_EXPORT_USER: 'Can create personal books and download to PDF',
  SAVED_SEARCH_USER: 'Can save searches',
  COLLECTION_USER: 'Can create collections',
  OFFLINE_USER: 'Can use offline features',
  ANALYTICS_USER: 'Can see Analytics (excluding analytics related to individual user behavior)',
  BETA_USER: 'Can use beta features',
  DEBUG_USER: 'Can access debug tools',
};

function defaultRolesChooserLabel(roleId, vocabEntry) {
  return DEFAULT_ROLE_LONG_LABEL[roleId] || vocabEntry?.label || roleId;
}

function roleSelectionEqual(sel, snap) {
  if (!sel || !snap || sel.length !== snap.length) return false;
  const a = new Set(sel);
  return snap.every((id) => a.has(id));
}

const tierLabel = (tier) =>
  tier === 'superadmin' ? 'Super admin' : (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '');

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

// ---------------------------------------------------------------------------
// Origin dot (small coloured circle)
// ---------------------------------------------------------------------------
function OriginDot({ origin, title }) {
  const meta = ORIGINS[origin] || ORIGINS.manual;
  return <span title={title || meta.label} style={{ ...S.dot, background: meta.color }} />;
}

function ChipWithOrigin({ origin, children, color = '#0f172a', bg = '#f1f5f9' }) {
  return (
    <span style={{ ...S.chip, background: bg, color }}>
      <OriginDot origin={origin} />
      <span>{children}</span>
    </span>
  );
}

/** Fluid Topics–style access group pill (filled light blue / dot). */
function GroupPill({ origin, children }) {
  return (
    <span style={S.groupPillFt}>
      <OriginDot origin={origin} />
      <span>{children}</span>
    </span>
  );
}

/** Outlined role pill with origin dot (feature / tier / admin roles). */
function RolePill({ origin, children, variant = 'feature' }) {
  const st =
    variant === 'tier' ? S.tierPillFt
    : variant === 'admin' ? S.adminPillFt
    : S.rolePillFt;
  return (
    <span style={st}>
      <OriginDot origin={origin} />
      <span>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter — single-select “chosen” style (All X + list), like Fluid Topics admin
// ---------------------------------------------------------------------------
function SingleSelectFilter({ allLabel, options, value, onChange, formatOption }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const display =
    !value ? allLabel
    : formatOption ? formatOption(value)
    : value;
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '148px', maxWidth: '200px' }}>
      <button type="button" style={F.trigger} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span style={{ flex: 1, textAlign: 'left', color: value ? '#0f172a' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9, 12 15, 18 9" />
        </svg>
      </button>
      {open && (
        <div style={F.menu}>
          <button type="button" style={F.optionRow} onClick={() => { onChange(''); setOpen(false); }}>
            {allLabel}
          </button>
          {options.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#94a3b8' }}>No options</div>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              style={{ ...F.optionRow, fontWeight: value === opt ? 600 : 400 }}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {formatOption ? formatOption(opt) : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

function SortableTh({ label, columnId, activeColumn, dir, onSort }) {
  const isActive = activeColumn === columnId;
  return (
    <th
      style={S.th}
      aria-sort={isActive ? (dir === 'desc' ? 'descending' : 'ascending') : undefined}
    >
      <button
        type="button"
        style={S.sortBtn}
        onClick={() => onSort(columnId)}
      >
        <span>{label}</span>
        <span style={S.sortIcons} aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isActive && dir === 'asc' ? '#7c3aed' : '#cbd5e1'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8 9 12 5 16 9" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isActive && dir === 'desc' ? '#7c3aed' : '#cbd5e1'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 15 12 19 8 15" />
          </svg>
        </span>
      </button>
    </th>
  );
}

function Pager({ page, pageSize, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const windowStart = Math.max(1, Math.min(page - 4, totalPages - 9));
  const pages = [];
  for (let i = windowStart; i <= Math.min(windowStart + 9, totalPages); i += 1) pages.push(i);
  const go = (p) => onPage(Math.max(1, Math.min(p, totalPages)));
  return (
    <div style={S.pager}>
      <button type="button" style={S.pagerBtn} disabled={page <= 1} onClick={() => go(1)} aria-label="Go to first page">«</button>
      <button type="button" style={S.pagerBtn} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Go to previous page">‹</button>
      <div style={S.pagerPages}>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            style={{ ...S.pagerBtn, ...(p === page ? S.pagerBtnCurrent : null) }}
            onClick={() => go(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            disabled={p === page}
          >
            {p}
          </button>
        ))}
      </div>
      <button type="button" style={S.pagerBtn} disabled={page >= totalPages} onClick={() => go(page + 1)} aria-label="Go to next page">›</button>
      <button type="button" style={S.pagerBtn} disabled={page >= totalPages} onClick={() => go(totalPages)} aria-label="Go to last page">»</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-side drawer scaffold
// ---------------------------------------------------------------------------
function Drawer({
  open, onClose, title, footer, width = '520px', children,
  closeLeading = false, titleAs = 'h3', dialogLabel,
}) {
  if (!open) return null;
  const Heading = titleAs;
  const ariaLabel = dialogLabel || title;
  return (
    <div style={D.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{ ...D.panel, width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...D.header, ...(closeLeading ? D.headerLeading : {}) }}>
          {closeLeading && (
            <button type="button" style={D.closeLeading} onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          <Heading style={{ ...D.title, ...(closeLeading ? D.titleLeading : {}) }}>{title}</Heading>
          {!closeLeading && (
            <button type="button" style={D.close} onClick={onClose} aria-label="Close drawer">✕</button>
          )}
        </div>
        <div style={D.body}>{children}</div>
        {footer && <div style={{ ...D.footer, ...(closeLeading ? D.footerFlush : {}) }}>{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User detail / edit drawer
// ---------------------------------------------------------------------------
function UserDrawer({
  userId, vocab, actor, onClose, onSaved, onDeleted, allGroups, refreshAllGroups,
}) {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local working copy of mutable fields.
  const [draft, setDraft] = useState({
    name: '', email: '', tier: 'viewer', realm: 'internal',
    permissions: [],         // feature roles (manual)
    defaultPermissions: [], // permissionsDefault — editable copy for Save
    adminRoles:  [],
    groups:      [],         // ObjectIds (manual)
    tags:        [],
    locked:      false,
  });

  // Search-prefs state.
  const [adminPrefs, setAdminPrefs] = useState(null);
  const [userPrefs,  setUserPrefs]  = useState(null);

  // Load user
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    api.get(`/admin/users/${userId}`)
      .then((d) => {
        setUser(d.user);
        setDraft({
          name:        d.user.name || '',
          email:       d.user.email || '',
          tier:        d.user.role || 'viewer',
          realm:       d.user.realm || 'internal',
          permissions: d.user.permissionsManual || [],
          defaultPermissions: [...(d.user.permissionsDefault || [])],
          adminRoles:  d.user.adminRolesManual  || [],
          groups:      (d.user.groupsManual || []).map((g) => g._id || g),
          tags:        d.user.tagsManual || [],
          locked:      !!d.user.lockedManually,
        });
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
    api.get(`/admin/users/${userId}/search-preferences`)
      .then((d) => { setAdminPrefs(d.adminSet || {}); setUserPrefs(d.userSet || {}); })
      .catch(() => { setAdminPrefs(null); setUserPrefs(null); });
  }, [userId]);

  const togglePerm = (id) =>
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(id) ? d.permissions.filter((p) => p !== id) : [...d.permissions, id],
    }));

  /** Toggle signed-in feature role: manual first, then default copy, then grant manual; SSO-only cannot be cleared here. */
  const toggleFeatureRole = (id) => {
    setDraft((d) => {
      if (d.permissions.includes(id)) {
        return { ...d, permissions: d.permissions.filter((p) => p !== id) };
      }
      const defs = d.defaultPermissions || [];
      if (defs.includes(id)) {
        return { ...d, defaultPermissions: defs.filter((p) => p !== id) };
      }
      if (user && (user.permissionsAuto || []).includes(id)) {
        return d;
      }
      return { ...d, permissions: [...d.permissions, id] };
    });
  };
  /** Prefer clearing manual assignment; SSO-supplied roles cannot be removed here. */
  const toggleAdminRole = (id) => {
    setDraft((d) => {
      if (d.adminRoles.includes(id)) {
        return { ...d, adminRoles: d.adminRoles.filter((x) => x !== id) };
      }
      if (user && (user.adminRolesAuto || []).includes(id)) {
        return d;
      }
      return { ...d, adminRoles: [...d.adminRoles, id] };
    });
  };
  const toggleGroup = (id) =>
    setDraft((d) => ({
      ...d,
      groups: d.groups.includes(id) ? d.groups.filter((g) => g !== id) : [...d.groups, id],
    }));

  const [newTag, setNewTag] = useState('');
  const addTag = () => {
    const t = newTag.trim();
    if (!t || draft.tags.includes(t)) { setNewTag(''); return; }
    setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
    setNewTag('');
  };
  const removeTag = (t) => setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== t) }));

  const [newGroup, setNewGroup] = useState('');
  const createGroupAndAdd = async () => {
    const name = newGroup.trim();
    if (!name) return;
    try {
      const res = await api.post('/admin/groups', { name });
      const g = res.group || res;
      setDraft((d) => ({ ...d, groups: [...d.groups, g._id] }));
      await refreshAllGroups();
      setNewGroup('');
    } catch (e) { setError(e.message || 'Failed to create group'); }
  };

  const handleSave = async () => {
    if (!userId) return;
    setError('');
    setSaving(true);
    try {
      const payload = {
        name:        draft.name,
        email:       draft.email,
        role:        draft.tier,
        realm:       draft.realm,
        permissions: draft.permissions,
        permissionsDefault: draft.defaultPermissions,
        adminRoles:  draft.adminRoles,
        groups:      draft.groups,
        tags:        draft.tags,
        lockedManually: draft.locked,
      };
      const res = await api.patch(`/admin/users/${userId}`, payload);
      if (res?.user) {
        setUser(res.user);
        setDraft((prev) => ({
          ...prev,
          permissions:       res.user.permissionsManual || [],
          defaultPermissions: [...(res.user.permissionsDefault || [])],
          adminRoles:        res.user.adminRolesManual || [],
        }));
      }
      onSaved?.(res.user);
    } catch (e) {
      setError(e.message || 'Failed to save user');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!userId) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      onDeleted?.(userId);
    } catch (e) { setError(e.message || 'Failed to delete'); }
  };

  const handleSavePrefs = async () => {
    if (!userId || !adminPrefs) return;
    try {
      const res = await api.put(`/admin/users/${userId}/search-preferences`, adminPrefs);
      setAdminPrefs(res.adminSet || adminPrefs);
    } catch (e) { setError(e.message || 'Failed to save preferences'); }
  };

  // Per the BRD: send the user a 24-hour, single-use MFA reset link. We
  // refresh the user object so the drawer reflects the new pending state.
  const [resetMfaConfirm, setResetMfaConfirm] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaDevToken, setMfaDevToken] = useState('');
  const handleResetMfa = async () => {
    if (!userId) return;
    setMfaBusy(true);
    setMfaDevToken('');
    try {
      const res = await api.post(`/admin/auth/users/${userId}/reset-mfa`, {});
      if (res?.devToken) setMfaDevToken(res.devToken);
      const fresh = await api.get(`/admin/users/${userId}`);
      if (fresh?.user) onSaved?.(fresh.user);
      setResetMfaConfirm(false);
    } catch (e) { setError(e.message || 'Failed to reset MFA'); }
    finally { setMfaBusy(false); }
  };

  const assignableFeatureList = useMemo(() => accountAssignableFeatureRoles(vocab), [vocab]);
  const assignableFeatureIds = useMemo(
    () => new Set(assignableFeatureList.map((r) => r.id)),
    [assignableFeatureList],
  );
  const featureGroups = useMemo(() => {
    const buckets = {};
    assignableFeatureList.forEach((r) => {
      buckets[r.bucket] = buckets[r.bucket] || [];
      buckets[r.bucket].push(r);
    });
    return buckets;
  }, [assignableFeatureList]);

  const unauthManualPermissions = useMemo(
    () => (draft.permissions || []).filter((id) => {
      const r = featureRoleMeta(vocab, id);
      return r && r.bucket === 'unauthenticated';
    }),
    [draft.permissions, vocab],
  );

  /** Manual ∪ editable default ∪ SSO — drives checkbox checked state for signed-in feature roles. */
  const effectiveFeatureIds = useMemo(() => {
    const set = new Set();
    (draft.permissions || []).forEach((id) => set.add(id));
    (draft.defaultPermissions || []).forEach((id) => set.add(id));
    if (user) (user.permissionsAuto || []).forEach((id) => set.add(id));
    return set;
  }, [draft.permissions, draft.defaultPermissions, user]);

  const effectiveAdminRoleIds = useMemo(() => {
    const set = new Set();
    (draft.adminRoles || []).forEach((id) => set.add(id));
    if (user) (user.adminRolesAuto || []).forEach((id) => set.add(id));
    return set;
  }, [draft.adminRoles, user]);

  const inheritedAutoFeatureChips = useMemo(
    () => (user?.permissionsAuto || []).filter((p) => !assignableFeatureIds.has(p)),
    [user?.permissionsAuto, assignableFeatureIds],
  );
  /** Default-granted roles not in the signed-in checkbox grid (e.g. anonymous-bucket defaults). */
  const inheritedDefaultFeatureChips = useMemo(
    () => (draft.defaultPermissions || []).filter((p) => !assignableFeatureIds.has(p)),
    [draft.defaultPermissions, assignableFeatureIds],
  );

  const tiersForSelect = useMemo(() => {
    const list = actor?.role === 'superadmin'
      ? ['viewer', 'editor', 'admin', 'superadmin']
      : DEFAULT_ASSIGNABLE_TIERS;
    return [...new Set([...list, draft.tier].filter(Boolean))];
  }, [actor, draft.tier]);

  const featureCount = useMemo(
    () => assignableFeatureList.filter((r) => effectiveFeatureIds.has(r.id)).length,
    [assignableFeatureList, effectiveFeatureIds],
  );
  const featureMax = assignableFeatureList.length;
  const adminEffectiveCount = useMemo(
    () => (vocab?.administrativeRoles || []).filter((r) => effectiveAdminRoleIds.has(r.id)).length,
    [vocab?.administrativeRoles, effectiveAdminRoleIds],
  );
  const adminMax = (vocab?.administrativeRoles || []).length;

  if (loading || !user) {
    return (
      <Drawer open onClose={onClose} title="User details" width="600px">
        {error ? (
          <div style={{ padding: '24px' }}>
            <div style={modal.error}>{error}</div>
            <button type="button" style={{ ...modal.cancelBtn, marginTop: '12px' }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        )}
      </Drawer>
    );
  }

  const groupNameLookup = Object.fromEntries((allGroups || []).map((g) => [g._id, g.name]));

  return (
    <Drawer
      open
      onClose={onClose}
      title={user.name || user.email}
      width="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', width: '100%' }}>
          <button style={{ ...modal.cancelBtn, color: '#dc2626' }} onClick={() => setConfirmDelete(true)}>
            Delete user
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={modal.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={modal.saveBtn} disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      }
    >
      {error && <div style={modal.error}>{error}</div>}

      {/* Identity */}
      <Section title="Identity">
        <Field label="Name">
          <input style={modal.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input style={modal.input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Field label="Tier role">
            <select style={modal.select} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>
              {tiersForSelect.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
            </select>
          </Field>
          <Field label="Realm">
            <select style={modal.select} value={draft.realm} onChange={(e) => setDraft({ ...draft, realm: e.target.value })}>
              {(vocab?.realms || ['internal','sso','ldap','oidc']).map((r) => (
                <option key={r} value={r}>{REALM_LABELS[r] || r}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
          ID: <span style={{ fontFamily: 'monospace' }}>{user._id}</span>
        </div>
      </Section>

      {/* Status */}
      <Section title="Status">
        <div style={S.statusRow}>
          <div>
            <div style={{ fontWeight: 600, color: draft.locked ? '#dc2626' : '#16a34a' }}>
              {draft.locked ? 'Locked' : 'Active'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              {draft.locked
                ? 'The user cannot access any Fluid Topics service.'
                : 'The user can sign in and use the portal.'}
            </div>
          </div>
          <button
            type="button"
            style={{ ...S.toggle, background: draft.locked ? '#dc2626' : '#16a34a' }}
            onClick={() => setDraft({ ...draft, locked: !draft.locked })}
          >
            <span style={{ ...S.toggleKnob, left: draft.locked ? '24px' : '4px' }} />
          </button>
        </div>
      </Section>

      {/* Groups */}
      <Section title="Access groups" subtitle="Add a group manually or create a new one.">
        <div style={S.tagWrap}>
          {draft.groups.length === 0 && <span style={S.muted}>No groups</span>}
          {draft.groups.map((gid) => (
            <span key={gid} style={{ ...S.chip, background: '#dbeafe', color: '#1d4ed8' }}>
              <OriginDot origin="manual" />
              <span>{groupNameLookup[gid] || gid}</span>
              <button type="button" style={S.chipX} onClick={() => toggleGroup(gid)} aria-label="Remove group">×</button>
            </span>
          ))}
          {/* Auto-applied groups (from SSO) — read-only */}
          {(user.groupsAuto || []).map((g) => {
            const id = (g && g._id) || g;
            const name = (g && g.name) || groupNameLookup[id] || id;
            if (draft.groups.includes(id)) return null;
            return (
              <span key={`auto-${id}`} style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>
                <OriginDot origin="auto" />
                <span>{name}</span>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <select
            style={modal.select}
            value=""
            onChange={(e) => {
              if (e.target.value) toggleGroup(e.target.value);
              e.target.selectedIndex = 0;
            }}
          >
            <option value="">Add existing group…</option>
            {(allGroups || [])
              .filter((g) => !draft.groups.includes(g._id))
              .map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input style={modal.input} placeholder="Create new group…" value={newGroup}
                 onChange={(e) => setNewGroup(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && createGroupAndAdd()} />
          <button type="button" style={modal.cancelBtn} onClick={createGroupAndAdd}>Create &amp; Add</button>
        </div>
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <div style={S.tagWrap}>
          {draft.tags.length === 0 && <span style={S.muted}>No tags</span>}
          {draft.tags.map((t) => (
            <span key={t} style={{ ...S.chip, background: '#f1f5f9', color: '#475569' }}>
              <OriginDot origin="manual" />
              <span>{t}</span>
              <button type="button" style={S.chipX} onClick={() => removeTag(t)} aria-label="Remove tag">×</button>
            </span>
          ))}
          {(user.tagsAuto || []).filter((t) => !draft.tags.includes(t)).map((t) => (
            <span key={`auto-${t}`} style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>
              <OriginDot origin="auto" /><span>{t}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input style={modal.input} placeholder="Add tag…" value={newTag}
                 onChange={(e) => setNewTag(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && addTag()} />
          <button type="button" style={modal.cancelBtn} onClick={addTag}>Add</button>
        </div>
      </Section>

      {/* Feature roles — authenticated catalogue only; anonymous-session defaults live under Default roles */}
      <Section
        title="Feature roles"
        subtitle={`${featureCount} of ${featureMax} signed-in roles effective${unauthManualPermissions.length ? ` · ${unauthManualPermissions.length} anonymous-session (manual)` : ''}`}
      >
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
          Uncheck to remove a default grant for this user (saved with <strong>Save</strong>), or add roles manually. SSO-mapped roles stay until your IdP changes.
        </div>
        {Object.keys(featureGroups).map((bucket) => (
          <div key={bucket} style={{ marginBottom: '12px' }}>
            <div style={modal.permGroup}>{bucket} users</div>
            <div style={modal.permGrid}>
              {featureGroups[bucket].map((r) => (
                <label key={r.id} style={modal.permItem}>
                  <input
                    type="checkbox"
                    checked={effectiveFeatureIds.has(r.id)}
                    onChange={() => toggleFeatureRole(r.id)}
                    style={{ marginRight: '6px' }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {unauthManualPermissions.length > 0 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e5e7eb' }}>
            <div style={modal.permGroup}>Anonymous-session roles (manual)</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px' }}>
              Normally configured for anonymous users via Default roles. Remove if this assignment was unintended.
            </div>
            <div style={S.tagWrap}>
              {unauthManualPermissions.map((id) => {
                const label = featureRoleMeta(vocab, id)?.label || id;
                return (
                  <span key={id} style={{ ...S.chip, background: '#fef9c3', color: '#854d0e' }}>
                    <span>{label}</span>
                    <button type="button" style={S.chipX} onClick={() => togglePerm(id)} aria-label={`Remove ${label}`}>×</button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {/* Auto/default permissions not shown above (e.g. anonymous-bucket defaults) */}
        {(inheritedAutoFeatureChips.length > 0 || inheritedDefaultFeatureChips.length > 0) ? (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
            <div style={{ ...modal.permGroup, marginBottom: '6px' }}>Inherited (read-only)</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '6px' }}>
              Other inherited roles (signed-in roles also appear checked above).
            </div>
            <div style={S.tagWrap}>
              {inheritedAutoFeatureChips.map((p) => (
                <span key={`auto-${p}`} style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>
                  <OriginDot origin="auto" /><span>{p}</span>
                </span>
              ))}
              {inheritedDefaultFeatureChips.map((p) => (
                <span key={`def-${p}`} style={{ ...S.chip, background: '#fee2e2', color: '#991b1b' }}>
                  <OriginDot origin="default" /><span>{p}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* Admin roles */}
      <Section title="Administrative roles" subtitle={`${adminEffectiveCount} of ${adminMax} effective`}>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
          Toggle manual assignments here. Roles still supplied by SSO remain until updated in your identity provider.
        </div>
        <div style={modal.permGrid}>
          {(vocab?.administrativeRoles || []).map((r) => (
            <label key={r.id} style={modal.permItem}>
              <input
                type="checkbox"
                checked={effectiveAdminRoleIds.has(r.id)}
                onChange={() => toggleAdminRole(r.id)}
                style={{ marginRight: '6px' }}
              />
              {r.label}
            </label>
          ))}
        </div>
      </Section>

      {/* Search preferences (admin-set + user-set, read-only summary) */}
      {adminPrefs && (
        <Section title="Search preferences (admin-set)" subtitle="Filter and prioritize for this user.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={modal.permGroup}>Filter</div>
              <label style={modal.permItem}>
                <input
                  type="checkbox"
                  checked={!!adminPrefs.releaseNotesOnly}
                  onChange={(e) => setAdminPrefs({ ...adminPrefs, releaseNotesOnly: e.target.checked })}
                  style={{ marginRight: '6px' }}
                />
                Release notes only
              </label>
              <div style={{ ...S.muted, marginTop: '4px' }}>
                Documents: {(adminPrefs.documentIds || []).length || '—'} • Topics: {(adminPrefs.topicIds || []).length || '—'}
              </div>
            </div>
            <div>
              <div style={modal.permGroup}>Prioritize</div>
              <label style={modal.permItem}>
                <input
                  type="checkbox"
                  checked={!!adminPrefs.priorityReleaseNotes}
                  onChange={(e) => setAdminPrefs({ ...adminPrefs, priorityReleaseNotes: e.target.checked })}
                  style={{ marginRight: '6px' }}
                />
                Boost release notes
              </label>
              <div style={{ ...S.muted, marginTop: '4px' }}>
                Documents: {(adminPrefs.priorityDocumentIds || []).length || '—'} • Topics: {(adminPrefs.priorityTopicIds || []).length || '—'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <button type="button" style={modal.cancelBtn} onClick={handleSavePrefs}>Save admin-set preferences</button>
          </div>
        </Section>
      )}

      {userPrefs && (
        <Section title="Search preferences (set by user)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={modal.permGroup}>Filter</div>
              <div style={S.muted}>Release notes only: {userPrefs.releaseNotesOnly ? 'yes' : 'no'}</div>
              <div style={S.muted}>Documents: {(userPrefs.documentIds || []).length || '—'} • Topics: {(userPrefs.topicIds || []).length || '—'}</div>
            </div>
            <div>
              <div style={modal.permGroup}>Prioritize</div>
              <div style={S.muted}>Boost release notes: {userPrefs.priorityReleaseNotes ? 'yes' : 'no'}</div>
              <div style={S.muted}>Documents: {(userPrefs.priorityDocumentIds || []).length || '—'} • Topics: {(userPrefs.priorityTopicIds || []).length || '—'}</div>
            </div>
          </div>
        </Section>
      )}

      {/* Authentication — MFA controls (BRD: Manage Users → Authentication). */}
      <Section title="Authentication" subtitle="Multi-factor authentication settings.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
              Multi-factor authentication (MFA)
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              {user.mfa?.resetRequested
                ? `Reset link issued${user.mfa.resetTokenExpiresAt ? ` — expires ${formatDateTime(user.mfa.resetTokenExpiresAt)}` : ''}.`
                : user.mfa?.enrolled
                  ? `Enrolled${user.mfa.enrolledAt ? ` on ${formatDateTime(user.mfa.enrolledAt)}` : ''}.`
                  : 'Not enrolled. The user will be prompted to enroll on next sign-in.'}
              {(user.mfa?.resetCount || 0) > 0 && (
                <span style={{ marginLeft: '6px', color: '#94a3b8' }}>
                  Reset count: {user.mfa.resetCount}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            style={{ ...modal.cancelBtn, color: '#a21caf', borderColor: '#e9d5ff' }}
            onClick={() => setResetMfaConfirm(true)}
          >
            Reset MFA
          </button>
        </div>
        {mfaDevToken && (
          <div style={{
            marginTop: '8px', padding: '8px 10px', borderRadius: '4px',
            background: '#fef3c7', border: '1px solid #fde68a',
            fontSize: '0.78rem', color: '#78350f',
          }}>
            Dev mode: reset token <code style={{ fontFamily: 'monospace' }}>{mfaDevToken}</code>
            &nbsp;(non-prod only).
          </div>
        )}
      </Section>

      {/* Activity stats */}
      <Section title="Activity">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
          <div>Created: <strong style={{ color: '#0f172a' }}>{formatDateTime(user.createdAt)}</strong></div>
          <div>Last login: <strong style={{ color: '#0f172a' }}>{formatDateTime(user.lastLogin)}</strong></div>
          <div>Last activity: <strong style={{ color: '#0f172a' }}>{formatDateTime(user.lastActivityAt)}</strong></div>
          <div>Login count: <strong style={{ color: '#0f172a' }}>{user.loginCount || 0}</strong></div>
          <div>Bookmarks: <strong style={{ color: '#0f172a' }}>{user.counts?.bookmarks || 0}</strong></div>
          <div>Saved searches: <strong style={{ color: '#0f172a' }}>{user.counts?.savedSearches || 0}</strong></div>
          <div>Personal books: <strong style={{ color: '#0f172a' }}>{user.counts?.personalBooks || 0}</strong></div>
          <div>Collections: <strong style={{ color: '#0f172a' }}>{user.counts?.collections || 0}</strong></div>
        </div>
      </Section>

      {resetMfaConfirm && (
        <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && setResetMfaConfirm(false)}>
          <div style={{ ...modal.box, maxWidth: '440px' }}>
            <div style={modal.header}>
              <h3 style={modal.title}>Reset MFA?</h3>
              <button style={modal.close} onClick={() => setResetMfaConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '20px 24px', color: '#475569', fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '8px' }}>
                The user will receive an e-mail with a link valid for 24&nbsp;hours
                to reset multi-factor authentication. The link is single-use and
                their active sessions will be revoked.
              </div>
              <div>Affects <strong>{user.email}</strong>.</div>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={modal.cancelBtn} onClick={() => setResetMfaConfirm(false)}>Cancel</button>
              <button style={modal.saveBtn} disabled={mfaBusy} onClick={handleResetMfa}>
                {mfaBusy ? 'Sending…' : 'Reset MFA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div style={{ ...modal.box, maxWidth: '420px' }}>
            <div style={modal.header}><h3 style={modal.title}>Delete user?</h3>
              <button style={modal.close} onClick={() => setConfirmDelete(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', color: '#475569', fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '8px' }}>
                You are about to delete <strong>{user.email}</strong>.
              </div>
              This action cannot be undone.
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={modal.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button style={{ ...modal.saveBtn, background: '#dc2626' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <div style={S.sectionTitle}>{title}</div>
        {subtitle && <div style={S.sectionSub}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={modal.row}>
      <label style={modal.label}>{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default roles drawer (Fluid Topics layout: sections, label + ROLE_ID column)
// ---------------------------------------------------------------------------
function DefaultRolesDrawer({ onClose, vocab }) {
  const [data, setData] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/default-roles')
      .then((d) => {
        setData(d);
        setSnapshot({
          unauthenticated: [...(d.unauthenticated || [])],
          authenticated: [...(d.authenticated || [])],
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  const toggle = (bucket, id) => {
    setData((d) => {
      const arr = d[bucket].includes(id) ? d[bucket].filter((x) => x !== id) : [...d[bucket], id];
      return { ...d, [bucket]: arr };
    });
  };

  const dirty = data && snapshot && (
    !roleSelectionEqual(data.unauthenticated, snapshot.unauthenticated)
    || !roleSelectionEqual(data.authenticated, snapshot.authenticated)
  );

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await api.put('/admin/default-roles', {
        unauthenticated: data.unauthenticated,
        authenticated: data.authenticated,
      });
      const merged = { ...data, ...res };
      setData(merged);
      setSnapshot({
        unauthenticated: [...(merged.unauthenticated || [])],
        authenticated: [...(merged.authenticated || [])],
      });
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const unauthCatalogue = (data?.catalogue?.unauthenticated
    || vocab?.featureRoles?.filter((r) => r.bucket === 'unauthenticated' && r.defaultEligible)
    || []).filter((r) => !r.alias);
  const authCatalogue = (data?.catalogue?.authenticated
    || vocab?.featureRoles?.filter((r) => r.bucket === 'authenticated' && r.defaultEligible)
    || []).filter((r) => !r.alias);

  return (
    <Drawer
      open
      onClose={onClose}
      title="Default roles"
      dialogLabel="Default roles"
      titleAs="h2"
      closeLeading
      width="min(760px, 100vw)"
      footer={(
        <div style={DR.footerActions}>
          <button type="button" style={DR.btnCancel} onClick={onClose} aria-label="Cancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...DR.btnSave, ...((!dirty || saving || !data) ? DR.btnSaveDisabled : {}) }}
            disabled={!dirty || saving || !data}
            onClick={save}
            aria-label="Save"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      )}
    >
      {error && <div style={modal.error}>{error}</div>}
      {!data ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div style={DR.scroll}>
          <div style={DR.widgetGroup}>
            <div style={DR.widgetGroupLabel}>Select roles to assign to all unauthenticated users</div>
            <ul style={DR.roleList}>
              {unauthCatalogue.map((r) => (
                <li key={r.id} style={DR.roleListItem}>
                  <label style={DR.roleRowLabel}>
                    <input
                      type="checkbox"
                      checked={data.unauthenticated.includes(r.id)}
                      onChange={() => toggle('unauthenticated', r.id)}
                    />
                    <span>{defaultRolesChooserLabel(r.id, r)}</span>
                  </label>
                  <span style={DR.roleName}>{r.id}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={DR.widgetGroup}>
            <div style={DR.widgetGroupLabel}>Select roles to assign to all authenticated users</div>
            <ul style={DR.roleList}>
              {authCatalogue.map((r) => (
                <li key={r.id} style={DR.roleListItem}>
                  <label style={DR.roleRowLabel}>
                    <input
                      type="checkbox"
                      checked={data.authenticated.includes(r.id)}
                      onChange={() => toggle('authenticated', r.id)}
                    />
                    <span>{defaultRolesChooserLabel(r.id, r)}</span>
                  </label>
                  <span style={DR.roleName}>{r.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// New-user modal (kept as a centred modal)
// ---------------------------------------------------------------------------
function NewUserModal({ onClose, onSaved, vocab, allGroups, actor }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', tier: 'viewer', realm: 'internal',
    permissions: [], adminRoles: [], groups: [], tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [newTag, setNewTag] = useState('');
  /** 'defaults' = match tenant Default roles (authenticated); 'empty' = no manual picks — server still applies full defaults on create. */
  const [featurePreset, setFeaturePreset] = useState('defaults');
  const [tenantDefaultAssignableIds, setTenantDefaultAssignableIds] = useState([]);

  const tiers = actor?.role === 'superadmin'
    ? ['viewer', 'editor', 'admin', 'superadmin']
    : DEFAULT_ASSIGNABLE_TIERS;
  const featureGroups = useMemo(() => {
    const buckets = {};
    accountAssignableFeatureRoles(vocab).forEach((r) => {
      buckets[r.bucket] = buckets[r.bucket] || [];
      buckets[r.bucket].push(r);
    });
    return buckets;
  }, [vocab]);

  useEffect(() => {
    let cancelled = false;
    const assignableSet = new Set(accountAssignableFeatureRoles(vocab).map((r) => r.id));
    api.get('/admin/default-roles')
      .then((d) => {
        if (cancelled) return;
        const ids = (d.authenticated || []).filter((id) => assignableSet.has(id));
        setTenantDefaultAssignableIds(ids);
      })
      .catch(() => {
        if (!cancelled) setTenantDefaultAssignableIds([]);
      });
    return () => { cancelled = true; };
  }, [vocab]);

  useEffect(() => {
    if (featurePreset !== 'defaults') return;
    setForm((f) => ({ ...f, permissions: [...tenantDefaultAssignableIds] }));
  }, [tenantDefaultAssignableIds, featurePreset]);

  const setFeatureRolePreset = (preset) => {
    setFeaturePreset(preset);
    if (preset === 'defaults') {
      setForm((f) => ({ ...f, permissions: [...tenantDefaultAssignableIds] }));
    } else {
      setForm((f) => ({ ...f, permissions: [] }));
    }
  };

  const toggle = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const togglePerm = (id) => toggle('permissions', form.permissions.includes(id) ? form.permissions.filter((p) => p !== id) : [...form.permissions, id]);
  const toggleAdmin = (id) => toggle('adminRoles', form.adminRoles.includes(id) ? form.adminRoles.filter((p) => p !== id) : [...form.adminRoles, id]);
  const toggleGroup = (id) => toggle('groups', form.groups.includes(id) ? form.groups.filter((g) => g !== id) : [...form.groups, id]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, role: form.tier };
      delete payload.tier;
      const res = await api.post('/admin/users', payload);
      onSaved?.(res.user);
    } catch (err) { setError(err.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  return (
    <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modal.box, maxWidth: '640px' }}>
        <div style={modal.header}>
          <h3 style={modal.title}>New user</h3>
          <button style={modal.close} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={modal.body} autoComplete="off">
          {/* Hidden decoys absorb Chrome's heuristic autofill, which ignores autocomplete=off on the real fields. */}
          <input type="text" name="fakeusernameremembered" autoComplete="username" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
          <input type="password" name="fakepasswordremembered" autoComplete="new-password" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
          {error && <div style={modal.error}>{error}</div>}
          <Field label="Name *">
            <input style={modal.input} value={form.name} required autoComplete="off" onChange={(e) => toggle('name', e.target.value)} />
          </Field>
          <Field label="Email *">
            <input style={modal.input} type="email" value={form.email} required autoComplete="off" onChange={(e) => toggle('email', e.target.value)} />
          </Field>
          <Field label="Password *">
            <input style={modal.input} type="password" value={form.password} required autoComplete="new-password" onChange={(e) => toggle('password', e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Field label="Tier role">
              <select style={modal.select} value={form.tier} onChange={(e) => toggle('tier', e.target.value)}>
                {tiers.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Realm">
              <select style={modal.select} value={form.realm} onChange={(e) => toggle('realm', e.target.value)}>
                {(vocab?.realms || ['internal','sso','ldap','oidc']).map((r) => (
                  <option key={r} value={r}>{REALM_LABELS[r] || r}</option>
                ))}
              </select>
            </Field>
          </div>

          <Section title="Groups">
            <div style={S.tagWrap}>
              {form.groups.length === 0 && <span style={S.muted}>No groups</span>}
              {form.groups.map((gid) => {
                const g = (allGroups || []).find((x) => x._id === gid);
                return (
                  <span key={gid} style={{ ...S.chip, background: '#dbeafe', color: '#1d4ed8' }}>
                    <OriginDot origin="manual" />
                    <span>{g?.name || gid}</span>
                    <button type="button" style={S.chipX} onClick={() => toggleGroup(gid)}>×</button>
                  </span>
                );
              })}
            </div>
            <select
              style={modal.select}
              value=""
              onChange={(e) => { if (e.target.value) toggleGroup(e.target.value); e.target.selectedIndex = 0; }}
            >
              <option value="">Add existing group…</option>
              {(allGroups || [])
                .filter((g) => !form.groups.includes(g._id))
                .map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Section>

          <Section title="Tags">
            <div style={S.tagWrap}>
              {form.tags.map((t) => (
                <span key={t} style={{ ...S.chip, background: '#f1f5f9', color: '#475569' }}>
                  <OriginDot origin="manual" /><span>{t}</span>
                  <button type="button" style={S.chipX} onClick={() => toggle('tags', form.tags.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={modal.input} placeholder="Add tag…" value={newTag}
                     onChange={(e) => setNewTag(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newTag.trim()) { toggle('tags', [...form.tags, newTag.trim()]); setNewTag(''); } } }} />
              <button type="button" style={modal.cancelBtn} onClick={() => { if (newTag.trim()) { toggle('tags', [...form.tags, newTag.trim()]); setNewTag(''); } }}>Add</button>
            </div>
          </Section>

          <Section
            title="Default feature roles"
            subtitle="Choose how signed-in feature roles are applied first; you can fine-tune each role in the next section."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...modal.permItem, cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="newUserFeaturePreset"
                  checked={featurePreset === 'defaults'}
                  onChange={() => setFeatureRolePreset('defaults')}
                  style={{ marginRight: '8px', marginTop: '3px' }}
                />
                <span style={{ fontSize: '0.84rem', lineHeight: 1.45, color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>Use tenant default roles</strong>
                  {' — '}
                  Select the same authenticated-user defaults as <strong>Edit default roles</strong> (checkboxes below match this list).
                </span>
              </label>
              <label style={{ ...modal.permItem, cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="newUserFeaturePreset"
                  checked={featurePreset === 'empty'}
                  onChange={() => setFeatureRolePreset('empty')}
                  style={{ marginRight: '8px', marginTop: '3px' }}
                />
                <span style={{ fontSize: '0.84rem', lineHeight: 1.45, color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>Start with no selections here</strong>
                  {' — '}
                  Leave feature checkboxes empty; on create, the server still applies full tenant defaults for this account (not shown as manual picks below).
                </span>
              </label>
            </div>
          </Section>

          <Section title="Feature roles" subtitle="Signed-in capabilities only — adjust individual roles after your default choice above. Anonymous defaults are under Default roles.">
            {Object.keys(featureGroups).length === 0 && <span style={S.muted}>Loading roles…</span>}
            {Object.keys(featureGroups).map((bucket) => (
              <div key={bucket} style={{ marginBottom: '8px' }}>
                <div style={modal.permGroup}>{bucket} users</div>
                <div style={modal.permGrid}>
                  {featureGroups[bucket].map((r) => (
                    <label key={r.id} style={modal.permItem}>
                      <input type="checkbox" checked={form.permissions.includes(r.id)} onChange={() => togglePerm(r.id)} style={{ marginRight: '6px' }} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section title="Administrative roles">
            <div style={modal.permGrid}>
              {(vocab?.administrativeRoles || []).map((r) => (
                <label key={r.id} style={modal.permItem}>
                  <input type="checkbox" checked={form.adminRoles.includes(r.id)} onChange={() => toggleAdmin(r.id)} style={{ marginRight: '6px' }} />
                  {r.label}
                </label>
              ))}
            </div>
          </Section>

          <div style={modal.footer}>
            <button type="button" style={modal.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={modal.saveBtn} disabled={saving}>{saving ? 'Creating…' : 'Create user'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy/Merge bar — surfaces when exactly 2 users are selected.
// ---------------------------------------------------------------------------
function CopyMergeBar({ users, selected, onClear, onDone }) {
  const [order, setOrder]     = useState([selected[0], selected[1]]);
  const [items, setItems]     = useState({
    groups: true, roles: true, adminRoles: true, tags: true,
    bookmarks: true, savedSearches: true, personalBooks: true, collections: true,
  });
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  useEffect(() => { setOrder([selected[0], selected[1]]); }, [selected]);
  const swap = () => setOrder(([a, b]) => [b, a]);
  const userById = (id) => users.find((u) => u._id === id);
  const src = userById(order[0]);
  const tgt = userById(order[1]);

  async function run(mode) {
    if (!src || !tgt) return;
    setBusy(true); setErr('');
    try {
      const path = mode === 'merge'
        ? `/admin/users/${tgt._id}/merge-from/${src._id}`
        : `/admin/users/${tgt._id}/copy-from/${src._id}`;
      await api.post(path, { items });
      onDone?.();
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  }

  if (!src || !tgt) return null;

  return (
    <div style={S.copyBarInner}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <strong style={{ color: '#0f172a' }}>Copy / merge</strong>
        <span style={{ ...S.muted }}>{src.email}</span>
        <span style={{ fontSize: '1.2rem' }}>→</span>
        <span style={{ ...S.muted }}>{tgt.email}</span>
        <button style={modal.cancelBtn} onClick={swap}>Swap users</button>
      </div>
      <div style={S.copyOpts}>
        {Object.keys(items).map((k) => (
          <label key={k} style={modal.permItem}>
            <input type="checkbox" checked={items[k]} onChange={(e) => setItems({ ...items, [k]: e.target.checked })} style={{ marginRight: '6px' }} />
            {labelForItem(k)}
          </label>
        ))}
      </div>
      {err && <div style={{ ...modal.error, marginTop: '6px' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button style={modal.cancelBtn} onClick={onClear}>Cancel</button>
        <button style={modal.cancelBtn} disabled={busy} onClick={() => run('copy')}>Copy</button>
        <button style={{ ...modal.saveBtn, background: '#dc2626' }} disabled={busy} onClick={() => run('merge')}>Merge</button>
      </div>
    </div>
  );
}

function labelForItem(k) {
  return ({
    groups: 'Groups',
    roles: 'Feature roles',
    adminRoles: 'Admin roles',
    tags: 'Tags',
    bookmarks: 'Bookmarks',
    savedSearches: 'Saved searches',
    personalBooks: 'Personal books',
    collections: 'Collections',
  }[k] || k);
}

// ---------------------------------------------------------------------------
// Bulk-action bar — tab strip like Fluid Topics (always visible; actions gated).
// ---------------------------------------------------------------------------
function BulkBar({
  selectedCount,
  onAssign,
  onDelete,
  vocab,
  allGroups,
  copySlot,
}) {
  const [tab, setTab] = useState('groups');
  const [picked, setPicked] = useState('');
  const [pickedAdmin, setPickedAdmin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [newName, setNewName] = useState('');

  const featureOptions = accountAssignableFeatureRoles(vocab);
  const adminOptions = (vocab?.administrativeRoles || []);

  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const disabled = selectedCount === 0;

  return (
    <div style={S.bulkBar}>
      <div style={S.bulkTabRow}>
        <span style={{ ...S.bulkCount, color: disabled ? '#94a3b8' : '#0f172a' }}>
          {selectedCount === 0 ? 'No users selected' : `${selectedCount} selected`}
        </span>
        {['groups', 'roles', 'tags', 'delete', 'copy'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              ...S.bulkTab,
              ...(tab === t ? S.bulkTabActive : null),
              color: t === 'delete' ? '#dc2626' : '#0f172a',
            }}
          >
            {labelForBulkTab(t)}
          </button>
        ))}
      </div>
      {tab === 'copy' ? (
        <div style={{ marginTop: '10px' }}>{copySlot}</div>
      ) : (
        <div style={{ marginTop: '10px' }}>
          {tab === 'groups' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select style={{ ...modal.select, maxWidth: '280px', opacity: disabled ? 0.5 : 1 }} value={picked} disabled={disabled} onChange={(e) => setPicked(e.target.value)}>
                <option value="">Choose group…</option>
                {(allGroups || []).map((opt) => (
                  <option key={opt._id} value={opt._id}>{opt.name}</option>
                ))}
              </select>
              <button
                type="button"
                style={modal.saveBtn}
                disabled={busy || disabled || !picked}
                onClick={() => run(async () => {
                  await onAssign?.('groups', [picked]);
                  setPicked('');
                })}
              >
                {busy ? 'Working…' : 'Add'}
              </button>
            </div>
          )}
          {tab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={{ ...modal.select, maxWidth: '300px', opacity: disabled ? 0.5 : 1 }} value={picked} disabled={disabled} onChange={(e) => setPicked(e.target.value)}>
                  <option value="">Feature role…</option>
                  {featureOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label || opt.id}</option>
                  ))}
                </select>
                <button
                  type="button"
                  style={modal.saveBtn}
                  disabled={busy || disabled || !picked}
                  onClick={() => run(async () => {
                    await onAssign?.('roles', [picked]);
                    setPicked('');
                  })}
                >
                  {busy ? '…' : 'Add'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={{ ...modal.select, maxWidth: '300px', opacity: disabled ? 0.5 : 1 }} value={pickedAdmin} disabled={disabled} onChange={(e) => setPickedAdmin(e.target.value)}>
                  <option value="">Admin role…</option>
                  {adminOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label || opt.id}</option>
                  ))}
                </select>
                <button
                  type="button"
                  style={modal.saveBtn}
                  disabled={busy || disabled || !pickedAdmin}
                  onClick={() => run(async () => {
                    await onAssign?.('adminRoles', [pickedAdmin]);
                    setPickedAdmin('');
                  })}
                >
                  {busy ? '…' : 'Add'}
                </button>
              </div>
            </div>
          )}
          {tab === 'tags' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                style={{ ...modal.input, maxWidth: '280px', opacity: disabled ? 0.5 : 1 }}
                placeholder="Add tag…"
                value={newName}
                disabled={disabled}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="button"
                style={modal.saveBtn}
                disabled={busy || disabled || !newName.trim()}
                onClick={() => run(async () => {
                  await onAssign?.('tags', [newName.trim()]);
                  setNewName('');
                })}
              >
                {busy ? 'Working…' : 'Add'}
              </button>
            </div>
          )}
          {tab === 'delete' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={S.muted}>Permanently remove the selected users.</span>
              <button
                type="button"
                style={{ ...modal.saveBtn, background: '#dc2626' }}
                disabled={busy || disabled}
                onClick={() => run(async () => { await onDelete?.(); })}
              >
                {busy ? 'Working…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}
      {err && <div style={{ ...modal.error, marginTop: '6px' }}>{err}</div>}
    </div>
  );
}

function labelForBulkTab(t) {
  return ({ groups: 'Groups', roles: 'Roles', tags: 'Tags', delete: 'Delete', copy: 'Copy' }[t] || t);
}

// ---------------------------------------------------------------------------
// XLSX download helper — reuses the bearer token from api lib.
// ---------------------------------------------------------------------------
async function downloadXlsx(filterParams) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filterParams || {})) {
    if (v) params.set(k, v);
  }
  const token = getStoredToken();
  const qs = params.toString();
  const url = `${API_BASE}/admin/users/export.xlsx${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed (${res.status})`);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/:/g, '_').replace(/\..+$/, '');
  a.href = objUrl;
  a.download = `ft-users-${ts}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

function formatStatsLine(u) {
  const c = u.counts;
  if (!c) return '';
  const { bookmarks = 0, savedSearches = 0, personalBooks = 0, collections: cols = 0 } = c;
  if (!bookmarks && !savedSearches && !personalBooks && !cols) return '';
  const parts = [];
  if (bookmarks) parts.push(`${bookmarks} bookmark${bookmarks === 1 ? '' : 's'}`);
  if (savedSearches) parts.push(`${savedSearches} saved`);
  if (personalBooks) parts.push(`${personalBooks} books`);
  if (cols) parts.push(`${cols} collections`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------
function ManageUsersInner() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [actor, setActor]     = useState(null);

  const [vocab,  setVocab]  = useState(null);
  const [allGroups, setAllGroups] = useState([]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [realmFilter, setRealmFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('created');
  const [sortDir, setSortDir] = useState('desc');

  const [drawerUserId,        setDrawerUserId]        = useState(null);
  const [defaultRolesOpen,    setDefaultRolesOpen]    = useState(false);
  const [newUserOpen,         setNewUserOpen]         = useState(false);
  const [selectedIds,         setSelectedIds]         = useState([]);

  useEffect(() => { setActor(getStoredUser()); }, []);

  const loadVocab = useCallback(async () => {
    try { setVocab(await api.get('/admin/users-vocabulary')); }
    catch { /* server may be old; we have static fallbacks */ }
  }, []);
  const loadGroups = useCallback(async () => {
    try {
      const res = await api.get('/admin/groups');
      setAllGroups(res.groups || res || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadVocab(); loadGroups(); }, [loadVocab, loadGroups]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const baseFilters = useMemo(() => ({
    q: search.trim() || '',
    realm: realmFilter || '',
    group: groupFilter || '',
    role: roleFilter || '',
    tag: tagFilter || '',
    origin: originFilter ? (ORIGIN_QUERY_VALUES[originFilter] || '') : '',
  }), [search, realmFilter, groupFilter, roleFilter, tagFilter, originFilter]);

  const sortMongo = useMemo(() => {
    const field = ({ user: 'name', last: 'lastActivityAt', created: 'createdAt', realm: 'realm' })[sortKey] || 'createdAt';
    return (sortDir === 'desc' ? '-' : '') + field;
  }, [sortKey, sortDir]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- new filter set must show page 1
  useEffect(() => { setPage(1); }, [baseFilters]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- row selection applies to current page only
  useEffect(() => { setSelectedIds([]); }, [page]);

  const exportFilters = baseFilters;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(baseFilters)) if (v) params.set(k, v);
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(page));
      params.set('sort', sortMongo);
      const res = await api.get(`/admin/users?${params}`);
      setUsers(res.users || []);
      setTotal(res.total ?? (res.users?.length ?? 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [baseFilters, page, sortMongo]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    syncCurrentUserFromServer();
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'user' || key === 'realm' ? 'asc' : 'desc');
    }
  };

  // Outside-click close for kebab menu
  useEffect(() => {
    if (!openMenu) return;
    const onDoc = () => setOpenMenu(null);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenu]);

  // ----- handlers -----
  const handleSaved = (user) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u._id === user._id);
      return idx >= 0 ? prev.map((u) => (u._id === user._id ? user : u)) : [user, ...prev];
    });
    const self = getStoredUser();
    if (self && String(user._id) === String(self._id)) {
      syncCurrentUserFromServer();
    }
  };
  const handleDeleted = (id) => {
    setUsers((prev) => prev.filter((u) => u._id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
    setDrawerUserId(null);
  };

  const toggleRow = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelectedIds((s) => (s.length === users.length ? [] : users.map((u) => u._id)));

  const bulkAssign = async (dimension, values) => {
    await api.post('/admin/users/bulk-assign', { userIds: selectedIds, dimension, values, op: 'add' });
    const self = getStoredUser();
    if (self && selectedIds.some((id) => String(id) === String(self._id))) {
      await syncCurrentUserFromServer();
    }
    await load();
  };
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} users?`)) return;
    await api.post('/admin/users/bulk-delete', { userIds: selectedIds });
    setSelectedIds([]);
    await load();
  };

  // ----- table option lists from vocab + current rows -----
  const realmOptions  = useMemo(() => Object.keys(REALM_LABELS), []);
  const groupOptions  = useMemo(() => (allGroups || []).map((g) => g.name), [allGroups]);
  const roleOptions   = useMemo(() => {
    const fr = (vocab?.featureRoles || []).map((r) => r.id);
    const ar = (vocab?.administrativeRoles || []).map((r) => r.id);
    return ['superadmin','admin','editor','viewer', ...fr, ...ar];
  }, [vocab]);
  const tagOptions    = useMemo(() => {
    const set = new Set();
    users.forEach((u) => (u.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [users]);
  const originLabels  = ['authentication provider', 'manually added', 'default'];

  return (
    <>
      <div style={S.headerRow}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <h1 style={S.title}>Manage users</h1>
          <span style={S.count}>{total.toLocaleString()} users</span>
        </div>
        <div style={S.actions}>
          <button type="button" style={S.linkBtn} onClick={() => setDefaultRolesOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            Edit default roles
          </button>
          <button type="button" style={S.linkBtn} onClick={() => downloadXlsx(exportFilters).catch((e) => alert(e.message))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download xlsx
          </button>
          <button type="button" style={S.primaryBtn} onClick={() => setNewUserOpen(true)}>+ New user</button>
        </div>
      </div>

      <div style={S.filterBar}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Search</span>
          <input style={S.searchInput} placeholder="Username, email, user ID"
                 value={searchInput} onChange={(e) => setSearchInput(e.target.value)} type="search" />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Filtering by</span>
          <SingleSelectFilter allLabel="All Realms" options={realmOptions} value={realmFilter} onChange={setRealmFilter} formatOption={(v) => REALM_LABELS[v] || v} />
          <SingleSelectFilter allLabel="All Groups" options={groupOptions} value={groupFilter} onChange={setGroupFilter} />
          <SingleSelectFilter allLabel="All Roles" options={roleOptions} value={roleFilter} onChange={setRoleFilter} />
          <SingleSelectFilter allLabel="All Tags" options={tagOptions} value={tagFilter} onChange={setTagFilter} />
          <SingleSelectFilter allLabel="All Origins" options={originLabels} value={originFilter} onChange={setOriginFilter} />
        </div>
      </div>

      <div style={S.encryptionNotice} role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>Due to data encryption, search by username or email only returns exact matches.</span>
      </div>

      <div style={S.tableWrap} data-displayed-entries={users.length} data-available-entries={total}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '36px' }}>
                  <input type="checkbox"
                         checked={users.length > 0 && selectedIds.length === users.length}
                         onChange={toggleAll}
                         aria-label="Select all" />
                </th>
                <SortableTh label="User" columnId="user" activeColumn={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Last activity" columnId="last" activeColumn={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Created on" columnId="created" activeColumn={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Realms" columnId="realm" activeColumn={sortKey} dir={sortDir} onSort={handleSort} />
                <th style={S.th}>Access groups</th>
                <th style={S.th}>Roles</th>
                <th style={S.th}>Tags</th>
                <th style={S.th}>Stats</th>
                <th style={S.th} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const checked = selectedIds.includes(u._id);
                const statsLine = formatStatsLine(u);
                const realmLabel = REALM_LABELS[u.realm] || u.realm;
                return (
                  <tr key={u._id} style={{ ...S.row, ...(u.lockedManually ? { background: '#fef2f2' } : null) }}>
                    <td style={{ ...S.td, paddingLeft: '8px' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleRow(u._id)} aria-label="Select user" />
                    </td>
                    <td style={S.td}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={S.userNameBtn}
                            onClick={() => setDrawerUserId(String(u._id))}
                          >
                            {u.name}
                          </button>
                          {u.lockedManually && (
                            <span style={{ ...S.statusPill, background: '#fee2e2', color: '#991b1b' }}>Locked</span>
                          )}
                        </div>
                        <div style={S.userMeta}>{u.email}</div>
                        <div style={{ ...S.userMeta, fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.85 }}>
                          ID: {u._id}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}><span style={S.dateText}>{formatDateTime(u.lastActivityAt)}</span></td>
                    <td style={S.td}><span style={S.dateText}>{formatDate(u.createdAt)}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.realmTag, background: realmBg(u.realm), color: realmColor(u.realm) }} title={u.realm}>
                        {realmLabel}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {(u.groupsWithOrigin || []).length === 0 && <span style={S.muted}>—</span>}
                        {(u.groupsWithOrigin || []).slice(0, 4).map((g) => (
                          <GroupPill key={g._id} origin={g.origin}>{g.name}</GroupPill>
                        ))}
                        {(u.groupsWithOrigin || []).length > 4 && (
                          <span style={S.moreTag}>+{u.groupsWithOrigin.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        <RolePill origin="default" variant="tier">{(u.role || '').toUpperCase()}</RolePill>
                        {(u.featureRolesWithOrigin || []).slice(0, 6).map((p) => (
                          <RolePill key={p.value} origin={p.origin}>{p.value}</RolePill>
                        ))}
                        {(u.featureRolesWithOrigin || []).length > 6 && (
                          <span style={S.moreTag}>+{u.featureRolesWithOrigin.length - 6}</span>
                        )}
                        {(u.adminRolesWithOrigin || []).slice(0, 4).map((p) => (
                          <RolePill key={`admin-${p.value}`} origin={p.origin} variant="admin">{p.value}</RolePill>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {(u.tagsWithOrigin || []).length === 0 && <span style={S.muted}>—</span>}
                        {(u.tagsWithOrigin || []).slice(0, 4).map((t) => (
                          <ChipWithOrigin key={t.value} origin={t.origin} bg="#f1f5f9" color="#475569">{t.value}</ChipWithOrigin>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>
                      {statsLine ? (
                        <button type="button" style={S.statsLineBtn} onClick={() => setDrawerUserId(String(u._id))} title="Open user details">
                          {statsLine}
                        </button>
                      ) : (
                        <span style={S.muted}>—</span>
                      )}
                    </td>
                    <td style={{ ...S.td, position: 'relative', textAlign: 'right' }}>
                      <button style={S.kebab}
                              onClick={(e) => { e.stopPropagation(); setOpenMenu((m) => (m === u._id ? null : u._id)); }}
                              aria-label="Actions">⋮</button>
                      {openMenu === u._id && (
                        <div style={S.kebabMenu} onMouseDown={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            style={S.kebabItem}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDrawerUserId(String(u._id));
                              setOpenMenu(null);
                            }}
                          >
                            Edit user
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    No users match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      )}

      {selectedIds.length > 0 && (
        <BulkBar
          selectedCount={selectedIds.length}
          onAssign={bulkAssign}
          onDelete={bulkDelete}
          vocab={vocab}
          allGroups={allGroups}
          copySlot={
            selectedIds.length === 2 ? (
              <CopyMergeBar
                users={users}
                selected={selectedIds}
                onClear={() => setSelectedIds([])}
                onDone={async () => { setSelectedIds([]); await load(); }}
              />
            ) : (
              <span style={S.muted}>Select exactly two users to copy or merge accounts.</span>
            )
          }
        />
      )}

      {drawerUserId && typeof document !== 'undefined' && createPortal(
        <UserDrawer
          key={String(drawerUserId)}
          userId={String(drawerUserId)}
          vocab={vocab}
          actor={actor}
          allGroups={allGroups}
          refreshAllGroups={loadGroups}
          onClose={() => setDrawerUserId(null)}
          onSaved={(u) => { handleSaved(u); }}
          onDeleted={handleDeleted}
        />,
        document.body,
      )}
      {defaultRolesOpen && (
        <DefaultRolesDrawer onClose={() => setDefaultRolesOpen(false)} vocab={vocab} />
      )}
      {newUserOpen && (
        <NewUserModal
          vocab={vocab}
          allGroups={allGroups}
          actor={actor}
          onClose={() => setNewUserOpen(false)}
          onSaved={(u) => { handleSaved(u); setNewUserOpen(false); }}
        />
      )}
    </>
  );
}

function realmBg(r) {
  return { internal: '#fef3c7', sso: '#dcfce7', ldap: '#e0e7ff', oidc: '#fae8ff' }[r] || '#f1f5f9';
}
function realmColor(r) {
  return { internal: '#92400e', sso: '#166534', ldap: '#3730a3', oidc: '#86198f' }[r] || '#475569';
}

export default function AdminUsersPage() {
  return (
    <AdminShell
      active="manage-users-list"
      allowedRoles={['superadmin']}
      allowedAdminRoles={['USERS_ADMIN']}
      fullWidth
    >
      <ManageUsersInner />
    </AdminShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '18px', flexWrap: 'wrap', gap: '12px',
  },
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  count: { fontSize: '0.85rem', color: '#64748b' },
  actions: { display: 'flex', alignItems: 'center', gap: '14px' },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#a855f7', fontWeight: 600, fontSize: '0.85rem', padding: '6px 4px',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    background: '#a855f7', color: '#fff', border: 'none',
    borderRadius: '6px', padding: '8px 16px', fontWeight: 600,
    fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(168,85,247,0.25)',
  },
  filterBar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
    gap: '14px 20px', padding: '14px 16px',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    background: '#fafbfc', marginBottom: '16px',
  },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  filterLabel: { fontSize: '0.78rem', fontWeight: 600, color: '#475569' },
  searchInput: {
    padding: '7px 10px', fontSize: '0.85rem',
    border: '1px solid #d1d5db', borderRadius: '6px',
    background: '#fff', minWidth: '220px', outline: 'none', fontFamily: 'inherit',
  },
  legend: {
    marginLeft: 'auto', display: 'flex', flexDirection: 'column',
    gap: '4px', fontSize: '0.75rem', color: '#475569',
  },
  legendTitle: { fontWeight: 600, color: '#0f172a' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  encryptionNotice: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '10px 14px', marginBottom: '14px',
    background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '8px',
    fontSize: '0.82rem', color: '#0c4a6e', lineHeight: 1.45,
  },
  pager: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '14px 8px', flexWrap: 'wrap',
  },
  pagerPages: { display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' },
  pagerBtn: {
    minWidth: '32px', height: '32px', padding: '0 8px',
    border: '1px solid #e5e7eb', borderRadius: '6px',
    background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
    color: '#475569',
  },
  pagerBtnCurrent: {
    borderColor: '#a855f7', background: '#f5f3ff', color: '#6b21a8', fontWeight: 700,
  },
  sortBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    font: 'inherit', color: 'inherit', fontWeight: 600, textTransform: 'inherit',
    letterSpacing: 'inherit', fontSize: 'inherit',
  },
  sortIcons: { display: 'inline-flex', flexDirection: 'column', gap: 0, marginLeft: '2px' },
  statsLineBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: 0, fontSize: '0.72rem', color: '#64748b', textAlign: 'left',
    fontFamily: 'inherit', maxWidth: '220px', lineHeight: 1.35,
  },
  groupPillFt: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    borderRadius: '999px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 500,
    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
    whiteSpace: 'nowrap',
  },
  rolePillFt: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    borderRadius: '999px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600,
    background: '#fff', color: '#991b1b', border: '1px solid #fca5a5',
    whiteSpace: 'nowrap',
  },
  tierPillFt: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    borderRadius: '999px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700,
    background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
    whiteSpace: 'nowrap',
  },
  adminPillFt: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    borderRadius: '999px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600,
    background: '#fff', color: '#5b21b6', border: '1px solid #c4b5fd',
    whiteSpace: 'nowrap',
  },
  tableWrap: {
    border: '1px solid #e5e7eb', borderRadius: '8px',
    overflow: 'auto', background: '#fff',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    textAlign: 'left', padding: '10px 12px',
    background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
    fontSize: '0.74rem', fontWeight: 600, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    whiteSpace: 'nowrap', position: 'sticky', top: 0,
  },
  row:  { borderBottom: '1px solid #f1f5f9' },
  td:   { padding: '12px 12px', verticalAlign: 'middle', color: '#0f172a' },
  userNameBtn: {
    fontWeight: 600, fontSize: '0.85rem', color: '#0f172a',
    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
  },
  userMeta: { fontSize: '0.74rem', color: '#64748b' },
  dateText: { fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' },
  muted:    { color: '#94a3b8', fontSize: '0.78rem' },
  tagWrap:  { display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '320px' },
  realmTag: {
    borderRadius: '4px', padding: '1px 8px', fontSize: '0.7rem',
    fontWeight: 600, whiteSpace: 'nowrap',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem',
    fontWeight: 500, whiteSpace: 'nowrap',
  },
  chipX: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'inherit', fontSize: '1rem', lineHeight: 1, padding: '0 0 0 2px',
  },
  moreTag: {
    background: '#f1f5f9', color: '#475569', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500,
  },
  statusPill: { borderRadius: '4px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 },
  kebab: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '1.2rem', color: '#475569', padding: '0 6px', lineHeight: 1,
  },
  kebabMenu: {
    position: 'absolute', right: '8px', top: '32px',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
    minWidth: '180px', zIndex: 5, padding: '4px',
  },
  kebabItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a',
    fontFamily: 'inherit', borderRadius: '4px',
  },
  // bulk-action footer
  bulkBar: {
    position: 'sticky', bottom: 0, background: '#fff',
    borderTop: '1px solid #e5e7eb', padding: '14px 16px',
    boxShadow: '0 -8px 20px rgba(15,23,42,0.06)',
    marginTop: '12px',
  },
  bulkTab: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 600, padding: '6px 8px',
    borderRadius: '4px', fontFamily: 'inherit',
  },
  bulkTabActive: { background: '#ede9fe', color: '#5b21b6' },
  bulkTabRow: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    borderBottom: '1px solid #f1f5f9', paddingBottom: '6px',
  },
  bulkCount: { fontSize: '0.8rem', fontWeight: 600, marginRight: '6px' },
  copyBarInner: { padding: '4px 0' },
  copyBar: {
    position: 'sticky', bottom: 0, background: '#fff',
    borderTop: '1px solid #e5e7eb', padding: '14px 16px',
    boxShadow: '0 -8px 20px rgba(15,23,42,0.06)',
    marginTop: '12px',
  },
  copyOpts: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '10px' },
  // drawer sections
  section: {
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '12px 14px', marginBottom: '12px', background: '#fff',
  },
  sectionHead: { marginBottom: '8px' },
  sectionTitle: { fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' },
  sectionSub:   { fontSize: '0.75rem', color: '#64748b', marginTop: '2px' },
  // status toggle
  statusRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px',
  },
  toggle: {
    width: '44px', height: '24px', borderRadius: '999px',
    border: 'none', position: 'relative', cursor: 'pointer',
    transition: 'background 0.2s',
  },
  toggleKnob: {
    position: 'absolute', top: '4px', width: '16px', height: '16px',
    background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
  },
};

const F = {
  trigger: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '7px 10px', minWidth: '160px',
    border: '1px solid #d1d5db', borderRadius: '6px',
    background: '#fff', fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit', color: '#0f172a',
  },
  menu: {
    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
    zIndex: 30, minWidth: '220px', maxHeight: '280px', overflowY: 'auto',
    padding: '6px',
  },
  item: {
    display: 'flex', alignItems: 'center', padding: '6px 10px',
    fontSize: '0.85rem', cursor: 'pointer', borderRadius: '4px',
    color: '#0f172a',
  },
  clear: {
    width: '100%', textAlign: 'left', marginTop: '4px',
    padding: '6px 10px', fontSize: '0.78rem',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#a855f7', fontWeight: 600, fontFamily: 'inherit',
    borderTop: '1px solid #f1f5f9',
  },
  optionRow: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 10px', fontSize: '0.85rem', cursor: 'pointer',
    background: 'transparent', border: 'none', borderRadius: '4px',
    color: '#0f172a', fontFamily: 'inherit',
  },
};

const D = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
    zIndex: 10050, display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    background: '#f8fafc', height: '100%',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-12px 0 30px rgba(15,23,42,0.15)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
    background: '#fff', position: 'sticky', top: 0, zIndex: 1,
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' },
  headerLeading: { justifyContent: 'flex-start', gap: '6px', padding: '16px 18px' },
  closeLeading: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
    padding: '4px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  titleLeading: { flex: 1, fontSize: '1.125rem', fontWeight: 600 },
  body:  { padding: '14px 16px', flex: 1, overflowY: 'auto' },
  footer:{
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
    background: '#fff', display: 'flex', alignItems: 'center',
  },
  footerFlush: { padding: '16px 20px', justifyContent: 'flex-end' },
};

const DR = {
  scroll: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' },
  widgetGroup: { marginBottom: '24px' },
  widgetGroupLabel: {
    fontSize: '0.95rem', fontWeight: 600, color: '#0f172a',
    marginBottom: '4px', lineHeight: 1.4,
  },
  roleList: { listStyle: 'none', margin: 0, padding: 0 },
  roleListItem: {
    display: 'flex', alignItems: 'center',
    gap: '12px', padding: '4px 0',
  },
  roleRowLabel: {
    display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
    fontSize: '0.875rem', color: '#0f172a', lineHeight: 1.4,
  },
  roleName: {
    fontSize: '0.78rem', color: '#7c3aed', fontFamily: 'ui-monospace, Menlo, monospace',
    whiteSpace: 'nowrap', letterSpacing: '0.02em',
  },
  footerActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%', alignItems: 'center' },
  btnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '6px', border: '1px solid #a855f7',
    background: '#fff', color: '#6b21a8', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSave: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px', borderRadius: '6px', border: 'none',
    background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSaveDisabled: { opacity: 0.45, cursor: 'not-allowed' },
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: '20px',
  },
  box: {
    background: '#fff', borderRadius: '10px', width: '100%',
    maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
    position: 'sticky', top: 0, background: '#fff', zIndex: 1,
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#0f172a' },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' },
  body:  { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  row:   { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  input: {
    padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', flex: 1,
  },
  select: {
    padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', width: '100%',
  },
  permGroup: { fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' },
  permGrid:  { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  permItem:  { fontSize: '0.8rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
    padding: '16px 24px', borderTop: '1px solid #e2e8f0',
    position: 'sticky', bottom: 0, background: '#fff',
  },
  cancelBtn: {
    background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '8px 16px',
    fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
  },
  saveBtn: {
    background: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  error: {
    background: '#fee2e2', color: '#991b1b', borderRadius: '6px',
    padding: '10px 14px', fontSize: '0.85rem',
  },
};
