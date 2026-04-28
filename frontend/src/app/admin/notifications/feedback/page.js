'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, MagentaLinks, Checkbox, Radio, ReorderList } from '@/components/admin/AdminBits';
import EmailPreviewDrawer from '@/components/admin/EmailPreviewDrawer';
import { buildEmailPreviewSrcDoc, resolveLogoAbs } from '@/lib/emailPreviews';
import api from '@/lib/api';

// Material-style outlined input mirroring the Email admin page so the two
// notification screens share the same look.
function OutlinedInput({ label, value, onChange, type = 'text', suffix, placeholder }) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: '10px 14px 12px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        background: '#fff',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <legend style={{ padding: '0 6px', fontSize: '0.72rem', color: '#475569' }}>{label}</legend>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '0.92rem',
          color: '#0f172a',
          fontFamily: 'var(--font-sans)',
          padding: 0,
        }}
      />
      {suffix && <span style={{ fontSize: '0.85rem', color: '#475569' }}>{suffix}</span>}
    </fieldset>
  );
}

function Banner({ kind, children, onDismiss }) {
  if (!children) return null;
  const palette = {
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#0c4a6e' },
    warn:    { bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
  }[kind] || { bg: '#eff6ff', border: '#bfdbfe', color: '#0c4a6e' };
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      style={{
        marginBottom: '14px',
        padding: '10px 14px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: '4px',
        color: palette.color,
        fontSize: '0.88rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        maxWidth: '720px',
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

const TEMPLATES = [
  'Topic feedback (sent to admin)',
  'Topic feedback confirmation (sent to user)',
  'Document feedback (sent to admin)',
  'Document feedback confirmation (sent to user)',
];

const FALLBACK_METADATA_KEYS = [
  'title',
  'author_personname',
  'authorgroup_author_personname',
  'publicationDate',
  'ft:lastPublication',
  'ft:publication_title',
  'ft:topic_id',
  'ft:source_id',
  'product',
  'audience',
  'language',
  'version',
  'tags',
];

function emptySettings() {
  return {
    recipients: [],
    subjectMetadataKeys: [],
    bodyMetadataKeys: [
      'ft:lastPublication',
      'publicationDate',
      'author_personname',
      'title',
      'ft:publication_title',
    ],
    authenticatedEmailService: 'ft',
    unauthenticatedEmailService: 'user',
    confirmationEmailEnabled: true,
    forbiddenAttachmentExtensions: [],
    maxAttachmentSizeMb: 5,
  };
}

export default function FeedbackNotificationsPage() {
  const [settings, setSettings] = useState(emptySettings());
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [forbiddenRaw, setForbiddenRaw] = useState('');
  const [metadataVocab, setMetadataVocab] = useState(FALLBACK_METADATA_KEYS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [subjectAdd, setSubjectAdd] = useState('');
  const [bodyAdd, setBodyAdd] = useState('');
  const baseline = useRef(null);
  const recipientsBaseline = useRef('');
  const forbiddenBaseline = useRef('');
  const [dirty, setDirty] = useState(false);

  // Mirror the live body-metadata list into the preview iframe so the admin
  // sees their reordering without needing to save.
  const previewSrcDoc = useMemo(() => {
    if (!preview) return '';
    return buildEmailPreviewSrcDoc(preview, {
      fromAddr: 'docs@darwinbox.com',
      adminTo: settings.recipients.join(', ') || 'docs@example.com',
      metaTags: settings.bodyMetadataKeys && settings.bodyMetadataKeys.length
        ? settings.bodyMetadataKeys
        : undefined,
      logoAbs: resolveLogoAbs('/ft-header-logo.png'),
    });
  }, [preview, settings.recipients, settings.bodyMetadataKeys]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setErrorMsg('');
    setInfoMsg('');
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    markDirty();
  }, [markDirty]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const d = await api.get('/admin/feedback');
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      const recip = (next.recipients || []).join(', ');
      const forbid = (next.forbiddenAttachmentExtensions || []).join(', ');
      setRecipientsRaw(recip);
      setForbiddenRaw(forbid);
      baseline.current = JSON.stringify(next);
      recipientsBaseline.current = recip;
      forbiddenBaseline.current = forbid;
      setDirty(false);
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to load feedback settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVocab = useCallback(async () => {
    try {
      const d = await api.get('/admin/feedback/metadata-keys');
      if (Array.isArray(d.keys) && d.keys.length) {
        setMetadataVocab(d.keys);
        setSubjectAdd((s) => s || d.keys[0]);
        setBodyAdd((s) => s || d.keys[0]);
      }
    } catch {
      // Non-fatal: built-ins still populate the dropdown.
    }
  }, []);

  useEffect(() => {
    load();
    loadVocab();
  }, [load, loadVocab]);

  // Default the dropdown selection once the vocab is loaded.
  useEffect(() => {
    if (!subjectAdd && metadataVocab.length) setSubjectAdd(metadataVocab[0]);
    if (!bodyAdd && metadataVocab.length)    setBodyAdd(metadataVocab[0]);
  }, [metadataVocab, subjectAdd, bodyAdd]);

  const cancel = () => {
    if (!baseline.current) { setDirty(false); return; }
    const b = JSON.parse(baseline.current);
    setSettings(b);
    setRecipientsRaw(recipientsBaseline.current);
    setForbiddenRaw(forbiddenBaseline.current);
    setDirty(false);
    setErrorMsg('');
    setInfoMsg('');
  };

  const save = async () => {
    setSaving(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const payload = {
        ...settings,
        recipients: recipientsRaw,
        forbiddenAttachmentExtensions: forbiddenRaw,
      };
      const d = await api.put('/admin/feedback', payload);
      const next = { ...emptySettings(), ...(d.settings || {}) };
      setSettings(next);
      const recip = (next.recipients || []).join(', ');
      const forbid = (next.forbiddenAttachmentExtensions || []).join(', ');
      setRecipientsRaw(recip);
      setForbiddenRaw(forbid);
      baseline.current = JSON.stringify(next);
      recipientsBaseline.current = recip;
      forbiddenBaseline.current = forbid;
      setDirty(false);
      setInfoMsg('Feedback settings saved.');
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to save feedback settings.');
    } finally {
      setSaving(false);
    }
  };

  // Subject metadata helpers — the array is reordered + ±entries from the
  // ReorderList; the typeahead dropdown gates additions to the vocabulary.
  const addSubjectMeta = () => {
    const v = subjectAdd?.trim();
    if (!v) return;
    if (settings.subjectMetadataKeys.includes(v)) return;
    update({ subjectMetadataKeys: [...settings.subjectMetadataKeys, v] });
  };
  const moveSubjectMeta = (from, to) => {
    if (to < 0 || to >= settings.subjectMetadataKeys.length) return;
    const arr = [...settings.subjectMetadataKeys];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    update({ subjectMetadataKeys: arr });
  };
  const removeSubjectMeta = (i) => {
    update({ subjectMetadataKeys: settings.subjectMetadataKeys.filter((_, idx) => idx !== i) });
  };

  const addBodyMeta = () => {
    const v = bodyAdd?.trim();
    if (!v) return;
    if (settings.bodyMetadataKeys.includes(v)) return;
    update({ bodyMetadataKeys: [...settings.bodyMetadataKeys, v] });
  };
  const moveBodyMeta = (from, to) => {
    if (to < 0 || to >= settings.bodyMetadataKeys.length) return;
    const arr = [...settings.bodyMetadataKeys];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    update({ bodyMetadataKeys: arr });
  };
  const removeBodyMeta = (i) => {
    update({ bodyMetadataKeys: settings.bodyMetadataKeys.filter((_, idx) => idx !== i) });
  };

  if (loading) {
    return (
      <AdminShell active="notif-feedback" allowedRoles={['superadmin', 'admin']} allowedAdminRoles={['PORTAL_ADMIN']}>
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="notif-feedback"
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['PORTAL_ADMIN']}
      footer={<ActionFooter dirty={dirty && !saving} onCancel={cancel} onSave={save} />}
    >
      <h1 style={S.h1}>Feedback</h1>
      <p style={S.subtitle}>Configure and preview the user feedback email template.</p>

      <Banner kind="error" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner>
      <Banner kind="success" onDismiss={() => setInfoMsg('')}>{infoMsg}</Banner>

      <Section title="Preview the email templates">
        <MagentaLinks items={TEMPLATES} onClick={setPreview} />
      </Section>

      <Section title="Recipients" desc="Comma-separated list of recipient email addresses.">
        <Banner kind="warn">
          Please use email aliases — feedback recipient addresses are publicly available for functional reasons.
        </Banner>
        {settings.recipients.length === 0 && (
          <Banner kind="info">
            Without an email address set in the Recipients field, Fluid Topics cannot send feedback emails.
          </Banner>
        )}
        <div style={{ maxWidth: '720px' }}>
          <OutlinedInput
            label="Recipient email addresses"
            value={recipientsRaw}
            onChange={(v) => { setRecipientsRaw(v); markDirty(); }}
            placeholder="docs@example.com, support@example.com"
          />
        </div>
      </Section>

      <Section title="Enrich email subject" desc="Adds metadata to the email subject line.">
        <div style={S.metaBox}>
          {settings.subjectMetadataKeys.length === 0 ? (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem', padding: '8px 0' }}>
              No metadata selected
            </div>
          ) : (
            <ReorderList
              items={settings.subjectMetadataKeys}
              onMove={moveSubjectMeta}
              onRemove={removeSubjectMeta}
            />
          )}
          <div style={S.addRow}>
            <span style={{ fontSize: '0.9rem' }}>Add metadata</span>
            <select value={subjectAdd} onChange={(e) => setSubjectAdd(e.target.value)} style={S.select}>
              {metadataVocab.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={addSubjectMeta} style={S.addBtn} aria-label="Add">+</button>
          </div>
        </div>
      </Section>

      <Section title="Enrich email body" desc="Adds metadata, only from the document, to the email body.">
        <div style={S.metaBox}>
          {settings.bodyMetadataKeys.length === 0 ? (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem', padding: '8px 0' }}>
              No metadata selected
            </div>
          ) : (
            <ReorderList
              items={settings.bodyMetadataKeys}
              onMove={moveBodyMeta}
              onRemove={removeBodyMeta}
            />
          )}
          <div style={S.addRow}>
            <span style={{ fontSize: '0.9rem' }}>Add metadata</span>
            <select value={bodyAdd} onChange={(e) => setBodyAdd(e.target.value)} style={S.select}>
              {metadataVocab.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={addBodyMeta} style={S.addBtn} aria-label="Add">+</button>
          </div>
        </div>
      </Section>

      <Section title="Email service for authenticated users">
        <div style={S.radioGroup}>
          <Radio
            checked={settings.authenticatedEmailService === 'ft'}
            onChange={() => update({ authenticatedEmailService: 'ft' })}
            label="Feedback sent by Fluid Topics email sending method"
          />
          <Radio
            checked={settings.authenticatedEmailService === 'user'}
            onChange={() => update({ authenticatedEmailService: 'user' })}
            label="Feedback sent by the user's email application"
          />
        </div>
      </Section>

      <Section title="Email service for unauthenticated users">
        <Banner kind="info">
          Configure SMTP relay in the <a href="/admin/notifications/email" style={{ color: '#1d4ed8' }}>Email settings</a> screen to enable Fluid Topics for unauthenticated users.
        </Banner>
        <div style={S.radioGroup}>
          <Radio
            checked={settings.unauthenticatedEmailService === 'ft'}
            onChange={() => update({ unauthenticatedEmailService: 'ft' })}
            label="Feedback sent by Fluid Topics email sending method (only available with SMTP relay)"
          />
          <Radio
            checked={settings.unauthenticatedEmailService === 'user'}
            onChange={() => update({ unauthenticatedEmailService: 'user' })}
            label="Feedback sent by the user's email application"
          />
        </div>
      </Section>

      {settings.authenticatedEmailService === 'ft' && (
        <Section
          title="Confirmation email"
          desc="When authenticated users submit feedback, Fluid Topics sends them an email to acknowledge their action."
        >
          <Checkbox
            checked={settings.confirmationEmailEnabled}
            onChange={(v) => update({ confirmationEmailEnabled: v })}
            label="An email is sent to users after submitting feedback"
          />
        </Section>
      )}

      <Section title="Forbidden attachment file extensions" desc="Comma-separated list of file extensions. Letter case is ignored.">
        <div style={{ maxWidth: '720px' }}>
          <OutlinedInput
            label="File extensions"
            value={forbiddenRaw}
            onChange={(v) => { setForbiddenRaw(v); markDirty(); }}
            placeholder=".exe, .bat, .vbs"
          />
        </div>
      </Section>

      <Section title="Maximum attachment size" desc="Defines the maximum total size for attached files (between 1MB and 23MB).">
        <div style={{ maxWidth: '320px' }}>
          <OutlinedInput
            label="Maximum size"
            type="number"
            value={String(settings.maxAttachmentSizeMb ?? '')}
            onChange={(v) => update({ maxAttachmentSizeMb: v === '' ? '' : Number(v) })}
            suffix="MB"
          />
        </div>
      </Section>

      <EmailPreviewDrawer
        template={preview}
        srcDoc={previewSrcDoc}
        onClose={() => setPreview(null)}
      />
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  metaBox: {
    background: '#FFFFFF',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    maxWidth: '720px',
  },
  addRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px',
  },
  select: {
    padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', background: '#fff',
    fontFamily: 'var(--font-sans)', color: '#1f2937', cursor: 'pointer',
  },
  addBtn: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#a21caf', color: '#fff', border: 'none',
    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  radioGroup: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: '4px',
  },
};
