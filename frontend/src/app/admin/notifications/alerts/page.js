'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, Checkbox, Radio, ReorderList } from '@/components/admin/AdminBits';
import AlertPreviewModal from '@/components/admin/AlertPreviewModal';
import { buildAlertSrcDoc, resolveLogoAbs } from '@/lib/emailPreviews';
import api from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Same metadata catalogue as the feedback / configure-rule screens — keeps
// the typeahead suggestions consistent across notification settings.
const METADATA_OPTIONS = [
  'author_personname', 'authorgroup_author_personname', 'copyright',
  'Created_by', 'creationDate', 'data_origin_id', 'ft:alertTimestamp',
  'ft:attachmentsSize', 'ft:baseId', 'ft:clusterId', 'ft:container',
  'ft:contentSize', 'ft:document_type', 'ft:editorialType', 'ft:filename',
  'ft:isArticle', 'ft:isAttachment', 'ft:isBook', 'ft:isHtmlPackage',
  'ft:isPublication', 'ft:isSynchronousAttachment', 'ft:isUnstructured',
  'ft:khubVersion', 'ft:lastEdition', 'ft:lastPublication',
  'ft:lastTechChange', 'ft:lastTechChangeTimestamp', 'ft:locale',
  'ft:mimeType', 'ft:openMode', 'ft:originId', 'ft:prettyUrl',
  'ft:publication_title', 'ft:publicationId', 'ft:publishStatus',
  'ft:publishUploadId', 'ft:searchableFromInt', 'ft:sourceCategory',
  'ft:sourceId', 'ft:sourceName', 'ft:sourceType', 'ft:structure',
  'ft:title', 'ft:tocPosition', 'ft:topicTitle', 'ft:wordCount',
  'generator', 'Key', 'Module', 'Name', 'paligo:resourceTitle',
  'paligo:resourceTitleLabel', 'publicationDate', 'Release_Notes',
  'subtitle', 'Taxonomy', 'title',
];

// Convert the on-disk shape to / from the local UI shape. Days come in as a
// `{Monday: true, …}` map for the checkbox grid; the API uses a flat
// ['Monday', 'Wednesday'] array so the audit diff is trivial to read.
const DAY_MAP_DEFAULT = Object.fromEntries(DAYS.map((d) => [d, false]));
function daysArrayToMap(arr = []) {
  const out = { ...DAY_MAP_DEFAULT };
  for (const d of arr) if (d in out) out[d] = true;
  return out;
}
function daysMapToArray(map = {}) {
  return DAYS.filter((d) => !!map[d]);
}

export default function AlertsNotificationsPage() {
  const [matchMode, setMatchMode] = useState('any');             // 'any' | 'all'
  const [days, setDays] = useState({ ...DAY_MAP_DEFAULT, Monday: true });
  const [bodyMeta, setBodyMeta] = useState(['Created_by', 'title', 'publicationDate']);
  const [bodyAdd, setBodyAdd] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Snapshot of the last successfully-loaded/saved settings — Cancel reverts.
  const [savedSnapshot, setSavedSnapshot] = useState({
    matchMode: 'any', days: { ...DAY_MAP_DEFAULT, Monday: true },
    bodyMeta: ['Created_by', 'title', 'publicationDate'],
  });

  // Load on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/admin/notifications/alerts');
        if (cancelled) return;
        const s = data?.settings || {};
        const next = {
          matchMode: s.matchMode || 'any',
          days:      daysArrayToMap(s.recurrenceDays || []),
          bodyMeta:  Array.isArray(s.bodyMetadataKeys) && s.bodyMetadataKeys.length
            ? s.bodyMetadataKeys
            : ['Created_by', 'title', 'publicationDate'],
        };
        setMatchMode(next.matchMode);
        setDays(next.days);
        setBodyMeta(next.bodyMeta);
        setSavedSnapshot(next);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load alert settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = (fn) => (v) => { fn(v); setDirty(true); };

  const toggleDay = (d) => { setDays({ ...days, [d]: !days[d] }); setDirty(true); };

  const addBody = () => {
    const v = bodyAdd.trim();
    if (!v) return;
    if (!bodyMeta.includes(v)) {
      setBodyMeta([...bodyMeta, v]);
      setDirty(true);
    }
    setBodyAdd('');
  };
  const moveBody = (from, to) => {
    if (to < 0 || to >= bodyMeta.length) return;
    const arr = [...bodyMeta]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    setBodyMeta(arr); setDirty(true);
  };
  const removeBody = (i) => { setBodyMeta(bodyMeta.filter((_, idx) => idx !== i)); setDirty(true); };

  const handleCancel = useCallback(() => {
    setMatchMode(savedSnapshot.matchMode);
    setDays(savedSnapshot.days);
    setBodyMeta(savedSnapshot.bodyMeta);
    setDirty(false);
    setError('');
  }, [savedSnapshot]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        matchMode,
        recurrenceDays:   daysMapToArray(days),
        bodyMetadataKeys: bodyMeta,
      };
      const data = await api.put('/admin/notifications/alerts', payload);
      const s = data?.settings || {};
      const next = {
        matchMode: s.matchMode || matchMode,
        days:      daysArrayToMap(s.recurrenceDays || payload.recurrenceDays),
        bodyMeta:  Array.isArray(s.bodyMetadataKeys) ? s.bodyMetadataKeys : payload.bodyMetadataKeys,
      };
      setMatchMode(next.matchMode);
      setDays(next.days);
      setBodyMeta(next.bodyMeta);
      setSavedSnapshot(next);
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to save alert settings.');
    } finally {
      setSaving(false);
    }
  }, [matchMode, days, bodyMeta, saving]);

  // ----- Preview wiring ----------------------------------------------------
  const previewMeta = useMemo(() => ({
    fromAddr: 'docs@darwinbox.com',
    subject:  '"My Saved Search" search summary',
    toAddr:   'john.doe@fluidtopics.com',
    replyTo:  'docs@darwinbox.com',
  }), []);

  const previewSrcDoc = useMemo(() => {
    if (!previewOpen) return '';
    const raw = buildAlertSrcDoc({
      fromAddr:        previewMeta.fromAddr,
      sampleTo:        previewMeta.toAddr,
      sampleName:      'John Doe',
      savedSearchName: 'My Saved Search',
      logoAbs:         resolveLogoAbs('/ft-header-logo.png'),
    });
    // The modal already shows From/Subject/To/Reply-To above the iframe,
    // so strip the duplicate <dl class="meta">…</dl> block from the body.
    return raw.replace(/<dl class="meta">[\s\S]*?<\/dl>/, '');
  }, [previewOpen, previewMeta]);

  return (
    <AdminShell
      active="notif-alerts"
      allowedRoles={['superadmin', 'admin']}
      allowedAdminRoles={['PORTAL_ADMIN']}
      footer={<ActionFooter dirty={dirty && !saving} onCancel={handleCancel} onSave={handleSave} />}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
        <div>
          <h1 style={S.h1}>
            Alerts{' '}
            <span title="Configure when and how alerts are sent" style={S.infoIcon}>ⓘ</span>
          </h1>
          <p style={S.subtitle}>Configure alert parameters.</p>
        </div>
        <button type="button" style={S.previewBtn} onClick={() => setPreviewOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preview</span>
        </button>
      </div>

      {loading && (
        <div style={S.statusBar}>Loading current settings…</div>
      )}
      {error && !loading && (
        <div style={{ ...S.statusBar, ...S.statusBarError }}>{error}</div>
      )}
      {savedAt && !error && !dirty && (
        <div style={{ ...S.statusBar, ...S.statusBarOk }}>
          Saved at {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <Section title="Match all search terms" desc="Triggers alert when new or updated results match:">
        <div style={S.radioGroup}>
          <Radio
            checked={matchMode === 'any'}
            onChange={() => set(setMatchMode)('any')}
            label="At least one search term"
          />
          <Radio
            checked={matchMode === 'all'}
            onChange={() => set(setMatchMode)('all')}
            label="All search terms"
          />
        </div>
      </Section>

      <Section title="Recurrence" desc="Sends alerts to the users on selected days.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {DAYS.map((d) => (
            <Checkbox key={d} checked={!!days[d]} onChange={() => toggleDay(d)} label={d} />
          ))}
        </div>
      </Section>

      <Section title="Enrich email body" desc="Adds metadata to the email body">
        <div style={S.metaBox}>
          <ReorderList
            items={bodyMeta}
            onMove={moveBody}
            onRemove={removeBody}
            renderItem={(m) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#94a3b8' }}>≡</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{m}</span>
              </div>
            )}
          />
          <div style={S.addRow}>
            <input
              type="text"
              list="alerts-meta-options"
              value={bodyAdd}
              onChange={(e) => setBodyAdd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBody(); } }}
              placeholder="Add metadata"
              style={S.metaInput}
            />
            <datalist id="alerts-meta-options">
              {METADATA_OPTIONS.filter((m) => !bodyMeta.includes(m)).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={addBody}
              disabled={!bodyAdd.trim()}
              style={{ ...S.addBtn, ...(bodyAdd.trim() ? {} : S.addBtnDisabled) }}
              aria-label="Add"
            >
              +
            </button>
          </div>
        </div>
      </Section>

      <AlertPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        srcDoc={previewSrcDoc}
        fromAddr={previewMeta.fromAddr}
        subject={previewMeta.subject}
        toAddr={previewMeta.toAddr}
        replyTo={previewMeta.replyTo}
      />
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  infoIcon: {
    fontSize: '0.95rem', color: '#94a3b8',
    cursor: 'help', display: 'inline-block', verticalAlign: 'middle',
  },
  previewBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', background: '#fff',
    color: '#a21caf', border: '1px solid #e5e7eb', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)', fontWeight: 500,
  },
  radioGroup: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: '4px',
  },
  metaBox: {
    background: '#FFFFFF', border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '12px',
  },
  addRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px',
    padding: '6px 10px', background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: '4px',
  },
  metaInput: {
    flex: 1, padding: '6px 10px', border: '1px solid transparent',
    borderRadius: '4px',
    fontSize: '0.9rem', background: '#fff',
    fontFamily: 'var(--font-sans)', color: '#0f172a',
    outline: 'none',
  },
  addBtn: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#a21caf', color: '#fff', border: 'none',
    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: {
    background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed',
  },
  statusBar: {
    margin: '0 0 16px', padding: '8px 12px',
    background: '#f1f5f9', color: '#475569',
    border: '1px solid #e2e8f0', borderRadius: '4px',
    fontSize: '0.85rem', fontFamily: 'var(--font-sans)',
  },
  statusBarOk: {
    background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0',
  },
  statusBarError: {
    background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca',
  },
};
