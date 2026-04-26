'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// All available roles (matches the chips visible across rows in the reference).
const ALL_ROLES = [
  'ADMIN',
  'KHUB_ADMIN',
  'USERS_ADMIN',
  'PORTAL_ADMIN',
  'ANNOUNCEMENT_ADMIN',
  'CONTENT_PUBLISHER',
  'PERSONAL_BOOK_USER',
  'PERSONAL_BOOK_SHARE_USER',
  'SAVED_SEARCH_USER',
  'COLLECTION_USER',
  'RATING_USER',
  'FEEDBACK_USER',
  'OFFLINE_USER',
  'ANALYTICS_USER',
  'BETA_USER',
  'DEBUG_USER',
  'PRINT_USER',
  'HTML_EXPORT_USER',
  'PDF_EXPORT_USER',
  'GENERATIVE_AI_USER',
  'GENERATIVE_AI_EXPORT_USER',
  'BEHAVIOR_DATA_USER',
];

const ALL_GROUPS = ['Fluid Topics Staff', 'DB_internal', 'Customer Success', 'Engineering'];

const SEED_KEYS = [
  {
    id: 'k_ft_ps',
    name: 'FT-PS-API',
    createdOn: '1/18/23',
    lastActivity: '10/20/23, 6:18 PM',
    groups: ['Fluid Topics Staff'],
    roles: ['ADMIN'],
    ipRestrictions: '',
    secret: 'ft-ps-secret-7a91-4e2c-9b3f-2d8a',
  },
  {
    id: 'k_paligo',
    name: 'Paligo-Key',
    createdOn: '1/18/23',
    lastActivity: '4/23/26, 10:26 AM',
    groups: [],
    roles: ['CONTENT_PUBLISHER'],
    ipRestrictions: '',
    secret: 'paligo-c83b-12fd-44a1-e90c-7b22',
  },
  {
    id: 'k_content_pub',
    name: 'content-publisher',
    createdOn: '1/20/23',
    lastActivity: '6/23/23, 1:46 PM',
    groups: ['DB_internal'],
    roles: ['KHUB_ADMIN'],
    ipRestrictions: '',
    secret: 'content-pub-29ae-8901-bc12-e4d6',
  },
  {
    id: 'k_db_prod_client',
    name: 'darwinbox-prod-client-user',
    createdOn: '6/30/23',
    lastActivity: '11/6/25, 3:50 PM',
    groups: [],
    roles: ['USERS_ADMIN'],
    ipRestrictions: '',
    secret: 'db-prod-95fa-2bcd-9e10-3a7c',
  },
  {
    id: 'k_beacon',
    name: 'Beacon',
    createdOn: '6/3/24',
    lastActivity: '4/14/26, 12:50 PM',
    groups: ['DB_internal'],
    roles: ['SAVED_SEARCH_USER', 'COLLECTION_USER', 'RATING_USER', 'FEEDBACK_USER'],
    ipRestrictions: '',
    secret: 'beacon-5612-76de-cab8-1090',
  },
  {
    id: 'k_internaltest',
    name: 'internaltestingdb',
    createdOn: '12/30/24',
    lastActivity: '1/28/25, 5:44 PM',
    groups: ['DB_internal'],
    roles: ['SAVED_SEARCH_USER', 'COLLECTION_USER', 'RATING_USER', 'FEEDBACK_USER'],
    ipRestrictions: '',
    secret: 'internaltest-ad33-19c1-7710',
  },
  {
    id: 'k_docteam',
    name: 'docteam',
    createdOn: '1/22/25',
    lastActivity: '12/30/25, 1:59 PM',
    groups: ['DB_internal'],
    roles: [
      'PERSONAL_BOOK_USER', 'PERSONAL_BOOK_SHARE_USER', 'SAVED_SEARCH_USER',
      'ANALYTICS_USER', 'RATING_USER', 'FEEDBACK_USER', 'GENERATIVE_AI_USER',
      'USERS_ADMIN', 'ADMIN',
    ],
    ipRestrictions: '',
    secret: 'docteam-8821-aa12-5511-9c7f',
  },
  {
    id: 'k_prem',
    name: 'prem',
    createdOn: '12/30/25',
    lastActivity: '12/30/25, 2:09 PM',
    groups: [],
    roles: [
      'PERSONAL_BOOK_USER', 'PERSONAL_BOOK_SHARE_USER', 'HTML_EXPORT_USER',
      'PDF_EXPORT_USER', 'SAVED_SEARCH_USER', 'COLLECTION_USER', 'OFFLINE_USER',
      'ANALYTICS_USER', 'BETA_USER', 'DEBUG_USER', 'PRINT_USER', 'RATING_USER',
      'FEEDBACK_USER', 'GENERATIVE_AI_USER', 'GENERATIVE_AI_EXPORT_USER',
      'CONTENT_PUBLISHER', 'BEHAVIOR_DATA_USER', 'ANNOUNCEMENT_ADMIN',
      'KHUB_ADMIN', 'USERS_ADMIN', 'PORTAL_ADMIN', 'ADMIN',
    ],
    ipRestrictions: '',
    secret: 'prem-1234-abcd-5678-efab',
  },
];

const todayShort = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
};

function genSecret() {
  // crypto-quality, but not exposed to network
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState(SEED_KEYS);
  const [baseline, setBaseline] = useState(SEED_KEYS);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // key id being edited
  const [copiedId, setCopiedId] = useState(null);
  const newRef = useRef(null);

  const dirty = useMemo(
    () => JSON.stringify(keys) !== JSON.stringify(baseline),
    [keys, baseline],
  );
  const canCreate = newName.trim().length > 0
    && !keys.some((k) => k.name.toLowerCase() === newName.trim().toLowerCase());

  const onCancel = () => { setKeys(baseline); setEditing(null); };
  const onSave   = () => setBaseline(keys);

  const onCreate = () => {
    if (!canCreate) return;
    const k = {
      id: `k_new_${Date.now()}`,
      name: newName.trim(),
      createdOn: todayShort(),
      lastActivity: '—',
      groups: [],
      roles: [],
      ipRestrictions: '',
      secret: genSecret(),
    };
    setKeys((ks) => [...ks, k]);
    setNewName('');
    setEditing(k.id);
  };

  const onCopy = async (k) => {
    try { await navigator.clipboard.writeText(k.secret); }
    catch { /* clipboard unavailable */ }
    setCopiedId(k.id);
    window.clearTimeout(onCopy._t);
    onCopy._t = window.setTimeout(() => setCopiedId(null), 1400);
  };
  const onDelete = (id) => setKeys((ks) => ks.filter((k) => k.id !== id));
  const onUpdate = (id, patch) =>
    setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  return (
    <AdminShell
      active="integ-api-keys"
      allowedRoles={['superadmin']}
      footer={
        <>
          <button
            type="button"
            style={{ ...S.btnCancel, opacity: dirty ? 1 : 0.6, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onCancel}
            disabled={!dirty}
          >
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onSave}
            disabled={!dirty}
          >
            <CheckIcon /> <span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ paddingBottom: '40px' }}>
        <h1 style={S.h1}>API keys</h1>
        <p style={S.subtitle}>Declare integrations that need to access Fluid Topics.</p>

        <div style={S.tableWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: '14%' }}>Name</th>
                  <th style={{ ...S.th, width: '8%' }}>Created on</th>
                  <th style={{ ...S.th, width: '12%' }}>Last activity</th>
                  <th style={{ ...S.th, width: '12%' }}>Groups</th>
                  <th style={{ ...S.th, width: '32%' }}>Roles</th>
                  <th style={{ ...S.th, width: '10%' }}>IP restrictions</th>
                  <th style={S.thAction} />
                  <th style={S.thAction} />
                  <th style={S.thAction} />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={S.tr}>
                    <td style={S.td}>{k.name}</td>
                    <td style={S.td}>{k.createdOn}</td>
                    <td style={S.td}>{k.lastActivity}</td>
                    <td style={S.td}>
                      <ChipList values={k.groups} variant="group" />
                    </td>
                    <td style={S.td}>
                      <ChipList values={k.roles} variant="role" />
                    </td>
                    <td style={{ ...S.td, color: '#94a3b8' }}>
                      {k.ipRestrictions || '—'}
                    </td>
                    <td style={S.tdAction}>
                      <button
                        type="button"
                        style={S.iconBtn}
                        onClick={() => onCopy(k)}
                        title={copiedId === k.id ? 'Copied!' : 'Copy API key to clipboard'}
                        aria-label="Copy API key to clipboard"
                      >
                        {copiedId === k.id ? <CheckIcon /> : <ClipboardIcon />}
                      </button>
                    </td>
                    <td style={S.tdAction}>
                      <button
                        type="button"
                        style={S.iconBtn}
                        onClick={() => setEditing(k.id)}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilIcon />
                      </button>
                    </td>
                    <td style={S.tdAction}>
                      <button
                        type="button"
                        style={S.iconBtnDanger}
                        onClick={() => onDelete(k.id)}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <CrossIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={S.createRow}>
            <input
              ref={newRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
              placeholder="Name"
              autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
              style={S.createInput}
              aria-label="Add value"
            />
            <button
              type="button"
              onClick={onCreate}
              disabled={!canCreate}
              style={{
                ...S.createBtn,
                opacity: canCreate ? 1 : 0.55,
                cursor: canCreate ? 'pointer' : 'default',
              }}
            >
              Create &amp; Add
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <EditKeyDrawer
          api={keys.find((k) => k.id === editing)}
          onClose={() => setEditing(null)}
          onChange={(patch) => onUpdate(editing, patch)}
        />
      )}
    </AdminShell>
  );
}

// ── Chip list (Roles / Groups) ────────────────────────────────────────────
function ChipList({ values, variant }) {
  if (!values || values.length === 0) return <span style={{ color: '#cbd5e1' }}>—</span>;
  const chipStyle = variant === 'group' ? S.chipGroup : S.chipRole;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {values.map((v) => (
        <span key={v} style={chipStyle}>{v}</span>
      ))}
    </div>
  );
}

// ── Edit drawer ───────────────────────────────────────────────────────────
function EditKeyDrawer({ api, onClose, onChange }) {
  if (!api) return null;
  const toggle = (list, v) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <>
      <div style={S.drawerBackdrop} onClick={onClose} />
      <aside style={S.drawer} role="dialog" aria-modal="true">
        <div style={S.drawerHead}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            Edit API key
          </span>
          <button type="button" style={S.iconBtn} onClick={onClose} aria-label="Close">
            <CrossIcon />
          </button>
        </div>

        <div style={S.drawerBody}>
          <Field label="Name">
            <input
              type="text"
              value={api.name}
              onChange={(e) => onChange({ name: e.target.value })}
              style={S.textInput}
            />
          </Field>

          <Field label="API key">
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={api.secret}
                readOnly
                style={{ ...S.textInput, fontFamily: 'monospace', background: '#f8fafc' }}
              />
              <button
                type="button"
                style={S.btnSecondary}
                onClick={() => navigator.clipboard?.writeText(api.secret)}
              >
                Copy
              </button>
            </div>
          </Field>

          <Field label="IP restrictions" hint="Comma-separated list of IPs or CIDR ranges.">
            <input
              type="text"
              value={api.ipRestrictions}
              onChange={(e) => onChange({ ipRestrictions: e.target.value })}
              placeholder="e.g. 10.0.0.0/24, 192.168.1.10"
              style={S.textInput}
            />
          </Field>

          <Field label="Groups">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ALL_GROUPS.map((g) => {
                const on = api.groups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onChange({ groups: toggle(api.groups, g) })}
                    style={on ? S.chipToggleOn : S.chipToggleOff}
                  >{g}</button>
                );
              })}
            </div>
          </Field>

          <Field label="Roles">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ALL_ROLES.map((r) => {
                const on = api.roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChange({ roles: toggle(api.roles, r) })}
                    style={on ? S.chipToggleOn : S.chipToggleOff}
                  >{r}</button>
                );
              })}
            </div>
          </Field>
        </div>

        <div style={S.drawerFoot}>
          <button type="button" style={S.btnSave} onClick={onClose}>
            <CheckIcon /> <span>Done</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },

  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.86rem',
    color: '#0f172a',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'none',
    letterSpacing: 0,
  },
  thAction: {
    width: '40px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: {
    padding: '10px 12px',
    verticalAlign: 'middle',
    fontSize: '0.86rem',
    color: '#0f172a',
  },
  tdAction: {
    padding: '6px 4px',
    width: '40px',
    textAlign: 'center',
    verticalAlign: 'middle',
  },

  // Chips visible in the table
  chipRole: {
    display: 'inline-block',
    padding: '2px 8px',
    border: '1px solid #c084fc',
    color: '#7e22ce',
    background: '#faf5ff',
    borderRadius: '999px',
    fontSize: '0.74rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    lineHeight: 1.5,
  },
  chipGroup: {
    display: 'inline-block',
    padding: '2px 8px',
    border: '1px solid #94a3b8',
    color: '#334155',
    background: '#f1f5f9',
    borderRadius: '999px',
    fontSize: '0.74rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    lineHeight: 1.5,
  },

  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px',
    background: 'transparent', color: '#475569',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  },
  iconBtnDanger: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px',
    background: 'transparent', color: '#dc2626',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  },

  createRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    padding: '10px 12px',
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
  },
  createInput: {
    flex: '0 0 240px',
    border: '1px solid #cbd5e1',
    borderRight: 'none',
    borderRadius: '4px 0 0 4px',
    padding: '8px 10px',
    fontSize: '0.88rem',
    outline: 'none',
    background: '#fff',
    color: '#0f172a',
    fontFamily: 'var(--font-sans)',
  },
  createBtn: {
    background: '#a21caf',
    color: '#fff',
    border: '1px solid #a21caf',
    borderRadius: '0 4px 4px 0',
    padding: '0 14px',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },

  btnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px',
    background: '#fff', color: '#374151',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.85rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },

  drawerBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.35)',
    zIndex: 999,
  },
  drawer: {
    position: 'fixed',
    top: 0, right: 0, bottom: 0,
    width: 'min(560px, 100vw)',
    background: '#fff',
    boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column',
  },
  drawerHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #e2e8f0',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px',
  },
  drawerFoot: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 18px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },

  textInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    color: '#0f172a',
    background: '#fff',
    boxSizing: 'border-box',
  },

  chipToggleOff: {
    padding: '4px 10px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    borderRadius: '999px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  chipToggleOn: {
    padding: '4px 10px',
    border: '1px solid #a21caf',
    background: '#a21caf',
    color: '#fff',
    borderRadius: '999px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
  },
};
