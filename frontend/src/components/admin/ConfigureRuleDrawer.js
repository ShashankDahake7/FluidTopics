'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './drawerlasagna-layer.css';
import MetadataRequirementDrawer from './MetadataRequirementDrawer';

/**
 * Slide-in "Configure rule" drawer used on /admin/notifications/rating.
 *
 * Open by passing a non-null `rule` and `onClose` / `onSave` handlers. The
 * drawer manages its own draft state from the supplied `rule` and only
 * propagates changes back via `onSave`.
 *
 * Topic level dropdown rules:
 *   - Level 1 cannot use "Rate together" (no parent to inherit from).
 *   - Level 2+ can pick any of the three options.
 *   - Up to 4 levels can be defined; default rule has 1 level.
 */
export default function ConfigureRuleDrawer({ rule, onClose, onSave }) {
  const layerRef = useRef(null);
  const [docType, setDocType] = useState('Stars');
  const [topicType, setTopicType] = useState('Stars');
  const [topicLevels, setTopicLevels] = useState(['Rate together']);
  const [exampleDoc, setExampleDoc] = useState('');
  const [metaReqs, setMetaReqs] = useState([]);
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);

  // Load draft from incoming rule whenever the drawer opens for a new rule.
  useEffect(() => {
    if (!rule) return;
    setDocType(rule.docType || 'Stars');
    setTopicType(rule.topicType || 'Stars');
    setTopicLevels(rule.topicLevels && rule.topicLevels.length ? rule.topicLevels : ['Rate together']);
    setExampleDoc('');
    setMetaReqs(rule.metaReqs || []);
  }, [rule]);

  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!rule) return undefined;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [rule, handleKey]);
  useEffect(() => {
    if (!rule) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [rule]);
  useEffect(() => { if (rule && layerRef.current) layerRef.current.focus(); }, [rule]);

  const showZone = topicType !== 'No rating';
  const canAddLevel = topicLevels.length < 4 && showZone;
  const canRemoveLevel = topicLevels.length > 1 && showZone;

  if (!rule) return null;

  const updateLevel = (idx, value) => {
    setTopicLevels((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };
  const addLevel = () => setTopicLevels((prev) => [...prev, 'Rate together']);
  const removeLastLevel = () => setTopicLevels((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleSave = () => {
    onSave?.({
      ...rule,
      docType,
      topicType,
      topicLevels: showZone ? topicLevels : [],
      metaReqs,
    });
  };

  return (
    <aside
      ref={layerRef}
      className={`drawerlasagna-layer drawerlasagna-layer-opened drawerlasagna-layer-active${metaDrawerOpen ? ' drawerlasagna-has-stacked' : ''}`}
      tabIndex={0}
      aria-hidden={false}
    >
      <div className="drawerlasagna-layer-pasta" role="presentation" onClick={onClose} />
      <div
        className="drawerlasagna-layer-garnish drawerlasagna-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Configure rule"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawerlasagna-layer-header">
          <div className="drawerlasagna-layer-close-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 48" width="50" height="48" aria-hidden="true">
              <title>drawer close background</title>
              <path className="cls-1" d="M49,48,5.81,38.21A4.79,4.79,0,0,1,2,33.52v-19A4.79,4.79,0,0,1,5.81,9.79L49,0Z" />
              <path className="cls-2" d="M50,48,5.81,38.21A4.79,4.79,0,0,1,2,33.52v-19A4.79,4.79,0,0,1,5.81,9.79L50,0" />
            </svg>
            <button
              type="button"
              className="ft-btn ft-btn-no-bg ft-btn-no-border ft-btn-square"
              aria-label="Close"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className="ft-btn-inner-text">Close</span>
            </button>
          </div>
          <h2 className="drawerlasagna-layer-title">
            <span className="gwt-InlineLabel">Configure rule</span>
          </h2>
        </header>

        <div className="drawerlasagna-layer-content" style={{ background: '#fff' }}>
          <div className="drawerlasagna-content-wrapper" style={{ padding: '20px 24px', overflowY: 'auto' }}>
            <div style={STY.body}>
              {/* Left column — configuration */}
              <div style={STY.left}>
                <div style={STY.sectionTitle}>Document metadata requirements</div>
                <MetaRequirementsList
                  value={metaReqs}
                  onRemove={(i) => setMetaReqs(metaReqs.filter((_, idx) => idx !== i))}
                  onAdd={() => setMetaDrawerOpen(true)}
                />

                <div style={STY.sectionTitle}>Document rating type</div>
                <OutlinedSelect
                  label="Rating type"
                  value={docType}
                  onChange={setDocType}
                  options={['Stars', 'Like', 'Dichotomous', 'No rating']}
                />

                <div style={STY.sectionTitle}>Topic rating type</div>
                <OutlinedSelect
                  label="Rating type"
                  value={topicType}
                  onChange={setTopicType}
                  options={['Stars', 'Like', 'Dichotomous', 'No rating']}
                />

                {showZone && (
                  <>
                    <div style={STY.zoneLabel}>Configure rating zone</div>
                    {topicLevels.map((lvl, idx) => (
                      <OutlinedSelect
                        key={idx}
                        label={idx === topicLevels.length - 1 ? `Level ${idx + 1} and after` : `Level ${idx + 1}`}
                        value={lvl}
                        onChange={(v) => updateLevel(idx, v)}
                        options={
                          idx === 0
                            ? ['Rate individually', 'Do not rate']
                            : ['Rate individually', 'Do not rate', 'Rate together']
                        }
                      />
                    ))}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <LinkButton onClick={addLevel} disabled={!canAddLevel} icon="+">Add topic level</LinkButton>
                      {canRemoveLevel && (
                        <LinkButton onClick={removeLastLevel} icon="−">Remove last level</LinkButton>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right column — example */}
              <div style={STY.right}>
                <div style={STY.sectionTitle}>Example</div>
                <p style={STY.exampleDesc}>Each colored zone will display a unique rating button.</p>
                <OutlinedSelect
                  label="Choose among 10 matching documents"
                  value={exampleDoc}
                  onChange={setExampleDoc}
                  options={EXAMPLE_DOCS}
                />
                <ExampleTree
                  docRated={docType !== 'No rating'}
                  topicRated={showZone}
                  topicLevels={topicLevels}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="drawerlasagna-buttons">
          <div className="admin-final-actions-section">
            <div className="admin-standard-actions">
              <button type="button" className="ft-btn ft-btn-cancel" onClick={onClose} aria-label="Cancel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Cancel</span>
              </button>
              <button type="button" className="ft-btn ft-btn-confirm" onClick={handleSave} aria-label="Save">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <MetadataRequirementDrawer
        open={metaDrawerOpen}
        onClose={() => setMetaDrawerOpen(false)}
        onSave={({ key, value }) => {
          setMetaReqs((prev) => [...prev, { key, value }]);
          setMetaDrawerOpen(false);
        }}
      />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Outlined Material-style select used inside the drawer.
// ---------------------------------------------------------------------------
function OutlinedSelect({ label, value, onChange, options }) {
  const id = useMemo(() => `os-${Math.random().toString(36).slice(2, 8)}`, []);
  const filled = value !== undefined && value !== null && value !== '';
  return (
    <div style={{ position: 'relative', margin: '6px 0 14px' }}>
      <label
        htmlFor={id}
        style={{
          position: 'absolute',
          top: filled ? '-8px' : '12px',
          left: filled ? '8px' : '12px',
          padding: filled ? '0 4px' : '0',
          background: '#fff',
          fontSize: filled ? '0.72rem' : '0.88rem',
          color: filled ? '#475569' : '#94a3b8',
          pointerEvents: 'none',
          transition: 'all 120ms ease',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 32px 10px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: '#0f172a',
          background: '#fff',
          fontFamily: 'var(--font-sans)',
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {!filled && <option value="" disabled hidden></option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>▾</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Magenta link-style button (used for "Add topic level", "Add metadata
// requirement", etc.) Mirrors `MagentaLinks` but with a leading bullet icon.
// ---------------------------------------------------------------------------
function LinkButton({ onClick, disabled, icon = '+', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: 'transparent', border: 'none',
        color: disabled ? '#cbd5e1' : '#a21caf',
        fontSize: '0.9rem', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '4px 0', fontFamily: 'var(--font-sans)',
      }}
    >
      <span style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: disabled ? '#e2e8f0' : '#a21caf',
        color: '#fff', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem',
        lineHeight: 1,
      }}>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Read-only listing of selected metadata requirements + an "Add metadata
// requirement" link that opens a stacked sub-drawer for adding entries.
// ---------------------------------------------------------------------------
function MetaRequirementsList({ value, onRemove, onAdd }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      {value.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
          {value.map((m, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', background: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '4px',
              fontSize: '0.85rem', color: '#0f172a',
            }}>
              <span style={{ fontFamily: 'monospace' }}>{m.key}</span>
              <span style={{ color: '#94a3b8' }}>=</span>
              <span style={{ color: '#475569', fontStyle: m.value === '' ? 'italic' : 'normal' }}>
                {m.value === '' ? '(empty)' : (m.value || (m.values?.length ? m.values.join(', ') : 'any value'))}
              </span>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => onRemove(i)} aria-label="Remove" style={{
                background: 'transparent', border: 'none', color: '#a21caf',
                cursor: 'pointer', fontSize: '1rem', padding: '0 4px',
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
      <LinkButton onClick={onAdd}>Add metadata requirement</LinkButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Example tree — visualises which titles will be wrapped in their own
// rating zone given the current rating-type/level configuration.
// ---------------------------------------------------------------------------
const EXAMPLE_TREE = [
  { id: '1',     children: [{ id: '1.1' }, { id: '1.2' }] },
  { id: '2',     children: [{ id: '2.1' }] },
  { id: '3',     children: [
    { id: '3.1', children: [{ id: '3.1.1' }, { id: '3.1.2' }] },
    { id: '3.2', children: [{ id: '3.2.1' }, { id: '3.2.2' }] },
  ] },
  { id: '4' },
  { id: '5',     children: [{ id: '5.1', children: [{ id: '5.1.1' }] }] },
];

const ZONE_COLORS = [
  { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }, // depth 1 (document)
  { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' }, // depth 2
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }, // depth 3
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }, // depth 4
];

// Compute, for each topic depth, whether it should be highlighted as its
// own zone (Rate individually), inherit its parent (Rate together), or
// not be highlighted at all (Do not rate).
function classifyDepth(depth, topicLevels, topicRated) {
  if (depth === 0) return 'individual'; // document level
  if (!topicRated) return 'none';
  // depth-1 lookup into topicLevels (last entry sticks for "and after")
  const idx = Math.min(depth - 1, topicLevels.length - 1);
  const setting = topicLevels[idx] || 'Rate together';
  if (setting === 'Rate individually') return 'individual';
  if (setting === 'Do not rate') return 'none';
  return 'together';
}

function ExampleTree({ docRated, topicRated, topicLevels }) {
  const renderNode = (node, depth, parentColorIdx) => {
    const cls = classifyDepth(depth, topicLevels, topicRated);
    let colorIdx;
    if (depth === 0) {
      colorIdx = docRated ? 0 : null;
    } else if (cls === 'individual') {
      colorIdx = depth; // unique colour per level
    } else if (cls === 'together') {
      colorIdx = parentColorIdx;
    } else {
      colorIdx = null;
    }
    const color = colorIdx !== null && colorIdx !== undefined ? ZONE_COLORS[Math.min(colorIdx, ZONE_COLORS.length - 1)] : null;
    return (
      <div key={node.id} style={{ marginLeft: depth === 0 ? 0 : '14px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            margin: '2px 0',
            background: color ? color.bg : 'transparent',
            color: color ? color.text : '#475569',
            border: color ? `1px dashed ${color.border}` : '1px dashed transparent',
            borderRadius: '3px',
            fontSize: '0.85rem',
          }}
        >
          Title of {node.id}
        </span>
        {node.children?.map((child) => renderNode(child, depth + 1, colorIdx ?? parentColorIdx))}
      </div>
    );
  };

  return (
    <div style={STY.exampleTree}>
      {EXAMPLE_TREE.map((node) => renderNode(node, 0, null))}
    </div>
  );
}

const EXAMPLE_DOCS = [
  '100 Features', 'Attendance', 'Best Practices', 'Company',
  'Continuous Feedback', 'Country Guide', 'Custom Fields',
  'Darwinbox Bot for Microsoft Teams', 'Darwinbox FAQs Articles',
];

const STY = {
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) 1fr',
    gap: '32px',
    alignItems: 'start',
  },
  left: { minWidth: 0 },
  right: { minWidth: 0 },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#0f172a',
    marginTop: '16px',
    marginBottom: '8px',
  },
  zoneLabel: {
    fontSize: '0.85rem',
    color: '#475569',
    margin: '8px 0 2px',
  },
  exampleDesc: {
    fontSize: '0.85rem', color: '#475569', margin: '0 0 12px',
  },
  exampleTree: {
    marginTop: '14px',
    padding: '10px 12px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    minHeight: '180px',
    fontFamily: 'var(--font-sans)',
  },
};
