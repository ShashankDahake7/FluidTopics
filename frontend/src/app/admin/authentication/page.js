'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ── Small atomic UI ──────────────────────────────────────────────────────────
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

function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={S.checkRow}>
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

function FloatingInput({ label, value, onChange, type = 'text', error, prefix, helper, suffix }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value || !!prefix;
  const errored = !!error;
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
            border: errored
              ? '1.5px solid #dc2626'
              : focused
                ? '2px solid #a21caf'
                : '1px solid #cbd5e1',
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
          <input
            ref={inputRef} type={type} value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={{
              position: 'relative', width: '100%',
              padding: prefix ? '12px 12px 12px 4px' : '12px',
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.9rem', color: '#0f172a',
              fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
          {suffix && (
            <span style={{ paddingRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
              {suffix}
            </span>
          )}
        </div>
        {!isFloated && (
          <label style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.9rem', color: '#94a3b8',
            pointerEvents: 'none', background: 'transparent',
          }}>{label}</label>
        )}
      </div>
      {(error || helper) && (
        <div style={{
          fontSize: '0.78rem', marginTop: '4px',
          color: errored ? '#dc2626' : '#64748b',
        }}>{error || helper}</div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const SEEDED_REALMS = [
  { id: 'internal',                  name: 'Internal',                  type: 'internal', users: 3249, locked: true },
  { id: 'sso-stage-realm',           name: 'sso-stage-realm',           type: 'oidc',     users: 1323 },
  { id: 'Darwinbox_fluidtopics',     name: 'Darwinbox_fluidtopics',     type: 'oidc',     users: 1879 },
  { id: 'darwinbox-clients-sso-prod', name: 'darwinbox-clients-sso-prod', type: 'oidc',    users: 1006 },
];

export default function AuthenticationPage() {
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ft_user') || 'null');
      if (u?.role) setUserRole(u.role);
    } catch { /* ignore */ }
  }, []);
  const isSuperAdmin = userRole === 'superadmin';

  const [tab, setTab] = useState('general');

  // General tab state
  const [requireAuth,    setRequireAuth]    = useState(false);
  const [openSsoCurrent, setOpenSsoCurrent] = useState(true);
  const [hideCredForm,   setHideCredForm]   = useState(false);
  const [logoutUrl,      setLogoutUrl]      = useState('');
  const [disableLogout,  setDisableLogout]  = useState(false);
  const [timeoutOn,      setTimeoutOn]      = useState(true);
  const [timeoutMin,     setTimeoutMin]     = useState(840);
  const [generalDirty,   setGeneralDirty]   = useState(false);
  const setG = (setter) => (v) => { setter(v); setGeneralDirty(true); };

  // Realms tab state
  const [realms, setRealms]           = useState(SEEDED_REALMS);
  const [realmsBaseline]              = useState(SEEDED_REALMS);
  const [realmsType, setRealmsType]   = useState('oidc');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editingRealm, setEditingRealm] = useState(null);

  const realmsDirty = useMemo(
    () => JSON.stringify(realms) !== JSON.stringify(realmsBaseline),
    [realms, realmsBaseline]
  );

  const onCreateRealm = () => {
    setEditingRealm(null);
    setDrawerOpen(true);
  };
  const onEditRealm = (r) => {
    setEditingRealm(r);
    setDrawerOpen(true);
  };
  const onMove = (idx, dir) => {
    setRealms((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const onDeleteRealm = (id) => setRealms((arr) => arr.filter((r) => r.id !== id));
  const onSaveRealm = (data) => {
    setRealms((arr) => {
      if (editingRealm) {
        return arr.map((r) => r.id === editingRealm.id ? { ...r, ...data } : r);
      }
      return [...arr, { id: data.identifier, name: data.identifier, users: 0, type: 'oidc', ...data }];
    });
    setDrawerOpen(false);
    setEditingRealm(null);
  };

  const dirty = tab === 'general' ? generalDirty : realmsDirty;
  const onCancel = () => {
    if (tab === 'general') setGeneralDirty(false);
    else setRealms(realmsBaseline);
  };

  return (
    <AdminShell
      active="authentication"
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
            style={{ ...S.btnSave, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
            onClick={() => { if (tab === 'general') setGeneralDirty(false); }}
            disabled={!dirty}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Save</span>
          </button>
        </>
      }
    >
      <h1 style={S.h1}>Authentication</h1>
      <p style={S.subtitle}>Configure authentication parameters.</p>

      {/* Tabs ─ Realms is rendered only for superadmin */}
      <div style={S.tabs}>
        <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
        {isSuperAdmin && (
          <TabBtn active={tab === 'realms'} onClick={() => setTab('realms')}>Realms</TabBtn>
        )}
      </div>

      {tab === 'general' && (
        <GeneralTab
          requireAuth={requireAuth}      setRequireAuth={setG(setRequireAuth)}
          openSsoCurrent={openSsoCurrent} setOpenSsoCurrent={setG(setOpenSsoCurrent)}
          hideCredForm={hideCredForm}    setHideCredForm={setG(setHideCredForm)}
          logoutUrl={logoutUrl}          setLogoutUrl={setG(setLogoutUrl)}
          disableLogout={disableLogout}  setDisableLogout={setG(setDisableLogout)}
          timeoutOn={timeoutOn}          setTimeoutOn={setG(setTimeoutOn)}
          timeoutMin={timeoutMin}        setTimeoutMin={setG(setTimeoutMin)}
        />
      )}

      {tab === 'realms' && isSuperAdmin && (
        <RealmsTab
          realms={realms}
          realmsType={realmsType}
          setRealmsType={setRealmsType}
          onCreateRealm={onCreateRealm}
          onEditRealm={onEditRealm}
          onMove={onMove}
          onDeleteRealm={onDeleteRealm}
        />
      )}

      <NewRealmDrawer
        open={drawerOpen}
        existing={editingRealm}
        onClose={() => { setDrawerOpen(false); setEditingRealm(null); }}
        onSave={onSaveRealm}
      />
    </AdminShell>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '10px 16px',
        cursor: 'pointer',
        fontSize: '0.92rem',
        fontWeight: active ? 700 : 500,
        color: active ? '#a21caf' : '#475569',
        borderBottom: `3px solid ${active ? '#a21caf' : 'transparent'}`,
        marginBottom: '-1px',
        fontFamily: 'var(--font-sans)',
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

// ── General tab ──────────────────────────────────────────────────────────────
function GeneralTab(p) {
  return (
    <div style={{ paddingBottom: '90px' }}>
      <Section title="Mandatory authentication" desc="Makes the portal only available to authenticated users.">
        <Checkbox checked={p.requireAuth} onChange={p.setRequireAuth} label="Require authentication" />
      </Section>

      <Section title="SSO login and logout page" desc="Makes the external login and logout page open in the current browser window if an SSO realm is configured.">
        <Checkbox checked={p.openSsoCurrent} onChange={p.setOpenSsoCurrent} label="Open SSO login and logout page in the current window" />
      </Section>

      <Section title="Credentials form" desc="Prevents the display of the default credentials form when both SSO and non-SSO realms are configured.">
        <Checkbox checked={p.hideCredForm} onChange={p.setHideCredForm} label="Hide the credentials form if an SSO realm is configured" />
        <div style={S.infoBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#1d4ed8', flexShrink: 0 }}>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          <span>Bookmark the following URL to display the credentials form&nbsp;<code style={S.code}>https://help.darwinbox.com/login?direct=true</code></span>
        </div>
      </Section>

      <Section title="Logout redirect URL" desc="Redirects users to a URL after logout.">
        <input
          value={p.logoutUrl}
          onChange={(e) => p.setLogoutUrl(e.target.value)}
          placeholder="Redirect URL"
          style={S.input}
        />
      </Section>

      <Section title="Native logout" desc="Hides the native logout button, for example, when a custom logout mechanism is provided.">
        <Checkbox checked={p.disableLogout} onChange={p.setDisableLogout} label="Disable native logout" />
      </Section>

      <Section title="Authentication timeout" desc="Defines a number of minutes of inactivity before automatic logout (30 minutes minimum).">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Checkbox checked={p.timeoutOn} onChange={p.setTimeoutOn} label="Trigger timeout after" />
          <input
            type="number"
            min={30}
            value={p.timeoutMin}
            onChange={(e) => p.setTimeoutMin(Number(e.target.value))}
            style={{ ...S.input, width: '120px' }}
            disabled={!p.timeoutOn}
          />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>minutes of inactivity</span>
        </div>
      </Section>
    </div>
  );
}

// ── Realms tab ───────────────────────────────────────────────────────────────
function RealmsTab({ realms, realmsType, setRealmsType, onCreateRealm, onEditRealm, onMove, onDeleteRealm }) {
  return (
    <div style={{ paddingBottom: '90px' }}>
      <h2 style={{ ...S.h2, marginTop: '8px' }}>Authentication realms</h2>
      <p style={S.sectionDesc}>Defines available authentication realms and their order of precedence.</p>

      <div style={S.realmsCard}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {realms.map((r, idx) => (
            <div key={r.id} style={S.realmRow}>
              <span style={S.realmName}>{r.name}</span>
              <span style={S.realmCount}>
                {String(r.users).padStart(0, '')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <div style={S.realmActions}>
                {r.locked ? (
                  <span style={{ width: '24px' }} />
                ) : (
                  <IconBtn title="Edit realm" onClick={() => onEditRealm(r)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </IconBtn>
                )}
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
                {!r.locked && (
                  <IconBtn title="Delete realm" danger onClick={() => onDeleteRealm(r.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </IconBtn>
                )}
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
                <option value="oidc">OpenID Connect</option>
                <option value="saml">SAML 2.0</option>
                <option value="ldap">LDAP</option>
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

// ── New realm drawer ─────────────────────────────────────────────────────────
function NewRealmDrawer({ open, onClose, onSave, existing }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Form state, reset whenever drawer is opened with a different target
  const [identifier, setIdentifier]   = useState('');
  const [identifierTouched, setIdTouched] = useState(false);
  const [showLoginBtn, setShowLoginBtn] = useState(true);
  const [labelEn, setLabelEn]         = useState('');
  const [labelIt, setLabelIt]         = useState('');
  const [editingLabel, setEditingLabel] = useState(null); // 'en' | 'it' | null
  const [tempLabel, setTempLabel]     = useState('');
  const [clientId, setClientId]       = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [revealSecret, setRevealSecret] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [scopes, setScopes]           = useState('');
  const [ssoLogout, setSsoLogout]     = useState(false);
  const [migrateRealms, setMigrateRealms] = useState('');
  const [activateMfa, setActivateMfa] = useState(false);
  const [callbackCopied, setCallbackCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setIdentifier(existing?.identifier ?? existing?.name ?? '');
      setIdTouched(false);
      setShowLoginBtn(existing?.showLoginBtn ?? true);
      setLabelEn(existing?.labels?.en ?? '');
      setLabelIt(existing?.labels?.it ?? '');
      setClientId(existing?.clientId ?? '');
      setClientSecret(existing?.clientSecret ?? '');
      setRevealSecret(false);
      setDiscoveryUrl(existing?.discoveryUrl ?? '');
      setScopes(existing?.scopes ?? '');
      setSsoLogout(existing?.ssoLogout ?? false);
      setMigrateRealms(existing?.migrateRealms ?? '');
      setActivateMfa(existing?.mfa ?? false);
      setEditingLabel(null);
      setCallbackCopied(false);
    }
  }, [open, existing]);

  if (!open) return null;

  const idError = identifierTouched && !identifier.trim() ? 'Please fill in this field.' : '';

  const callbackUrl = 'https://help.darwinbox.com/api/authentication/callback';

  const onCallbackCopy = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCallbackCopied(true);
      setTimeout(() => setCallbackCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const handleOk = () => {
    setIdTouched(true);
    if (!identifier.trim()) return;
    onSave({
      identifier: identifier.trim(),
      name: identifier.trim(),
      showLoginBtn,
      labels: { en: labelEn, it: labelIt },
      clientId,
      clientSecret,
      discoveryUrl,
      scopes,
      ssoLogout,
      migrateRealms,
      mfa: activateMfa,
    });
  };

  return (
    <div role="presentation" onClick={onClose} style={S.drawerScrim}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={existing ? 'Edit realm' : 'New realm'}
        onClick={(e) => e.stopPropagation()}
        style={S.drawer}
      >
        <header style={S.drawerHeader}>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h2 style={S.drawerTitle}>{existing ? 'Edit realm' : 'New realm'}</h2>
        </header>

        <div style={S.drawerBody}>
          <Section title="OpenID Connect realm" desc="Allows Fluid Topics to interact with a third-party identity provider using the OpenID Connect protocol." />

          <Section title="Realm identifier" desc="Defines the realm identifier.">
            <FloatingInput
              label="Identifier"
              value={identifier}
              onChange={(v) => { setIdentifier(v); setIdTouched(true); }}
              error={idError}
            />
            <Notice variant="info">Realm identifiers cannot be modified.</Notice>
          </Section>

          <Section title="Login button" desc="Configures your SSO login button with an optional custom image and a label.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <RadioOption checked={showLoginBtn}  onChange={() => setShowLoginBtn(true)}  title="Display login button" />
              <RadioOption checked={!showLoginBtn} onChange={() => setShowLoginBtn(false)} title="Hide login button" />
            </div>

            {showLoginBtn && (
              <>
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '6px' }}>Choose square button image</div>
                  <div style={S.imagePickerRow}>
                    <div style={S.imagePreview}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button type="button" style={S.linkBtnPink}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Replace
                      </button>
                      <button type="button" style={{ ...S.linkBtnPink, color: '#dc2626' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={S.th}>Language</th>
                        <th style={S.th}>Label</th>
                        <th style={{ ...S.th, width: '50px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {[{ code: 'en-US', val: labelEn, set: setLabelEn, key: 'en' },
                        { code: 'it-IT', val: labelIt, set: setLabelIt, key: 'it' }].map((row) => (
                        <tr key={row.code} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={S.td}>{row.code}</td>
                          <td style={S.td}>
                            {editingLabel === row.key ? (
                              <input
                                value={tempLabel}
                                onChange={(e) => setTempLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { row.set(tempLabel); setEditingLabel(null); }
                                  if (e.key === 'Escape') setEditingLabel(null);
                                }}
                                style={{ ...S.input, width: '100%', padding: '6px 10px' }}
                                autoFocus
                              />
                            ) : (
                              <span style={{ color: row.val ? '#0f172a' : '#94a3b8' }}>
                                {row.val || '—'}
                              </span>
                            )}
                          </td>
                          <td style={S.td}>
                            <IconBtn
                              title={editingLabel === row.key ? 'Save' : 'Edit'}
                              onClick={() => {
                                if (editingLabel === row.key) {
                                  row.set(tempLabel);
                                  setEditingLabel(null);
                                } else {
                                  setTempLabel(row.val || '');
                                  setEditingLabel(row.key);
                                }
                              }}
                            >
                              {editingLabel === row.key ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                              )}
                            </IconBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          <Section title="Relying party metadata" desc="Retrieves the relying party's metadata that are required to finalize configuration.">
            <button type="button" style={S.featureBtn} onClick={onCallbackCopy} title={callbackUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {callbackCopied ? 'Copied!' : 'Callback URL'}
            </button>
          </Section>

          <Section title="OAuth 2.0 credentials" desc="Defines the OAuth 2.0 credentials for the Fluid Topics application as communicated by an OpenID Connect provider.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FloatingInput label="Client ID" value={clientId} onChange={setClientId} />
              <FloatingInput
                label="Secret"
                type={revealSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={setClientSecret}
                suffix={
                  <button
                    type="button" aria-label={revealSecret ? 'Hide secret' : 'Show secret'}
                    onClick={() => setRevealSecret((v) => !v)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#475569' }}
                  >
                    {revealSecret ? (
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

          <Section title="Endpoints" desc="Defines a URL to the Discovery Document with the configuration of the OpenID Connect provider's endpoints.">
            <FloatingInput label="Discovery document URL" value={discoveryUrl} onChange={setDiscoveryUrl} type="url" />
          </Section>

          <Section title="Scopes" desc="Defines additional scopes to request from the OpenID Connect provider.">
            <FloatingInput label="Scopes" value={scopes} onChange={setScopes} prefix="openid profile email" />
          </Section>

          <Section title="Profile mappers" desc="Defines mappings between authentication system and Fluid Topics profiles.">
            <button type="button" style={{ ...S.featureBtn, opacity: 0.6, cursor: 'not-allowed' }} disabled>
              Run configuration assistant…
            </button>
          </Section>

          <Section title="SSO Logout">
            <Checkbox checked={ssoLogout} onChange={setSsoLogout} label="Sends the logout request to the SSO realm" />
          </Section>

          <Section title="Migrate users" desc="Overrides selected legacy realms and migrates user accounts with all assets upon next login.">
            <FloatingInput label="Realms" value={migrateRealms} onChange={setMigrateRealms} />
            <Notice variant="info">Use “,” to separate multiple values.</Notice>
          </Section>

          <Section
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Multi-factor authentication (MFA)
                <span style={S.betaChip}>Beta</span>
              </span>
            }
            desc=""
          >
            <Notice variant="info">
              Only time-based one-time passwords through authenticator apps are supported.&nbsp;
              <a
                href="https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Users/Authentication/Configure-realms/Configure-multi-factor-authentication"
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#1d4ed8', textDecoration: 'underline' }}
              >
                See Configure multi-factor authentication documentation.
              </a>
            </Notice>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <Checkbox checked={activateMfa} onChange={setActivateMfa} label="Activate MFA for all realm users" />
              <span style={S.recommendChip}>Recommended</span>
            </div>
          </Section>
        </div>

        <footer style={S.drawerFooter}>
          <button type="button" onClick={onClose} style={S.btnCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Cancel
          </button>
          <button type="button" onClick={handleOk} style={S.btnSave}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            OK
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 14px' },
  tabs: {
    display: 'flex', alignItems: 'center', gap: '4px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '24px',
  },
  section: { marginBottom: '28px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.9rem', color: '#475569', margin: '0 0 6px' },
  checkRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 0',
    fontFamily: 'var(--font-sans)',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.92rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    maxWidth: '720px',
    color: '#0f172a',
    background: '#ffffff',
  },
  infoBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '10px',
    padding: '8px 12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '4px',
    color: '#1e3a8a',
    fontSize: '0.88rem',
  },
  code: {
    fontFamily: 'var(--font-mono)',
    background: '#dbeafe',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '0.82rem',
  },
  btnCancel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    background: '#a21caf',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  featureBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '7px 14px',
    background: '#fdf4ff', color: '#a21caf',
    border: '1px solid #f5d0fe', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  linkBtnPink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', padding: '6px 8px',
    color: '#a21caf', fontSize: '0.86rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },

  realmsCard: {
    border: '1px solid #e2e8f0', borderRadius: '4px',
    background: '#fff', marginTop: '8px',
  },
  realmRow: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '10px 16px', borderBottom: '1px solid #f1f5f9',
  },
  realmName: { flex: 1, fontSize: '0.92rem', color: '#0f172a', fontWeight: 500 },
  realmCount: {
    color: '#dc2626', fontSize: '0.86rem', fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  },
  realmActions: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  realmCreateRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px', flexWrap: 'wrap',
  },
  realmTypeSelect: {
    padding: '7px 30px 7px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.86rem', color: '#0f172a',
    outline: 'none', appearance: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
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
    width: 'min(560px, 100%)',
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
  },
  drawerFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '10px',
    padding: '12px 18px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },

  imagePickerRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '12px',
  },
  imagePreview: {
    width: '64px', height: '64px',
    border: '1px solid #e2e8f0', borderRadius: '4px',
    background: '#f8fafc',
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
