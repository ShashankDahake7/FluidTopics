'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import api from '@/lib/api';

// Full metadata-key list mirrored from the Fluid Topics admin panel.
const METADATA_KEYS = [
  'author_personname', 'authorgroup_author_personname', 'copyright',
  'Created_by', 'creationDate', 'data_origin_id',
  'ft:alertTimestamp', 'ft:attachmentsSize', 'ft:baseId', 'ft:clusterId',
  'ft:container', 'ft:contentSize', 'ft:document_type', 'ft:editorialType',
  'ft:filename', 'ft:isArticle', 'ft:isAttachment', 'ft:isBook',
  'ft:isHtmlPackage', 'ft:isPublication', 'ft:isSynchronousAttachment',
  'ft:isUnstructured', 'ft:khubVersion', 'ft:lastEdition', 'ft:lastPublication',
  'ft:lastTechChange', 'ft:lastTechChangeTimestamp', 'ft:locale', 'ft:mimeType',
  'ft:openMode', 'ft:originId', 'ft:prettyUrl', 'ft:publication_title',
  'ft:publicationId', 'ft:publishStatus', 'ft:publishUploadId',
  'ft:searchableFromInt', 'ft:sourceCategory', 'ft:sourceId', 'ft:sourceName',
  'ft:sourceType', 'ft:structure', 'ft:tocPosition', 'ft:topicTitle',
  'ft:wordCount', 'generator', 'Key', 'Module', 'Name',
  'paligo:resourceTitle', 'paligo:resourceTitleLabel', 'publicationDate',
  'Release_Notes', 'subtitle', 'Taxonomy', 'ud:id',
  'xinfo:branched_topic_id', 'xinfo:branched_topic_uuid',
  'xinfo:contribution_editable', 'xinfo:document_id', 'xinfo:linktype',
  'xinfo:origin', 'xinfo:origin_id', 'xinfo:pagebreak', 'xinfo:taxonomy',
  'xinfo:version_major', 'xinfo:version_minor',
];

const ROBOTS_FLAGS = ['noindex', 'nofollow', 'noarchive'];

const DOC_LINKS = {
  defaultRobots: 'https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Integrations/Web-Search-Engines/Default-robots-meta-tags',
  customRobots:  'https://doc.fluidtopics.com/r/Fluid-Topics-Configuration-and-Administration-Guide/Configure-a-Fluid-Topics-tenant/Integrations/Web-Search-Engines/Custom-robots-rules',
};

const INITIAL = {
  crawlingAllowed: true,
  titleTags: [
    { id: 'title-base', label: 'Title (topic or document)', metadata: 'ft:title', locked: true },
  ],
  defaultRobots: { noindex: false, nofollow: false, noarchive: false },
  customRules: [],
  customRobotsFile: '',
  bingFile: null,
  googleFile: null,
};

export default function WebSearchEnginesPage() {
  const [state, setState] = useState(INITIAL);
  const [baseline, setBaseline] = useState(INITIAL);
  const [loading, setLoading] = useState(true);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(baseline), [state, baseline]);

  useEffect(() => {
    api.get('/seo-config')
      .then((data) => {
        const merged = { ...INITIAL, ...data };
        setState(merged);
        setBaseline(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch) => setState((s) => ({ ...s, ...patch }));

  const handleSave = async () => {
    try {
      const data = await api.put('/seo-config', state);
      setState(data);
      setBaseline(data);
      alert('Settings saved successfully');
    } catch (e) {
      alert('Failed to save settings: ' + e.message);
    }
  };

  if (loading) return null;

  return (
    <AdminShell
      active="integ-search-engine"
      allowedRoles={['superadmin']}
      footer={
        <>
          <button
            type="button"
            style={{ ...S.btnCancel, opacity: dirty ? 1 : 0.6, cursor: dirty ? 'pointer' : 'default' }}
            onClick={() => setState(baseline)}
            disabled={!dirty}
          >
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
            onClick={handleSave}
            disabled={!dirty}
          >
            <CheckIcon /> <span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ paddingBottom: '90px' }}>
        <h1 style={S.h1}>Web search engines</h1>
        <p style={S.subtitle}>Configure the portal to be indexed by web search engines.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 18px' }}>
          <Toggle on={state.crawlingAllowed} onChange={(v) => update({ crawlingAllowed: v })} />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>Crawling allowed</span>
        </div>

        <Notice variant="warning">
          To prevent malicious users from accessing content when crawling is allowed, set the default group to{' '}
          <strong>“Authenticated”</strong> in the <em>Access rules</em> tab of the Administration menu.
        </Notice>

        <Section title="Title tags" desc="Adds metadata to topic and document titles in web search engine results.">
          <TitleTagsTable
            tags={state.titleTags}
            onAdd={(meta) => update({ titleTags: [...state.titleTags, { id: 'tag-' + Date.now(), label: meta, metadata: meta }] })}
            onMove={(idx, dir) => update({ titleTags: move(state.titleTags, idx, dir) })}
            onRemove={(id) => update({ titleTags: state.titleTags.filter((t) => t.id !== id) })}
          />
        </Section>

        <Section
          title="Default robots meta tags"
          desc="Applies to all documents except those matching a rule below."
          link={{ label: 'Default robots meta tags', href: DOC_LINKS.defaultRobots }}
        >
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
            {ROBOTS_FLAGS.map((flag) => (
              <Checkbox
                key={flag}
                label={flag}
                checked={!!state.defaultRobots[flag]}
                onChange={(v) => update({ defaultRobots: { ...state.defaultRobots, [flag]: v } })}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Custom robots rules"
          desc="Determines robots meta tags for specific content based on metadata."
          link={{ label: 'Custom robots rules', href: DOC_LINKS.customRobots }}
        >
          <div style={S.dashedBox}>
            {state.customRules.length === 0 ? (
              <button
                type="button"
                style={S.dashedAddBtn}
                onClick={() => update({ customRules: [...state.customRules, newRule()] })}
              >
                <PlusIcon /> <span>Add rule</span>
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {state.customRules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onChange={(patch) => update({
                      customRules: state.customRules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
                    })}
                    onRemove={() => update({
                      customRules: state.customRules.filter((_, i) => i !== idx),
                    })}
                  />
                ))}
                <button
                  type="button"
                  style={S.linkBtnPink}
                  onClick={() => update({ customRules: [...state.customRules, newRule()] })}
                >
                  <PlusIcon /> Add rule
                </button>
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Verification files"
          desc="Upload Bing or Google verification files used to claim ownership of a website."
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <UploadButton
              label="Bing"
              accept=".xml"
              file={state.bingFile}
              onChange={(file) => update({ bingFile: file })}
            />
            <UploadButton
              label="Google"
              accept=".html"
              file={state.googleFile}
              onChange={(file) => update({ googleFile: file })}
            />
          </div>
        </Section>

        <Section
          title="Custom robots file"
          desc="Appends the following directives to the end of the robots.txt file."
        >
          <Notice variant="warning">
            Fluid Topics cannot be held responsible for issues caused by custom robots.txt. Please proceed with caution.
          </Notice>
          <FloatingTextarea
            label="Additional robots.txt directives"
            value={state.customRobotsFile}
            onChange={(v) => update({ customRobotsFile: v })}
          />
        </Section>
      </div>
    </AdminShell>
  );
}

function move(arr, idx, dir) {
  const next = [...arr];
  const j = idx + dir;
  if (j < 0 || j >= next.length) return arr;
  [next[idx], next[j]] = [next[j], next[idx]];
  return next;
}

function newRule() {
  return {
    id: 'rule-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    metadataKey: '',
    metadataValues: '',
    flags: { noindex: false, nofollow: false, noarchive: false },
  };
}

// ── UI primitives ───────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: '38px', height: '22px',
        background: on ? '#1d4ed8' : '#cbd5e1',
        borderRadius: '999px', border: 'none',
        position: 'relative', cursor: 'pointer',
        padding: 0, transition: 'background 150ms',
      }}
    >
      <span
        style={{
          position: 'absolute', top: '2px', left: on ? '18px' : '2px',
          width: '18px', height: '18px',
          background: '#fff', borderRadius: '999px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 150ms',
        }}
      />
    </button>
  );
}

function Section({ title, desc, link, children }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h2 style={S.h2}>{title}</h2>
      {desc && <p style={S.sectionDesc}>{desc}</p>}
      {link && (
        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#475569' }}>
          See documentation:{' '}
          <a
            href={link.href || '#'}
            target={link.href ? '_blank' : undefined}
            rel={link.href ? 'noopener noreferrer' : undefined}
            onClick={link.href ? undefined : (e) => e.preventDefault()}
            style={{ color: '#1d4ed8', textDecoration: 'underline' }}
          >
            {link.label}
          </a>
        </p>
      )}
      <div style={{ marginTop: '6px' }}>{children}</div>
    </section>
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
      borderRadius: '4px', padding: '10px 14px', marginTop: '4px', marginBottom: '6px',
      color: palette.text, fontSize: '0.86rem', lineHeight: 1.45,
    }}>
      <span style={{ color: palette.icon, marginTop: '2px', display: 'inline-flex' }}>
        {variant === 'warning' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
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

function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={S.checkRow}>
      <span style={{
        width: '16px', height: '16px',
        border: '2px solid', borderColor: checked ? '#1d4ed8' : '#94a3b8',
        background: checked ? '#1d4ed8' : 'transparent',
        borderRadius: '3px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: '0.9rem', color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}>{label}</span>
    </button>
  );
}

// ── Title tags table ───────────────────────────────────────────────────────
function TitleTagsTable({ tags, onAdd, onMove, onRemove }) {
  const [pending, setPending] = useState('');
  return (
    <div style={S.tableCard}>
      {tags.map((t, idx) => (
        <div key={t.id} style={S.tagRow}>
          <span style={{ flex: 1, fontSize: '0.92rem', color: '#0f172a' }}>{t.label}</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <IconBtn title="Move up" onClick={() => onMove(idx, -1)} disabled={idx === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </IconBtn>
            <IconBtn title="Move down" onClick={() => onMove(idx, +1)} disabled={idx === tags.length - 1}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            </IconBtn>
            {t.locked ? (
              <IconBtn title="Locked" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </IconBtn>
            ) : (
              <IconBtn title="Remove" danger onClick={() => onRemove(t.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </IconBtn>
            )}
          </div>
        </div>
      ))}
      <div style={S.addRow}>
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Add metadata</span>
        <div style={{ position: 'relative' }}>
          <select
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            style={S.metaSelect}
          >
            <option value="">{tags[0]?.metadata || 'Select metadata'}</option>
            {METADATA_KEYS.filter((k) => !tags.some((t) => t.metadata === k)).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <span style={S.selectCaret} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        <button
          type="button"
          onClick={() => { if (pending) { onAdd(pending); setPending(''); } }}
          disabled={!pending}
          style={{
            ...S.miniAddBtn,
            opacity: pending ? 1 : 0.5,
            cursor: pending ? 'pointer' : 'not-allowed',
          }}
          aria-label="Add metadata"
        >
          <PlusIcon size={12} />
        </button>
        <a href="#" onClick={(e) => e.preventDefault()} style={S.linkText}>or create new</a>
      </div>
    </div>
  );
}

// ── Custom rule row ────────────────────────────────────────────────────────
function RuleRow({ rule, onChange, onRemove }) {
  return (
    <div style={S.ruleRow}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <select
            value={rule.metadataKey}
            onChange={(e) => onChange({ metadataKey: e.target.value })}
            style={{ ...S.metaSelect, width: '100%' }}
          >
            <option value="">Metadata key</option>
            {METADATA_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span style={S.selectCaret} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        <input
          type="text"
          placeholder="Metadata values (comma separated)"
          value={rule.metadataValues}
          onChange={(e) => onChange({ metadataValues: e.target.value })}
          style={{ ...S.input, flex: '2 1 200px', maxWidth: 'none' }}
        />
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          {ROBOTS_FLAGS.map((f) => (
            <Checkbox
              key={f}
              label={f}
              checked={rule.flags[f]}
              onChange={(v) => onChange({ flags: { ...rule.flags, [f]: v } })}
            />
          ))}
        </div>
      </div>
      <IconBtn title="Remove rule" danger onClick={onRemove}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
        </svg>
      </IconBtn>
    </div>
  );
}

// ── Upload button ──────────────────────────────────────────────────────────
function UploadButton({ label, accept, file, onChange }) {
  const inputId = `verification-${label.toLowerCase()}`;
  return (
    <label htmlFor={inputId} style={{ ...S.uploadBtn, cursor: 'pointer' }}>
      <input
        id={inputId}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0]?.name || null)}
        style={{ display: 'none' }}
      />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span>{file ? `${label}: ${file}` : `Add a ${label} file`}</span>
    </label>
  );
}

// ── Material floating-label textarea ───────────────────────────────────────
function FloatingTextarea({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const isFloated = focused || !!value;
  return (
    <div
      style={{ position: 'relative', background: '#fff', borderRadius: '4px', maxWidth: '760px', marginTop: '10px' }}
      onClick={() => ref.current?.focus()}
    >
      <fieldset
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          border: focused ? '2px solid #a21caf' : '1px solid #cbd5e1',
          borderRadius: '4px', margin: 0, padding: '0 8px',
          pointerEvents: 'none', textAlign: 'left', minWidth: 0,
        }}
      >
        <legend style={{
          width: isFloated ? 'auto' : 0, maxWidth: '100%',
          padding: isFloated ? '0 4px' : 0,
          fontSize: '0.74rem', color: focused ? '#a21caf' : '#475569',
          float: 'unset', height: '11px', visibility: 'visible',
          fontWeight: 500, opacity: isFloated ? 1 : 0, transition: 'opacity 120ms',
        }}>{label}</legend>
      </fieldset>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={5}
        style={{
          position: 'relative', width: '100%',
          padding: '12px',
          background: 'transparent', border: 'none', outline: 'none',
          resize: 'vertical', minHeight: '110px',
          fontSize: '0.86rem', color: '#0f172a',
          fontFamily: 'var(--font-mono, monospace)',
          boxSizing: 'border-box',
        }}
      />
      {!isFloated && (
        <label style={{
          position: 'absolute', left: '12px', top: '12px',
          fontSize: '0.9rem', color: '#94a3b8',
          pointerEvents: 'none', background: 'transparent',
        }}>{label}</label>
      )}
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

function PlusIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}
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

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 12px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.9rem', color: '#475569', margin: '0 0 4px' },
  checkRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
    fontFamily: 'var(--font-sans)',
  },
  tableCard: {
    border: '1px solid #e2e8f0', borderRadius: '4px',
    background: '#fff', padding: '0',
    display: 'flex', flexDirection: 'column',
  },
  tagRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
  },
  addRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', flexWrap: 'wrap',
  },
  metaSelect: {
    padding: '7px 30px 7px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.86rem', color: '#0f172a',
    outline: 'none', appearance: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', minWidth: '180px',
  },
  selectCaret: {
    position: 'absolute', right: '8px', top: '50%',
    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
    display: 'inline-flex',
  },
  miniAddBtn: {
    width: '24px', height: '24px',
    background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '999px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  linkText: { color: '#a21caf', fontSize: '0.86rem', textDecoration: 'underline', fontWeight: 500 },

  dashedBox: {
    border: '1px dashed #cbd5e1', borderRadius: '4px',
    background: '#f8fafc', padding: '14px',
  },
  dashedAddBtn: {
    background: 'transparent', border: 'none',
    color: '#a21caf', fontSize: '0.92rem', fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 0', width: '100%', justifyContent: 'center',
  },
  ruleRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
  },
  linkBtnPink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', padding: '6px 0',
    color: '#a21caf', fontSize: '0.86rem', fontWeight: 600,
    cursor: 'pointer', alignSelf: 'flex-start',
  },

  uploadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    fontSize: '0.86rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  textarea: {
    width: '100%', maxWidth: '760px',
    padding: '10px 14px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.85rem', color: '#0f172a',
    outline: 'none', resize: 'vertical', minHeight: '110px',
    fontFamily: 'var(--font-mono, monospace)',
    boxSizing: 'border-box',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.85rem', color: '#0f172a',
    outline: 'none', boxSizing: 'border-box',
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
  },
};
