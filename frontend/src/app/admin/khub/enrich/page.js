'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// ── Action library ────────────────────────────────────────────────────────
// Mirrors the backend `ruleConfigSchemas.js` enum. Order here drives the
// drawer's action select and the table's chip lookup.
const ACTIONS = [
  { v: 'enrich',         label: 'Enrich',         description: 'Add values from a vocabulary' },
  { v: 'clean',          label: 'Clean',          description: 'Trim, drop empties, de-duplicate' },
  { v: 'find_replace',   label: 'Find & replace', description: 'Literal substitution on every value' },
  { v: 'regex_replace',  label: 'Regex replace',  description: 'Pattern substitution on every value' },
  { v: 'drop_key',       label: 'Drop key',       description: 'Remove this metadata key from the topic' },
  { v: 'set_value',      label: 'Set value',      description: 'Force this metadata key to a fixed list of values' },
  { v: 'copy_from',      label: 'Copy from',      description: 'Copy values from another metadata key' },
];

const SCOPE_OPTIONS = [
  { value: 'new', label: 'Apply to new content only' },
  { value: 'all', label: 'Apply to existing and new content' },
];

const COPY_FROM_MODES = [
  { value: 'replace', label: 'Replace existing values' },
  { value: 'append',  label: 'Append to existing values' },
];

function blankRule() {
  return {
    id: '',
    metadataKey: '',
    type: 'enrich',
    config: {},
    priority: 0,
    scope: 'new',
    enabled: true,
  };
}

function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// Stable comparison key for "is the working copy dirty?" — we sort by id
// + drop server-only fields so the comparator doesn't false-positive on
// timestamps that come back from the server after a save.
function compareKey(rules) {
  return JSON.stringify(
    rules.map((r) => ({
      id: r.id || '',
      metadataKey: r.metadataKey,
      type: r.type,
      config: r.config || {},
      priority: r.priority || 0,
      scope: r.scope,
      enabled: r.enabled !== false,
    }))
  );
}

export default function EnrichAndCleanPage() {
  const [savedRules, setSavedRules] = useState([]);
  const [rules, setRules]           = useState([]);
  const [metadataKeys, setMetadataKeys] = useState([]);
  const [vocabularies, setVocabularies] = useState([]);
  const [config, setConfig] = useState({
    lastFullReprocessAt: null,
    lastFullReprocessByName: null,
    pendingReprocess: false,
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageInfo, setPageInfo] = useState('');
  const [editing, setEditing] = useState(null);  // rule object | 'new' | null
  const [confirm, setConfirm] = useState(null);
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);

  const dirty = useMemo(
    () => compareKey(rules) !== compareKey(savedRules),
    [rules, savedRules]
  );
  const hasConfig = metadataKeys.length > 0;
  const canCreate = hasConfig;

  // ── Data loading ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [rulesRes, mkRes, vocabRes] = await Promise.all([
        api.get('/enrich-rules'),
        api.get('/metadata-keys'),
        api.get('/vocabularies'),
      ]);
      const rulesList = (rulesRes?.rules || []).map(normaliseRule);
      setRules(rulesList);
      setSavedRules(rulesList);
      setConfig({
        lastFullReprocessAt: rulesRes?.config?.lastFullReprocessAt || null,
        lastFullReprocessByName: rulesRes?.config?.lastFullReprocessByName || null,
        pendingReprocess: !!rulesRes?.config?.pendingReprocess,
      });
      if (rulesRes?.config?.runningJob) setJob(rulesRes.config.runningJob);

      setMetadataKeys((mkRes?.items || []).map((k) => ({
        key: k.name,
        label: k.displayName || k.name,
      })));
      setVocabularies((vocabRes?.items || []).map((v) => ({
        id: v.id,
        label: v.displayName || v.name,
      })));
    } catch (e) {
      setPageError(e?.message || 'Failed to load Enrich-and-Clean configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // ── Reprocess job polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!job?.id) return undefined;
    if (job.status === 'done' || job.status === 'failed') {
      refetch();
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/enrich-rules/jobs/${job.id}`);
        if (res?.job) setJob(res.job);
      } catch (_) { /* keep polling on transient errors */ }
    }, 1000);
    return () => clearInterval(pollRef.current);
  }, [job?.id, job?.status, refetch]);

  // ── Local-only mutations (staged in `rules` until Save) ────────────────
  const upsertRule = (draft) => {
    setRules((prev) => {
      const exists = prev.find((r) => r.id === draft.id || r._localId === draft._localId);
      if (exists) {
        return prev.map((r) =>
          (r.id && r.id === draft.id) || (r._localId && r._localId === draft._localId)
            ? { ...r, ...draft }
            : r
        );
      }
      return [
        ...prev,
        {
          ...draft,
          // Local-only marker for rows not yet persisted; survives re-render
          // and is stripped before the PUT body is built.
          _localId: draft._localId || `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      ];
    });
    setEditing(null);
  };

  const deleteLocal = (rule) => {
    setRules((prev) => prev.filter((r) =>
      rule.id ? r.id !== rule.id : r._localId !== rule._localId
    ));
  };

  // ── Server actions ──────────────────────────────────────────────────────
  const save = async () => {
    setBusy(true);
    setPageError('');
    setPageInfo('');
    try {
      const payload = rules.map((r, idx) => ({
        id: r.id || undefined,
        metadataKey: r.metadataKey,
        type: r.type,
        config: r.config || {},
        // Re-stamp priorities by index so the visible order is durable.
        priority: (idx + 1) * 10,
        scope: r.scope,
        enabled: r.enabled !== false,
      }));
      const res = await api.put('/enrich-rules', { rules: payload });
      const stored = (res?.rules || []).map(normaliseRule);
      setRules(stored);
      setSavedRules(stored);
      setPageInfo('Rules saved.');
    } catch (e) {
      setPageError(e?.message || 'Failed to save rules');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setRules(savedRules);
    setPageError('');
    setPageInfo('');
  };

  const startReprocess = async () => {
    setBusy(true);
    setPageError('');
    try {
      const res = await api.post('/enrich-rules/reprocess', {});
      if (res?.job) setJob(res.job);
    } catch (e) {
      setPageError(e?.message || 'Failed to start reprocess');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const lookupMetadataLabel = (k) =>
    metadataKeys.find((m) => m.key === k)?.label || k;
  const lookupVocabLabel = (id) =>
    vocabularies.find((v) => v.id === id)?.label || id || '—';

  const reprocessInFlight = job && (job.status === 'queued' || job.status === 'running');

  return (
    <AdminShell active="khub-enrich" allowedRoles={['superadmin']} fullWidth>
      <div style={S.page}>
        <header style={S.headerRow}>
          <h1 style={S.h1}>Enrich and Clean</h1>
          <button
            type="button"
            disabled={!canCreate || loading}
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
        </header>

        <p style={S.description}>
          Apply vocabularies to enrich metadata values and keep them consistent throughout the portal.{' '}
          <a href="/admin/khub/vocabularies" style={S.link}>Configure Vocabularies</a>
        </p>

        {pageError && <div style={S.errorBar}>{pageError}</div>}
        {pageInfo && !pageError && <div style={S.infoBar}>{pageInfo}</div>}

        <div style={S.tableContainer}>
          {!hasConfig && !loading && (
            <div style={S.warning}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
              </svg>
              <span>If no metadata or thesaurus has been configured for the portal, the new rule button is deactivated.</span>
            </div>
          )}

          {loading ? (
            <div style={S.emptyTable}>Loading…</div>
          ) : rules.length === 0 ? (
            <div style={S.emptyTable}>No rules applied</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Metadata</th>
                  <th style={S.th}>Action</th>
                  <th style={S.th}>Details</th>
                  <th style={S.th}>Scope</th>
                  <th style={{ ...S.th, width: '110px', textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id || r._localId} style={S.tr}>
                    <td style={S.td}>{lookupMetadataLabel(r.metadataKey)}</td>
                    <td style={S.td}><ActionChip type={r.type} /></td>
                    <td style={S.td}>{describeRule(r, { lookupMetadataLabel, lookupVocabLabel })}</td>
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
          <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'reprocess' })}
              disabled={savedRules.length === 0 || busy || reprocessInFlight}
              style={{
                ...S.secondaryBtn,
                opacity: savedRules.length === 0 || busy || reprocessInFlight ? 0.55 : 1,
                cursor: savedRules.length === 0 || busy || reprocessInFlight ? 'not-allowed' : 'pointer',
                position: 'relative',
              }}
              title={
                savedRules.length === 0 ? 'Save at least one rule before reprocessing.'
                : reprocessInFlight ? 'A reprocess is already running.'
                : 'Reprocess every topic with the saved rules.'
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{reprocessInFlight ? 'Reprocessing…' : 'Reprocess'}</span>
              {config.pendingReprocess && !reprocessInFlight && (
                <span aria-hidden="true" style={S.pendingDot} title="Rules have changed since the last reprocess." />
              )}
            </button>
            <span style={S.footerChip}>
              {reprocessInFlight && job
                ? `Processed ${job.processed || 0} / ${job.total || '?'} topics${job.errorCount ? ` · ${job.errorCount} errors` : ''}`
                : config.lastFullReprocessAt
                ? `Last full reprocess on ${formatTimestamp(config.lastFullReprocessAt)}${config.lastFullReprocessByName ? ` by ${config.lastFullReprocessByName}` : ''}`
                : 'No full reprocess yet.'}
            </span>
          </div>
          <div style={{ display: 'inline-flex', gap: '8px' }}>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              style={{
                ...S.primaryBtn,
                background: dirty && !busy ? '#16a34a' : '#e2e8f0',
                color: dirty && !busy ? '#fff' : '#94a3b8',
                border: dirty && !busy ? '1px solid #16a34a' : '1px solid #e2e8f0',
                cursor: dirty && !busy ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{busy ? 'Saving…' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!dirty || busy}
              style={{
                ...S.secondaryBtn,
                opacity: dirty && !busy ? 1 : 0.55,
                cursor: dirty && !busy ? 'pointer' : 'not-allowed',
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
        metadataKeys={metadataKeys}
        vocabularies={vocabularies}
        otherRules={rules}
        onClose={() => setEditing(null)}
        onSave={upsertRule}
      />

      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title="Delete rule?"
        body={confirm?.rule
          ? `The rule for "${lookupMetadataLabel(confirm.rule.metadataKey)}" will be removed.`
          : ''}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm?.rule) deleteLocal(confirm.rule); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm?.kind === 'reprocess'}
        title="Reprocess content?"
        body="Every topic will be re-derived from its raw metadata and re-run through the saved enrich-and-clean rules. This may take a few minutes."
        confirmLabel="Reprocess"
        onCancel={() => setConfirm(null)}
        onConfirm={startReprocess}
      />
    </AdminShell>
  );
}

// Map an API row into the shape the page works with locally. Adds an
// `_localId` for items that already have a server id so the dirty
// comparator + remove path can use a single key strategy.
function normaliseRule(r) {
  return {
    id: r.id || '',
    _localId: r.id ? `srv-${r.id}` : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metadataKey: r.metadataKey,
    type: r.type,
    config: r.config || {},
    priority: typeof r.priority === 'number' ? r.priority : 0,
    scope: r.scope || 'new',
    enabled: r.enabled !== false,
  };
}

// Compact human description for the table — surfaces the per-action
// details that matter most ("Vocabulary: Products", "Find: cloud → Cloud").
function describeRule(r, { lookupMetadataLabel, lookupVocabLabel }) {
  const cfg = r.config || {};
  switch (r.type) {
    case 'enrich':        return `Vocabulary: ${lookupVocabLabel(cfg.vocabularyId)}`;
    case 'clean':         return 'Trim, drop empties, de-dup';
    case 'find_replace':  return `${cfg.find ?? ''} → ${cfg.replace ?? ''}${cfg.caseSensitive ? ' · case-sensitive' : ''}`;
    case 'regex_replace': return `/${cfg.pattern ?? ''}/${cfg.flags ?? ''} → ${cfg.replace ?? ''}`;
    case 'drop_key':      return 'Remove key';
    case 'set_value':     return `Values: ${(cfg.values || []).join(', ')}`;
    case 'copy_from':     return `Copy from "${lookupMetadataLabel(cfg.sourceKey)}" (${cfg.mode || 'replace'})`;
    default:              return r.type;
  }
}

// ── Rule editor drawer ────────────────────────────────────────────────────
function RuleDrawer({ open, rule, metadataKeys, vocabularies, otherRules, onClose, onSave }) {
  const isEdit = !!rule;
  const [draft, setDraft] = useState(blankRule());
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setDraft(rule ? cloneRuleForEdit(rule) : blankRule());
    setValidationError('');
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, rule, onClose]);

  if (!open) return null;

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updateConfig = (patch) => setDraft((d) => ({ ...d, config: { ...(d.config || {}), ...patch } }));

  const valid = isDraftValid(draft) && !validationError;

  const handleSave = () => {
    const error = clientSideValidate(draft, otherRules);
    setValidationError(error || '');
    if (error) return;
    onSave({
      ...draft,
      _localId: draft._localId || (draft.id ? `srv-${draft.id}` : `tmp-${Date.now()}`),
    });
  };

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
                {metadataKeys.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <span aria-hidden="true" style={S.selectChevron}>▾</span>
            </div>
          </Field>

          <Field label="Action">
            <div style={{ position: 'relative' }}>
              <select
                value={draft.type}
                onChange={(e) => update({ type: e.target.value, config: defaultConfigFor(e.target.value) })}
                style={{ ...S.formInput, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
              >
                {ACTIONS.map((a) => (
                  <option key={a.v} value={a.v}>{a.label} — {a.description}</option>
                ))}
              </select>
              <span aria-hidden="true" style={S.selectChevron}>▾</span>
            </div>
          </Field>

          <ActionConfigFields
            type={draft.type}
            config={draft.config || {}}
            onChange={updateConfig}
            metadataKeys={metadataKeys}
            vocabularies={vocabularies}
            ownMetadataKey={draft.metadataKey}
          />

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

          <Field label="Enabled">
            <label style={{ ...S.radioRow, gap: '10px' }}>
              <input
                type="checkbox"
                checked={draft.enabled !== false}
                onChange={(e) => update({ enabled: e.target.checked })}
                style={{ accentColor: '#a21caf' }}
              />
              <span style={S.radioLabel}>Apply this rule</span>
            </label>
          </Field>

          {validationError && <div style={S.errorBar}>{validationError}</div>}
        </div>

        <div style={S.drawerFooter}>
          <button type="button" style={S.linkBtn} onClick={onClose}>Cancel</button>
          <button
            type="button"
            disabled={!valid}
            onClick={handleSave}
            style={{
              ...S.primaryBtn,
              background: valid ? '#a21caf' : '#e2e8f0',
              color: valid ? '#fff' : '#94a3b8',
              border: valid ? '1px solid #a21caf' : '1px solid #e2e8f0',
              opacity: valid ? 1 : 0.85,
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

function cloneRuleForEdit(r) {
  return {
    ...r,
    config: { ...(r.config || {}) },
  };
}

function defaultConfigFor(type) {
  switch (type) {
    case 'enrich':        return { vocabularyId: '' };
    case 'clean':         return {};
    case 'find_replace':  return { find: '', replace: '', caseSensitive: false };
    case 'regex_replace': return { pattern: '', flags: '', replace: '' };
    case 'drop_key':      return {};
    case 'set_value':     return { values: [] };
    case 'copy_from':     return { sourceKey: '', mode: 'replace' };
    default:              return {};
  }
}

// Light-weight sanity check — full validation runs server-side, but we
// gate the Create button so admins don't ship obvious nonsense.
function isDraftValid(draft) {
  if (!draft.metadataKey || !draft.type || !draft.scope) return false;
  const cfg = draft.config || {};
  switch (draft.type) {
    case 'enrich':        return !!cfg.vocabularyId;
    case 'clean':
    case 'drop_key':      return true;
    case 'find_replace':  return typeof cfg.find === 'string' && cfg.find.length > 0
                                 && typeof cfg.replace === 'string';
    case 'regex_replace': {
      if (typeof cfg.pattern !== 'string' || cfg.pattern.length === 0) return false;
      if (typeof cfg.replace !== 'string') return false;
      try { new RegExp(cfg.pattern, (cfg.flags || '') + 'g'); return true; }
      catch (_) { return false; }
    }
    case 'set_value':     return Array.isArray(cfg.values) && cfg.values.length > 0;
    case 'copy_from':     return !!cfg.sourceKey && cfg.sourceKey !== draft.metadataKey;
    default:              return false;
  }
}

// Local validation that calls out the precise issue (regex compile,
// copy-from cycle on the same key). The server is still authoritative.
function clientSideValidate(draft, otherRules) {
  const cfg = draft.config || {};
  if (draft.type === 'regex_replace') {
    try { new RegExp(cfg.pattern || '', (cfg.flags || '') + 'g'); }
    catch (e) { return `Invalid regex pattern: ${e.message}`; }
  }
  if (draft.type === 'copy_from') {
    if ((cfg.sourceKey || '').toLowerCase() === (draft.metadataKey || '').toLowerCase()) {
      return 'copy_from cannot use the same key as both source and target.';
    }
    // Quick cycle check against other staged copy_from rules.
    const edges = new Map();
    const consider = (otherRules || []).filter(
      (r) => r.type === 'copy_from'
        && (r.id ? r.id !== draft.id : r._localId !== draft._localId)
    );
    for (const r of consider) {
      if (!edges.has(r.metadataKey)) edges.set(r.metadataKey, new Set());
      edges.get(r.metadataKey).add(r.config?.sourceKey);
    }
    if (!edges.has(draft.metadataKey)) edges.set(draft.metadataKey, new Set());
    edges.get(draft.metadataKey).add(cfg.sourceKey);
    const start = draft.metadataKey;
    const stack = [start];
    const seen = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (seen.has(node)) continue;
      seen.add(node);
      const next = edges.get(node);
      if (!next) continue;
      for (const n of next) {
        if (n === start) return 'copy_from rules form a cycle.';
        stack.push(n);
      }
    }
  }
  return '';
}

// ── Per-action config UI ──────────────────────────────────────────────────
function ActionConfigFields({ type, config, onChange, metadataKeys, vocabularies, ownMetadataKey }) {
  if (type === 'enrich') {
    return (
      <Field label="Vocabulary">
        <div style={{ position: 'relative' }}>
          <select
            value={config.vocabularyId || ''}
            onChange={(e) => onChange({ vocabularyId: e.target.value })}
            style={{ ...S.formInput, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
          >
            <option value="">Select a vocabulary</option>
            {vocabularies.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <span aria-hidden="true" style={S.selectChevron}>▾</span>
        </div>
      </Field>
    );
  }
  if (type === 'clean' || type === 'drop_key') {
    return (
      <div style={S.helpBlock}>
        {type === 'clean'
          ? 'Trims whitespace, drops empties, and de-duplicates the values for this key.'
          : 'Removes this metadata key from every topic that has it.'}
      </div>
    );
  }
  if (type === 'find_replace') {
    return (
      <>
        <Field label="Find">
          <input
            type="text"
            value={config.find || ''}
            onChange={(e) => onChange({ find: e.target.value })}
            placeholder="cloud"
            style={S.formInput}
          />
        </Field>
        <Field label="Replace with">
          <input
            type="text"
            value={config.replace || ''}
            onChange={(e) => onChange({ replace: e.target.value })}
            placeholder="Cloud"
            style={S.formInput}
          />
        </Field>
        <Field label="">
          <label style={{ ...S.radioRow, gap: '10px' }}>
            <input
              type="checkbox"
              checked={!!config.caseSensitive}
              onChange={(e) => onChange({ caseSensitive: e.target.checked })}
              style={{ accentColor: '#a21caf' }}
            />
            <span style={S.radioLabel}>Case sensitive</span>
          </label>
        </Field>
      </>
    );
  }
  if (type === 'regex_replace') {
    let compileError = '';
    try {
      if (config.pattern) new RegExp(config.pattern, (config.flags || '') + 'g');
    } catch (e) {
      compileError = e.message;
    }
    return (
      <>
        <Field label="Pattern" hint={compileError ? `Pattern error: ${compileError}` : 'Standard JavaScript regex syntax. The "g" flag is always added.'}>
          <input
            type="text"
            value={config.pattern || ''}
            onChange={(e) => onChange({ pattern: e.target.value })}
            placeholder="\\bstaff\\b"
            style={{ ...S.formInput, borderColor: compileError ? '#dc2626' : '#cbd5e1' }}
          />
        </Field>
        <Field label="Flags" hint="Subset of g, i, m, s, u, y. Defaults to global match.">
          <input
            type="text"
            value={config.flags || ''}
            onChange={(e) => onChange({ flags: e.target.value })}
            placeholder="i"
            style={S.formInput}
          />
        </Field>
        <Field label="Replace with">
          <input
            type="text"
            value={config.replace || ''}
            onChange={(e) => onChange({ replace: e.target.value })}
            placeholder="Employee"
            style={S.formInput}
          />
        </Field>
      </>
    );
  }
  if (type === 'set_value') {
    const values = Array.isArray(config.values) ? config.values : [];
    return (
      <Field label="Values" hint="Press Enter to add. Click a chip to remove it.">
        <ChipInput
          values={values}
          onChange={(next) => onChange({ values: next })}
        />
      </Field>
    );
  }
  if (type === 'copy_from') {
    return (
      <>
        <Field label="Source metadata key">
          <div style={{ position: 'relative' }}>
            <select
              value={config.sourceKey || ''}
              onChange={(e) => onChange({ sourceKey: e.target.value })}
              style={{ ...S.formInput, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="">Select a source key</option>
              {metadataKeys
                .filter((m) => m.key !== ownMetadataKey)
                .map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <span aria-hidden="true" style={S.selectChevron}>▾</span>
          </div>
        </Field>
        <Field label="Mode">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {COPY_FROM_MODES.map((m) => (
              <label key={m.value} style={S.radioRow}>
                <input
                  type="radio"
                  name="copy-mode"
                  value={m.value}
                  checked={(config.mode || 'replace') === m.value}
                  onChange={() => onChange({ mode: m.value })}
                  style={S.radioInput}
                />
                <span style={S.radioLabel}>{m.label}</span>
              </label>
            ))}
          </div>
        </Field>
      </>
    );
  }
  return null;
}

function ChipInput({ values, onChange }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) { setDraft(''); return; }
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div style={S.chipInputWrap}>
      <div style={S.chipRow}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            style={S.chip}
            title="Remove"
          >
            {v}
            <span aria-hidden="true" style={{ marginLeft: '6px' }}>×</span>
          </button>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
        placeholder="Type a value and press Enter"
        style={S.formInput}
      />
    </div>
  );
}

// ── Generic confirm modal ────────────────────────────────────────────────
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

// ── Small primitives ─────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '18px' }}>
      {label && (
        <span style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 500 }}>{label}</span>
      )}
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

function ActionChip({ type }) {
  const map = {
    enrich:        { bg: '#dcfce7', fg: '#166534', label: 'Enrich' },
    clean:         { bg: '#dbeafe', fg: '#1e40af', label: 'Clean' },
    find_replace:  { bg: '#fef3c7', fg: '#92400e', label: 'Find & replace' },
    regex_replace: { bg: '#fde68a', fg: '#92400e', label: 'Regex' },
    drop_key:      { bg: '#fee2e2', fg: '#991b1b', label: 'Drop' },
    set_value:     { bg: '#ede9fe', fg: '#6b21a8', label: 'Set value' },
    copy_from:     { bg: '#cffafe', fg: '#155e75', label: 'Copy from' },
  };
  const c = map[type] || { bg: '#f1f5f9', fg: '#475569', label: type };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      background: c.bg, color: c.fg, fontSize: '0.78rem', fontWeight: 500,
    }}>{c.label}</span>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────
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
  errorBar: {
    padding: '10px 14px',
    background: '#fee2e2', border: '1px solid #fecaca',
    color: '#991b1b', fontSize: '0.86rem', borderRadius: '4px',
  },
  infoBar: {
    padding: '10px 14px',
    background: '#dcfce7', border: '1px solid #bbf7d0',
    color: '#14532d', fontSize: '0.86rem', borderRadius: '4px',
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
    flexWrap: 'wrap', gap: '12px',
  },
  footerChip: {
    fontSize: '0.82rem', color: '#475569',
  },
  pendingDot: {
    display: 'inline-block', width: '8px', height: '8px',
    borderRadius: '999px', background: '#dc2626',
    marginLeft: '6px', verticalAlign: 'middle',
  },
  // Drawer
  drawerOverlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    background: '#fff', height: '100%', width: 'min(520px, 96vw)',
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
  helpBlock: {
    padding: '10px 12px',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
    color: '#475569', fontSize: '0.86rem',
    marginBottom: '18px',
  },
  chipInputWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 10px', borderRadius: '999px',
    background: '#ede9fe', color: '#6b21a8',
    border: 'none', fontSize: '0.82rem', cursor: 'pointer',
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
