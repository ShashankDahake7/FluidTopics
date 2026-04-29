'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Helpers ───────────────────────────────────────────────────────────────
const newId = () => `r${Math.random().toString(36).slice(2, 8)}`;

// Pull the editable working set from the API response. Drafts win when
// they exist; otherwise we clone the active rows so the editor always
// has something to manipulate.
function bucketsToWorkingSet(payload) {
  const fromBucket = (b) => {
    if (!b) return [];
    const src = b.draft?.length ? b.draft : (b.active || []);
    return src.map((r) => ({
      id: r.id,
      persisted: true,
      state: r.state,
      template: r.template || '',
      requirements: (r.requirements || []).map((rq) => ({ ...rq })),
      priority: r.priority || 0,
      _source: r,
    }));
  };
  return {
    documents: fromBucket(payload?.documents),
    topics: fromBucket(payload?.topics),
  };
}

// Compare current working set against last-saved snapshot to flag dirty.
function isDirty(working, baseline, configWorking, configBaseline) {
  if (configWorking.removeAccents !== configBaseline.removeAccents) return true;
  if (configWorking.lowercase !== configBaseline.lowercase) return true;
  for (const scope of ['documents', 'topics']) {
    if (working[scope].length !== baseline[scope].length) return true;
    for (let i = 0; i < working[scope].length; i += 1) {
      const a = working[scope][i];
      const b = baseline[scope][i];
      if (!b || a.id !== b.id) return true;
      if ((a.template || '') !== (b.template || '')) return true;
      const ar = JSON.stringify(a.requirements || []);
      const br = JSON.stringify(b.requirements || []);
      if (ar !== br) return true;
    }
  }
  return false;
}

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return null;
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function PrettyUrlPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverPayload, setServerPayload] = useState(null);
  const [working, setWorking] = useState({ documents: [], topics: [] });
  const [baseline, setBaseline] = useState({ documents: [], topics: [] });
  const [config, setConfig] = useState({ removeAccents: true, lowercase: false });
  const [configBaseline, setConfigBaseline] = useState({ removeAccents: true, lowercase: false });
  const [reqOpenFor, setReqOpenFor] = useState(null); // { section, ruleId }
  const [confirm, setConfirm] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [reprocessJob, setReprocessJob] = useState(null);

  const showToast = useCallback((kind, text) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api.get('/pretty-urls/');
      setServerPayload(payload);
      const ws = bucketsToWorkingSet(payload);
      setWorking(ws);
      setBaseline(JSON.parse(JSON.stringify(ws)));
      const cfg = {
        removeAccents: !!payload?.config?.removeAccents,
        lowercase: !!payload?.config?.lowercase,
      };
      setConfig(cfg);
      setConfigBaseline(cfg);
      setReprocessJob(payload?.runningJob || null);
    } catch (err) {
      setError(err?.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Poll the running job until it terminates so the admin sees live
  // progress without manually refreshing.
  useEffect(() => {
    if (!reprocessJob?.id) return undefined;
    if (reprocessJob.status !== 'queued' && reprocessJob.status !== 'running') return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const { job } = await api.get(`/pretty-urls/jobs/${reprocessJob.id}`);
        if (cancelled) return;
        setReprocessJob(job);
        if (job.status === 'queued' || job.status === 'running') {
          window.setTimeout(poll, 1500);
        } else {
          // Refetch the global payload — config.pendingReprocess clears
          // when the worker is done, and we want the action bar updated.
          reload();
        }
      } catch {
        if (!cancelled) window.setTimeout(poll, 3000);
      }
    };
    const t = window.setTimeout(poll, 1500);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [reprocessJob?.id, reprocessJob?.status, reload]);

  const dirty = useMemo(
    () => isDirty(working, baseline, config, configBaseline),
    [working, baseline, config, configBaseline]
  );
  const pendingReprocess = !!serverPayload?.config?.pendingReprocess;

  // ── List mutators ────────────────────────────────────────────────────
  const updateRule = (section, id, patch) => {
    setWorking((prev) => ({
      ...prev,
      [section]: prev[section].map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };
  const removeRule = (section, id) => {
    setWorking((prev) => ({
      ...prev,
      [section]: prev[section].filter((r) => r.id !== id),
    }));
  };
  const addRule = (section) => {
    setWorking((prev) => ({
      ...prev,
      [section]: [...prev[section], {
        id: newId(),
        persisted: false,
        state: 'draft',
        template: '',
        requirements: [],
        priority: prev[section].length,
      }],
    }));
  };
  const addRequirement = (section, id, requirement) => {
    setWorking((prev) => ({
      ...prev,
      [section]: prev[section].map((r) => (
        r.id === id ? { ...r, requirements: [...r.requirements, requirement] } : r
      )),
    }));
  };
  const removeRequirement = (section, id, idx) => {
    setWorking((prev) => ({
      ...prev,
      [section]: prev[section].map((r) => (
        r.id === id ? { ...r, requirements: r.requirements.filter((_, i) => i !== idx) } : r
      )),
    }));
  };
  const reorderSection = (section, fromId, toId) => {
    if (fromId === toId) return;
    setWorking((prev) => {
      const list = prev[section];
      const fromIdx = list.findIndex((r) => r.id === fromId);
      const toIdx = list.findIndex((r) => r.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      return { ...prev, [section]: arrayMove(list, fromIdx, toIdx) };
    });
  };

  // ── Reset working set back to the server's last load ─────────────────
  const onCancel = () => {
    setWorking(JSON.parse(JSON.stringify(baseline)));
    setConfig({ ...configBaseline });
  };

  // Reset draft on the server (drops drafts, copies actives back).
  const onResetDraft = async () => {
    setBusy(true);
    try {
      await api.post('/pretty-urls/reset-draft', {});
      await reload();
      showToast('success', 'Draft reset to currently active configuration');
    } catch (err) {
      showToast('error', err?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  // Persist the working set as drafts (server keeps actives untouched).
  const onSaveDraft = async () => {
    setBusy(true);
    try {
      // Wipe existing drafts
      const oldDrafts = [
        ...(serverPayload?.documents?.draft || []),
        ...(serverPayload?.topics?.draft || []),
      ];
      for (const d of oldDrafts) {
        try { await api.delete(`/pretty-urls/${d.id}`); }
        catch (_) { /* ignore — best-effort */ }
      }

      // Insert new drafts in priority order so the server-side priority
      // matches the on-screen order.
      for (const [scope, key] of [['document', 'documents'], ['topic', 'topics']]) {
        const list = working[key];
        for (let i = 0; i < list.length; i += 1) {
          const r = list[i];
          if (!r.template?.trim()) continue;
          await api.post('/pretty-urls', {
            scope,
            state: 'draft',
            template: r.template,
            requirements: r.requirements,
            priority: i,
          });
        }
      }

      // Push normalization updates if they changed.
      if (config.removeAccents !== configBaseline.removeAccents
          || config.lowercase !== configBaseline.lowercase) {
        await api.patch('/pretty-urls/config', config);
      }

      await reload();
      showToast('success', 'Draft saved');
    } catch (err) {
      showToast('error', err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Save the working set as the live active configuration and queue a
  // reprocess job.
  const onSaveAndActivate = async () => {
    setBusy(true);
    try {
      const documents = working.documents
        .filter((r) => r.template?.trim())
        .map((r, i) => ({ template: r.template.trim(), requirements: r.requirements, priority: i }));
      const topics = working.topics
        .filter((r) => r.template?.trim())
        .map((r, i) => ({ template: r.template.trim(), requirements: r.requirements, priority: i }));
      const { job } = await api.post('/pretty-urls/save-and-activate', {
        documents,
        topics,
        config,
      });
      setReprocessJob(job);
      showToast('success', 'Saved and activated. Reprocess queued.');
      await reload();
    } catch (err) {
      showToast('error', err?.message || 'Save & activate failed');
    } finally {
      setBusy(false);
    }
  };

  // Queue a reprocess job without changing templates.
  const onActivateForAll = async () => {
    setBusy(true);
    try {
      const { job } = await api.post('/pretty-urls/reprocess', {});
      setReprocessJob(job);
      showToast('success', 'Reprocess queued for all documents.');
      await reload();
    } catch (err) {
      showToast('error', err?.message || 'Reprocess failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell active="khub-pretty-url" allowedRoles={['superadmin']} fullWidth>
        <div style={S.page}>
          <div style={{ padding: 24, color: '#475569' }}>Loading Pretty URL configuration…</div>
        </div>
      </AdminShell>
    );
  }

  const lastActivatedDisplay = formatDate(serverPayload?.config?.lastActivatedAt);
  const lastJob = serverPayload?.lastJob;
  const lastApplyAllDisplay = lastJob?.finishedAt ? formatDate(lastJob.finishedAt) : null;

  return (
    <AdminShell active="khub-pretty-url" allowedRoles={['superadmin']} fullWidth>
      <div style={S.page}>
        {error && (
          <Notice variant="warning">
            <strong>Failed to load:</strong> {error}
          </Notice>
        )}

        <header style={S.headerRow}>
          <div>
            <h1 style={S.h1}>Pretty URL</h1>
            <p style={S.subtitle}>Create meaningful and non-ambiguous URLs to facilitate documentation sharing.</p>
          </div>
          <button type="button" style={S.linkBtnPink} onClick={() => setViewOpen(true)}>View current configuration</button>
        </header>

        <Notice variant="info">
          <span style={{ fontWeight: 500 }}>See documentation:&nbsp;</span>
          <a href="https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Knowledge-Hub/Pretty-URL"
             target="_blank" rel="noreferrer" style={S.docLink}>
            Pretty URL
          </a>
        </Notice>

        <Notice variant="info">
          {lastActivatedDisplay && <div>Last activation: {lastActivatedDisplay}</div>}
          {lastApplyAllDisplay && <div>Last application for all documents: {lastApplyAllDisplay}</div>}
          {!lastActivatedDisplay && !lastApplyAllDisplay && (
            <div>No activation has been recorded yet.</div>
          )}
        </Notice>

        {pendingReprocess && (
          <Notice variant="warning">
            You have unsaved changes. Save and activate to apply them, or reset draft to discard.
          </Notice>
        )}

        {reprocessJob && (reprocessJob.status === 'queued' || reprocessJob.status === 'running') && (
          <Notice variant="info">
            Reprocessing in progress — {reprocessJob.processed || 0}/{reprocessJob.total || '?'} documents
            {reprocessJob.errorCount ? ` (${reprocessJob.errorCount} errors)` : ''}.
          </Notice>
        )}
        {reprocessJob && reprocessJob.status === 'failed' && (
          <Notice variant="warning">
            Last reprocess failed: {reprocessJob.lastError || 'Unknown error'}
          </Notice>
        )}

        <Notice variant="warning">
          Use metadata with a single value in Pretty URLs. For metadata with multiple values, the value used cannot be predicted.
        </Notice>

        <Section
          title="Pretty URLs for documents"
          description="Defines pretty URLs for documents. Templates apply in the order listed."
        >
          <RulesList
            section="documents"
            rules={working.documents}
            placeholder="example/{ft:title}"
            onChangeTemplate={(id, val) => updateRule('documents', id, { template: val })}
            onRemove={(id) => removeRule('documents', id)}
            onAddRequirement={(id) => setReqOpenFor({ section: 'documents', ruleId: id })}
            onRemoveRequirement={(id, idx) => removeRequirement('documents', id, idx)}
            onReorder={(fromId, toId) => reorderSection('documents', fromId, toId)}
          />
          <button type="button" style={S.addBtn} onClick={() => addRule('documents')}>
            <PlusIcon /> Add template
          </button>
        </Section>

        <Section
          title="Pretty URLs for topics"
          description="Defines pretty URLs for topics. Templates apply in the order listed."
        >
          <Notice variant="info">
            <div>Reference document’s metadata with <code style={S.code}>{`{document.metadata}`}</code>.</div>
            <div>Concatenate metadata of all parent topics and current topic with <code style={S.code}>{`{parents-and-self.metadata}`}</code>.</div>
            <div>Reference document&apos;s generated URL with <code style={S.code}>{`{document.ft:prettyUrl}`}</code>.</div>
          </Notice>
          <RulesList
            section="topics"
            rules={working.topics}
            placeholder="example/{document.ft:title}/{ft:title}"
            onChangeTemplate={(id, val) => updateRule('topics', id, { template: val })}
            onRemove={(id) => removeRule('topics', id)}
            onAddRequirement={(id) => setReqOpenFor({ section: 'topics', ruleId: id })}
            onRemoveRequirement={(id, idx) => removeRequirement('topics', id, idx)}
            onReorder={(fromId, toId) => reorderSection('topics', fromId, toId)}
          />
          <button type="button" style={S.addBtn} onClick={() => addRule('topics')}>
            <PlusIcon /> Add template
          </button>
        </Section>

        <Section
          title="Normalization"
          description="These operations are applied to all generated pretty URLs."
        >
          <Notice variant="warning">
            Changing these settings invalidates the existing Pretty URLs. This can break links and affect SEO.
          </Notice>
          <label style={S.normalizationLine}>
            <input
              type="checkbox"
              checked={config.removeAccents}
              onChange={(e) => setConfig((p) => ({ ...p, removeAccents: e.target.checked }))}
              style={S.checkboxInput}
            />
            <span>Remove accents and other UTF-8 combining characters</span>
          </label>
          <label style={S.normalizationLine}>
            <input
              type="checkbox"
              checked={config.lowercase}
              onChange={(e) => setConfig((p) => ({ ...p, lowercase: e.target.checked }))}
              style={S.checkboxInput}
            />
            <span>Transform to lower case</span>
          </label>
        </Section>

        <footer style={S.actionsBar}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'resetDraft' })}
                    style={{ ...S.secondaryBtn, opacity: busy ? 0.55 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              Reset draft
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'activateAll' })}
                    style={{ ...S.secondaryBtn, opacity: busy ? 0.55 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              Activate for all documents
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button type="button" disabled={busy || !dirty} onClick={onCancel}
                    style={{ ...S.cancelBtn, opacity: busy || !dirty ? 0.55 : 1, cursor: busy || !dirty ? 'not-allowed' : 'pointer' }}>
              <CrossIcon /> Cancel
            </button>
            <button type="button" disabled={busy || !dirty} onClick={onSaveDraft}
                    style={{ ...S.confirmBtn, opacity: busy || !dirty ? 0.55 : 1, cursor: busy || !dirty ? 'not-allowed' : 'pointer' }}>
              <CheckIcon /> Save Draft
            </button>
            <button type="button" disabled={busy || !dirty} onClick={() => setConfirm({ kind: 'saveAndActivate' })}
                    style={{ ...S.confirmBtn, opacity: busy || !dirty ? 0.55 : 1, cursor: busy || !dirty ? 'not-allowed' : 'pointer' }}>
              <CheckIcon /> Save and activate
            </button>
          </div>
        </footer>
      </div>

      {toast && (
        <div style={{ ...S.toast, ...(toast.kind === 'error' ? S.toastError : S.toastSuccess) }}>
          {toast.text}
        </div>
      )}

      <CurrentConfigDrawer
        open={viewOpen}
        payload={serverPayload}
        onClose={() => setViewOpen(false)}
      />

      <RequirementModal
        open={!!reqOpenFor}
        onCancel={() => setReqOpenFor(null)}
        onSave={(req) => { if (reqOpenFor) addRequirement(reqOpenFor.section, reqOpenFor.ruleId, req); setReqOpenFor(null); }}
      />

      <ConfirmModal
        open={confirm?.kind === 'activateAll'}
        title="Activate for all documents?"
        body={
          <>
            This will <strong>regenerate the Pretty URLs</strong> for every document already in the platform using the currently saved configuration.
            <br /><br />
            Existing links to old URLs may break and affect SEO.
          </>
        }
        confirmLabel="Activate"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onActivateForAll(); }}
      />

      <ConfirmModal
        open={confirm?.kind === 'saveAndActivate'}
        title="Save and activate?"
        body={
          <>
            This will <strong>replace the active Pretty URL configuration</strong> with the current draft and queue a reprocess job for the entire corpus.
            <br /><br />
            Existing links may change.
          </>
        }
        confirmLabel="Save and activate"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onSaveAndActivate(); }}
      />

      <ConfirmModal
        open={confirm?.kind === 'resetDraft'}
        title="Reset draft?"
        body="The draft will be discarded and replaced with a fresh copy of the currently active configuration."
        confirmLabel="Reset draft"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onResetDraft(); }}
      />
    </AdminShell>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <section style={S.section}>
      <header style={{ marginBottom: '12px' }}>
        <h2 style={S.sectionTitle}>{title}</h2>
        <p style={S.sectionDesc}>{description}</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </section>
  );
}

// ─── Sortable rule list (dnd-kit) ──────────────────────────────────────────
function RulesList({ section, rules, placeholder, onChangeTemplate, onRemove, onAddRequirement, onRemoveRequirement, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(active.id, over.id);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div style={S.rulesWrap}>
          {rules.map((r, idx) => (
            <SortableRuleCard
              key={r.id}
              section={section}
              rule={r}
              number={idx + 1}
              placeholder={placeholder}
              onChangeTemplate={(val) => onChangeTemplate(r.id, val)}
              onRemove={() => onRemove(r.id)}
              onAddRequirement={() => onAddRequirement(r.id)}
              onRemoveRequirement={(i) => onRemoveRequirement(r.id, i)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRuleCard({ rule, number, placeholder, onChangeTemplate, onRemove, onAddRequirement, onRemoveRequirement }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 4px 12px rgba(15,23,42,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={{ ...S.ruleCard, ...style }}>
      <button
        type="button"
        title="Drag to reorder"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        style={S.dragHandle}
      >
        <DragIcon />
      </button>
      <span style={S.ruleNumber}>{number}</span>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <MaterialInput
          label="Template"
          placeholder={placeholder}
          value={rule.template}
          onChange={onChangeTemplate}
        />
        <ul style={S.requirementsList}>
          {rule.requirements.map((req, i) => (
            <li key={i} style={S.requirementChip}>
              <span>
                <strong>{req.key}</strong>
                {req.required === false ? <span style={S.optionalTag}>(optional)</span> : null}
                {req.topicSource ? <span style={S.topicSourceTag}>topic source</span> : null}
              </span>
              <button type="button" aria-label="Remove" onClick={() => onRemoveRequirement(i)} style={S.requirementRemove}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={onAddRequirement} style={S.requirementAdd}>
              <PlusIcon size={12} /> Add metadata requirement
            </button>
          </li>
        </ul>
      </div>

      <div style={S.ruleActions}>
        <IconBtn title="Remove template" onClick={onRemove} danger>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}

// ─── Material outlined input ───────────────────────────────────────────────
function MaterialInput({ label, placeholder, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value;

  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        borderRadius: '4px',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <fieldset
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
          borderRadius: '4px',
          margin: 0, padding: '0 8px',
          pointerEvents: 'none',
          textAlign: 'left',
          minWidth: 0,
        }}
      >
        <legend style={{
          width: isFloated ? 'auto' : 0,
          maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem',
          color: focused ? '#a21caf' : '#475569',
          fontFamily: 'var(--font-sans)',
          float: 'unset',
          height: '11px',
          visibility: 'visible',
          fontWeight: 500,
          opacity: isFloated ? 1 : 0,
          transition: 'opacity 120ms',
        }}>
          {label}
        </legend>
      </fieldset>

      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={isFloated ? placeholder : ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'relative',
          width: '100%',
          padding: '14px 12px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: '0.92rem', color: '#0f172a',
          fontFamily: 'var(--font-mono, monospace)',
          boxSizing: 'border-box',
        }}
      />

      {!isFloated && (
        <label style={{
          position: 'absolute',
          left: '12px', top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.92rem', color: '#94a3b8',
          pointerEvents: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-sans)',
        }}>
          {label}
        </label>
      )}
    </div>
  );
}

// ─── Notice (info / warning) ───────────────────────────────────────────────
function Notice({ variant = 'info', children }) {
  const palette = variant === 'warning'
    ? { bg: '#fef3c7', border: '#fde68a', icon: '#b45309', text: '#78350f' }
    : { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e3a8a' };
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: '4px', padding: '10px 14px',
      color: palette.text, fontSize: '0.86rem', lineHeight: 1.45,
    }}>
      <span aria-hidden="true" style={{ color: palette.icon, marginTop: '2px', display: 'inline-flex' }}>
        {variant === 'warning' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9"  x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8"  x2="12.01" y2="8" />
          </svg>
        )}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function IconBtn({ title, danger, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        color: danger ? '#b91c1c' : '#475569',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '4px',
      }}
    >
      {children}
    </button>
  );
}

const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5"  x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const DragIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="18" r="1" />
  </svg>
);

// ─── Add metadata requirement modal ────────────────────────────────────────
function RequirementModal({ open, onCancel, onSave }) {
  const [keyVal, setKeyVal] = useState('');
  const [requiredVal, setRequiredVal] = useState(true);
  const [topicSourceVal, setTopicSourceVal] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setKeyVal('');
    setRequiredVal(true);
    setTopicSourceVal(false);
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onCancel]);

  if (!open) return null;
  const valid = !!keyVal.trim();

  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label="Add metadata requirement" onClick={(e) => e.stopPropagation()} style={S.modalDialog}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>Add metadata requirement</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}><CrossIcon /></button>
        </header>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569' }}>
            The template will only apply when this metadata key resolves successfully.
          </p>
          <MaterialInput label="Metadata key" placeholder="ft:sourceType" value={keyVal} onChange={setKeyVal} />
          <label style={S.normalizationLine}>
            <input
              type="checkbox"
              checked={requiredVal}
              onChange={(e) => setRequiredVal(e.target.checked)}
              style={S.checkboxInput}
            />
            <span>Required (template only matches when this key has a value)</span>
          </label>
          <label style={S.normalizationLine}>
            <input
              type="checkbox"
              checked={topicSourceVal}
              onChange={(e) => setTopicSourceVal(e.target.checked)}
              style={S.checkboxInput}
            />
            <span>Resolve from the topic itself (only valid for topic templates)</span>
          </label>
        </div>
        <div style={S.modalFooter}>
          <button type="button" onClick={onCancel} style={S.linkBtn}>Cancel</button>
          <button type="button" disabled={!valid}
                  onClick={() => valid && onSave({ key: keyVal.trim(), required: requiredVal, topicSource: topicSourceVal })}
                  style={{ ...S.confirmBtn, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <CheckIcon /> Add requirement
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Current configuration drawer (read-only view of *active* set) ─────────
function CurrentConfigDrawer({ open, payload, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const cfg = payload?.config || {};
  const lastActivatedDisplay = formatDate(cfg.lastActivatedAt);

  return (
    <div role="presentation" onClick={onClose} style={S.drawerScrim}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Current Pretty URL configuration"
        onClick={(e) => e.stopPropagation()}
        style={S.drawer}
      >
        <header style={S.drawerHeader}>
          <button type="button" aria-label="Close" onClick={onClose} style={S.modalClose}>
            <CrossIcon />
          </button>
          <h2 style={S.drawerTitle}>Current Pretty URL configuration</h2>
        </header>

        <div style={S.drawerBody}>
          {lastActivatedDisplay && (
            <Notice variant="info">Last activated: {lastActivatedDisplay}</Notice>
          )}

          <section>
            <h3 style={S.drawerSection}>Normalization</h3>
            <ReadOnlyCheck checked={!!cfg.removeAccents} label="Remove accents and other UTF-8 combining characters" />
            <ReadOnlyCheck checked={!!cfg.lowercase} label="Transform to lower case" />
          </section>

          <section>
            <h3 style={S.drawerSection}>Pretty URLs for documents</h3>
            <ReadOnlyRules rules={payload?.documents?.active || []} />
          </section>

          <section>
            <h3 style={S.drawerSection}>Pretty URLs for topics</h3>
            <ReadOnlyRules rules={payload?.topics?.active || []} />
          </section>
        </div>
      </aside>
    </div>
  );
}

function ReadOnlyRules({ rules }) {
  if (!rules?.length) {
    return <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No template defined.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rules.map((r, idx) => (
        <div key={r.id} style={S.readOnlyRule}>
          <span style={S.readOnlyNumber}>{idx + 1}</span>
          <code style={S.readOnlyTemplate}>{r.template}</code>
          {r.requirements?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginLeft: '8px' }}>
              {r.requirements.map((req, i) => (
                <span key={i} style={S.requirementChip}>
                  <strong>{req.key}</strong>
                  {req.required === false ? <span style={S.optionalTag}>(optional)</span> : null}
                  {req.topicSource ? <span style={S.topicSourceTag}>topic source</span> : null}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReadOnlyCheck({ checked, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
      <span style={{
        width: '14px', height: '14px', borderRadius: '2px',
        border: '1px solid ' + (checked ? '#a21caf' : '#cbd5e1'),
        background: checked ? '#a21caf' : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span style={{
        fontSize: '0.86rem',
        color: checked ? '#0f172a' : '#94a3b8',
      }}>
        {label}
      </span>
    </div>
  );
}

function ConfirmModal({ open, title, body, confirmLabel = 'Confirm', onCancel, onConfirm }) {
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
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}><CrossIcon /></button>
        </header>
        <div style={S.modalBody}>{body}</div>
        <div style={S.modalFooter}>
          <button type="button" onClick={onCancel} style={S.linkBtn}>Cancel</button>
          <button type="button" onClick={onConfirm} style={S.confirmBtn}>
            <CheckIcon /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '64px' },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569' },
  linkBtnPink: {
    background: 'transparent', border: 'none', padding: 0,
    color: '#a21caf', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  section: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '16px 18px',
  },
  sectionTitle: { margin: 0, fontSize: '1.02rem', fontWeight: 600, color: '#0f172a' },
  sectionDesc: { margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' },
  rulesWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  ruleCard: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '12px 14px',
  },
  dragHandle: {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    cursor: 'grab',
    color: '#94a3b8',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '4px',
    flexShrink: 0,
    marginTop: '6px',
    touchAction: 'none',
  },
  ruleNumber: {
    width: '24px', height: '24px', borderRadius: '999px',
    background: '#fdf2f8', color: '#a21caf', fontWeight: 600, fontSize: '0.78rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: '12px',
  },
  ruleActions: {
    display: 'inline-flex', gap: '2px', flexShrink: 0, marginTop: '6px',
  },
  requirementsList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
  },
  requirementChip: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '4px 8px', borderRadius: '999px',
    background: '#fdf2f8', border: '1px solid #f5d0fe', color: '#a21caf',
    fontSize: '0.74rem', fontWeight: 500,
  },
  optionalTag: {
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: 400,
    marginLeft: '4px',
  },
  topicSourceTag: {
    fontSize: '0.7rem',
    color: '#1e3a8a',
    background: '#dbeafe',
    border: '1px solid #bfdbfe',
    borderRadius: '999px',
    padding: '0 6px',
    fontWeight: 500,
    marginLeft: '4px',
  },
  requirementRemove: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '0 0 0 2px', color: '#a21caf', display: 'inline-flex',
  },
  requirementAdd: {
    background: 'transparent', border: 'none',
    color: '#a21caf', cursor: 'pointer',
    padding: '4px 8px', fontSize: '0.78rem', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    fontFamily: 'var(--font-sans)',
  },
  addBtn: {
    alignSelf: 'flex-start',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fdf2f8', color: '#a21caf',
    border: '1px solid #f5d0fe', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  normalizationLine: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', fontSize: '0.9rem', color: '#0f172a',
  },
  checkboxInput: {
    width: '16px', height: '16px',
    accentColor: '#a21caf', margin: 0,
  },
  code: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '3px',
    padding: '0 4px', fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.78rem', color: '#0f172a',
  },
  actionsBar: {
    position: 'sticky', bottom: 0, zIndex: 5,
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#f8fafc', borderTop: '1px solid #e2e8f0',
    padding: '12px 16px', marginTop: '6px',
    borderRadius: '0 0 4px 4px',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  cancelBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  confirmBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#16a34a', color: '#fff',
    border: '1px solid #16a34a', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 12px',
    background: 'transparent', color: '#475569',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.86rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  docLink: {
    color: '#a21caf', fontWeight: 600, textDecoration: 'none',
  },
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
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: '18px', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
  },
  drawerScrim: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(15,23,42,0.4)',
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 'min(720px, 100%)',
    height: '100%',
    background: '#fff',
    boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-sans)',
    animation: 'drawerSlideIn 200ms ease-out',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 18px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  drawerTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  drawerBody: {
    flex: 1, overflowY: 'auto',
    padding: '20px 22px',
    display: 'flex', flexDirection: 'column', gap: '18px',
  },
  drawerSection: {
    margin: '0 0 10px',
    fontSize: '0.95rem', fontWeight: 600, color: '#0f172a',
  },
  readOnlyRule: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '10px 12px',
  },
  readOnlyNumber: {
    width: '22px', height: '22px', borderRadius: '999px',
    background: '#fdf2f8', color: '#a21caf', fontWeight: 600, fontSize: '0.74rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  readOnlyTemplate: {
    flex: 1,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '3px',
    padding: '6px 10px', fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.85rem', color: '#0f172a',
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '12px 16px',
    borderRadius: '6px',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.86rem',
    fontWeight: 500,
    boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
    zIndex: 10002,
    maxWidth: '420px',
  },
  toastSuccess: {
    background: '#dcfce7',
    border: '1px solid #86efac',
    color: '#166534',
  },
  toastError: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#991b1b',
  },
};
