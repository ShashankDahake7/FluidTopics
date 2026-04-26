'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import ProfileShell from '@/components/profile/ProfileShell';

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </svg>
);

const Caret = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <polyline points="6 9, 12 15, 18 9" />
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6, 15 12, 9 18" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 6, 9 12, 15 18" />
  </svg>
);

export default function SearchPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editingFilters, setEditingFilters] = useState(false);
  const [editingPriorities, setEditingPriorities] = useState(false);

  // Load profile + the docs/topics needed to render chip labels.
  const [docsById, setDocsById] = useState({});
  const [topicsById, setTopicsById] = useState({});

  useEffect(() => {
    if (!localStorage.getItem('ft_token')) {
      router.replace('/login');
      return;
    }
    Promise.all([
      api.get('/user/profile').catch(() => null),
      api.get('/portal/documents').catch(() => ({ documents: [] })),
    ]).then(([pf, docs]) => {
      setProfile(pf);
      const dById = {};
      (docs.documents || []).forEach((d) => { dById[d._id] = d; });
      setDocsById(dById);
    }).finally(() => setLoading(false));
  }, [router]);

  const documentIds = profile?.documentIds || [];
  const topicIds = profile?.topicIds || [];
  const releaseNotesOnly = !!profile?.releaseNotesOnly;
  const priorityDocumentIds = profile?.priorityDocumentIds || [];
  const priorityTopicIds    = profile?.priorityTopicIds || [];
  const priorityReleaseNotes = !!profile?.priorityReleaseNotes;
  const authPriorities = profile?.products || [];
  const personalPriorities = (profile?.topProducts || []).map((p) => p.product);

  // Lazy-load topic titles for any topicIds we don't have a label for yet
  useEffect(() => {
    const missing = [...topicIds, ...priorityTopicIds].filter((id) => !topicsById[id]);
    if (missing.length === 0) return;
    api.get('/portal/topics-index').then((d) => {
      const byId = { ...topicsById };
      (d.topics || []).forEach((t) => { byId[t._id] = t; });
      setTopicsById(byId);
    }).catch(() => {});
  }, [topicIds, priorityTopicIds, topicsById]);

  const filterChips = [
    ...(releaseNotesOnly ? [{ key: 'rn', label: 'Release Notes' }] : []),
    ...documentIds.map((id) => ({ key: `d:${id}`, label: docsById[id]?.title || 'Module' })),
    ...topicIds.map((id) => ({ key: `t:${id}`, label: topicsById[id]?.title || 'Topic' })),
  ];

  const priorityChips = [
    ...(priorityReleaseNotes ? [{ key: 'p-rn', label: 'Release Notes' }] : []),
    ...priorityDocumentIds.map((id) => ({ key: `pd:${id}`, label: docsById[id]?.title || 'Module' })),
    ...priorityTopicIds.map((id) => ({ key: `pt:${id}`, label: topicsById[id]?.title || 'Topic' })),
    ...personalPriorities.map((p) => ({ key: `pp:${p}`, label: p })),
  ];

  return (
    <ProfileShell active="search-preferences">
      <h1 style={S.pageTitle}>Search preferences</h1>

      {/* Filter results */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Filter results</h2>
        <p style={S.sectionDesc}>Results only contain content with this metadata.</p>

        {filterChips.length === 0 ? (
          <div style={S.muted}>No filters defined</div>
        ) : (
          <div style={S.chips}>
            {filterChips.map((c) => <span key={c.key} style={S.chip}>{c.label}</span>)}
          </div>
        )}
        <button type="button" onClick={() => setEditingFilters(true)} style={S.editLink}>
          <PencilIcon /> <span>Edit</span>
        </button>
      </section>

      {/* Prioritize results */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Prioritize results</h2>
        <p style={S.sectionDesc}>Content with this metadata appears as a top search result.</p>

        <div style={{ marginTop: '14px' }}>
          <div style={S.subLabel}>
            <strong>Authenticated values</strong>{' '}
            <span style={{ fontWeight: 400, color: '#475569' }}>(automatically provided by your administrator)</span>
          </div>
          {authPriorities.length === 0 ? (
            <div style={S.muted}>No priorities defined</div>
          ) : (
            <div style={S.chips}>
              {authPriorities.map((p) => <span key={p} style={S.chip}>{p}</span>)}
            </div>
          )}
        </div>

        <div style={{ marginTop: '18px' }}>
          <div style={S.subLabel}><strong>Personal values</strong></div>
          {priorityChips.length === 0 ? (
            <div style={S.muted}>No priorities defined</div>
          ) : (
            <div style={S.chips}>
              {priorityChips.map((c) => <span key={c.key} style={S.chip}>{c.label}</span>)}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setEditingPriorities(true)} style={S.editLink}>
          <PencilIcon /> <span>Edit</span>
        </button>
      </section>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      )}

      {editingFilters && (
        <EditFiltersPanel
          initial={{ documentIds, topicIds, releaseNotesOnly }}
          onClose={() => setEditingFilters(false)}
          onSave={(next) => {
            setProfile((p) => ({ ...(p || {}), ...next }));
            setEditingFilters(false);
          }}
        />
      )}
      {editingPriorities && (
        <EditPrioritiesPanel
          initial={{
            priorityDocumentIds,
            priorityTopicIds,
            priorityReleaseNotes,
          }}
          onClose={() => setEditingPriorities(false)}
          onSave={(next) => {
            setProfile((p) => ({ ...(p || {}), ...next }));
            setEditingPriorities(false);
          }}
        />
      )}
    </ProfileShell>
  );
}

// ---------------------------------------------------------------------------
// Slide-in "Edit filters" panel — TAXONOMY (Module + Release Notes) & FT:TITLE
// ---------------------------------------------------------------------------
function EditFiltersPanel({ initial, onClose, onSave }) {
  const [docIds, setDocIds]     = useState(new Set(initial.documentIds || []));
  const [topIds, setTopIds]     = useState(new Set(initial.topicIds || []));
  const [releaseNotes, setRN]   = useState(!!initial.releaseNotesOnly);
  const [taxonomyOpen, setTaxOpen] = useState(true);
  const [titleOpen, setTitleOpen]  = useState(false);
  const [moduleView, setModuleView] = useState(false);  // false = list, true = drilled into Module
  const [docs, setDocs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [count, setCount] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load uploaded documents + topic index once
  useEffect(() => {
    api.get('/portal/documents').then((d) => setDocs(d.documents || [])).catch(() => setDocs([]));
    api.get('/portal/topics-index').then((d) => setTopics(d.topics || [])).catch(() => setTopics([]));
  }, []);

  // Live count
  const refreshCount = useCallback(async () => {
    const params = new URLSearchParams({ q: '', limit: '1' });
    if (docIds.size) params.set('documentIds', Array.from(docIds).join(','));
    if (topIds.size) params.set('topicIds', Array.from(topIds).join(','));
    if (releaseNotes) {
      const existing = params.get('tags');
      params.set('tags', existing ? `${existing},Release Notes` : 'Release Notes');
    }
    try {
      const d = await api.get(`/search?${params.toString()}`);
      setCount(d.total ?? 0);
    } catch {
      setCount(null);
    }
  }, [docIds, topIds, releaseNotes]);

  useEffect(() => {
    const h = setTimeout(refreshCount, 200);
    return () => clearTimeout(h);
  }, [refreshCount]);

  const toggle = (set, setSet) => (value) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const clearAll = () => { setDocIds(new Set()); setTopIds(new Set()); setRN(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/user/preferences', {
        documentIds: Array.from(docIds),
        topicIds: Array.from(topIds),
        releaseNotesOnly: releaseNotes,
      });
      onSave({
        documentIds: Array.from(docIds),
        topicIds: Array.from(topIds),
        releaseNotesOnly: releaseNotes,
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredDocs   = useMemo(() =>
    docs.filter((d) => d.title?.toLowerCase().includes(moduleFilter.toLowerCase())),
    [docs, moduleFilter]);
  const filteredTopics = useMemo(() =>
    topics.filter((t) => t.title?.toLowerCase().includes(titleFilter.toLowerCase())),
    [topics, titleFilter]);

  // Header label inside TAXONOMY: when something is selected, show the count or "Release Notes"
  const taxonomyLabel = (() => {
    if (releaseNotes && docIds.size === 0) return 'Release Notes';
    if (docIds.size > 0 && !releaseNotes) return `${docIds.size} module${docIds.size === 1 ? '' : 's'}`;
    if (docIds.size > 0 && releaseNotes) return `${docIds.size + 1} selected`;
    return null;
  })();

  return (
    <div style={P.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={P.panel} onClick={(e) => e.stopPropagation()}>
        <div style={P.header}>
          <button type="button" onClick={onClose} aria-label="Close" style={P.closeBtn}>×</button>
          <div style={P.title}>Edit filters</div>
        </div>

        <div style={P.body}>
          <div style={P.countBanner}>
            <span style={P.infoIcon} aria-hidden="true">ⓘ</span>
            <span><strong>{count ?? '…'}</strong> matching results in all languages</span>
          </div>

          {/* TAXONOMY group */}
          <div style={P.group}>
            <button type="button" onClick={() => setTaxOpen((v) => !v)} style={P.groupHeader}>
              <span>TAXONOMY</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {taxonomyLabel && <span style={P.headerLabel}>{taxonomyLabel}</span>}
                <Caret open={taxonomyOpen} />
              </span>
            </button>
            {taxonomyOpen && (
              moduleView ? (
                /* drilled-in: list of all uploaded documents (Modules) */
                <div style={P.subPane}>
                  <button type="button" onClick={() => setModuleView(false)} style={P.backRow}>
                    <ChevronLeft />
                    <span>Module</span>
                  </button>
                  <input
                    type="text"
                    placeholder="Filter"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    style={P.filterInput}
                  />
                  <div style={P.scroll}>
                    {filteredDocs.length === 0
                      ? <div style={P.empty}>No modules</div>
                      : filteredDocs.map((d) => (
                          <label key={d._id} style={P.optRow}>
                            <input
                              type="checkbox"
                              checked={docIds.has(d._id)}
                              onChange={() => toggle(docIds, setDocIds)(d._id)}
                            />
                            <span>{d.title}</span>
                          </label>
                        ))}
                  </div>
                </div>
              ) : (
                /* top-level: Module (drill in) + Release Notes (toggle) */
                <div>
                  {(docIds.size > 0 || releaseNotes) && (
                    <div style={P.clearRow}>
                      <button type="button" onClick={clearAll} style={P.clearTextBtn}>
                        ✕ <span style={{ marginLeft: '6px' }}>CLEAR</span>
                      </button>
                    </div>
                  )}
                  <div style={P.checkRowWrap}>
                    <div style={P.checkRow}>
                      <label style={P.checkLabel}>
                        <input
                          type="checkbox"
                          checked={releaseNotes}
                          onChange={(e) => setRN(e.target.checked)}
                        />
                        <span>Release Notes</span>
                      </label>
                    </div>
                  </div>
                  <div style={P.checkRowWrap}>
                    <button type="button" onClick={() => setModuleView(true)} style={P.drillRow}>
                      <span style={P.checkLabel}>
                        <input
                          type="checkbox"
                          readOnly
                          checked={docIds.size > 0 && docIds.size === docs.length}
                          ref={(el) => { if (el) el.indeterminate = docIds.size > 0 && docIds.size < docs.length; }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            if (docIds.size === docs.length) setDocIds(new Set());
                            else setDocIds(new Set(docs.map((d) => d._id)));
                          }}
                        />
                        <span>Module</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {docIds.size > 0 && <span style={P.countBadge}>{docIds.size}</span>}
                        <ChevronRight />
                      </span>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* FT:TITLE group */}
          <div style={P.group}>
            <button type="button" onClick={() => setTitleOpen((v) => !v)} style={P.groupHeader}>
              <span>FT:TITLE</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {topIds.size > 0 && <span style={P.headerLabel}>{topIds.size} title{topIds.size === 1 ? '' : 's'}</span>}
                <Caret open={titleOpen} />
              </span>
            </button>
            {titleOpen && (
              <div style={P.subPane}>
                <input
                  type="text"
                  placeholder="Filter"
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                  style={P.filterInput}
                />
                <div style={P.scroll}>
                  {filteredTopics.length === 0
                    ? <div style={P.empty}>No titles</div>
                    : filteredTopics.slice(0, 500).map((t) => (
                        <label key={t._id} style={P.optRow}>
                          <input
                            type="checkbox"
                            checked={topIds.has(t._id)}
                            onChange={() => toggle(topIds, setTopIds)(t._id)}
                          />
                          <span>{t.title}</span>
                        </label>
                      ))}
                  {filteredTopics.length > 500 && (
                    <div style={P.empty}>Showing first 500. Type to filter further.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={P.footer}>
          <button type="button" onClick={clearAll} style={P.clearBtn}>Clear all</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={P.cancelBtn}>✕ Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={P.saveBtn}>
            ✓ {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-in "Edit priorities" panel — same structure as filters, but it boosts
// matching results to the top instead of restricting to them.
// ---------------------------------------------------------------------------
function EditPrioritiesPanel({ initial, onClose, onSave }) {
  const [docIds, setDocIds] = useState(new Set(initial.priorityDocumentIds || []));
  const [topIds, setTopIds] = useState(new Set(initial.priorityTopicIds || []));
  const [releaseNotes, setRN] = useState(!!initial.priorityReleaseNotes);
  const [taxonomyOpen, setTaxOpen] = useState(true);
  const [titleOpen, setTitleOpen] = useState(false);
  const [moduleView, setModuleView] = useState(false);
  const [docs, setDocs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/portal/documents').then((d) => setDocs(d.documents || [])).catch(() => setDocs([]));
    api.get('/portal/topics-index').then((d) => setTopics(d.topics || [])).catch(() => setTopics([]));
  }, []);

  const toggle = (set, setSet) => (value) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const clearAll = () => { setDocIds(new Set()); setTopIds(new Set()); setRN(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/user/preferences', {
        priorityDocumentIds: Array.from(docIds),
        priorityTopicIds: Array.from(topIds),
        priorityReleaseNotes: releaseNotes,
      });
      onSave({
        priorityDocumentIds: Array.from(docIds),
        priorityTopicIds: Array.from(topIds),
        priorityReleaseNotes: releaseNotes,
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredDocs = useMemo(() =>
    docs.filter((d) => d.title?.toLowerCase().includes(moduleFilter.toLowerCase())),
    [docs, moduleFilter]);
  const filteredTopics = useMemo(() =>
    topics.filter((t) => t.title?.toLowerCase().includes(titleFilter.toLowerCase())),
    [topics, titleFilter]);

  const taxonomyLabel = (() => {
    if (releaseNotes && docIds.size === 0) return 'Release Notes';
    if (docIds.size > 0 && !releaseNotes) return `${docIds.size} module${docIds.size === 1 ? '' : 's'}`;
    if (docIds.size > 0 && releaseNotes) return `${docIds.size + 1} selected`;
    return null;
  })();

  return (
    <div style={P.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={P.panel} onClick={(e) => e.stopPropagation()}>
        <div style={P.header}>
          <button type="button" onClick={onClose} aria-label="Close" style={P.closeBtn}>×</button>
          <div style={P.title}>Edit priorities</div>
        </div>

        <div style={P.body}>
          {/* TAXONOMY */}
          <div style={P.group}>
            <button type="button" onClick={() => setTaxOpen((v) => !v)} style={P.groupHeader}>
              <span>TAXONOMY</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {taxonomyLabel && <span style={P.headerLabel}>{taxonomyLabel}</span>}
                <Caret open={taxonomyOpen} />
              </span>
            </button>
            {taxonomyOpen && (
              moduleView ? (
                <div style={P.subPane}>
                  <button type="button" onClick={() => setModuleView(false)} style={P.backRow}>
                    <ChevronLeft />
                    <span>Module</span>
                  </button>
                  <input
                    type="text"
                    placeholder="Filter"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    style={P.filterInput}
                  />
                  <div style={P.scroll}>
                    {filteredDocs.length === 0
                      ? <div style={P.empty}>No modules</div>
                      : filteredDocs.map((d) => (
                          <label key={d._id} style={P.optRow}>
                            <input type="checkbox" checked={docIds.has(d._id)} onChange={() => toggle(docIds, setDocIds)(d._id)} />
                            <span>{d.title}</span>
                          </label>
                        ))}
                  </div>
                </div>
              ) : (
                <div>
                  {(docIds.size > 0 || releaseNotes) && (
                    <div style={P.clearRow}>
                      <button type="button" onClick={clearAll} style={P.clearTextBtn}>
                        ✕ <span style={{ marginLeft: '6px' }}>CLEAR</span>
                      </button>
                    </div>
                  )}
                  <div style={P.checkRowWrap}>
                    <div style={P.checkRow}>
                      <label style={P.checkLabel}>
                        <input type="checkbox" checked={releaseNotes} onChange={(e) => setRN(e.target.checked)} />
                        <span>Release Notes</span>
                      </label>
                    </div>
                  </div>
                  <div style={P.checkRowWrap}>
                    <button type="button" onClick={() => setModuleView(true)} style={P.drillRow}>
                      <span style={P.checkLabel}>
                        <input
                          type="checkbox"
                          readOnly
                          checked={docIds.size > 0 && docIds.size === docs.length}
                          ref={(el) => { if (el) el.indeterminate = docIds.size > 0 && docIds.size < docs.length; }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            if (docIds.size === docs.length) setDocIds(new Set());
                            else setDocIds(new Set(docs.map((d) => d._id)));
                          }}
                        />
                        <span>Module</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {docIds.size > 0 && <span style={P.countBadge}>{docIds.size}</span>}
                        <ChevronRight />
                      </span>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* FT:TITLE */}
          <div style={P.group}>
            <button type="button" onClick={() => setTitleOpen((v) => !v)} style={P.groupHeader}>
              <span>FT:TITLE</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {topIds.size > 0 && <span style={P.headerLabel}>{topIds.size} title{topIds.size === 1 ? '' : 's'}</span>}
                <Caret open={titleOpen} />
              </span>
            </button>
            {titleOpen && (
              <div style={P.subPane}>
                <input
                  type="text"
                  placeholder="Filter"
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                  style={P.filterInput}
                />
                <div style={P.scroll}>
                  {filteredTopics.length === 0
                    ? <div style={P.empty}>No titles</div>
                    : filteredTopics.slice(0, 500).map((t) => (
                        <label key={t._id} style={P.optRow}>
                          <input type="checkbox" checked={topIds.has(t._id)} onChange={() => toggle(topIds, setTopIds)(t._id)} />
                          <span>{t.title}</span>
                        </label>
                      ))}
                  {filteredTopics.length > 500 && <div style={P.empty}>Showing first 500. Type to filter further.</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={P.footer}>
          <button type="button" onClick={clearAll} style={P.clearBtn}>Clear all</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={P.cancelBtn}>✕ Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={P.saveBtn}>
            ✓ {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  pageTitle: { fontSize: '1.6rem', fontWeight: 600, color: '#1d4ed8', margin: '0 0 24px', letterSpacing: '-0.01em' },
  section: { marginBottom: '36px' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  sectionDesc: { fontSize: '0.92rem', color: '#1f2937', margin: '0 0 12px' },
  subLabel: { fontSize: '0.92rem', color: '#0f172a', marginBottom: '6px' },
  muted: { fontSize: '0.9rem', color: '#94a3b8', margin: '6px 0' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' },
  chip: { fontSize: '0.78rem', padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '999px', border: '1px solid #bfdbfe' },
  editLink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', color: '#1d4ed8',
    fontSize: '0.92rem', cursor: 'pointer', padding: '8px 0 0',
    fontFamily: 'var(--font-sans)',
  },
  editCard: {
    marginTop: '10px', padding: '12px', background: '#FFFFFF',
    border: '1px solid #e5e7eb', borderRadius: '6px',
    display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '560px',
  },
  label: { fontSize: '0.78rem', fontWeight: 600, color: '#374151' },
  input: { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--font-sans)' },
  editActions: { display: 'flex', gap: '8px' },
  btnPrimary: { background: '#1d4ed8', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 600 },
  btnSecondary: { background: '#fff', color: '#374151', border: '1px solid #cbd5e1', padding: '7px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-sans)' },
};

const P = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: '100%', maxWidth: '760px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-sans)',
    boxShadow: '-12px 0 30px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f1f5f9',
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
    color: '#374151', width: '28px', height: '28px',
  },
  title: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  countBanner: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', borderRadius: '999px',
    background: '#eff6ff', color: '#1d4ed8',
    fontSize: '0.88rem',
    border: '1px solid #bfdbfe',
    marginBottom: '20px',
  },
  infoIcon: {
    width: '20px', height: '20px',
    background: '#1d4ed8', color: '#fff',
    borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem', fontStyle: 'normal',
  },
  group: {
    border: '1px solid #e5e7eb', borderRadius: '6px',
    marginBottom: '12px', overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '12px 14px',
    background: '#f8fafc', border: 'none',
    fontSize: '0.78rem', fontWeight: 700, color: '#475569',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  headerLabel: {
    fontSize: '0.85rem', fontWeight: 500, color: '#1d4ed8',
    letterSpacing: 0, textTransform: 'none',
  },
  checkRowWrap: { borderTop: '1px solid #f1f5f9' },
  checkRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', background: '#ffffff',
  },
  drillRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px', background: '#ffffff',
    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  checkLabel: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    fontSize: '0.92rem', color: '#1f2937', cursor: 'pointer',
    flex: 1, textAlign: 'left',
  },
  countBadge: {
    background: '#eff6ff', color: '#1d4ed8',
    fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: '999px',
  },
  subPane: {
    padding: '12px 14px',
    borderTop: '1px solid #f1f5f9',
    background: '#ffffff',
  },
  backRow: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none',
    color: '#1f2937', cursor: 'pointer',
    padding: '4px 0', marginBottom: '8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.92rem',
  },
  filterInput: {
    width: '100%', padding: '8px 10px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
    marginBottom: '8px',
  },
  scroll: {
    maxHeight: '320px', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '4px',
    paddingRight: '4px',
  },
  optRow: {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    fontSize: '0.88rem', color: '#1f2937',
    padding: '6px 4px', cursor: 'pointer',
    borderRadius: '4px',
  },
  empty: { fontSize: '0.85rem', color: '#94a3b8', padding: '8px 4px' },
  clearRow: {
    display: 'flex', justifyContent: 'flex-end',
    padding: '8px 14px 0', background: '#ffffff',
  },
  clearTextBtn: {
    background: 'transparent', border: 'none',
    color: '#1d4ed8', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em',
    fontFamily: 'var(--font-sans)',
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 24px',
    borderTop: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  clearBtn: {
    background: '#eff6ff', color: '#1d4ed8',
    border: 'none', borderRadius: '4px',
    padding: '8px 16px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 600,
  },
  cancelBtn: {
    background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '4px',
    padding: '8px 18px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
  },
  saveBtn: {
    background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: '4px',
    padding: '8px 22px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 600,
  },
};
