'use client';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ── Mock data ──────────────────────────────────────────────────────────────
// In production these come from the metadata/vocabulary services.
// When both lists are empty the "New rule" button stays deactivated and the
// warning message is shown — matching the empty-portal Darwinbox screen.
const METADATA_KEYS = [
  { key: 'audience',     label: 'Audience' },
  { key: 'topic-type',   label: 'Topic type' },
  { key: 'product',      label: 'Product' },
  { key: 'language',     label: 'Language' },
  { key: 'region',       label: 'Region' },
];
const VOCABULARIES = [
  { id: 'voc-products',  label: 'Products' },
  { id: 'voc-audiences', label: 'Audiences' },
  { id: 'voc-regions',   label: 'Regions' },
];
const SCOPE_OPTIONS = [
  { value: 'new',  label: 'Apply to new content only' },
  { value: 'all',  label: 'Apply to existing and new content' },
];

export default function EnrichAndCleanPage() {
  // Demo affordance: toggle metadata/thesaurus availability so super admins can
  // explore both empty and populated states from the UI.
  const [hasConfig, setHasConfig] = useState(false);

  const [savedRules, setSavedRules] = useState([]);    // last persisted snapshot
  const [rules,      setRules]      = useState([]);    // working copy
  const [editing,    setEditing]    = useState(null);  // rule object | 'new' | null
  const [confirm,    setConfirm]    = useState(null);  // { kind, rule? }

  const dirty = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(savedRules),
    [rules, savedRules],
  );
  const canCreate = hasConfig;

  const upsertRule = (draft) => {
    setRules((prev) => {
      const exists = prev.find((r) => r.id === draft.id);
      if (exists) return prev.map((r) => (r.id === draft.id ? { ...draft } : r));
      return [...prev, draft];
    });
    setEditing(null);
  };
  const deleteRule = (rule) => setRules((prev) => prev.filter((r) => r.id !== rule.id));

  const save   = () => setSavedRules(rules);
  const cancel = () => setRules(savedRules);

  return (
    <AdminShell active="khub-enrich" allowedRoles={['superadmin']}>
      <div style={S.page}>
        <header style={S.headerRow}>
          <h1 style={S.h1}>Enrich and Clean</h1>
          <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
            <label style={S.demoToggle} title="Demo: toggle whether metadata/thesauri are configured for this portal.">
              <input
                type="checkbox"
                checked={hasConfig}
                onChange={(e) => setHasConfig(e.target.checked)}
              />
              <span>Metadata configured</span>
            </label>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => canCreate && setEditing('new')}
              style={{
                ...S.primaryBtn,
                background: canCreate ? '#a21caf' : '#e2e8f0',
                color: canCreate ? '#fff' : '#94a3b8',
                border: canCreate ? '1px solid #a21caf' : '1px solid #e2e8f0',
                cursor: canCreate ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5"  y1="12" x2="19" y2="12" />
              </svg>
              <span>New rule</span>
            </button>
          </div>
        </header>

        <p style={S.description}>
          Apply vocabularies to enrich metadata values and keep them consistent throughout the portal.{' '}
          <a href="/admin/khub/vocabularies" style={S.link}>Configure Vocabularies</a>
        </p>

        <div style={S.tableContainer}>
          {!hasConfig && (
            <div style={S.warning}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
              </svg>
              <span>If no metadata or thesaurus has been configured for the portal, the new rule button is deactivated.</span>
            </div>
          )}

          {rules.length === 0 ? (
            <div style={S.emptyTable}>No rules applied</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Metadata</th>
                  <th style={S.th}>Action</th>
                  <th style={S.th}>Vocabulary</th>
                  <th style={S.th}>Scope</th>
                  <th style={{ ...S.th, width: '110px', textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}>
                      {METADATA_KEYS.find((m) => m.key === r.metadataKey)?.label || r.metadataKey}
                    </td>
                    <td style={S.td}>
                      <ActionChip action={r.action} />
                    </td>
                    <td style={S.td}>
                      {VOCABULARIES.find((v) => v.id === r.vocabularyId)?.label || r.vocabularyId || '—'}
                    </td>
                    <td style={S.td}>
                      {SCOPE_OPTIONS.find((s) => s.value === r.scope)?.label || r.scope}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <IconBtn title="Edit rule" onClick={() => setEditing(r)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                        </svg>
                      </IconBtn>
                      <IconBtn title="Delete rule" onClick={() => setConfirm({ kind: 'delete', rule: r })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                        </svg>
                      </IconBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={S.actionsBar}>
          <div>
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'reprocess' })}
              disabled={savedRules.length === 0}
              style={{
                ...S.secondaryBtn,
                opacity: savedRules.length === 0 ? 0.55 : 1,
                cursor: savedRules.length === 0 ? 'not-allowed' : 'pointer',
              }}
              title={savedRules.length === 0 ? 'Save at least one rule before reprocessing.' : 'Reprocess'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Reprocess</span>
            </button>
          </div>
          <div style={{ display: 'inline-flex', gap: '8px' }}>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              style={{
                ...S.primaryBtn,
                background: dirty ? '#16a34a' : '#e2e8f0',
                color: dirty ? '#fff' : '#94a3b8',
                border: dirty ? '1px solid #16a34a' : '1px solid #e2e8f0',
                cursor: dirty ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!dirty}
              style={{
                ...S.secondaryBtn,
                opacity: dirty ? 1 : 0.55,
                cursor: dirty ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>

      <RuleDrawer
        open={!!editing}
        rule={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
        onSave={upsertRule}
      />

      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title="Delete rule?"
        body={confirm?.rule
          ? `The rule for "${METADATA_KEYS.find((m) => m.key === confirm.rule.metadataKey)?.label || confirm.rule.metadataKey}" will be removed.`
          : ''}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm?.rule) deleteRule(confirm.rule); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm?.kind === 'reprocess'}
        title="Reprocess content?"
        body="All affected publications will be queued for reprocessing using the saved enrich-and-clean rules. This may take a few minutes."
        confirmLabel="Reprocess"
        onCancel={() => setConfirm(null)}
        onConfirm={() => setConfirm(null)}
      />
    </AdminShell>
  );
}

// ── Rule editor drawer ─────────────────────────────────────────────────────
function RuleDrawer({ open, rule, onClose, onSave }) {
  const isEdit = !!rule;
  const [draft, setDraft] = useState(blankRule());

  useEffect(() => {
    if (!open) return undefined;
    setDraft(rule ? { ...rule } : blankRule());
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, rule, onClose]);

  if (!open) return null;
  const valid = draft.metadataKey && draft.action && draft.scope && (draft.action === 'clean' || draft.vocabularyId);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div role="presentation" onClick={onClose} style={S.drawerOverlay}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit rule' : 'New rule'}
        onClick={(e) => e.stopPropagation()}
        style={S.drawer}
      >
        <header style={S.drawerHeader}>
          <div style={S.drawerTitle}>{isEdit ? 'Edit rule' : 'New rule'}</div>
          <button type="button" aria-label="Close" onClick={onClose} style={S.iconBtnPlain}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={S.drawerBody}>
          <Field label="Metadata key">
            <div style={{ position: 'relative' }}>
              <select
                value={draft.metadataKey}
                onChange={(e) => update({ metadataKey: e.target.value })}
                style={{ ...S.formInput, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">Select a metadata key</option>
                {METADATA_KEYS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <span aria-hidden="true" style={S.selectChevron}>▾</span>
            </div>
          </Field>

          <Field label="Action">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { v: 'enrich', label: 'Enrich — add values from a vocabulary' },
                { v: 'clean',  label: 'Clean — normalise and de-duplicate values' },
              ].map((a) => (
                <label key={a.v} style={S.radioRow}>
                  <input
                    type="radio"
                    name="rule-action"
                    value={a.v}
                    checked={draft.action === a.v}
                    onChange={() => update({ action: a.v, vocabularyId: a.v === 'clean' ? '' : draft.vocabularyId })}
                    style={S.radioInput}
                  />
                  <span style={S.radioLabel}>{a.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {draft.action === 'enrich' && (
            <Field label="Vocabulary">
              <div style={{ position: 'relative' }}>
                <select
                  value={draft.vocabularyId}
                  onChange={(e) => update({ vocabularyId: e.target.value })}
                  style={{ ...S.formInput, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select a vocabulary</option>
                  {VOCABULARIES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                <span aria-hidden="true" style={S.selectChevron}>▾</span>
              </div>
            </Field>
          )}

          <Field label="Scope">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.value} style={S.radioRow}>
                  <input
                    type="radio"
                    name="rule-scope"
                    value={s.value}
                    checked={draft.scope === s.value}
                    onChange={() => update({ scope: s.value })}
                    style={S.radioInput}
                  />
                  <span style={S.radioLabel}>{s.label}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div style={S.drawerFooter}>
          <button type="button" style={S.linkBtn} onClick={onClose}>Cancel</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onSave({
              ...draft,
              id: draft.id || `rule-${Date.now()}`,
            })}
            style={{
              ...S.primaryBtn,
              opacity: valid ? 1 : 0.55,
              cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function blankRule() {
  return { id: '', metadataKey: '', action: 'enrich', vocabularyId: '', scope: 'new' };
}

// ── Generic confirm modal ─────────────────────────────────────────────────
function ConfirmModal({ open, title, body, cancelLabel = 'Cancel', confirmLabel = 'Confirm', onCancel, onConfirm }) {
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
          <button type="button" aria-label="Close" onClick={onCancel} style={S.iconBtnPlain}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={S.modalBody}>{body}</div>
        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" style={S.primaryBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Small primitives ──────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '18px' }}>
      <span style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>{hint}</span>}
    </label>
  );
}

function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '4px',
        marginLeft: '4px', cursor: 'pointer', color: '#475569',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function ActionChip({ action }) {
  const map = {
    enrich: { bg: '#dcfce7', fg: '#166534', label: 'Enrich' },
    clean:  { bg: '#dbeafe', fg: '#1e40af', label: 'Clean'  },
  };
  const c = map[action] || { bg: '#f1f5f9', fg: '#475569', label: action };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      background: c.bg, color: c.fg, fontSize: '0.78rem', fontWeight: 500,
    }}>{c.label}</span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px' },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '14px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  description: {
    margin: 0, fontSize: '0.92rem', color: '#475569', lineHeight: 1.5,
  },
  link: { color: '#a21caf', fontWeight: 500, textDecoration: 'none' },
  demoToggle: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontSize: '0.82rem', color: '#475569',
    padding: '6px 10px', border: '1px dashed #cbd5e1', borderRadius: '4px',
    background: '#f8fafc', userSelect: 'none', cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    borderRadius: '4px', fontSize: '0.9rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'transparent', color: '#a21caf',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  tableContainer: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    overflow: 'hidden',
  },
  warning: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px',
    background: '#fef3c7', borderBottom: '1px solid #fde68a',
    color: '#92400e', fontSize: '0.85rem',
  },
  emptyTable: {
    padding: '60px 16px', textAlign: 'center',
    color: '#94a3b8', fontSize: '0.95rem', fontStyle: 'italic',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left', padding: '12px 16px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px 16px', color: '#0f172a', verticalAlign: 'middle' },
  actionsBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc', borderRadius: '4px',
    position: 'sticky', bottom: 0,
  },
  // Drawer
  drawerOverlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    background: '#fff', height: '100%', width: 'min(480px, 96vw)',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
    fontFamily: 'var(--font-sans)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
  },
  drawerTitle: { fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '24px' },
  drawerFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
  },
  formInput: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  },
  selectChevron: {
    position: 'absolute', right: '10px', top: '50%',
    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
  },
  radioRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', userSelect: 'none', width: 'fit-content',
  },
  radioInput: { width: '14px', height: '14px', accentColor: '#a21caf', margin: 0 },
  radioLabel: { fontSize: '0.88rem', color: '#475569' },
  iconBtnPlain: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  // Modal
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
  modalBody: { padding: '18px', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
  },
};
