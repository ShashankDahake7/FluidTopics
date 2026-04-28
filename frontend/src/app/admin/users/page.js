'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api, { getStoredUser, getStoredToken } from '@/lib/api';
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

const tierBadge = (tier) => ({
  superadmin: { bg: '#ede9fe', color: '#5b21b6' },
  admin:      { bg: '#fee2e2', color: '#991b1b' },
  editor:     { bg: '#fef3c7', color: '#92400e' },
  viewer:     { bg: '#f1f5f9', color: '#475569' },
}[tier] || { bg: '#f1f5f9', color: '#475569' });

const tierLabel = (tier) =>
  tier === 'superadmin' ? 'Super admin' : (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '');

function initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function avatarColor(seed = '') {
  const palette = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

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

// ---------------------------------------------------------------------------
// Filter dropdown — multi-select with checkbox list
// ---------------------------------------------------------------------------
function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const summary =
    selected.length === 0 ? label
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '160px' }}>
      <button type="button" style={F.trigger} onClick={() => setOpen((v) => !v)}>
        <span style={{ flex: 1, textAlign: 'left', color: selected.length ? '#0f172a' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {summary}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9, 12 15, 18 9" />
        </svg>
      </button>
      {open && (
        <div style={F.menu}>
          {options.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#94a3b8' }}>No options</div>
          )}
          {options.map((opt) => (
            <label key={opt} style={F.item}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ marginRight: '8px' }} />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" style={F.clear} onClick={() => onChange([])}>Clear selection</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-side drawer scaffold
// ---------------------------------------------------------------------------
function Drawer({ open, onClose, title, footer, width = '520px', children }) {
  if (!open) return null;
  return (
    <div style={D.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...D.panel, width }}>
        <div style={D.header}>
          <h3 style={D.title}>{title}</h3>
          <button style={D.close} onClick={onClose} aria-label="Close drawer">✕</button>
        </div>
        <div style={D.body}>{children}</div>
        {footer && <div style={D.footer}>{footer}</div>}
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
  const toggleAdmin = (id) =>
    setDraft((d) => ({
      ...d,
      adminRoles: d.adminRoles.includes(id) ? d.adminRoles.filter((p) => p !== id) : [...d.adminRoles, id],
    }));
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
        adminRoles:  draft.adminRoles,
        groups:      draft.groups,
        tags:        draft.tags,
        lockedManually: draft.locked,
      };
      const res = await api.patch(`/admin/users/${userId}`, payload);
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

  const featureGroups = useMemo(() => {
    const buckets = {};
    (vocab?.featureRoles || []).forEach((r) => {
      if (r.alias) return; // hide legacy aliases from picker
      buckets[r.bucket] = buckets[r.bucket] || [];
      buckets[r.bucket].push(r);
    });
    return buckets;
  }, [vocab]);

  const tiersForSelect = useMemo(() => {
    const list = actor?.role === 'superadmin'
      ? ['viewer', 'editor', 'admin', 'superadmin']
      : DEFAULT_ASSIGNABLE_TIERS;
    return [...new Set([...list, draft.tier].filter(Boolean))];
  }, [actor, draft.tier]);

  const featureCount  = draft.permissions.length;
  const featureMax    = (vocab?.featureRoles || []).filter((r) => !r.alias).length;
  const adminCount    = draft.adminRoles.length;
  const adminMax      = (vocab?.administrativeRoles || []).length;

  if (loading || !user) {
    return (
      <Drawer open onClose={onClose} title="User details">
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
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

      {/* Feature roles */}
      <Section
        title="Feature roles"
        subtitle={`${featureCount} of ${featureMax} assigned`}
      >
        {Object.keys(featureGroups).map((bucket) => (
          <div key={bucket} style={{ marginBottom: '12px' }}>
            <div style={modal.permGroup}>{bucket} users</div>
            <div style={modal.permGrid}>
              {featureGroups[bucket].map((r) => (
                <label key={r.id} style={modal.permItem}>
                  <input type="checkbox" checked={draft.permissions.includes(r.id)} onChange={() => togglePerm(r.id)} style={{ marginRight: '6px' }} />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {/* Auto-applied / default permissions, read-only */}
        {(user.permissionsAuto?.length || user.permissionsDefault?.length) ? (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
            <div style={{ ...modal.permGroup, marginBottom: '6px' }}>Inherited (read-only)</div>
            <div style={S.tagWrap}>
              {(user.permissionsAuto || []).map((p) => (
                <span key={`auto-${p}`} style={{ ...S.chip, background: '#dcfce7', color: '#166534' }}>
                  <OriginDot origin="auto" /><span>{p}</span>
                </span>
              ))}
              {(user.permissionsDefault || []).map((p) => (
                <span key={`def-${p}`} style={{ ...S.chip, background: '#fee2e2', color: '#991b1b' }}>
                  <OriginDot origin="default" /><span>{p}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* Admin roles */}
      <Section title="Administrative roles" subtitle={`${adminCount} of ${adminMax} assigned`}>
        <div style={modal.permGrid}>
          {(vocab?.administrativeRoles || []).map((r) => (
            <label key={r.id} style={modal.permItem}>
              <input type="checkbox" checked={draft.adminRoles.includes(r.id)} onChange={() => toggleAdmin(r.id)} style={{ marginRight: '6px' }} />
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
// Default roles drawer
// ---------------------------------------------------------------------------
function DefaultRolesDrawer({ onClose, vocab }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/default-roles').then(setData).catch((e) => setError(e.message));
  }, []);
  const toggle = (bucket, id) => {
    setData((d) => {
      const arr = d[bucket].includes(id) ? d[bucket].filter((x) => x !== id) : [...d[bucket], id];
      return { ...d, [bucket]: arr };
    });
  };
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/admin/default-roles', {
        unauthenticated: data.unauthenticated,
        authenticated:   data.authenticated,
      });
      setData({ ...data, ...res });
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Drawer
      open onClose={onClose}
      title="Edit default roles"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <button style={modal.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={modal.saveBtn} disabled={saving || !data} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      {error && <div style={modal.error}>{error}</div>}
      {!data ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <>
          <Section title="Unauthenticated users" subtitle="Roles applied to anonymous sessions.">
            <div style={modal.permGrid}>
              {(data.catalogue?.unauthenticated || vocab?.featureRoles?.filter((r) => r.bucket === 'unauthenticated' && r.defaultEligible) || []).map((r) => (
                <label key={r.id} style={modal.permItem}>
                  <input type="checkbox" checked={data.unauthenticated.includes(r.id)}
                         onChange={() => toggle('unauthenticated', r.id)} style={{ marginRight: '6px' }} />
                  {r.label || r.id}
                </label>
              ))}
            </div>
          </Section>
          <Section title="Authenticated users" subtitle="Roles auto-assigned to every signed-in user with no manual roles.">
            <div style={modal.permGrid}>
              {(data.catalogue?.authenticated || vocab?.featureRoles?.filter((r) => r.bucket === 'authenticated' && r.defaultEligible) || []).map((r) => (
                <label key={r.id} style={modal.permItem}>
                  <input type="checkbox" checked={data.authenticated.includes(r.id)}
                         onChange={() => toggle('authenticated', r.id)} style={{ marginRight: '6px' }} />
                  {r.label || r.id}
                </label>
              ))}
            </div>
          </Section>
        </>
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

  const tiers = actor?.role === 'superadmin'
    ? ['viewer', 'editor', 'admin', 'superadmin']
    : DEFAULT_ASSIGNABLE_TIERS;
  const featureGroups = useMemo(() => {
    const buckets = {};
    (vocab?.featureRoles || []).forEach((r) => {
      if (r.alias) return;
      buckets[r.bucket] = buckets[r.bucket] || [];
      buckets[r.bucket].push(r);
    });
    return buckets;
  }, [vocab]);

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
        <form onSubmit={submit} style={modal.body}>
          {error && <div style={modal.error}>{error}</div>}
          <Field label="Name *">
            <input style={modal.input} value={form.name} required onChange={(e) => toggle('name', e.target.value)} />
          </Field>
          <Field label="Email *">
            <input style={modal.input} type="email" value={form.email} required onChange={(e) => toggle('email', e.target.value)} />
          </Field>
          <Field label="Password *">
            <input style={modal.input} type="password" value={form.password} required onChange={(e) => toggle('password', e.target.value)} />
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

          <Section title="Feature roles">
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
    <div style={S.copyBar}>
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
// Bulk-action footer — appears when ≥1 row is checked.
// ---------------------------------------------------------------------------
function BulkBar({ selectedCount, onAssign, onDelete, vocab, allGroups }) {
  const [tab, setTab]       = useState('groups');
  const [picked, setPicked] = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const [newName, setNewName] = useState('');

  const options = tab === 'groups'
    ? (allGroups || [])
    : tab === 'roles'
      ? (vocab?.featureRoles || []).filter((r) => !r.alias)
      : tab === 'adminRoles'
        ? (vocab?.administrativeRoles || [])
        : []; // tags handled by free input

  async function apply() {
    if (tab === 'delete') return onDelete?.();
    setBusy(true); setErr('');
    try {
      const value = tab === 'tags' ? newName.trim() : picked;
      if (!value) throw new Error('Pick a value first');
      await onAssign?.(tab, [value]);
      setPicked(''); setNewName('');
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div style={S.bulkBar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <strong style={{ color: '#0f172a' }}>{selectedCount} selected</strong>
        {['groups','tags','roles','adminRoles','delete'].map((t) => (
          <button key={t}
                  onClick={() => setTab(t)}
                  style={{ ...S.bulkTab, ...(tab === t ? S.bulkTabActive : null), color: t === 'delete' ? '#dc2626' : '#0f172a' }}>
            {labelForBulkTab(t)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {tab === 'tags' ? (
          <input style={modal.input} placeholder="Add tag…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        ) : tab !== 'delete' ? (
          <select style={modal.select} value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Choose…</option>
            {options.map((opt) => (
              <option key={opt._id || opt.id} value={opt._id || opt.id}>
                {opt.name || opt.label || opt.id}
              </option>
            ))}
          </select>
        ) : (
          <span style={S.muted}>Permanently remove the selected users.</span>
        )}
        <button
          style={tab === 'delete' ? { ...modal.saveBtn, background: '#dc2626' } : modal.saveBtn}
          disabled={busy}
          onClick={apply}
        >
          {tab === 'delete' ? 'Delete those users' : busy ? 'Working…' : 'Add'}
        </button>
      </div>
      {err && <div style={{ ...modal.error, marginTop: '6px' }}>{err}</div>}
    </div>
  );
}

function labelForBulkTab(t) {
  return ({ groups: 'Groups', tags: 'Tags', roles: 'Feature roles', adminRoles: 'Admin roles', delete: 'Delete' }[t] || t);
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
  const res = await fetch(`/api/admin/users/export.xlsx?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/:/g, '_').replace(/\..+$/, '');
  a.href = url;
  a.download = `ft-users-${ts}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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

  const [search,  setSearch]  = useState('');
  const [fRealms, setFRealms] = useState([]);
  const [fGroups, setFGroups] = useState([]);
  const [fRoles,  setFRoles]  = useState([]);
  const [fTags,   setFTags]   = useState([]);
  const [fOrigins,setFOrigins]= useState([]);

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

  // Server-side filtering — debounced query string.
  const filterParams = useMemo(() => ({
    q:     search.trim() || '',
    realm: fRealms[0] || '',
    group: fGroups[0] || '',
    role:  fRoles[0]  || '',
    tag:   fTags[0]   || '',
    origin: ORIGIN_QUERY_VALUES[fOrigins[0]] || '',
  }), [search, fRealms, fGroups, fRoles, fTags, fOrigins]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filterParams)) if (v) params.set(k, v);
      params.set('limit', '100');
      const res = await api.get(`/admin/users?${params}`);
      setUsers(res.users || []);
      setTotal(res.total ?? (res.users?.length ?? 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterParams]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

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

  const bulkAssign = async (tab, values) => {
    const dimension = tab === 'roles' ? 'roles' : tab === 'adminRoles' ? 'adminRoles' : tab;
    await api.post('/admin/users/bulk-assign', { userIds: selectedIds, dimension, values, op: 'add' });
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

  const isBehaviorAdmin =
    actor?.role === 'superadmin' ||
    (actor?.permissions || []).includes('BEHAVIOR_DATA_USER') ||
    (actor?.adminRoles || []).includes('USERS_ADMIN');

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
          <button type="button" style={S.linkBtn} onClick={() => downloadXlsx(filterParams).catch((e) => alert(e.message))}>
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
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Filtering by</span>
          <FilterDropdown label="All Realms"  options={realmOptions} selected={fRealms} onChange={setFRealms} />
          <FilterDropdown label="All Groups"  options={groupOptions} selected={fGroups} onChange={setFGroups} />
          <FilterDropdown label="All Roles"   options={roleOptions}  selected={fRoles}  onChange={setFRoles} />
          <FilterDropdown label="All Tags"    options={tagOptions}   selected={fTags}   onChange={setFTags} />
          <FilterDropdown label="All Origins" options={originLabels} selected={fOrigins} onChange={setFOrigins} />
        </div>
        <div style={S.legend}>
          <div style={S.legendTitle}>Origin</div>
          {Object.entries(ORIGINS).map(([k, o]) => (
            <div key={k} style={S.legendItem}>
              <span style={{ ...S.dot, background: o.color }} />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.tableWrap}>
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
                {['User', 'Last activity', 'Created on', 'Realm', 'Access groups', 'Roles', 'Tags', 'Stats', ''].map((h) => (
                  <th key={h} style={S.th}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {h}
                      {h && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.5 }}>
                          <polyline points="8 9 12 5 16 9" /><polyline points="16 15 12 19 8 15" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const tb = tierBadge(u.role);
                const checked = selectedIds.includes(u._id);
                return (
                  <tr key={u._id} style={{ ...S.row, ...(u.lockedManually ? { background: '#fef2f2' } : null) }}>
                    <td style={{ ...S.td, paddingLeft: '8px' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleRow(u._id)} aria-label="Select user" />
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ ...S.avatar, background: avatarColor(u.email || u.name) }}>{initials(u.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              style={S.userNameBtn}
                              onClick={() => setDrawerUserId(u._id)}
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
                      </div>
                    </td>
                    <td style={S.td}><span style={S.dateText}>{formatDateTime(u.lastActivityAt)}</span></td>
                    <td style={S.td}><span style={S.dateText}>{formatDate(u.createdAt)}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.realmTag, background: realmBg(u.realm), color: realmColor(u.realm) }}>
                        {REALM_LABELS[u.realm] || u.realm}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {(u.groupsWithOrigin || []).length === 0 && <span style={S.muted}>—</span>}
                        {(u.groupsWithOrigin || []).slice(0, 4).map((g) => (
                          <ChipWithOrigin key={g._id} origin={g.origin} bg="#dbeafe" color="#1d4ed8">#{g.name}</ChipWithOrigin>
                        ))}
                        {(u.groupsWithOrigin || []).length > 4 && (
                          <span style={S.moreTag}>+{u.groupsWithOrigin.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        <span style={{ ...S.tierBadge, background: tb.bg, color: tb.color }}>
                          #{(u.role || '').toUpperCase()}
                        </span>
                        {(u.featureRolesWithOrigin || []).slice(0, 3).map((p) => (
                          <ChipWithOrigin key={p.value} origin={p.origin} bg="#fee2e2" color="#991b1b">#{p.value}</ChipWithOrigin>
                        ))}
                        {(u.featureRolesWithOrigin || []).length > 3 && (
                          <span style={S.moreTag}>+{u.featureRolesWithOrigin.length - 3}</span>
                        )}
                        {(u.adminRolesWithOrigin || []).slice(0, 2).map((p) => (
                          <ChipWithOrigin key={`admin-${p.value}`} origin={p.origin} bg="#ede9fe" color="#5b21b6">#{p.value}</ChipWithOrigin>
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
                      <button type="button" style={S.statsBtn} onClick={() => setDrawerUserId(u._id)} title="View stats">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6"  y1="20" x2="6"  y2="14" />
                        </svg>
                      </button>
                    </td>
                    <td style={{ ...S.td, position: 'relative', textAlign: 'right' }}>
                      <button style={S.kebab}
                              onClick={(e) => { e.stopPropagation(); setOpenMenu((m) => (m === u._id ? null : u._id)); }}
                              aria-label="Actions">⋮</button>
                      {openMenu === u._id && (
                        <div style={S.kebabMenu} onMouseDown={(e) => e.stopPropagation()}>
                          <button style={S.kebabItem} onClick={() => { setDrawerUserId(u._id); setOpenMenu(null); }}>
                            Edit user
                          </button>
                          {isBehaviorAdmin && (
                            <>
                              <a href={`/admin/analytics/document-views?user=${u._id}`} style={{ ...S.kebabItem, textDecoration: 'none', display: 'block' }}>
                                Viewed documents
                              </a>
                              <a href={`/admin/analytics/sessions?user=${u._id}`} style={{ ...S.kebabItem, textDecoration: 'none', display: 'block' }}>
                                Session list
                              </a>
                            </>
                          )}
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

      {selectedIds.length > 0 && selectedIds.length !== 2 && (
        <BulkBar
          selectedCount={selectedIds.length}
          onAssign={bulkAssign}
          onDelete={bulkDelete}
          vocab={vocab}
          allGroups={allGroups}
        />
      )}
      {selectedIds.length === 2 && (
        <CopyMergeBar
          users={users}
          selected={selectedIds}
          onClear={() => setSelectedIds([])}
          onDone={async () => { setSelectedIds([]); await load(); }}
        />
      )}

      {drawerUserId && (
        <UserDrawer
          userId={drawerUserId}
          vocab={vocab}
          actor={actor}
          allGroups={allGroups}
          refreshAllGroups={loadGroups}
          onClose={() => setDrawerUserId(null)}
          onSaved={(u) => { handleSaved(u); }}
          onDeleted={handleDeleted}
        />
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
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['USERS_ADMIN']}
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
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    color: '#fff', fontSize: '0.75rem', fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
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
  tierBadge: {
    borderRadius: '4px', padding: '1px 6px',
    fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
  },
  moreTag: {
    background: '#f1f5f9', color: '#475569', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500,
  },
  statusPill: { borderRadius: '4px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 },
  statsBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#94a3b8', padding: '4px',
  },
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
};

const D = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
    zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
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
  body:  { padding: '14px 16px', flex: 1, overflowY: 'auto' },
  footer:{
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
    background: '#fff', display: 'flex', alignItems: 'center',
  },
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
