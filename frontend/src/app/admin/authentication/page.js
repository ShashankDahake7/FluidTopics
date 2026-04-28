'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// =============================================================================
// Atomic UI primitives. These mirror the look-and-feel established for the
// Manage users / Legal terms admin pages so the Authentication tab feels
// consistent across the suite.
// =============================================================================

const Check = ({ on }) => (
  <span style={{
    width: '16px', height: '16px',
    border: '2px solid', borderColor: on ? '#1d4ed8' : '#94a3b8',
    background: on ? '#1d4ed8' : 'transparent',
    borderRadius: '3px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    {on && (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </span>
);

function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{ ...S.checkRow, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <Check on={checked} />
      <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{label}</span>
    </button>
  );
}

function RadioOption({ checked, onChange, title, subtitle }) {
  return (
    <label style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      padding: '6px 0', cursor: 'pointer',
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

function Notice({ variant = 'info', children }) {
  const palette = variant === 'warning'
    ? { bg: '#fef3c7', border: '#fde68a', icon: '#b45309', text: '#78350f' }
    : variant === 'error'
      ? { bg: '#fee2e2', border: '#fecaca', icon: '#b91c1c', text: '#7f1d1d' }
      : { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e3a8a' };
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: '4px', padding: '10px 14px', marginTop: '10px',
      color: palette.text, fontSize: '0.85rem', lineHeight: 1.45,
    }}>
      <span style={{ color: palette.icon, marginTop: '2px', display: 'inline-flex' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8"  x2="12.01" y2="8" />
        </svg>
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function IconBtn({ title, danger, onClick, disabled, children }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{
        background: 'transparent', border: 'none', padding: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#cbd5e1' : (danger ? '#dc2626' : '#a21caf'),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '4px',
      }}
    >
      {children}
    </button>
  );
}

function FloatingInput({ label, value, onChange, type = 'text', error, prefix, helper, suffix, multiline, rows = 4 }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value || !!prefix;
  const errored = !!error;
  const inputProps = {
    ref: inputRef,
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
    style: {
      position: 'relative', width: '100%',
      padding: prefix ? '12px 12px 12px 4px' : '12px',
      background: 'transparent', border: 'none', outline: 'none',
      fontSize: '0.9rem', color: '#0f172a',
      fontFamily: multiline ? 'var(--font-mono)' : 'var(--font-sans)',
      boxSizing: 'border-box', resize: multiline ? 'vertical' : undefined,
      minHeight: multiline ? `${rows * 18}px` : undefined,
    },
  };
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{ position: 'relative', background: '#fff', borderRadius: '4px' }}
        onClick={() => inputRef.current?.focus()}
      >
        <fieldset
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            border: errored ? '1.5px solid #dc2626' : focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
            borderRadius: '4px', margin: 0, padding: '0 8px',
            pointerEvents: 'none', textAlign: 'left', minWidth: 0,
          }}
        >
          <legend style={{
            width: isFloated ? 'auto' : 0, maxWidth: '100%',
            padding: isFloated ? '0 4px' : 0,
            fontSize: '0.74rem',
            color: errored ? '#dc2626' : focused ? '#a21caf' : '#475569',
            float: 'unset', height: '11px', visibility: 'visible',
            fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
          }}>{label}</legend>
        </fieldset>
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          {prefix && (
            <span style={{ paddingLeft: '12px', color: '#64748b', fontSize: '0.9rem' }}>{prefix}</span>
          )}
          {multiline
            ? <textarea {...inputProps} rows={rows} />
            : <input    {...inputProps} type={type} />
          }
          {suffix && (
            <span style={{ paddingRight: '8px', display: 'inline-flex', alignItems: 'center' }}>{suffix}</span>
          )}
        </div>
        {!isFloated && (
          <label style={{
            position: 'absolute', left: '12px', top: multiline ? '14px' : '50%',
            transform: multiline ? 'none' : 'translateY(-50%)',
            fontSize: '0.9rem', color: '#94a3b8',
            pointerEvents: 'none', background: 'transparent',
          }}>{label}</label>
        )}
      </div>
      {(error || helper) && (
        <div style={{ fontSize: '0.78rem', marginTop: '4px', color: errored ? '#dc2626' : '#64748b' }}>
          {error || helper}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '10px 16px',
        cursor: 'pointer', fontSize: '0.92rem',
        fontWeight: active ? 700 : 500,
        color:  active ? '#a21caf' : '#475569',
        borderBottom: `3px solid ${active ? '#a21caf' : 'transparent'}`,
        marginBottom: '-1px', fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, desc, children }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2}>{title}</h2>
      {desc && <p style={S.sectionDesc}>{desc}</p>}
      <div style={{ marginTop: '8px' }}>{children}</div>
    </section>
  );
}

function TypeChip({ type }) {
  const palette = TYPE_PALETTE[type] || TYPE_PALETTE.internal;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '999px',
      background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.border}`,
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.02em',
    }}>{REALM_LABELS[type] || type}</span>
  );
}

const TYPE_PALETTE = {
  internal: { bg: '#dbeafe', fg: '#1d4ed8', border: '#bfdbfe' },
  ldap:     { bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  oidc:     { bg: '#fce7f3', fg: '#a21caf', border: '#f9a8d4' },
  saml:     { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' },
  jwt:      { bg: '#e0e7ff', fg: '#4338ca', border: '#c7d2fe' },
};
const REALM_LABELS = {
  internal: 'Internal',
  ldap:     'LDAP',
  oidc:     'OpenID Connect',
  saml:     'SAML 2.0',
  jwt:      'JWT',
};

// =============================================================================
// Page
// =============================================================================
export default function AuthenticationPage() {
  const [tab, setTab] = useState('general');

  // Resolve the current actor — only superadmin/admin can manipulate realms.
  const [actor, setActor] = useState(null);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ft_user') || sessionStorage.getItem('ft_user') || 'null');
      setActor(u);
    } catch { setActor(null); }
  }, []);
  const canEditRealms = actor?.role === 'superadmin' || actor?.role === 'admin';

  // ── General tab ────────────────────────────────────────────────────────────
  const [general, setGeneral]     = useState(null);
  const [generalDraft, setDraft]  = useState(null);
  const [genErr, setGenErr]       = useState('');
  const [genBusy, setGenBusy]     = useState(false);

  const refreshGeneral = useCallback(async () => {
    setGenErr('');
    try {
      const cfg = await api.get('/admin/auth/general');
      setGeneral(cfg);
      setDraft(cfg);
    } catch (e) { setGenErr(e?.message || 'Failed to load settings.'); }
  }, []);

  useEffect(() => { refreshGeneral(); }, [refreshGeneral]);

  const generalDirty = useMemo(() => {
    if (!general || !generalDraft) return false;
    const k = ['requireAuth','openSsoInCurrentWindow','hideCredentialsFormIfSso',
      'logoutRedirectUrl','hideNativeLogout','idleTimeoutEnabled',
      'idleTimeoutMinutes','rememberMeDays','mfaGraceDays'];
    return k.some((key) => JSON.stringify(general[key]) !== JSON.stringify(generalDraft[key]));
  }, [general, generalDraft]);

  const setG = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const onSaveGeneral = async () => {
    if (!generalDraft) return;
    setGenBusy(true); setGenErr('');
    try {
      const saved = await api.put('/admin/auth/general', generalDraft);
      setGeneral(saved);
      setDraft(saved);
    } catch (e) { setGenErr(e?.message || 'Failed to save.'); }
    finally { setGenBusy(false); }
  };
  const onCancelGeneral = () => setDraft(general);

  // ── Realms tab ─────────────────────────────────────────────────────────────
  const [realms, setRealms]   = useState([]);
  const [counts, setCounts]   = useState({});
  const [realmsType, setType] = useState('internal');
  const [realmsErr, setRErr]  = useState('');
  const [drawerOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const baselineOrder = useRef([]);

  const refreshRealms = useCallback(async () => {
    setRErr('');
    try {
      const r = await api.get('/admin/auth/realms');
      setRealms(r.realms || []);
      setCounts(r.counts || {});
      baselineOrder.current = (r.realms || []).map((x) => x.id);
      setOrderDirty(false);
    } catch (e) { setRErr(e?.message || 'Failed to load realms.'); }
  }, []);
  useEffect(() => { refreshRealms(); }, [refreshRealms]);

  const onMove = (idx, dir) => {
    setRealms((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      const nowIds = next.map((x) => x.id);
      setOrderDirty(JSON.stringify(nowIds) !== JSON.stringify(baselineOrder.current));
      return next;
    });
  };
  const onSaveOrder = async () => {
    try {
      await api.put('/admin/auth/realms/order', { order: realms.map((r) => r.id) });
      baselineOrder.current = realms.map((r) => r.id);
      setOrderDirty(false);
    } catch (e) { setRErr(e?.message || 'Failed to save order.'); }
  };
  const onCancelOrder = () => {
    const byId = new Map(realms.map((r) => [r.id, r]));
    setRealms(baselineOrder.current.map((id) => byId.get(id)).filter(Boolean));
    setOrderDirty(false);
  };

  const onCreateRealm = () => { setEditing(null); setOpen(true); };
  const onEditRealm   = (r) => { setEditing(r);   setOpen(true); };
  const onDeleteRealm = async (r) => {
    if (!window.confirm(`Delete realm "${r.identifier}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/auth/realms/${r.id}`);
      await refreshRealms();
    } catch (e) { setRErr(e?.message || 'Failed to delete realm.'); }
  };
  const onSaveRealm = async (payload) => {
    try {
      if (editing) {
        await api.put(`/admin/auth/realms/${editing.id}`, payload);
      } else {
        await api.post('/admin/auth/realms', { ...payload, type: realmsType });
      }
      setOpen(false); setEditing(null);
      await refreshRealms();
    } catch (e) { throw e; /* surfaced inside the drawer */ }
  };

  // Footer CTA shows the dirty state of whichever tab is active.
  const dirty = tab === 'general' ? generalDirty : orderDirty;
  const onCancel = () => (tab === 'general' ? onCancelGeneral() : onCancelOrder());
  const onSave   = () => (tab === 'general' ? onSaveGeneral()   : onSaveOrder());

  // Available realm-type options for the create-row.
  const availableTypes = useMemo(() => {
    const typesPresent = new Set(realms.map((r) => r.type));
    const opts = [
      { id: 'internal', label: 'Internal',         disabled: typesPresent.has('internal') },
      { id: 'ldap',     label: 'LDAP',             disabled: false },
      { id: 'oidc',     label: 'OpenID Connect',   disabled: false },
      { id: 'saml',     label: 'SAML 2.0',         disabled: false },
      { id: 'jwt',      label: 'JWT',              disabled: typesPresent.has('jwt') },
    ];
    return opts;
  }, [realms]);

  return (
    <AdminShell
      active="authentication"
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['PORTAL_ADMIN']}
      footer={
        <>
          <button
            type="button"
            style={{ ...S.btnCancel, opacity: dirty ? 1 : 0.6, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onCancel}
            disabled={!dirty}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty && !genBusy ? 1 : 0.5, cursor: dirty && !genBusy ? 'pointer' : 'default' }}
            onClick={onSave}
            disabled={!dirty || genBusy}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span>{genBusy ? 'Saving…' : 'Save'}</span>
          </button>
        </>
      }
    >
      <h1 style={S.h1}>Authentication</h1>
      <p style={S.subtitle}>Configure authentication parameters.</p>

      <div style={S.tabs}>
        <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
        {canEditRealms && (
          <TabBtn active={tab === 'realms'} onClick={() => setTab('realms')}>Realms</TabBtn>
        )}
      </div>

      {tab === 'general' && (
        <GeneralTab
          loading={!generalDraft}
          draft={generalDraft || {}}
          setG={setG}
          err={genErr}
        />
      )}

      {tab === 'realms' && canEditRealms && (
        <RealmsTab
          realms={realms}
          counts={counts}
          err={realmsErr}
          realmsType={realmsType}
          setRealmsType={setType}
          availableTypes={availableTypes}
          onCreateRealm={onCreateRealm}
          onEditRealm={onEditRealm}
          onMove={onMove}
          onDeleteRealm={onDeleteRealm}
        />
      )}

      <RealmDrawer
        open={drawerOpen}
        existing={editing}
        type={editing?.type || realmsType}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={onSaveRealm}
      />
    </AdminShell>
  );
}

// =============================================================================
// General tab
// =============================================================================
function GeneralTab({ loading, draft, setG, err }) {
  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading…</div>;
  return (
    <div style={{ paddingBottom: '90px' }}>
      {err && <Notice variant="error">{err}</Notice>}

      <Section title="Mandatory authentication" desc="Makes the portal only available to authenticated users.">
        <Checkbox checked={!!draft.requireAuth} onChange={(v) => setG('requireAuth', v)} label="Require authentication" />
        <Notice variant="info">
          Mandatory authentication does not protect public content from indexing or
          crawling. Use <a href="/admin/khub/access-rules" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Access rules</a> to
          restrict content access.
        </Notice>
      </Section>

      <Section title="SSO login and logout page" desc="Makes the external login and logout page open in the current browser window.">
        <Checkbox
          checked={!!draft.openSsoInCurrentWindow}
          onChange={(v) => setG('openSsoInCurrentWindow', v)}
          label="Open SSO login and logout page in the current window"
        />
      </Section>

      <Section title="Credentials form" desc="Hides the email/password form when at least one SSO realm is configured.">
        <Checkbox
          checked={!!draft.hideCredentialsFormIfSso}
          onChange={(v) => setG('hideCredentialsFormIfSso', v)}
          label="Hide the credentials form if an SSO realm is configured"
        />
        <div style={S.infoBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#1d4ed8', flexShrink: 0 }}>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          <span>Internal-realm sign-in remains reachable at&nbsp;<code style={S.code}>/login?direct=true</code>.</span>
        </div>
      </Section>

      <Section title="Logout redirect URL" desc="Redirects users to a URL after logout.">
        <input
          value={draft.logoutRedirectUrl || ''}
          onChange={(e) => setG('logoutRedirectUrl', e.target.value)}
          placeholder="https://example.com/goodbye"
          style={S.input}
        />
      </Section>

      <Section title="Native logout" desc="Hides the native logout button. Use when a custom logout mechanism is provided. Only applies to the classic header.">
        <Checkbox checked={!!draft.hideNativeLogout} onChange={(v) => setG('hideNativeLogout', v)} label="Disable native logout" />
      </Section>

      <Section title="Authentication timeout" desc="Defines the inactivity duration before automatic logout (30 minutes minimum).">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Checkbox
            checked={!!draft.idleTimeoutEnabled}
            onChange={(v) => setG('idleTimeoutEnabled', v)}
            label="Trigger timeout after"
          />
          <input
            type="number"
            min={30}
            value={draft.idleTimeoutMinutes ?? 30}
            onChange={(e) => setG('idleTimeoutMinutes', Math.max(30, Number(e.target.value) || 30))}
            style={{ ...S.input, width: '120px' }}
            disabled={!draft.idleTimeoutEnabled}
          />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>minutes of inactivity</span>
        </div>
        <Notice variant="info">
          The internal-realm <em>Remember me</em> check box keeps users signed in for{' '}
          <strong>{draft.rememberMeDays ?? 30}&nbsp;days</strong> regardless of idle timeout.
        </Notice>
      </Section>

      <Section title="Multi-factor authentication" desc="Portal-wide grace period before MFA is enforced for realms that have it activated. Set to 0 to disable the grace period.">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="number"
            min={0}
            value={draft.mfaGraceDays ?? 7}
            onChange={(e) => setG('mfaGraceDays', Math.max(0, Number(e.target.value) || 0))}
            style={{ ...S.input, width: '120px' }}
          />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>days</span>
        </div>
      </Section>
    </div>
  );
}

// =============================================================================
// Realms tab
// =============================================================================
function RealmsTab({
  realms, counts, err, realmsType, setRealmsType, availableTypes,
  onCreateRealm, onEditRealm, onMove, onDeleteRealm,
}) {
  return (
    <div style={{ paddingBottom: '90px' }}>
      <h2 style={{ ...S.h2, marginTop: '8px' }}>Authentication realms</h2>
      <p style={S.sectionDesc}>Defines available authentication realms and their order of precedence.</p>

      {err && <Notice variant="error">{err}</Notice>}

      <div style={S.realmsCard}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {realms.length === 0 && (
            <div style={{ padding: '24px 16px', color: '#64748b', textAlign: 'center', fontSize: '0.9rem' }}>
              No realms configured yet. Pick a type below and select <strong>Create</strong>.
            </div>
          )}
          {realms.map((r, idx) => (
            <div key={r.id} style={S.realmRow}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <TypeChip type={r.type} />
                <span style={S.realmName}>{r.identifier}</span>
                {!r.enabled && (
                  <span style={{
                    padding: '1px 8px', borderRadius: '999px',
                    background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
                    fontSize: '0.7rem', fontWeight: 600,
                  }}>Disabled</span>
                )}
                {r.mfaEnabled && (
                  <span style={{
                    padding: '1px 8px', borderRadius: '999px',
                    background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0',
                    fontSize: '0.7rem', fontWeight: 600,
                  }}>MFA</span>
                )}
              </span>
              <span style={S.realmCount} title={`${counts[r.identifier] || 0} user(s)`}>
                {counts[r.identifier] || 0}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <div style={S.realmActions}>
                <IconBtn title="Edit realm" onClick={() => onEditRealm(r)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </IconBtn>
                <IconBtn title="Move up" onClick={() => onMove(idx, -1)} disabled={idx === 0}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                </IconBtn>
                <IconBtn title="Move down" onClick={() => onMove(idx, +1)} disabled={idx === realms.length - 1}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                  </svg>
                </IconBtn>
                <IconBtn title="Delete realm" danger onClick={() => onDeleteRealm(r)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </IconBtn>
              </div>
            </div>
          ))}
          <div style={S.realmCreateRow}>
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>Available types</span>
            <div style={{ position: 'relative' }}>
              <select
                value={realmsType}
                onChange={(e) => setRealmsType(e.target.value)}
                style={S.realmTypeSelect}
              >
                {availableTypes.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.disabled}>
                    {t.label}{t.disabled ? ' (already configured)' : ''}
                  </option>
                ))}
              </select>
              <span style={S.selectCaret}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
            <button type="button" style={S.primaryBtn} onClick={onCreateRealm}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Realm drawer — type-aware. Persists every realm field defined in the BRD.
// =============================================================================
function blankConfig(type) {
  const base = {
    showLoginButton: true,
    buttonImageUrl: '',
    buttonLabels: [],
  };
  switch (type) {
    case 'internal':
      return { ...base, registrationType: 'verified', passwordPolicy: 'low', allowedEmailDomains: [] };
    case 'ldap':
      return { ...base, ldapUrl: '', ldapBindDn: '', ldapBindPassword: '', ldapSearchBase: '', ldapAuthMechanism: 'simple' };
    case 'oidc':
      return { ...base, oidcClientId: '', oidcClientSecret: '', oidcDiscoveryUrl: '', oidcScopes: [], oidcSsoLogout: false };
    case 'saml':
      return { ...base, samlIdpMetadataXml: '', samlEntityId: '', samlMaxAuthLifetimeSeconds: 7776000, samlIdpCerts: [] };
    case 'jwt':
      return { ...base, jwtIssuers: [], jwtRedirectionUrl: '' };
    default:
      return base;
  }
}

function RealmDrawer({ open, onClose, onSave, existing, type }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const [identifier, setIdentifier]       = useState('');
  const [identifierTouched, setIdTouched] = useState(false);
  const [enabled, setEnabled]             = useState(true);
  const [config, setConfig]               = useState(() => blankConfig(type));
  const [profileMapperScript, setMapper]  = useState('');
  const [mfaEnabled, setMfa]              = useState(false);
  const [migrateFromRealms, setMigrate]   = useState('');
  const [busy, setBusy]                   = useState(false);
  const [saveError, setSaveError]         = useState('');
  const [showSecret, setShowSecret]       = useState(false);
  const [callbackCopied, setCopied]       = useState(false);

  useEffect(() => {
    if (!open) return;
    const e = existing;
    setIdentifier(e?.identifier || '');
    setIdTouched(false);
    setEnabled(e ? !!e.enabled : true);
    setConfig(e?.config ? { ...blankConfig(e.type || type), ...e.config } : blankConfig(type));
    setMapper(e?.profileMapperScript || '');
    setMfa(!!e?.mfaEnabled);
    setMigrate(Array.isArray(e?.migrateFromRealms) ? e.migrateFromRealms.join(', ') : '');
    setSaveError('');
    setShowSecret(false);
    setCopied(false);
  }, [open, existing, type]);

  if (!open) return null;
  const realmType = existing?.type || type;
  const isEdit    = !!existing;
  const idError   = identifierTouched && !identifier.trim() ? 'Please fill in this field.' : '';

  // Callback URL preview (for OIDC/SAML/JWT). The actual URL exposed to the IdP
  // lives on the backend at /api/auth/callback/<realm-id>, but the drawer can
  // already render an accurate preview for the admin to copy.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const callbackUrl = identifier
    ? `${origin}/api/auth/callback/${encodeURIComponent(identifier.trim())}`
    : `${origin}/api/auth/callback/<realm-identifier>`;

  const onCallbackCopy = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const setCfg = (key, value) => setConfig((c) => ({ ...c, [key]: value }));

  const handleOk = async () => {
    setIdTouched(true);
    if (!identifier.trim()) return;
    setBusy(true); setSaveError('');
    const payload = {
      identifier: identifier.trim(),
      enabled,
      config,
      profileMapperScript,
      mfaEnabled,
      migrateFromRealms: migrateFromRealms.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      await onSave(payload);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save realm.');
    } finally { setBusy(false); }
  };

  return (
    <div role="presentation" onClick={onClose} style={S.drawerScrim}>
      <aside
        role="dialog" aria-modal="true"
        aria-label={isEdit ? 'Edit realm' : 'New realm'}
        onClick={(e) => e.stopPropagation()}
        style={S.drawer}
      >
        <header style={S.drawerHeader}>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h2 style={S.drawerTitle}>
            {isEdit ? `Edit realm — ${existing.identifier}` : `New ${REALM_LABELS[realmType] || realmType} realm`}
          </h2>
        </header>

        <div style={S.drawerBody}>
          {saveError && <Notice variant="error">{saveError}</Notice>}

          <Section title={`${REALM_LABELS[realmType] || realmType} realm`} desc={DESCRIPTIONS[realmType]} />

          <Section title="Realm identifier" desc="Defines the realm identifier.">
            <FloatingInput
              label="Identifier"
              value={identifier}
              onChange={(v) => { setIdentifier(v); setIdTouched(true); }}
              error={idError}
              helper={isEdit ? '' : 'Used in URLs and audit logs.'}
            />
            {isEdit && <Notice variant="info">Realm identifiers cannot be modified.</Notice>}
          </Section>

          <Section title="Realm status" desc="Disabled realms cannot be used to authenticate but their configuration is preserved.">
            <RadioOption checked={enabled}  onChange={() => setEnabled(true)}  title="Enabled" />
            <RadioOption checked={!enabled} onChange={() => setEnabled(false)} title="Disabled" />
          </Section>

          {realmType !== 'internal' && (
            <LoginButtonBlock config={config} setCfg={setCfg} />
          )}

          {realmType === 'internal' && <InternalBlock     config={config} setCfg={setCfg} />}
          {realmType === 'ldap'     && <LdapBlock         config={config} setCfg={setCfg} />}
          {realmType === 'oidc'     && (
            <OidcBlock
              config={config} setCfg={setCfg}
              onCallbackCopy={onCallbackCopy} callbackCopied={callbackCopied}
              callbackUrl={callbackUrl}
              showSecret={showSecret} setShowSecret={setShowSecret}
            />
          )}
          {realmType === 'saml'     && (
            <SamlBlock
              config={config} setCfg={setCfg}
              onCallbackCopy={onCallbackCopy} callbackCopied={callbackCopied}
              callbackUrl={callbackUrl}
              isEdit={isEdit}
            />
          )}
          {realmType === 'jwt'      && <JwtBlock          config={config} setCfg={setCfg} />}

          <Section title="Profile mappers" desc="JavaScript executed on each login to map identity-provider attributes to Fluid Topics roles, groups, tags, and search preferences.">
            <FloatingInput
              label="JavaScript"
              value={profileMapperScript}
              onChange={setMapper}
              multiline
              rows={10}
              helper="Use the user.* and attributes.* helpers. The script runs on the backend; safe to include credentials."
            />
          </Section>

          <Section title="Migrate users" desc="Comma-separated list of realm identifiers. On next login, accounts with the same email under any of these realms (and their assets) become attached to this realm.">
            <FloatingInput label="Source realms" value={migrateFromRealms} onChange={setMigrate} />
            <Notice variant="info">
              Migration starts on the user's next sign-in for SSO realms, and at account
              creation for non-SSO realms. Internal realms with public registration cannot
              be a source per OWASP guidance.
            </Notice>
          </Section>

          <Section
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Multi-factor authentication (MFA)
                <span style={S.betaChip}>Beta</span>
              </span>
            }
          >
            <Notice variant="info">
              Time-based one-time passwords (TOTP) only. When active, MFA applies to all
              users of this realm.
            </Notice>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <Checkbox checked={mfaEnabled} onChange={setMfa} label="Activate MFA for all realm users" />
              <span style={S.recommendChip}>Recommended</span>
            </div>
          </Section>
        </div>

        <footer style={S.drawerFooter}>
          <button type="button" onClick={onClose} style={S.btnCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Cancel
          </button>
          <button type="button" onClick={handleOk} disabled={busy} style={{ ...S.btnSave, opacity: busy ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {busy ? 'Saving…' : (isEdit ? 'Save' : 'Create')}
          </button>
        </footer>
      </aside>
    </div>
  );
}

const DESCRIPTIONS = {
  internal: 'Standalone user management embedded in Fluid Topics.',
  ldap:     'Use an enterprise directory as the user database.',
  oidc:     'Delegate authentication to an OpenID Connect provider (e.g. Okta, Keycloak, Auth0).',
  saml:     'Delegate authentication to a SAML 2.0 identity provider.',
  jwt:      'Accept JSON Web Tokens issued by a trusted client application.',
};

// ──── Per-type sub-blocks ────────────────────────────────────────────────────

function LoginButtonBlock({ config, setCfg }) {
  const labels = Array.isArray(config.buttonLabels) ? config.buttonLabels : [];
  const setLabel = (locale, label) => {
    const next = [...labels.filter((l) => l.locale !== locale)];
    if (label) next.push({ locale, label });
    setCfg('buttonLabels', next);
  };
  const localeRows = ['en-US', 'fr-FR'];
  return (
    <Section title="Login button" desc="Configures your SSO login button with an optional custom image and a label.">
      <RadioOption checked={config.showLoginButton !== false} onChange={() => setCfg('showLoginButton', true)}  title="Display login button" />
      <RadioOption checked={config.showLoginButton === false} onChange={() => setCfg('showLoginButton', false)} title="Hide login button" />

      {config.showLoginButton !== false && (
        <>
          <div style={{ marginTop: '14px' }}>
            <FloatingInput
              label="Square button image URL (optional)"
              value={config.buttonImageUrl || ''}
              onChange={(v) => setCfg('buttonImageUrl', v)}
              type="url"
              helper="Customize size by styling .login-sso-provider-image-button in Custom LESS."
            />
          </div>
          <div style={{ marginTop: '14px', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={S.th}>Language</th>
                  <th style={S.th}>Label</th>
                </tr>
              </thead>
              <tbody>
                {localeRows.map((locale) => {
                  const current = labels.find((l) => l.locale === locale)?.label || '';
                  return (
                    <tr key={locale} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={S.td}>{locale}</td>
                      <td style={S.td}>
                        <input
                          value={current}
                          onChange={(e) => setLabel(locale, e.target.value)}
                          placeholder="—"
                          style={{ ...S.input, width: '100%', padding: '6px 10px', maxWidth: 'unset' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

function InternalBlock({ config, setCfg }) {
  return (
    <>
      <Section title="Registration type" desc="Defines who can register a new account in this realm.">
        <RadioOption
          checked={config.registrationType === 'public'}
          onChange={() => setCfg('registrationType', 'public')}
          title="Public"
          subtitle="Anyone can register without verification."
        />
        <RadioOption
          checked={config.registrationType === 'verified'}
          onChange={() => setCfg('registrationType', 'verified')}
          title="Verified"
          subtitle="Users must confirm their email address before activation."
        />
        <RadioOption
          checked={config.registrationType === 'closed'}
          onChange={() => setCfg('registrationType', 'closed')}
          title="Closed"
          subtitle="Registration form is hidden; admins create accounts manually."
        />
      </Section>

      <Section title="Password policy" desc="Required strength when users create or change a password.">
        <RadioOption
          checked={config.passwordPolicy === 'low'}
          onChange={() => setCfg('passwordPolicy', 'low')}
          title="Low"
          subtitle="At least 6 characters."
        />
        <RadioOption
          checked={config.passwordPolicy === 'high'}
          onChange={() => setCfg('passwordPolicy', 'high')}
          title="High (OWASP-aligned)"
          subtitle="At least 12 characters and not present in the breached-passwords list."
        />
      </Section>

      <Section title="Email restrictions" desc="Restrict registration to users with email addresses from these domains. One per line; leave empty to allow any domain.">
        <FloatingInput
          label="Allowed domains"
          multiline rows={4}
          value={(config.allowedEmailDomains || []).join('\n')}
          onChange={(v) => setCfg('allowedEmailDomains',
            v.split(/[\n,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))}
          helper="e.g. example.com, partner.org"
        />
      </Section>
    </>
  );
}

function LdapBlock({ config, setCfg }) {
  return (
    <>
      <Section title="Server URL" desc="Use ldap:// or ldaps://.">
        <FloatingInput label="LDAP URL" value={config.ldapUrl} onChange={(v) => setCfg('ldapUrl', v)} />
      </Section>
      <Section title="System user" desc="Distinguished name and password used to bind to the directory before searching.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FloatingInput label="Bind DN"   value={config.ldapBindDn}        onChange={(v) => setCfg('ldapBindDn', v)} />
          <FloatingInput label="Password"  value={config.ldapBindPassword}  onChange={(v) => setCfg('ldapBindPassword', v)} type="password" />
        </div>
      </Section>
      <Section title="Search base" desc="LDAP query that selects users allowed to sign in.">
        <FloatingInput label="Search base" value={config.ldapSearchBase} onChange={(v) => setCfg('ldapSearchBase', v)} />
      </Section>
      <Section title="Authentication mechanism" desc="Default is simple.">
        <FloatingInput label="Mechanism" value={config.ldapAuthMechanism} onChange={(v) => setCfg('ldapAuthMechanism', v)} />
      </Section>
    </>
  );
}

function OidcBlock({ config, setCfg, onCallbackCopy, callbackCopied, callbackUrl, showSecret, setShowSecret }) {
  return (
    <>
      <Section title="Relying party metadata" desc="Share this callback URL with the OpenID Connect provider so it can declare Fluid Topics as the relying party.">
        <button type="button" style={S.featureBtn} onClick={onCallbackCopy} title={callbackUrl}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {callbackCopied ? 'Copied!' : 'Copy callback URL'}
        </button>
      </Section>

      <Section title="OAuth 2.0 credentials" desc="OAuth 2.0 client ID and secret communicated by the OpenID Connect provider.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FloatingInput label="Client ID" value={config.oidcClientId} onChange={(v) => setCfg('oidcClientId', v)} />
          <FloatingInput
            label="Secret"
            type={showSecret ? 'text' : 'password'}
            value={config.oidcClientSecret}
            onChange={(v) => setCfg('oidcClientSecret', v)}
            suffix={
              <button
                type="button" aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                onClick={() => setShowSecret((v) => !v)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#475569' }}
              >
                {showSecret ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.79 19.79 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.79 19.79 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            }
          />
        </div>
      </Section>

      <Section title="Endpoints" desc="URL of the OpenID Connect discovery document. Must include the userinfo_signing_alg_values_supported field.">
        <FloatingInput label="Discovery document URL" value={config.oidcDiscoveryUrl} onChange={(v) => setCfg('oidcDiscoveryUrl', v)} type="url" />
      </Section>

      <Section title="Scopes" desc="Additional scopes to request from the provider. The defaults openid, profile and email are always requested.">
        <FloatingInput
          label="Scopes (space-separated)"
          value={Array.isArray(config.oidcScopes) ? config.oidcScopes.join(' ') : ''}
          onChange={(v) => setCfg('oidcScopes', v.split(/\s+/).map((s) => s.trim()).filter(Boolean))}
          prefix="openid profile email"
        />
      </Section>

      <Section title="SSO Logout" desc="Redirects the user to the OIDC provider's logout endpoint when they sign out of Fluid Topics.">
        <Checkbox checked={!!config.oidcSsoLogout} onChange={(v) => setCfg('oidcSsoLogout', v)} label="Send the logout request to the SSO realm" />
      </Section>
    </>
  );
}

function SamlBlock({ config, setCfg, onCallbackCopy, callbackCopied, callbackUrl, isEdit }) {
  return (
    <>
      <Section title="Service provider metadata" desc="Information about Fluid Topics that the SAML identity provider needs to trust this service provider.">
        {isEdit ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={S.featureBtn} onClick={onCallbackCopy} title={callbackUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {callbackCopied ? 'Copied!' : 'Copy callback URL'}
            </button>
          </div>
        ) : (
          <Notice variant="info">Metadata will be available here once the realm is created.</Notice>
        )}
      </Section>

      <Section title="Identity provider metadata" desc="Paste the IdP-supplied XML metadata. The entity identifier and certificate(s) will be parsed and stored.">
        <FloatingInput
          label="IdP metadata XML"
          multiline rows={8}
          value={config.samlIdpMetadataXml}
          onChange={(v) => setCfg('samlIdpMetadataXml', v)}
        />
        <FloatingInput
          label="Entity identifier"
          value={config.samlEntityId}
          onChange={(v) => setCfg('samlEntityId', v)}
          helper="Usually the IdP's metadata URL."
        />
      </Section>

      <Section title="SAML protocol settings" desc="SSO session maximum authentication lifetime, in seconds. Match the value configured on the IdP. Defaults to 7,776,000s.">
        <FloatingInput
          label="IdP maximum authentication lifetime (seconds)"
          type="number"
          value={String(config.samlMaxAuthLifetimeSeconds ?? 7776000)}
          onChange={(v) => setCfg('samlMaxAuthLifetimeSeconds', Math.max(60, Number(v) || 0))}
        />
        <Notice variant="info">
          Recommended: <strong>ADFS</strong>&nbsp;28800,&nbsp;
          <strong>Google Workspace</strong>&nbsp;1209600,&nbsp;
          <strong>Okta</strong>&nbsp;2592000,&nbsp;
          <strong>Keycloak</strong>&nbsp;7776000,&nbsp;
          <strong>Azure</strong>&nbsp;1209600&ndash;7776000.
        </Notice>
      </Section>
    </>
  );
}

function JwtBlock({ config, setCfg }) {
  const issuers = Array.isArray(config.jwtIssuers) ? config.jwtIssuers : [];
  const setIssuer = (idx, key, value) => {
    const next = issuers.map((i, k) => k === idx ? { ...i, [key]: value } : i);
    setCfg('jwtIssuers', next);
  };
  const addIssuer    = () => setCfg('jwtIssuers', [...issuers, { issuer: '', jwksUrl: '' }]);
  const removeIssuer = (idx) => setCfg('jwtIssuers', issuers.filter((_, k) => k !== idx));

  return (
    <>
      <Section
        title="JWT issuers"
        desc="Each issuer represents an authentication provider that mints JWTs. Wildcards (*, **) are supported in the Issuer field. Only one JWT realm is allowed per portal."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {issuers.length === 0 && (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              No issuers yet. Use <em>Add issuer</em> below.
            </div>
          )}
          {issuers.map((iss, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <FloatingInput label="Issuer"   value={iss.issuer}  onChange={(v) => setIssuer(idx, 'issuer', v)} />
              <FloatingInput label="JWKS URL" value={iss.jwksUrl} onChange={(v) => setIssuer(idx, 'jwksUrl', v)} type="url" />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" style={{ ...S.btnCancel, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => removeIssuer(idx)}>
                  Remove issuer
                </button>
              </div>
            </div>
          ))}
          <div>
            <button type="button" style={S.featureBtn} onClick={addIssuer}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add issuer
            </button>
          </div>
        </div>
        <Notice variant="info">
          Supported signing algorithms: <strong>RS256, RS384, RS512, ES256, ES384, ES512</strong>.
          When using multiple issuers ensure JWT <code>sub</code> claims do not overlap.
        </Notice>
      </Section>

      <Section title="Redirection URL" desc="Where users are sent when they select the SSO login button or when their session ends.">
        <FloatingInput label="Redirection URL" value={config.jwtRedirectionUrl} onChange={(v) => setCfg('jwtRedirectionUrl', v)} type="url" />
      </Section>
    </>
  );
}

// =============================================================================
// Styles (carried over from the prior implementation)
// =============================================================================
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 14px' },
  tabs: { display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' },
  section: { marginBottom: '28px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.9rem', color: '#475569', margin: '0 0 6px' },
  checkRow: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0',
    fontFamily: 'var(--font-sans)',
  },
  input: {
    padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.92rem', outline: 'none', fontFamily: 'var(--font-sans)',
    width: '100%', maxWidth: '720px', color: '#0f172a', background: '#ffffff',
  },
  infoBanner: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    marginTop: '10px', padding: '8px 12px',
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px',
    color: '#1e3a8a', fontSize: '0.88rem',
  },
  code: {
    fontFamily: 'var(--font-mono)', background: '#dbeafe',
    padding: '1px 6px', borderRadius: '3px', fontSize: '0.82rem',
  },
  btnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', background: '#fff', color: '#374151',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px', background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
    cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  featureBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '7px 14px', background: '#fdf4ff', color: '#a21caf',
    border: '1px solid #f5d0fe', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },

  realmsCard: { border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', marginTop: '8px' },
  realmRow:   { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' },
  realmName:  { fontSize: '0.92rem', color: '#0f172a', fontWeight: 500 },
  realmCount: { color: '#475569', fontSize: '0.86rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' },
  realmActions: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  realmCreateRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' },
  realmTypeSelect: {
    padding: '7px 30px 7px 12px', border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.86rem', color: '#0f172a',
    outline: 'none', appearance: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  selectCaret: {
    position: 'absolute', right: '8px', top: '50%',
    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
    display: 'inline-flex',
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
    width: 'min(620px, 100%)',
    fontFamily: 'var(--font-sans)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  drawerTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  drawerBody:  { flex: 1, overflowY: 'auto', padding: '20px 22px' },
  drawerFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '10px', padding: '12px 18px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },

  th: {
    textAlign: 'left', padding: '10px 14px',
    color: '#475569', fontWeight: 600, fontSize: '0.78rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: { padding: '10px 14px', color: '#0f172a', fontSize: '0.88rem', verticalAlign: 'middle' },

  betaChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '1px 8px', borderRadius: '999px',
    background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.02em',
  },
  recommendChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '1px 8px', borderRadius: '999px',
    background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0',
    fontSize: '0.7rem', fontWeight: 600,
  },
};
