'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

const DEFAULT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
    <ShortName></ShortName>
    <Description>This example must be edited in order to reflect your own engine</Description>
    <Url type="text/html" rel="results" template="/search/all?query={searchTerms}"/>
    <Url type="application/atom+xml" rel="results" template="/opensearch?query={searchTerms}&amp;limit={count?}&amp;startIndex={startIndex?}&amp;content-lang={language?}"/>
    <Query role="example" searchTerms="how" />
</OpenSearchDescription>`;

const INITIAL = {
  enabled: false,
  name: '',
  xml: DEFAULT_XML,
};

export default function OpenSearchPage() {
  const [state, setState] = useState(INITIAL);
  const [baseline] = useState(INITIAL);
  const [nameTouched, setNameTouched] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(baseline),
    [state, baseline]
  );
  const nameError = state.enabled && !state.name.trim();
  const isValid   = !state.enabled || !!state.name.trim();
  const canSave   = dirty && isValid;

  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const onCancel = () => { setState(baseline); setNameTouched(false); };
  const onResetConfig = () => update({ xml: DEFAULT_XML });

  return (
    <AdminShell
      active="integ-opensearch"
      allowedRoles={['superadmin']}
      footer={
        <>
          {!isValid && (
            <span style={S.invalidReason}>Invalid configuration</span>
          )}
          <button
            type="button"
            style={{ ...S.btnCancel, opacity: dirty ? 1 : 0.6, cursor: dirty ? 'pointer' : 'default' }}
            onClick={onCancel}
            disabled={!dirty}
          >
            <CrossIcon /> <span>Cancel</span>
          </button>
          <button
            type="button"
            style={{ ...S.btnSave, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }}
            onClick={() => { /* TODO: persist */ }}
            disabled={!canSave}
          >
            <CheckIcon /> <span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ paddingBottom: '90px', position: 'relative' }}>
        <h1 style={S.h1}>OpenSearch</h1>
        <p style={S.subtitle}>Use the OpenSearch protocol to expose the portal&apos;s search engine to external integrations.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 24px' }}>
          <Toggle on={state.enabled} onChange={(v) => update({ enabled: v })} />
          <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>
            OpenSearch integration is {state.enabled ? 'enabled' : 'disabled'}
          </span>
        </div>

        <Section
          title="Search engine name"
          desc="Required by the OpenSearch protocol, the search engine name appears in the results feed and in web browsers."
        >
          <FloatingInput
            label="Name"
            value={state.name}
            onChange={(v) => { update({ name: v }); setNameTouched(true); }}
            onBlur={() => setNameTouched(true)}
            error={(nameTouched || state.enabled) && !state.name.trim() ? 'Please fill in this field.' : ''}
          />
        </Section>

        <Section
          title="Description document"
          desc="The OpenSearch description document is used to describe the web interface of the search engine."
        >
          <CodeEditor
            value={state.xml}
            onChange={(v) => update({ xml: v })}
            minLines={8}
          />
        </Section>

        {/* Reset configuration mini-button (bottom right of content area) */}
        <button
          type="button"
          onClick={onResetConfig}
          style={S.resetMini}
          title="Restore default OpenSearch description document"
        >
          Reset configuration
        </button>
      </div>
    </AdminShell>
  );
}

// ── Section ────────────────────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <section style={{ marginBottom: '24px' }}>
      <h2 style={S.h2}>{title}</h2>
      {desc && <p style={S.sectionDesc}>{desc}</p>}
      <div style={{ marginTop: '8px' }}>{children}</div>
    </section>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────
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

// ── Material-style floating-label input with error state ───────────────────
function FloatingInput({ label, value, onChange, onBlur, error }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const isFloated = focused || !!value;
  const errored = !!error;
  return (
    <div style={{ width: '100%', maxWidth: '760px' }}>
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
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          style={{
            position: 'relative', width: '100%',
            padding: '12px',
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.9rem', color: errored ? '#dc2626' : '#0f172a',
            fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
          }}
        />
        {!isFloated && (
          <label style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.9rem', color: errored ? '#dc2626' : '#94a3b8',
            pointerEvents: 'none', background: 'transparent',
          }}>{label}</label>
        )}
      </div>
      {error && <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}

// ── Code editor with XML syntax highlighting ──────────────────────────────
function CodeEditor({ value, onChange, minLines = 6 }) {
  const taRef  = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);

  const lineCount = Math.max(value.split('\n').length, minLines);
  const highlighted = useMemo(() => highlightXml(value) + '\n', [value]);

  // Keep the highlight overlay and gutter scroll-aligned with the textarea.
  const onScroll = () => {
    const ta = taRef.current; if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop  = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  useEffect(() => { onScroll(); }, [highlighted]);

  return (
    <div style={S.editorWrap}>
      <div ref={gutterRef} style={S.editorGutter} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={S.lineNumber}>{i + 1}</div>
        ))}
      </div>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <pre
          ref={preRef}
          aria-hidden="true"
          style={S.editorPre}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          style={S.editorTextarea}
          aria-label="OpenSearch description document"
        />
      </div>
    </div>
  );
}

// Token-based XML highlighter — uses placeholders so HTML escaping is safe.
const TKN = '\u0001';
function highlightXml(input) {
  let h = input
    .replace(/&/g, '&amp;')
    .replace(/</g, `${TKN}LT${TKN}`)
    .replace(/>/g, `${TKN}GT${TKN}`);

  // Strings
  h = h.replace(/"([^"]*)"/g, `${TKN}STR${TKN}"$1"${TKN}/STR${TKN}`);

  // Processing instructions <?…?>
  h = h.replace(new RegExp(`${TKN}LT${TKN}\\?([\\s\\S]*?)\\?${TKN}GT${TKN}`, 'g'),
    (_m, content) => {
      const inner = content
        .split(`${TKN}LT${TKN}`).join('&lt;')
        .split(`${TKN}GT${TKN}`).join('&gt;');
      return `${TKN}META${TKN}&lt;?${inner}?&gt;${TKN}/META${TKN}`;
    });

  // Comments <!--…-->
  h = h.replace(new RegExp(`${TKN}LT${TKN}!--([\\s\\S]*?)--${TKN}GT${TKN}`, 'g'),
    (_m, content) => `${TKN}CMT${TKN}&lt;!--${content}--&gt;${TKN}/CMT${TKN}`);

  // Tag opener  <tag  or </tag
  h = h.replace(new RegExp(`${TKN}LT${TKN}(/?)([a-zA-Z][\\w:-]*)`, 'g'),
    (_m, slash, name) => `${TKN}TAG${TKN}&lt;${slash}${name}${TKN}/TAG${TKN}`);

  // Tag close   /> or >
  h = h.replace(new RegExp(`(/?)${TKN}GT${TKN}`, 'g'),
    (_m, slash) => `${TKN}TAG${TKN}${slash}&gt;${TKN}/TAG${TKN}`);

  // Attribute names — only when followed by =
  h = h.replace(/(\s)([a-zA-Z_][\w:-]*)(=)/g,
    (_m, ws, name) => `${ws}${TKN}ATTR${TKN}${name}${TKN}/ATTR${TKN}=`);

  // Any remaining LT/GT (shouldn't happen, but be safe)
  h = h.split(`${TKN}LT${TKN}`).join('&lt;').split(`${TKN}GT${TKN}`).join('&gt;');

  // Substitute span markers
  h = h
    .split(`${TKN}STR${TKN}`).join('<span style="color:#19f9d8">')
    .split(`${TKN}/STR${TKN}`).join('</span>')
    .split(`${TKN}META${TKN}`).join('<span style="color:#b084eb">')
    .split(`${TKN}/META${TKN}`).join('</span>')
    .split(`${TKN}CMT${TKN}`).join('<span style="color:#676b79;font-style:italic">')
    .split(`${TKN}/CMT${TKN}`).join('</span>')
    .split(`${TKN}TAG${TKN}`).join('<span style="color:#ff75b5">')
    .split(`${TKN}/TAG${TKN}`).join('</span>')
    .split(`${TKN}ATTR${TKN}`).join('<span style="color:#fcb96d">')
    .split(`${TKN}/ATTR${TKN}`).join('</span>');

  return h;
}

// ── Icons ─────────────────────────────────────────────────────────────────
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

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 8px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.9rem', color: '#475569', margin: '0 0 4px' },

  editorWrap: {
    display: 'flex',
    background: '#21222c',
    border: '1px solid #1c1d24',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono, "Fira Code", "Source Code Pro", Menlo, monospace)',
    fontSize: '13px',
    lineHeight: '20px',
    color: '#e6e6e6',
    overflow: 'hidden',
    height: '250px',
    maxWidth: '760px',
  },
  editorGutter: {
    padding: '8px 8px 8px 12px',
    color: '#5b6b7d',
    textAlign: 'right',
    userSelect: 'none',
    background: '#1a1b25',
    flexShrink: 0,
    minWidth: '36px',
    overflow: 'hidden',
  },
  lineNumber: {
    height: '20px',
    fontVariantNumeric: 'tabular-nums',
  },
  editorPre: {
    position: 'absolute', inset: 0,
    margin: 0, padding: '8px 12px',
    whiteSpace: 'pre',
    color: '#e6e6e6',
    pointerEvents: 'none',
    overflow: 'hidden',
    fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit',
    boxSizing: 'border-box',
    tabSize: 4,
  },
  editorTextarea: {
    position: 'absolute', inset: 0,
    margin: 0, padding: '8px 12px',
    background: 'transparent',
    color: 'transparent',
    caretColor: '#fff',
    border: 'none', outline: 'none',
    fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit',
    whiteSpace: 'pre',
    resize: 'none',
    width: '100%', height: '100%',
    boxSizing: 'border-box',
    overflow: 'auto',
    tabSize: 4,
  },

  invalidReason: {
    fontSize: '0.82rem',
    color: '#dc2626',
    fontStyle: 'italic',
    marginRight: '8px',
  },

  resetMini: {
    position: 'absolute',
    right: 0, bottom: '14px',
    padding: '5px 10px',
    background: '#fef9c3',
    color: '#713f12',
    border: '1px solid #fde68a',
    borderRadius: '3px',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
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
