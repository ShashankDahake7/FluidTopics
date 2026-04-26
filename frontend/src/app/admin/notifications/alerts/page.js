'use client';
import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, Checkbox, Radio, ReorderList } from '@/components/admin/AdminBits';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const METADATA_OPTIONS = [
  'Created_by', 'title', 'publicationDate', 'author_personname',
  'ft:lastPublication', 'ft:publication_title', 'ft:topic_id',
];

export default function AlertsNotificationsPage() {
  const [matchMode, setMatchMode] = useState('any');             // 'any' | 'all'
  const [days, setDays] = useState({ Monday: true, Tuesday: false, Wednesday: false, Thursday: false, Friday: false, Saturday: false, Sunday: false });
  const [bodyMeta, setBodyMeta] = useState(['Created_by', 'title', 'publicationDate']);
  const [bodyAdd, setBodyAdd] = useState('author_personname');
  const [dirty, setDirty] = useState(false);
  const set = (fn) => (v) => { fn(v); setDirty(true); };

  const toggleDay = (d) => { setDays({ ...days, [d]: !days[d] }); setDirty(true); };

  const addBody = () => {
    if (!bodyMeta.includes(bodyAdd)) { setBodyMeta([...bodyMeta, bodyAdd]); setDirty(true); }
  };
  const moveBody = (from, to) => {
    if (to < 0 || to >= bodyMeta.length) return;
    const arr = [...bodyMeta]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    setBodyMeta(arr); setDirty(true);
  };
  const removeBody = (i) => { setBodyMeta(bodyMeta.filter((_, idx) => idx !== i)); setDirty(true); };

  return (
    <AdminShell
      active="notif-alerts"
      footer={<ActionFooter dirty={dirty} onCancel={() => setDirty(false)} onSave={() => setDirty(false)} />}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
        <div>
          <h1 style={S.h1}>
            Alerts{' '}
            <span title="Configure when and how alerts are sent" style={S.infoIcon}>ⓘ</span>
          </h1>
          <p style={S.subtitle}>Configure alert parameters.</p>
        </div>
        <button type="button" style={S.previewBtn} onClick={() => alert('Preview alert email placeholder')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preview</span>
        </button>
      </div>

      <Section title="Match all search terms" desc="Triggers alert when new or updated results match:">
        <Radio checked={matchMode === 'any'} onChange={() => set(setMatchMode)('any')} label="At least one search term" />
        <Radio checked={matchMode === 'all'} onChange={() => set(setMatchMode)('all')} label="All search terms" />
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
            <select value={bodyAdd} onChange={(e) => setBodyAdd(e.target.value)} style={S.select}>
              {METADATA_OPTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={addBody} style={S.addBtn} aria-label="Add">+</button>
          </div>
        </div>
      </Section>
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
  metaBox: {
    background: '#FFFFFF', border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '12px',
  },
  addRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px',
    padding: '10px 14px', background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: '4px',
  },
  select: {
    flex: 1, padding: '6px 10px', border: '1px solid transparent', borderRadius: '4px',
    fontSize: '0.9rem', background: '#fff',
    fontFamily: 'var(--font-sans)', color: '#94a3b8', cursor: 'pointer',
  },
  addBtn: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#a21caf', color: '#fff', border: 'none',
    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
};
