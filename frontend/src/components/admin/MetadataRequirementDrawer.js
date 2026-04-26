'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './drawerlasagna-layer.css';

/**
 * Stacked sub-drawer used inside `ConfigureRuleDrawer` when the operator
 * clicks "Add metadata requirement". Slides over the parent drawer and
 * collects a (metadata-key, value) pair before propagating it back.
 */
const METADATA_KEYS = [
  'author_personname',
  'authorgroup_author_personname',
  'copyright',
  'Created_by',
  'creationDate',
  'data_origin_id',
  'ft:alertTimestamp',
  'ft:attachmentsSize',
  'ft:baseId',
  'ft:clusterId',
  'ft:container',
  'ft:contentSize',
  'ft:document_type',
  'ft:editorialType',
  'ft:filename',
  'ft:isArticle',
  'ft:isAttachment',
  'ft:isBook',
  'ft:isHtmlPackage',
  'ft:isPublication',
  'ft:isSynchronousAttachment',
  'ft:isUnstructured',
  'ft:khubVersion',
  'ft:lastEdition',
  'ft:lastPublication',
  'ft:lastTechChange',
  'ft:lastTechChangeTimestamp',
  'ft:locale',
  'ft:mimeType',
  'ft:openMode',
  'ft:originId',
  'ft:prettyUrl',
  'ft:publication_title',
  'ft:publicationId',
  'ft:publishStatus',
  'ft:publishUploadId',
  'ft:searchableFromInt',
  'ft:sourceCategory',
  'ft:sourceId',
  'ft:sourceName',
  'ft:sourceType',
  'ft:structure',
  'ft:title',
  'ft:tocPosition',
  'ft:topicTitle',
  'ft:wordCount',
  'generator',
  'Key',
  'Module',
  'Name',
  'paligo:resourceTitle',
  'paligo:resourceTitleLabel',
  'publicationDate',
  'Release_Notes',
  'subtitle',
  'Taxonomy',
  'title',
];

// Best-effort suggestions per key — populate the "With this value" dropdown
// with sensible existing values when we can predict them.
const VALUE_HINTS = {
  'ft:document_type':  ['book', 'topic', 'article', 'attachment', 'unstructured'],
  'ft:editorialType':  ['public', 'internal', 'draft'],
  'ft:locale':         ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP'],
  'ft:publishStatus':  ['published', 'unpublished', 'archived'],
  'ft:sourceCategory': ['cms', 'manual', 'paligo', 'oxygen', 'other'],
  'ft:openMode':       ['html', 'pdf', 'native'],
  'ft:mimeType':       ['text/html', 'application/pdf', 'application/zip'],
  'ft:isBook':         ['true', 'false'],
  'ft:isPublication':  ['true', 'false'],
  'ft:isArticle':      ['true', 'false'],
  'ft:isAttachment':   ['true', 'false'],
  'ft:isHtmlPackage':  ['true', 'false'],
  'ft:isUnstructured': ['true', 'false'],
};

// Sentinel used by the dropdowns to mean "no value picked yet". Using a
// distinct symbol so an empty string can later be a real selection.
const UNSET = '__unset__';

export default function MetadataRequirementDrawer({ open, onClose, onSave }) {
  const layerRef = useRef(null);
  // metaKey / metaValue use UNSET to distinguish "nothing picked" from the
  // explicit "-- Empty value --" selection (which stores an empty string).
  const [metaKey, setMetaKey] = useState(UNSET);
  const [metaValue, setMetaValue] = useState(UNSET);

  useEffect(() => {
    if (open) { setMetaKey(UNSET); setMetaValue(UNSET); }
  }, [open]);

  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKey]);
  useEffect(() => { if (open && layerRef.current) layerRef.current.focus(); }, [open]);

  const valueHints = useMemo(() => VALUE_HINTS[metaKey] || [], [metaKey]);
  const keyChosen = metaKey !== UNSET;
  const valueChosen = metaValue !== UNSET;
  // Keys must be a real metadata field (not the "Empty value" sentinel —
  // there's no such thing as requiring an empty key). Values may legitimately
  // be the explicit empty string.
  const canSave = keyChosen && metaKey !== '' && valueChosen;

  if (!open) return null;

  const handleSave = () => {
    if (!canSave) return;
    onSave?.({ key: metaKey, value: metaValue });
  };

  return (
    <aside
      ref={layerRef}
      className="drawerlasagna-layer drawerlasagna-layer-opened drawerlasagna-layer-active drawerlasagna-stacked"
      tabIndex={0}
      aria-hidden={false}
    >
      <div className="drawerlasagna-layer-pasta" role="presentation" onClick={onClose} />
      <div
        className="drawerlasagna-layer-garnish"
        role="dialog"
        aria-modal="true"
        aria-label="Add metadata requirement"
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
            <span className="gwt-InlineLabel">Add metadata requirement</span>
          </h2>
        </header>

        <div className="drawerlasagna-layer-content" style={{ background: '#fff' }}>
          <div className="drawerlasagna-content-wrapper" style={{ padding: '20px 24px', overflowY: 'auto' }}>
            <FieldLabel>Require this metadata</FieldLabel>
            <SelectWithGroup
              value={keyChosen ? metaKey : UNSET}
              onChange={(v) => { setMetaKey(v); setMetaValue(UNSET); }}
              options={METADATA_KEYS}
            />

            <div style={{ height: '14px' }} />

            <FieldLabel>With this value</FieldLabel>
            <SelectWithGroup
              value={valueChosen ? metaValue : UNSET}
              onChange={setMetaValue}
              options={valueHints}
              disabled={!keyChosen || metaKey === ''}
            />
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
              <button
                type="button"
                className="ft-btn ft-btn-confirm"
                onClick={handleSave}
                disabled={!canSave}
                aria-label="Save"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.85rem', fontWeight: 500, color: '#0f172a',
      marginBottom: '6px',
    }}>
      {children}
    </div>
  );
}

/**
 * Native `<select>` with two leading entries — an `-- Empty value --` option
 * (representing an explicit empty string match) and a divider — followed by
 * an "Existing values" `<optgroup>` listing the supplied options. Mirrors the
 * Darwinbox metadata-requirement dropdown.
 */
function SelectWithGroup({ value, onChange, options, disabled }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          ...fieldStyle,
          background: disabled ? '#f1f5f9' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          appearance: 'none',
        }}
      >
        <option value={UNSET} hidden></option>
        <option value="">-- Empty value --</option>
        {options.length > 0 && (
          <optgroup label="Existing values">
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </optgroup>
        )}
      </select>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none',
          color: disabled ? '#cbd5e1' : '#94a3b8',
          fontSize: '0.75rem',
        }}
      >
        ▾
      </span>
    </div>
  );
}

const fieldStyle = {
  width: '100%',
  padding: '10px 32px 10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '0.9rem',
  color: '#0f172a',
  fontFamily: 'var(--font-sans)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
