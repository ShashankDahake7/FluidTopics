'use client';

export function Section({ title, desc, children, headerRight }) {
  return (
    <section style={S.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <h2 style={S.h2}>{title}</h2>
        {headerRight}
      </div>
      {desc && <p style={S.desc}>{desc}</p>}
      <div style={{ marginTop: desc ? '8px' : '12px' }}>{children}</div>
    </section>
  );
}

export function FormInput({ label, value, onChange, type = 'text', placeholder, suffix }) {
  return (
    <label style={S.formField}>
      {label && <span style={S.formLabel}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          type={type}
          placeholder={placeholder}
          style={S.input}
        />
        {suffix && <span style={{ fontSize: '0.9rem', color: '#374151' }}>{suffix}</span>}
      </div>
    </label>
  );
}

export function MagentaLinks({ items, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((label) => (
        <button key={label} type="button" onClick={() => onClick?.(label)} style={S.magentaLink}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Check({ on }) {
  return (
    <span style={{
      width: '16px', height: '16px',
      border: '2px solid', borderColor: on ? '#1d4ed8' : '#94a3b8',
      background: on ? '#1d4ed8' : 'transparent',
      borderRadius: '3px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {on && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={S.checkRow}>
      <Check on={checked} />
      <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{label}</span>
    </button>
  );
}

export function Radio({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(true)}
      style={{
        ...S.checkRow,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{
        width: '16px', height: '16px', borderRadius: '50%',
        border: '2px solid', borderColor: checked ? '#a21caf' : '#94a3b8',
        background: '#fff', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a21caf' }} />}
      </span>
      <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{label}</span>
    </button>
  );
}

export function Btn({ children, onClick, variant = 'ghost', disabled }) {
  const styles = {
    ghost: { background: '#fff', color: '#a21caf', border: '1px solid #e5e7eb' },
    primary: { background: '#a21caf', color: '#fff', border: 'none' },
    danger: { background: '#fff', color: '#a21caf', border: '1px solid #e5e7eb' },
  }[variant];
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        ...styles, padding: '7px 14px', borderRadius: '4px',
        fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'var(--font-sans)', fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}
    >
      {children}
    </button>
  );
}

export function ActionFooter({ dirty, onCancel, onSave }) {
  return (
    <>
      <button type="button" onClick={onCancel} disabled={!dirty} style={F.cancel}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        <span>Cancel</span>
      </button>
      <button
        type="button" onClick={onSave} disabled={!dirty}
        style={{ ...F.save, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        <span>Save</span>
      </button>
    </>
  );
}

export function ReorderList({ items, onMove, onRemove, renderItem }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={`${item}-${i}`} style={S.reorderRow}>
          <div style={{ flex: 1 }}>{renderItem ? renderItem(item) : <span style={{ fontWeight: 600, color: '#0f172a' }}>{item}</span>}</div>
          <button type="button" onClick={() => onMove(i, i - 1)} disabled={i === 0}        style={S.iconBtn} aria-label="Move up">↑</button>
          <button type="button" onClick={() => onMove(i, i + 1)} disabled={i === items.length - 1} style={S.iconBtn} aria-label="Move down">↓</button>
          <button type="button" onClick={() => onRemove(i)}  style={{ ...S.iconBtn, color: '#a21caf' }} aria-label="Remove">×</button>
        </div>
      ))}
    </div>
  );
}

const S = {
  section: { marginBottom: '32px' },
  h2: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  desc: { fontSize: '0.92rem', color: '#374151', margin: '4px 0 0' },
  formField: { display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '720px' },
  formLabel: { fontSize: '0.78rem', fontWeight: 600, color: '#a21caf', letterSpacing: '0.02em' },
  input: {
    width: '100%', padding: '10px 14px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.92rem', outline: 'none', fontFamily: 'var(--font-sans)',
    color: '#0f172a', background: '#fff',
  },
  magentaLink: {
    background: 'transparent', border: 'none', textAlign: 'left',
    color: '#a21caf', fontSize: '0.9rem', cursor: 'pointer', padding: 0,
    fontFamily: 'var(--font-sans)', textDecoration: 'none',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '6px 0', fontFamily: 'var(--font-sans)',
    width: 'fit-content', textAlign: 'left',
    outline: 'none',
  },
  reorderRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: '4px',
  },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#64748b', fontSize: '1rem', padding: '4px 8px',
    fontFamily: 'var(--font-sans)',
  },
};

const F = {
  cancel: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', background: '#fff', color: '#374151',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  save: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px', background: '#a21caf', color: '#fff',
    border: 'none', borderRadius: '4px',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
};
