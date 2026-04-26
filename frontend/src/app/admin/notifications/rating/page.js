'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, MagentaLinks } from '@/components/admin/AdminBits';

const RATING_TYPES = ['Stars', 'Like', 'Dichotomous'];

export default function RatingNotificationsPage() {
  const [rules, setRules] = useState([
    { id: 1, targets: ['Document', 'Topic'], scope: 'for all documents' },
  ]);
  const [dirty, setDirty] = useState(false);

  const addRule = () => {
    const id = (rules[rules.length - 1]?.id || 0) + 1;
    setRules([...rules, { id, targets: ['Document'], scope: 'for all documents' }]);
    setDirty(true);
  };
  const moveRule = (from, to) => {
    if (to < 0 || to >= rules.length) return;
    const arr = [...rules]; const [r] = arr.splice(from, 1); arr.splice(to, 0, r);
    setRules(arr); setDirty(true);
  };
  const removeRule = (i) => { setRules(rules.filter((_, idx) => idx !== i)); setDirty(true); };

  return (
    <AdminShell
      active="notif-rating"
      footer={<ActionFooter dirty={dirty} onCancel={() => setDirty(false)} onSave={() => setDirty(false)} />}
    >
      <h1 style={S.h1}>Rating</h1>
      <p style={S.subtitle}>Configure which content can be rated.</p>

      <Section title="Preview rating types">
        <MagentaLinks items={RATING_TYPES} onClick={(t) => alert(`Preview: ${t}`)} />
      </Section>

      <Section title="Rules" desc="Defines which content users can rate based on document metadata. Rules apply in the order listed.">
        <div style={S.rulesBox}>
          {rules.map((rule, i) => (
            <div key={rule.id} style={S.ruleRow}>
              <span style={S.ruleNum}>{i + 1}</span>
              <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>Rate</span>
              {rule.targets.map((t) => (
                <span key={t} style={S.tag}>{t}</span>
              ))}
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>{rule.scope}</span>
              <div style={{ flex: 1 }} />
              <button type="button" style={S.configBtn} onClick={() => alert('Configure rule placeholder')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
                <span>Configure rule</span>
              </button>
              <button type="button" style={S.iconBtn} onClick={() => moveRule(i, i - 1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" style={S.iconBtn} onClick={() => moveRule(i, i + 1)} disabled={i === rules.length - 1} aria-label="Move down">↓</button>
              <button type="button" style={{ ...S.iconBtn, color: '#a21caf' }} onClick={() => removeRule(i)} aria-label="Remove">×</button>
            </div>
          ))}
          <button type="button" onClick={addRule} style={S.addRule}>
            <span style={S.addRuleIcon}>+</span> Add rule
          </button>
        </div>
      </Section>
    </AdminShell>
  );
}

const S = {
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  subtitle: { fontSize: '0.92rem', color: '#475569', margin: '0 0 18px' },
  rulesBox: {
    background: '#FFFFFF', border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '12px',
  },
  ruleRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: '4px',
    marginBottom: '8px',
  },
  ruleNum: { fontSize: '0.85rem', fontWeight: 600, color: '#374151', minWidth: '14px' },
  tag: {
    fontSize: '0.78rem', padding: '3px 10px',
    background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1',
    borderRadius: '999px',
  },
  configBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', color: '#a21caf',
    fontSize: '0.88rem', cursor: 'pointer', padding: '4px 8px',
    fontFamily: 'var(--font-sans)',
  },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#64748b', fontSize: '1rem', padding: '4px 8px',
    fontFamily: 'var(--font-sans)',
  },
  addRule: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', width: '100%', padding: '12px',
    background: 'transparent', border: 'none',
    color: '#a21caf', fontSize: '0.92rem', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 500,
  },
  addRuleIcon: {
    width: '20px', height: '20px', borderRadius: '50%',
    background: '#a21caf', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.95rem', fontWeight: 700,
  },
};
