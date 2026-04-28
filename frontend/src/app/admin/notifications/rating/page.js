'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { ActionFooter, Section, MagentaLinks } from '@/components/admin/AdminBits';
import ConfigureRuleDrawer from '@/components/admin/ConfigureRuleDrawer';
import api from '@/lib/api';

const RATING_TYPES = ['Stars', 'Like', 'Dichotomous'];

// Title shown at the top of the preview card. Stars/Like share the same prompt;
// Dichotomous switches to a yes/no question, mirroring Fluid Topics' UX.
const PREVIEW_TITLES = {
  Stars: 'Rate this document',
  Like: 'Rate this document',
  Dichotomous: 'Did this solve your problem?',
};

// Tag a server-shaped rule with the local-only `id`/`targets`/`scope` fields
// the existing UI relies on. The `targets` chips are derived from the rating
// types, and the `scope` text becomes "for documents where …" when there's
// at least one metadata requirement.
function decorateRule(rule, idx) {
  const targets = [];
  if (rule.docType && rule.docType !== 'No rating') targets.push('Document');
  if (rule.topicType && rule.topicType !== 'No rating') targets.push('Topic');
  const scope = rule.metaReqs && rule.metaReqs.length > 0
    ? `for documents matching ${rule.metaReqs.length} metadata requirement${rule.metaReqs.length === 1 ? '' : 's'}`
    : 'for all documents';
  return {
    id: idx + 1,
    docType:     rule.docType || 'Stars',
    topicType:   rule.topicType || 'Stars',
    topicLevels: Array.isArray(rule.topicLevels) ? rule.topicLevels : [],
    metaReqs:    Array.isArray(rule.metaReqs) ? rule.metaReqs : [],
    targets,
    scope,
  };
}

// Strip the local-only fields before posting back to the server.
function toApiPayload(rules) {
  return rules.map((r) => ({
    docType:     r.docType,
    topicType:   r.topicType,
    topicLevels: Array.isArray(r.topicLevels) ? r.topicLevels : [],
    metaReqs:    (r.metaReqs || []).map((m) => ({ key: m.key, value: m.value ?? '' })),
  }));
}

const DEFAULT_RULE = {
  id: 1,
  targets: ['Document', 'Topic'],
  scope: 'for all documents',
  docType: 'Stars',
  topicType: 'Stars',
  topicLevels: ['Rate individually'],
  metaReqs: [],
};

export default function RatingNotificationsPage() {
  const [rules, setRules] = useState([DEFAULT_RULE]);
  // Snapshot of the last successfully-loaded/saved rules — Cancel reverts to
  // this so the operator can throw away in-progress edits.
  const [savedSnapshot, setSavedSnapshot] = useState([DEFAULT_RULE]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  // Load current configuration on mount. Failures keep the default scaffold
  // visible so the operator can still author a fresh policy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/admin/notifications/rating');
        if (cancelled) return;
        const decorated = (data?.settings?.rules || []).map(decorateRule);
        const next = decorated.length ? decorated : [DEFAULT_RULE];
        setRules(next);
        setSavedSnapshot(next);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load rating settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addRule = () => {
    const id = (rules[rules.length - 1]?.id || 0) + 1;
    // New rules start in "No rating" state — operators promote them via
    // Configure rule once the targets/types are chosen.
    setRules([
      ...rules,
      {
        id, targets: [], scope: 'for all documents',
        docType: 'No rating', topicType: 'No rating',
        topicLevels: [], metaReqs: [],
      },
    ]);
    setDirty(true);
  };
  const moveRule = (from, to) => {
    if (to < 0 || to >= rules.length) return;
    const arr = [...rules]; const [r] = arr.splice(from, 1); arr.splice(to, 0, r);
    setRules(arr); setDirty(true);
  };
  const removeRule = (i) => { setRules(rules.filter((_, idx) => idx !== i)); setDirty(true); };

  const saveRule = (updated) => {
    setRules((prev) =>
      prev.map((r) => (r.id === updated.id ? decorateRule(updated, prev.findIndex((p) => p.id === updated.id)) : r)),
    );
    setDirty(true);
    setEditingRule(null);
  };

  const handleCancel = useCallback(() => {
    setRules(savedSnapshot);
    setDirty(false);
    setError('');
  }, [savedSnapshot]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.put('/admin/notifications/rating', {
        rules: toApiPayload(rules),
      });
      const decorated = (data?.settings?.rules || []).map(decorateRule);
      const next = decorated.length ? decorated : [DEFAULT_RULE];
      setRules(next);
      setSavedSnapshot(next);
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to save rating settings.');
    } finally {
      setSaving(false);
    }
  }, [rules, saving]);

  return (
    <AdminShell
      active="notif-rating"
      footer={<ActionFooter dirty={dirty && !saving} onCancel={handleCancel} onSave={handleSave} />}
    >
      <h1 style={S.h1}>Rating</h1>
      <p style={S.subtitle}>Configure which content can be rated.</p>

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

      <Section title="Preview rating types">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <MagentaLinks items={RATING_TYPES} onClick={setPreview} />
          {preview && (
            <RatingPreviewCard
              type={preview}
              title={PREVIEW_TITLES[preview]}
              onClose={() => setPreview(null)}
            />
          )}
        </div>
      </Section>

      <Section title="Rules" desc="Defines which content users can rate based on document metadata. Rules apply in the order listed.">
        <div style={S.rulesBox}>
          {rules.map((rule, i) => {
            const noRating = (!rule.targets || rule.targets.length === 0)
              || (rule.docType === 'No rating' && rule.topicType === 'No rating');
            return (
            <div key={rule.id} style={S.ruleRow}>
              <span style={S.ruleNum}>{i + 1}</span>
              {noRating ? (
                <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>No rating</span>
              ) : (
                <>
                  <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>Rate</span>
                  {rule.targets.map((t) => (
                    <span key={t} style={S.tag}>{t}</span>
                  ))}
                </>
              )}
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>{rule.scope}</span>
              <div style={{ flex: 1 }} />
              <button type="button" style={S.configBtn} onClick={() => setEditingRule(rule)}>
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
            );
          })}
          <button type="button" onClick={addRule} style={S.addRule}>
            <span style={S.addRuleIcon}>+</span> Add rule
          </button>
        </div>
      </Section>

      <ConfigureRuleDrawer
        rule={editingRule}
        onClose={() => setEditingRule(null)}
        onSave={saveRule}
      />
    </AdminShell>
  );
}

// ---------------------------------------------------------------------------
// Preview popup — shows the live rating widget for the selected type.
// ---------------------------------------------------------------------------

function RatingPreviewCard({ type, title, onClose }) {
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [like, setLike] = useState(null);            // 'like' | 'dislike' | null
  const [yesNo, setYesNo] = useState(null);          // 'yes' | 'no' | null
  const [feedback, setFeedback] = useState('');
  const cardRef = useRef(null);

  // Reset internal widget state when the user switches between rating types.
  useEffect(() => {
    setStars(0); setHoverStars(0); setLike(null); setYesNo(null); setFeedback('');
  }, [type]);

  // Close on Escape key, mirroring the email-preview drawer behaviour.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasRating =
    (type === 'Stars' && stars > 0) ||
    (type === 'Like' && like !== null) ||
    (type === 'Dichotomous' && yesNo !== null);

  let statusText = 'Not rated';
  if (type === 'Stars' && stars > 0) statusText = `${stars} ${stars === 1 ? 'star' : 'stars'}`;
  if (type === 'Like' && like) statusText = like === 'like' ? 'Liked' : 'Disliked';
  if (type === 'Dichotomous' && yesNo) statusText = yesNo === 'yes' ? 'Yes' : 'No';

  return (
    <div ref={cardRef} style={S.previewCard} role="dialog" aria-label={`${type} rating preview`}>
      <button
        type="button"
        onClick={onClose}
        style={S.previewClose}
        aria-label="Close preview"
        title="Close"
      >
        ×
      </button>

      <div style={S.previewTitle}>{title}</div>

      {type === 'Stars' && (
        <div style={S.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hoverStars || stars) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                onMouseEnter={() => setHoverStars(n)}
                onMouseLeave={() => setHoverStars(0)}
                style={S.starBtn}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2.5l2.9 6.4 6.7.6-5 4.7 1.5 6.7L12 17.6 5.9 20.9l1.5-6.7-5-4.7 6.7-.6L12 2.5Z"
                    fill={filled ? '#a21caf' : 'none'}
                    stroke={filled ? '#a21caf' : '#94a3b8'}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {type === 'Like' && (
        <div style={S.choiceRow}>
          <button
            type="button"
            onClick={() => setLike('like')}
            style={{ ...S.choiceBtn, ...(like === 'like' ? S.choiceBtnActive : {}) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
              <line x1="7" y1="22" x2="7" y2="11" />
            </svg>
            <span>Like</span>
          </button>
          <button
            type="button"
            onClick={() => setLike('dislike')}
            style={{ ...S.choiceBtn, ...(like === 'dislike' ? S.choiceBtnActive : {}) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10Z" />
              <line x1="17" y1="2" x2="17" y2="13" />
            </svg>
            <span>Dislike</span>
          </button>
        </div>
      )}

      {type === 'Dichotomous' && (
        <div style={S.choiceRow}>
          <button
            type="button"
            onClick={() => setYesNo('yes')}
            style={{ ...S.choiceBtn, ...(yesNo === 'yes' ? S.choiceBtnActive : {}) }}
          >
            <span>Yes</span>
          </button>
          <button
            type="button"
            onClick={() => setYesNo('no')}
            style={{ ...S.choiceBtn, ...(yesNo === 'no' ? S.choiceBtnActive : {}) }}
          >
            <span>No</span>
          </button>
        </div>
      )}

      <div style={S.statusText}>{statusText}</div>

      <div style={S.feedbackBlock}>
        <div style={S.feedbackLabel}>How can we improve it?</div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Your feedback"
          rows={4}
          style={S.feedbackTa}
        />
      </div>

      <div style={S.previewFooter}>
        <button
          type="button"
          disabled={!hasRating}
          style={{ ...S.sendBtn, ...(hasRating ? {} : S.sendBtnDisabled) }}
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Send feedback</span>
        </button>
      </div>
    </div>
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

  // -------------------- Preview popup --------------------
  previewCard: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    width: '320px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
    padding: '16px 16px 12px',
    zIndex: 30,
    fontFamily: 'var(--font-sans)',
  },
  previewClose: {
    position: 'absolute', top: '6px', right: '8px',
    width: '24px', height: '24px',
    background: 'transparent', border: 'none',
    color: '#64748b', cursor: 'pointer',
    fontSize: '1.2rem', lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  previewTitle: {
    fontSize: '0.95rem', fontWeight: 600, color: '#0f172a',
    marginBottom: '10px', paddingRight: '20px',
  },
  starsRow: {
    display: 'flex', alignItems: 'center', gap: '4px',
    marginBottom: '4px',
  },
  starBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '2px', display: 'inline-flex',
  },
  choiceRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '6px',
  },
  choiceBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.88rem',
    fontFamily: 'var(--font-sans)', minWidth: '54px',
    justifyContent: 'center',
  },
  choiceBtnActive: {
    background: '#f3e8ff', color: '#a21caf',
    borderColor: '#a21caf',
  },
  statusText: {
    fontSize: '0.78rem', color: '#94a3b8',
    marginTop: '4px',
  },
  feedbackBlock: { marginTop: '14px' },
  feedbackLabel: {
    fontSize: '0.88rem', fontWeight: 600, color: '#0f172a',
    marginBottom: '6px',
  },
  feedbackTa: {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', fontSize: '0.88rem', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontFamily: 'var(--font-sans)', resize: 'vertical',
    background: '#fff', outline: 'none',
  },
  previewFooter: {
    display: 'flex', justifyContent: 'flex-end', marginTop: '12px',
  },
  sendBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px',
    background: '#3b82f6', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer',
    fontSize: '0.88rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  sendBtnDisabled: {
    background: '#bfdbfe', cursor: 'not-allowed',
  },
};
