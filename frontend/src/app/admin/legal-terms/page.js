'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api, { getStoredUser } from '@/lib/api';

const LOCALE_LABELS = {
  en: 'English (United States)',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

const ADDABLE_LOCALES = ['it', 'fr', 'de', 'es'];

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

function Toast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 56,
        right: 28,
        zIndex: 2000,
        maxWidth: 400,
        padding: '11px 14px',
        borderRadius: 6,
        background: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
        color: '#fff',
        fontSize: '0.84rem',
        fontWeight: 600,
        lineHeight: 1.4,
        boxShadow: '0 8px 28px rgba(234, 88, 12, 0.45), 0 0 0 1px rgba(251, 191, 36, 0.5)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button type="button" onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }} aria-label="Dismiss">×</button>
    </div>
  );
}

function NewVersionModal({ open, busy, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div style={nm.backdrop} onClick={busy ? undefined : onClose}>
      <div style={nm.box} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="nv-title">
        <h3 id="nv-title" style={nm.title}>New legal terms version</h3>
        <p style={nm.body}>All users will be required to agree to your legal terms again. Are you sure?</p>
        <div style={nm.actions}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...nm.cancel, opacity: busy ? 0.6 : 1 }}>
            ✕ Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} style={nm.confirm}>
            {busy ? '…' : '✓ Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

const nm = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1900,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
    fontFamily: 'var(--font-sans)',
  },
  box: {
    background: '#fff',
    borderRadius: 8,
    maxWidth: 440,
    width: '100%',
    padding: '24px 28px 22px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
  },
  title: { margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' },
  body: { margin: '0 0 22px', fontSize: '0.92rem', color: '#475569', lineHeight: 1.5 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancel: {
    padding: '8px 18px',
    background: '#fff',
    color: '#374151',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: 4,
    fontSize: '0.88rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  confirm: {
    padding: '8px 20px',
    background: '#7e22ce',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};

export default function LegalTermsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState([]);
  const [policyVersion, setPolicyVersion] = useState(0);
  const [lastPolicyUpdateAt, setLastPolicyUpdateAt] = useState(null);
  const [editingLocale, setEditingLocale] = useState(null);
  const [addLocale, setAddLocale] = useState('it');
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionBusy, setNewVersionBusy] = useState(false);
  const baseline = useRef(null);

  useEffect(() => {
    const u = getStoredUser();
    const tierOk    = u?.role === 'admin' || u?.role === 'superadmin';
    const portalAdm = Array.isArray(u?.adminRoles) && u.adminRoles.includes('PORTAL_ADMIN');
    setIsAdmin(tierOk || portalAdm);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setSaveError('');
    try {
      const d = await api.get('/admin/legal-terms');
      setDefaultLocale(d.defaultLocale || 'en');
      setEnabled(!!d.enabled);
      setMessages((d.messages || []).map((m) => ({ ...m })));
      setPolicyVersion(d.policyVersion || 0);
      setLastPolicyUpdateAt(d.lastPolicyUpdateAt || null);
      baseline.current = JSON.stringify({
        enabled: !!d.enabled,
        messages: d.messages || [],
        policyVersion: d.policyVersion || 0,
        lastPolicyUpdateAt: d.lastPolicyUpdateAt || null,
      });
      setDirty(false);
    } catch (e) {
      setSaveError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fallbackLocale = defaultLocale;

  const isFallback = (loc) => loc === fallbackLocale;

  const updateMessage = (locale, patch) => {
    setMessages((prev) => prev.map((m) => (m.locale === locale ? { ...m, ...patch } : m)));
    setDirty(true);
    setSaveError('');
  };

  const removeLocale = (locale) => {
    if (isFallback(locale)) return;
    setMessages((prev) => prev.filter((m) => m.locale !== locale));
    if (editingLocale === locale) setEditingLocale(null);
    setDirty(true);
  };

  const addLanguage = () => {
    if (!addLocale || messages.some((m) => m.locale === addLocale)) return;
    setMessages((prev) => [...prev, { locale: addLocale, label: '', linksHtml: '', validated: false }]);
    setDirty(true);
  };

  const validateRow = (locale) => {
    const m = messages.find((x) => x.locale === locale);
    if (!m?.label?.trim() || !m?.linksHtml?.trim()) {
      setSaveError('Enter both label and links before validating.');
      return;
    }
    updateMessage(locale, { validated: true });
    setSaveError('');
  };

  const cancel = () => {
    if (!baseline.current) return;
    const b = JSON.parse(baseline.current);
    setEnabled(b.enabled);
    setMessages((b.messages || []).map((m) => ({ ...m })));
    setPolicyVersion(b.policyVersion || 0);
    setLastPolicyUpdateAt(b.lastPolicyUpdateAt || null);
    setEditingLocale(null);
    setDirty(false);
    setSaveError('');
  };

  const save = async () => {
    if (!isAdmin) return;
    setSaveError('');
    try {
      const d = await api.put('/admin/legal-terms', { enabled, messages });
      setEnabled(!!d.enabled);
      setMessages((d.messages || []).map((m) => ({ ...m })));
      setPolicyVersion(d.policyVersion || 0);
      setLastPolicyUpdateAt(d.lastPolicyUpdateAt || null);
      baseline.current = JSON.stringify({
        enabled: !!d.enabled,
        messages: d.messages || [],
        policyVersion: d.policyVersion || 0,
        lastPolicyUpdateAt: d.lastPolicyUpdateAt || null,
      });
      setDirty(false);
      setEditingLocale(null);
    } catch (e) {
      setSaveError(e?.message || 'Save failed');
    }
  };

  const confirmNewVersion = async () => {
    if (!isAdmin) return;
    setNewVersionBusy(true);
    setSaveError('');
    try {
      // Persist toggle + messages first: new-version reads DB; UI "enabled" alone is not saved until PUT.
      const put = await api.put('/admin/legal-terms', { enabled, messages });
      setEnabled(!!put.enabled);
      setMessages((put.messages || []).map((m) => ({ ...m })));
      setPolicyVersion(put.policyVersion || 0);
      setLastPolicyUpdateAt(put.lastPolicyUpdateAt || null);
      baseline.current = JSON.stringify({
        enabled: !!put.enabled,
        messages: put.messages || [],
        policyVersion: put.policyVersion || 0,
        lastPolicyUpdateAt: put.lastPolicyUpdateAt || null,
      });
      setDirty(false);

      const d = await api.post('/admin/legal-terms/new-version', {});
      setPolicyVersion(d.policyVersion);
      setLastPolicyUpdateAt(d.lastPolicyUpdateAt);
      if (baseline.current) {
        const b = JSON.parse(baseline.current);
        b.policyVersion = d.policyVersion;
        b.lastPolicyUpdateAt = d.lastPolicyUpdateAt;
        baseline.current = JSON.stringify(b);
      }
      setNewVersionOpen(false);
    } catch (e) {
      setSaveError(e?.message || 'Request failed');
    } finally {
      setNewVersionBusy(false);
    }
  };

  const addableOptions = useMemo(
    () => ADDABLE_LOCALES.filter((code) => !messages.some((m) => m.locale === code)),
    [messages]
  );

  useEffect(() => {
    if (addableOptions.length && !addableOptions.includes(addLocale)) {
      setAddLocale(addableOptions[0]);
    }
  }, [addableOptions, addLocale]);

  const newVersionEnabled = enabled && isAdmin;

  const versionDescription =
    policyVersion === 0 && !lastPolicyUpdateAt
      ? 'Prompts users to accept updated legal terms. Legal terms have never been updated.'
      : `Prompts users to accept updated legal terms. Current policy version is ${policyVersion}${
          lastPolicyUpdateAt ? ` (last change ${new Date(lastPolicyUpdateAt).toLocaleString()})` : ''
        }.`;

  if (loading) {
    return (
      <AdminShell
        active="legal-terms"
        allowedRoles={['superadmin', 'admin', 'editor']}
        allowedAdminRoles={['PORTAL_ADMIN']}
      >
        <div style={{ padding: 40 }}><div className="spinner" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="legal-terms"
      allowedRoles={['superadmin', 'admin', 'editor']}
      allowedAdminRoles={['PORTAL_ADMIN']}
      footer={
        <>
          <button type="button" style={S.btnCancel} onClick={cancel} disabled={!dirty}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty && isAdmin ? 1 : 0.5, cursor: dirty && isAdmin ? 'pointer' : 'not-allowed' }}
            onClick={save}
            disabled={!dirty || !isAdmin}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Save</span>
          </button>
        </>
      }
    >
      <div style={S.pageHeader}>
        <div style={S.breadcrumb}>
          <span style={S.pageTitle}>Legal terms</span>
        </div>
        <p style={S.pageDesc}>Define legal terms for users to accept.</p>
      </div>

      {!isAdmin && (
        <p style={{ fontSize: '0.9rem', color: '#b45309', marginBottom: 16 }}>
          Sign in as an administrator to edit legal terms.
        </p>
      )}

      <section style={S.panel}>
        <div style={S.panelBody}>
          <div style={S.toggleRow}>
            <button
              type="button"
              onClick={() => { if (!isAdmin) return; setEnabled((v) => !v); setDirty(true); }}
              style={S.toggle(enabled)}
              aria-pressed={enabled}
              aria-label="Toggle legal terms"
              disabled={!isAdmin}
            >
              <span style={S.toggleKnob(enabled)} />
            </button>
            <label style={S.toggleLabel}>{enabled ? 'Legal terms enabled' : 'Legal terms disabled'}</label>
          </div>
        </div>
      </section>

      <section style={S.panel}>
        <div style={S.panelHeader}>
          <h2 style={S.sectionTitle}>Message</h2>
          <p style={S.sectionDesc}>Prompts users to accept legal terms and displays one or more links to these terms.</p>
        </div>
        <div style={S.panelBody}>
          <div style={S.tableWrap}>
            <div style={S.thead}>
              <div style={{ flex: '0 0 220px' }}>Language</div>
              <div style={{ flex: 1 }}>Message</div>
              <div style={{ width: 88, textAlign: 'right' }} />
            </div>
            {messages.map((m) => {
              const label = LOCALE_LABELS[m.locale] || m.locale;
              const isOpen = editingLocale === m.locale;
              const emptyPreview = !m.label?.trim() && !m.linksHtml?.trim();
              return (
                <div key={m.locale} style={S.row}>
                  <div style={{ flex: '0 0 220px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>{label}</div>
                    {isFallback(m.locale) && <span style={S.badgeFallback}>Fallback language</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isOpen ? (
                      <div style={S.editor}>
                        <label style={S.miniLabel}>Label</label>
                        <input
                          value={m.label}
                          onChange={(e) => updateMessage(m.locale, { label: e.target.value, validated: false })}
                          style={S.textInput}
                          disabled={!isAdmin}
                        />
                        <label style={{ ...S.miniLabel, marginTop: 12 }}>Links</label>
                        <div style={S.toolbar}>
                          <span style={S.tbBtn} title="Undo">↶</span>
                          <span style={S.tbBtn} title="Redo">↷</span>
                          <span style={S.tbBtn} title="Special characters">Ω</span>
                          <span style={S.tbBtn} title="Insert link">🔗</span>
                        </div>
                        <textarea
                          value={m.linksHtml}
                          onChange={(e) => updateMessage(m.locale, { linksHtml: e.target.value, validated: false })}
                          style={S.textarea}
                          rows={5}
                          placeholder="<a href=&quot;/terms&quot;>Read our Terms of Use</a>"
                          disabled={!isAdmin}
                        />
                        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button type="button" style={S.btnValidate} onClick={() => validateRow(m.locale)} disabled={!isAdmin}>
                            ✓ Validate
                          </button>
                          {m.validated && <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>Validated</span>}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={S.exampleLabel}>Example of message:</div>
                        <div style={{ marginTop: 4 }}>
                          <input type="checkbox" checked readOnly disabled style={{ marginRight: 8, verticalAlign: 'middle' }} />
                          <span style={{ color: emptyPreview ? '#94a3b8' : '#0f172a', fontSize: '0.92rem' }}>
                            {m.label?.trim() || 'I agree to the Terms of Use'}
                          </span>
                        </div>
                        {m.linksHtml?.trim() ? (
                          <div
                            style={{ marginTop: 8, fontSize: '0.85rem', color: '#1d4ed8' }}
                            dangerouslySetInnerHTML={{ __html: m.linksHtml }}
                          />
                        ) : (
                          <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>Read our Terms of Use</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 88, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button
                      type="button"
                      style={S.editIcon}
                      aria-label={isOpen ? 'Close editor' : 'Edit message'}
                      onClick={() => setEditingLocale(isOpen ? null : m.locale)}
                    >
                      <PencilIcon />
                    </button>
                    {!isFallback(m.locale) && (
                      <button type="button" style={{ ...S.editIcon, color: '#dc2626' }} aria-label="Remove language" onClick={() => removeLocale(m.locale)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={S.addRow}>
            <span style={S.addLabel}>Add language</span>
            {addableOptions.length ? (
              <>
                <select value={addLocale} onChange={(e) => setAddLocale(e.target.value)} style={S.select} disabled={!isAdmin}>
                  {addableOptions.map((code) => (
                    <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
                  ))}
                </select>
                <button type="button" onClick={addLanguage} style={S.addBtn} aria-label="Add language" disabled={!isAdmin}>
                  +
                </button>
              </>
            ) : (
              <span style={{ fontSize: '0.88rem', color: '#64748b' }}>All supported extra languages are in the table.</span>
            )}
          </div>
        </div>
      </section>

      <section style={S.panel}>
        <div style={S.panelHeader}>
          <h2 style={S.sectionTitle}>Version</h2>
          <p style={S.sectionDesc}>{versionDescription}</p>
        </div>
        <div style={S.panelBody}>
          <button
            type="button"
            style={{
              ...S.btnNewVersion,
              opacity: newVersionEnabled ? 1 : 0.45,
              cursor: newVersionEnabled ? 'pointer' : 'not-allowed',
            }}
            onClick={() => newVersionEnabled && setNewVersionOpen(true)}
            disabled={!newVersionEnabled}
          >
            New version
          </button>
        </div>
      </section>

      <NewVersionModal
        open={newVersionOpen}
        busy={newVersionBusy}
        onClose={() => !newVersionBusy && setNewVersionOpen(false)}
        onConfirm={confirmNewVersion}
      />
      <Toast message={saveError} onDismiss={() => setSaveError('')} />
    </AdminShell>
  );
}

const S = {
  pageHeader: { marginBottom: 20 },
  breadcrumb: { marginBottom: 6 },
  pageTitle: { fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' },
  pageDesc: { fontSize: '0.92rem', color: '#475569', margin: 0 },
  panel: { marginBottom: 24 },
  panelHeader: { marginBottom: 8 },
  panelBody: {},
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' },
  sectionDesc: { fontSize: '0.92rem', color: '#374151', margin: 0, lineHeight: 1.45 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  toggle: (on) => ({
    width: 44,
    height: 24,
    borderRadius: 999,
    background: on ? '#1d4ed8' : '#cbd5e1',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
    padding: 0,
    transition: 'background 150ms',
  }),
  toggleKnob: (on) => ({
    position: 'absolute',
    top: 3,
    left: on ? 24 : 3,
    width: 18,
    height: 18,
    background: '#fff',
    borderRadius: '50%',
    transition: 'left 150ms',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  }),
  toggleLabel: { fontSize: '0.92rem', color: '#0f172a', fontWeight: 500 },
  tableWrap: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  thead: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '10px 14px',
    background: '#f1f5f9',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    background: '#fff',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e7eb',
  },
  badgeFallback: {
    display: 'inline-block',
    marginTop: 6,
    padding: '3px 10px',
    background: '#1d4ed8',
    color: '#fff',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  exampleLabel: { color: '#d97706', fontSize: '0.78rem', fontWeight: 600 },
  editor: { maxWidth: 560 },
  miniLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: 4 },
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
  },
  toolbar: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
    padding: '4px 0',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
  },
  tbBtn: {
    width: 28,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    cursor: 'default',
    userSelect: 'none',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    fontSize: '0.88rem',
    fontFamily: 'ui-monospace, monospace',
    resize: 'vertical',
    minHeight: 100,
  },
  btnValidate: {
    padding: '8px 16px',
    background: '#7e22ce',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  editIcon: {
    color: '#7e22ce',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 4,
  },
  addRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  addLabel: { fontSize: '0.92rem', color: '#0f172a', fontWeight: 500 },
  select: {
    padding: '8px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    fontSize: '0.9rem',
    background: '#fff',
    fontFamily: 'var(--font-sans)',
    minWidth: 180,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#7e22ce',
    color: '#fff',
    border: 'none',
    fontSize: '1.2rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  btnNewVersion: {
    padding: '10px 20px',
    background: '#7e22ce',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.9rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  btnCancel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#fff',
    color: '#374151',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  btnSave: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    background: '#7e22ce',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
  },
};
