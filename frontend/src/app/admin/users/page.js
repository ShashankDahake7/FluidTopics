'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import api, { getStoredUser } from '@/lib/api';
import AdminShell from '@/components/admin/AdminShell';

const DEFAULT_ASSIGNABLE_ROLES = ['viewer', 'editor', 'admin'];

const ALL_PERMISSIONS = [
  { id: 'PRINT_USER',                label: 'Print',               group: 'Unauthenticated' },
  { id: 'RATING_USER',               label: 'Rate content',        group: 'Unauthenticated' },
  { id: 'FEEDBACK_USER',             label: 'Send feedback',       group: 'Unauthenticated' },
  { id: 'GENERATIVE_AI_USER',        label: 'Use AI features',     group: 'Unauthenticated' },
  { id: 'GENERATIVE_AI_EXPORT_USER', label: 'Export AI',           group: 'Unauthenticated' },
  { id: 'PERSONAL_BOOK_USER',        label: 'Personal books',      group: 'Authenticated' },
  { id: 'PERSONAL_BOOK_SHARE_USER',  label: 'Share personal books',group: 'Authenticated' },
  { id: 'HTML_EXPORT_USER',          label: 'HTML export',         group: 'Authenticated' },
  { id: 'PDF_EXPORT_USER',           label: 'PDF export',          group: 'Authenticated' },
  { id: 'SAVED_SEARCH_USER',         label: 'Save searches',       group: 'Authenticated' },
  { id: 'COLLECTION_USER',           label: 'Collections',         group: 'Authenticated' },
  { id: 'OFFLINE_USER',              label: 'Offline access',      group: 'Authenticated' },
  { id: 'ANALYTICS_USER',            label: 'Analytics (no PII)',  group: 'Authenticated' },
  { id: 'BETA_USER',                 label: 'Beta features',       group: 'Authenticated' },
  { id: 'DEBUG_USER',                label: 'Debug tools',         group: 'Authenticated' },
];

// Origin meta — three colored dots in the top-right legend.
const ORIGINS = {
  sso:    { color: '#22c55e', label: 'authentication provider' },
  manual: { color: '#f97316', label: 'manually added' },
  default:{ color: '#3b82f6', label: 'default' },
};

function originOf(u) {
  if (u?.ssoProvider) return 'sso';
  if (u?.createdAt)   return 'manual';
  return 'default';
}

const roleBadge = (role) => ({
  superadmin: { bg: '#ede9fe', color: '#5b21b6' },
  admin:      { bg: '#fee2e2', color: '#991b1b' },
  editor:     { bg: '#fef3c7', color: '#92400e' },
  viewer:     { bg: '#f1f5f9', color: '#475569' },
}[role] || { bg: '#f1f5f9', color: '#475569' });

function roleOptionLabel(role) {
  if (role === 'superadmin') return 'Super admin';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

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
// User modal (create / edit)
// ---------------------------------------------------------------------------
function UserModal({ user, onClose, onSaved, assignableRoles = DEFAULT_ASSIGNABLE_ROLES }) {
  const isEdit = !!user?._id;
  const [form, setForm] = useState({
    name:        user?.name || '',
    email:       user?.email || '',
    password:    '',
    role:        user?.role || 'viewer',
    isActive:    user?.isActive !== false,
    permissions: user?.permissions || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const toggle = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const togglePerm = (id) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const result = isEdit
        ? await api.patch(`/admin/users/${user._id}`, payload)
        : await api.post('/admin/users', payload);
      onSaved(result.user);
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(ALL_PERMISSIONS.map((p) => p.group))];
  const roleOrder = { superadmin: 0, admin: 1, editor: 2, viewer: 3 };
  const rolesForSelect = [...new Set([...assignableRoles, form.role].filter(Boolean))].sort(
    (a, b) => (roleOrder[a] ?? 99) - (roleOrder[b] ?? 99)
  );

  return (
    <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal.box}>
        <div style={modal.header}>
          <h3 style={modal.title}>{isEdit ? 'Edit user' : 'New user'}</h3>
          <button style={modal.close} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={modal.body}>
          {error && <div style={modal.error}>{error}</div>}

          <div style={modal.row}>
            <label style={modal.label}>Name *</label>
            <input
              style={modal.input}
              value={form.name}
              onChange={(e) => toggle('name', e.target.value)}
              required
            />
          </div>

          <div style={modal.row}>
            <label style={modal.label}>Email *</label>
            <input
              style={modal.input}
              type="email"
              value={form.email}
              onChange={(e) => toggle('email', e.target.value)}
              required
            />
          </div>

          <div style={modal.row}>
            <label style={modal.label}>{isEdit ? 'New password (leave blank to keep)' : 'Password *'}</label>
            <input
              style={modal.input}
              type="password"
              value={form.password}
              onChange={(e) => toggle('password', e.target.value)}
              required={!isEdit}
              placeholder={isEdit ? 'Leave blank to keep current' : ''}
            />
          </div>

          <div style={modal.row2}>
            <div style={{ flex: 1 }}>
              <label style={modal.label}>Role</label>
              <select
                style={modal.select}
                value={form.role}
                onChange={(e) => toggle('role', e.target.value)}
              >
                {rolesForSelect.map((r) => (
                  <option key={r} value={r}>{roleOptionLabel(r)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={modal.label}>Status</label>
              <select
                style={modal.select}
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => toggle('isActive', e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style={modal.permSection}>
            <div style={modal.permTitle}>Feature permissions</div>
            {groups.map((grp) => (
              <div key={grp} style={{ marginBottom: '12px' }}>
                <div style={modal.permGroup}>{grp} users</div>
                <div style={modal.permGrid}>
                  {ALL_PERMISSIONS.filter((p) => p.group === grp).map((p) => (
                    <label key={p.id} style={modal.permItem}>
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.id)}
                        onChange={() => togglePerm(p.id)}
                        style={{ marginRight: '6px' }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={modal.footer}>
            <button type="button" style={modal.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={modal.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update user' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter dropdown (multi-select with checkbox list)
// ---------------------------------------------------------------------------
function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const summary =
    selected.length === 0 ? label
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  };

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
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                style={{ marginRight: '8px' }}
              />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" style={F.clear} onClick={() => onChange([])}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner content rendered inside AdminShell
// ---------------------------------------------------------------------------
function ManageUsersInner() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [actorRole, setActorRole] = useState(null);

  const [search, setSearch] = useState('');
  const [fRealms, setFRealms]     = useState([]);
  const [fGroups, setFGroups]     = useState([]);
  const [fRoles,  setFRoles]      = useState([]);
  const [fTags,   setFTags]       = useState([]);
  const [fOrigins,setFOrigins]    = useState([]);

  const assignableRoles =
    actorRole === 'superadmin'
      ? ['viewer', 'editor', 'admin', 'superadmin']
      : DEFAULT_ASSIGNABLE_ROLES;

  useEffect(() => { setActorRole(getStoredUser()?.role || null); }, []);

  const load = () => {
    setLoading(true);
    api.get('/admin/users')
      .then((d) => setUsers(d.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // close kebab on outside click
  useEffect(() => {
    if (!openMenu) return;
    const onDoc = () => setOpenMenu(null);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenu]);

  const handleSaved = (user) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u._id === user._id);
      return idx >= 0 ? prev.map((u) => (u._id === user._id ? user : u)) : [user, ...prev];
    });
    setEditUser(null);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeleteId(null);
    }
  };

  // Build option lists from loaded users.
  const realmOptions = useMemo(() => {
    const s = new Set();
    users.forEach((u) => (u.groups || []).forEach((g) => s.add(g?.name || g)));
    return [...s].filter(Boolean).sort();
  }, [users]);
  const groupOptions = realmOptions; // same source for now
  const roleOptions  = useMemo(() => [...new Set(users.map((u) => u.role).filter(Boolean))].sort(), [users]);
  const tagOptions   = useMemo(() => {
    const s = new Set();
    users.forEach((u) => (u.tags || []).forEach((t) => s.add(t)));
    return [...s].filter(Boolean).sort();
  }, [users]);
  const originLabels = ['authentication provider', 'manually added', 'default'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.name || ''} ${u.email || ''} ${u._id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fRoles.length && !fRoles.includes(u.role)) return false;
      if (fRealms.length) {
        const names = (u.groups || []).map((g) => g?.name || g);
        if (!fRealms.some((r) => names.includes(r))) return false;
      }
      if (fGroups.length) {
        const names = (u.groups || []).map((g) => g?.name || g);
        if (!fGroups.some((g) => names.includes(g))) return false;
      }
      if (fTags.length) {
        const tags = u.tags || [];
        if (!fTags.some((t) => tags.includes(t))) return false;
      }
      if (fOrigins.length) {
        const o = ORIGINS[originOf(u)].label;
        if (!fOrigins.includes(o)) return false;
      }
      return true;
    });
  }, [users, search, fRealms, fGroups, fRoles, fTags, fOrigins]);

  const downloadXlsx = () => {
    const headers = ['Name', 'Email', 'Role', 'Active', 'Created', 'Last login', 'Tags'];
    const rows = filtered.map((u) => [
      u.name, u.email, u.role,
      u.isActive ? 'yes' : 'no',
      u.createdAt ? new Date(u.createdAt).toISOString() : '',
      u.lastLogin ? new Date(u.lastLogin).toISOString() : '',
      (u.tags || []).join(';'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div style={S.headerRow}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <h1 style={S.title}>Manage users</h1>
          <span style={S.count}>{filtered.length.toLocaleString()} users</span>
        </div>
        <div style={S.actions}>
          <button type="button" style={S.linkBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            Edit default roles
          </button>
          <button type="button" style={S.linkBtn} onClick={downloadXlsx}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download xlsx
          </button>
          <button type="button" style={S.primaryBtn} onClick={() => setEditUser({})}>
            + New user
          </button>
        </div>
      </div>

      <div style={S.filterBar}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Search</span>
          <input
            style={S.searchInput}
            placeholder="Username, email, user ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          {Object.values(ORIGINS).map((o) => (
            <div key={o.label} style={S.legendItem}>
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
                {['User', 'Last activity', 'Created on', 'Realms', 'Access groups', 'Roles', 'Tags', 'Stats', ''].map((h) => (
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
              {filtered.map((u) => {
                const rb = roleBadge(u.role);
                const origin = ORIGINS[originOf(u)];
                const realmNames = (u.groups || []).map((g) => g?.name || g).filter(Boolean);
                return (
                  <tr key={u._id} style={S.row}>
                    <td style={{ ...S.td, paddingLeft: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span title={origin.label} style={{ ...S.dot, background: origin.color, flexShrink: 0 }} />
                        <input type="checkbox" style={{ flexShrink: 0 }} />
                        <span style={{ ...S.avatar, background: avatarColor(u.email || u.name) }}>
                          {initials(u.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={S.userName}>{u.name}</div>
                          <div style={S.userMeta}>{u.email}</div>
                          <div style={{ ...S.userMeta, fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.85 }}>
                            ID: {u._id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={S.dateText}>{formatDateTime(u.lastLogin)}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.dateText}>{formatDate(u.createdAt)}</span>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {realmNames.length === 0 && <span style={S.muted}>—</span>}
                        {realmNames.map((r) => (
                          <span key={r} style={S.realmTag}>#{r}</span>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {realmNames.length === 0 && <span style={S.muted}>—</span>}
                        {realmNames.slice(0, 3).map((r) => (
                          <span key={r} style={S.groupTag}>#{r}</span>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        <span style={{ ...S.roleBadge, background: rb.bg, color: rb.color }}>
                          #{u.role?.toUpperCase()}
                        </span>
                        {(u.permissions || []).slice(0, 3).map((p) => (
                          <span key={p} style={S.permTag}>#{p}</span>
                        ))}
                        {(u.permissions || []).length > 3 && (
                          <span style={S.moreTag}>+{u.permissions.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={S.tagWrap}>
                        {(u.tags || []).length === 0 && <span style={S.muted}>—</span>}
                        {(u.tags || []).map((t) => (
                          <span key={t} style={S.userTag}>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td style={S.td}>
                      <button style={S.statsBtn} title="View stats">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6"  y1="20" x2="6"  y2="14" />
                        </svg>
                      </button>
                    </td>
                    <td style={{ ...S.td, position: 'relative', textAlign: 'right' }}>
                      <button
                        style={S.kebab}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu((m) => (m === u._id ? null : u._id));
                        }}
                        aria-label="Actions"
                      >
                        ⋮
                      </button>
                      {openMenu === u._id && (
                        <div style={S.kebabMenu} onMouseDown={(e) => e.stopPropagation()}>
                          <button style={S.kebabItem} onClick={() => { setEditUser(u); setOpenMenu(null); }}>
                            Edit user
                          </button>
                          <button
                            style={{ ...S.kebabItem, color: '#dc2626' }}
                            onClick={() => { setDeleteId(u._id); setOpenMenu(null); }}
                          >
                            Delete user
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    No users match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editUser !== null && (
        <UserModal
          user={editUser?._id ? editUser : null}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
          assignableRoles={assignableRoles}
        />
      )}

      {deleteId && (
        <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ ...modal.box, maxWidth: '380px' }}>
            <div style={modal.header}>
              <h3 style={modal.title}>Delete user?</h3>
              <button style={modal.close} onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', color: '#475569', fontSize: '0.875rem' }}>
              This action cannot be undone.
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={modal.cancelBtn} onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                style={{ ...modal.saveBtn, background: '#dc2626' }}
                onClick={() => handleDelete(deleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminShell active="manage-users-list" allowedRoles={['superadmin']}>
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
  filterGroup: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
  },
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
  dot: {
    width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
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
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    color: '#fff', fontSize: '0.75rem', fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userName: { fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' },
  userMeta: { fontSize: '0.74rem', color: '#64748b' },
  dateText: { fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' },
  muted:    { color: '#94a3b8', fontSize: '0.78rem' },
  tagWrap:  { display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '220px' },
  realmTag: {
    background: '#fef3c7', color: '#92400e', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500, whiteSpace: 'nowrap',
  },
  groupTag: {
    background: '#dbeafe', color: '#1d4ed8', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500, whiteSpace: 'nowrap',
  },
  permTag: {
    background: '#fee2e2', color: '#991b1b', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500, whiteSpace: 'nowrap',
  },
  roleBadge: {
    borderRadius: '4px', padding: '1px 6px',
    fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
  },
  moreTag: {
    background: '#f1f5f9', color: '#475569', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500,
  },
  userTag: {
    background: '#f1f5f9', color: '#475569', borderRadius: '4px',
    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 500,
  },
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
    minWidth: '160px', zIndex: 5, padding: '4px',
  },
  kebabItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a',
    fontFamily: 'inherit', borderRadius: '4px',
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

const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
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
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', fontSize: '1rem',
  },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  row:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  row2: { display: 'flex', gap: '14px' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  input: {
    padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  },
  select: {
    padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
    width: '100%',
  },
  permSection: { borderTop: '1px solid #e5e7eb', paddingTop: '14px' },
  permTitle:  { fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px' },
  permGroup:  { fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' },
  permGrid:   { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  permItem:   { fontSize: '0.8rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' },
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
