'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

const ROLES = ['viewer', 'editor', 'admin'];

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

const roleBadge = (role) => ({
  admin:  { bg: '#fee2e2', color: '#991b1b' },
  editor: { bg: '#fef3c7', color: '#92400e' },
  viewer: { bg: '#f1f5f9', color: '#475569' },
}[role] || { bg: '#f1f5f9', color: '#475569' });

// ---------------------------------------------------------------------------
// User modal (create / edit)
// ---------------------------------------------------------------------------
function UserModal({ user, onClose, onSaved }) {
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

  return (
    <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal.box}>
        <div style={modal.header}>
          <h3 style={modal.title}>{isEdit ? 'Edit User' : 'Create User'}</h3>
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
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
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

          {/* Permissions */}
          <div style={modal.permSection}>
            <div style={modal.permTitle}>Feature Permissions</div>
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
              {saving ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions badge list
// ---------------------------------------------------------------------------
function PermBadges({ perms }) {
  if (!perms?.length) return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>None</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {perms.slice(0, 3).map((p) => (
        <span key={p} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 500 }}>
          {p.replace(/_USER$/, '').replace(/_/g, ' ')}
        </span>
      ))}
      {perms.length > 3 && (
        <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '4px', padding: '1px 6px', fontSize: '0.68rem' }}>
          +{perms.length - 3} more
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminUsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);  // null = closed, {} = create, user = edit
  const [deleteId, setDeleteId] = useState(null);
  const [search,  setSearch]  = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/users')
      .then((d) => setUsers(d.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (user) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u._id === user._id);
      return idx >= 0 ? prev.map((u) => u._id === user._id ? user : u) : [user, ...prev];
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

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
      <main className="container" style={{ padding: '32px 0 56px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>User Management</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Manage users, roles, and feature permissions
            </p>
          </div>
          <button
            style={page.createBtn}
            onClick={() => setEditUser({})}
          >
            + Add User
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            style={page.searchInput}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['User', 'Role', 'Permissions', 'Status', 'Last login', ''].map((h) => (
                    <th key={h} style={page.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const rb = roleBadge(u.role);
                  return (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={page.td}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </td>
                      <td style={page.td}>
                        <span style={{ background: rb.bg, color: rb.color, borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={page.td}><PermBadges perms={u.permissions} /></td>
                      <td style={page.td}>
                        <span style={{ color: u.isActive ? 'var(--success)' : '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={page.td}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-US') : '—'}
                        </span>
                      </td>
                      <td style={{ ...page.td, textAlign: 'right' }}>
                        <button style={page.editBtn} onClick={() => setEditUser(u)}>Edit</button>
                        <button
                          style={page.deleteBtn}
                          onClick={() => setDeleteId(u._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Create / Edit modal */}
      {editUser !== null && (
        <UserModal
          user={editUser?._id ? editUser : null}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={modal.overlay} onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ ...modal.box, maxWidth: '380px' }}>
            <div style={modal.header}>
              <h3 style={modal.title}>Delete user?</h3>
              <button style={modal.close} onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const page = {
  createBtn: {
    background: 'var(--accent-primary)', color: '#fff',
    border: 'none', borderRadius: '6px', padding: '8px 16px',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  searchInput: {
    padding: '8px 14px', fontSize: '0.875rem', width: '320px',
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    outline: 'none', fontFamily: 'var(--font-sans)',
  },
  th: {
    textAlign: 'left', padding: '10px 16px',
    fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  editBtn: {
    background: 'transparent', border: '1px solid var(--border-color)',
    borderRadius: '5px', padding: '4px 10px', fontSize: '0.78rem',
    color: 'var(--text-secondary)', cursor: 'pointer',
    marginRight: '6px', fontFamily: 'var(--font-sans)',
  },
  deleteBtn: {
    background: 'transparent', border: '1px solid #fecaca',
    borderRadius: '5px', padding: '4px 10px', fontSize: '0.78rem',
    color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-sans)',
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
    background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  error: {
    background: '#fee2e2', color: '#991b1b', borderRadius: '6px',
    padding: '10px 14px', fontSize: '0.85rem',
  },
};
