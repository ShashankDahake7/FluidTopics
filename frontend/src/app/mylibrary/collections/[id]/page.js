'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { hrefForTopic } from '@/lib/prettyUrl';
import MyLibrarySidebar from '@/components/mylibrary/MyLibrarySidebar';
import { myLibraryStyles as s } from '../../mylibraryStyles';

const detail = {
  breadcrumb: {
    fontSize: '0.8rem', color: '#64748b', marginBottom: '12px',
    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
  },
  crumbLink: { color: '#1d4ed8', textDecoration: 'none' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  colorDot: { width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0 },
  title: { fontSize: '1.35rem', fontWeight: 600, color: '#0f172a', margin: 0 },
  badge: {
    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '4px 8px', borderRadius: '4px',
    background: '#e0e7ff', color: '#3730a3',
  },
  desc: { fontSize: '0.9rem', color: '#475569', marginBottom: '10px', maxWidth: '720px' },
  smartLead: { fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' },
  queryBox: {
    fontSize: '0.82rem', color: '#334155', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px',
    marginBottom: '22px', fontFamily: 'var(--font-mono, monospace)',
  },
  sectionTitle: {
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#64748b', marginBottom: '10px',
  },
  topicsList: {
    listStyle: 'none', padding: 0, margin: 0,
    border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff',
    overflow: 'hidden',
  },
  topicRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
  },
  topicLink: {
    flex: 1, fontSize: '0.95rem', fontWeight: 600, color: '#1d4ed8',
    textDecoration: 'none',
  },
  topicMuted: { flex: 1, fontSize: '0.95rem', color: '#64748b' },
};

function portalHref(topic) {
  const docId = topic.documentId != null ? String(topic.documentId) : '';
  const tid = topic._id != null ? String(topic._id) : '';
  if (!docId || !tid) return null;
  // Server enriches collection topics with `documentPrettyUrl` and the
  // topic's own `prettyUrl`, so hrefForTopic resolves to /r/<...> when
  // a template matched and falls back to /dashboard/docs/<id>?topic=…
  // when nothing matched.
  const parentDoc = { _id: docId, prettyUrl: topic.documentPrettyUrl || '' };
  return hrefForTopic({ ...topic, _id: tid }, parentDoc);
}

export default function CollectionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collection, setCollection] = useState(null);
  const [topics, setTopics] = useState([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/collections/${id}/contents`);
      setCollection(data.collection);
      setTopics(data.topics || []);
      setTotal(typeof data.total === 'number' ? data.total : (data.topics || []).length);
    } catch (e) {
      if (e?.status === 404) setError('notfound');
      else setError(e?.message || 'err');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('ft_token')) {
      router.replace('/login');
      return;
    }
    load();
  }, [load, router]);

  const removeTopic = async (topicId) => {
    if (!collection || collection.kind !== 'manual') return;
    try {
      await api.delete(`/collections/${collection._id}/topics/${topicId}`);
      setTopics((prev) => prev.filter((x) => String(x._id) !== String(topicId)));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      alert(e?.message || 'Failed');
    }
  };

  const isSmart = collection?.kind === 'smart';

  return (
    <div style={s.shell}>
      <MyLibrarySidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        activeTab="collections"
        labels={{
          bookmarks: t('bookmarks'),
          searches: t('searches'),
          collections: t('collections'),
          goToSearchPage: t('goToSearchPage'),
        }}
        styles={s}
      />
      <main style={s.main}>
        <div style={detail.breadcrumb}>
          <Link href="/mylibrary/bookmarks" style={detail.crumbLink}>{t('myLibraryHeading')}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/mylibrary/collections" style={detail.crumbLink}>{t('collections')}</Link>
          {collection?.name ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{collection.name}</span>
            </>
          ) : null}
        </div>

        {loading ? (
          <div style={s.empty}>{t('loading')}</div>
        ) : error === 'notfound' ? (
          <div style={s.empty}>{t('collectionNotFound')}</div>
        ) : error ? (
          <div style={s.empty}>{error}</div>
        ) : collection ? (
          <>
            <div style={detail.titleRow}>
              <span style={{ ...detail.colorDot, background: collection.color || '#0f172a' }} aria-hidden />
              <h1 style={detail.title}>{collection.name}</h1>
              {isSmart ? (
                <span style={detail.badge}>{t('smartCollectionShort')}</span>
              ) : (
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                  {topics.length === 1 ? t('topicCount', { n: 1 }) : t('topicCountPlural', { n: topics.length })}
                </span>
              )}
            </div>
            {collection.description ? (
              <p style={detail.desc}>{collection.description}</p>
            ) : null}
            {isSmart ? (
              <>
                <p style={detail.smartLead}>{t('smartCollectionLead')}</p>
                {(collection.query || (collection.filters && Object.keys(collection.filters).length)) ? (
                  <div style={detail.queryBox}>
                    {collection.query ? <div>{collection.query}</div> : null}
                    {collection.filters && Object.keys(collection.filters).length > 0 ? (
                      <div style={{ marginTop: collection.query ? '8px' : 0 }}>
                        {JSON.stringify(collection.filters)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            <div style={detail.sectionTitle}>{t('collectionTopics')}</div>
            {topics.length === 0 ? (
              <div style={{ ...s.empty, margin: '0', textAlign: 'left', paddingBottom: '24px' }}>
                {t('emptyCollectionTopics')}
              </div>
            ) : (
              <ul style={detail.topicsList}>
                {topics.map((topic) => {
                  const href = portalHref(topic);
                  return (
                    <li key={String(topic._id)} style={detail.topicRow}>
                      {href ? (
                        <Link href={href} style={detail.topicLink}>{topic.title || 'Untitled'}</Link>
                      ) : (
                        <span style={detail.topicMuted}>{topic.title || 'Untitled'}</span>
                      )}
                      {!isSmart && (
                        <button
                          type="button"
                          onClick={() => removeTopic(topic._id)}
                          style={{ ...s.iconBtn, color: '#dc2626' }}
                          aria-label={t('removeFromCollection')}
                          title={t('removeFromCollection')}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {isSmart && total > topics.length ? (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '12px' }}>
                {t('resultCountPlural', { n: total })}
              </p>
            ) : null}
            <p style={{ marginTop: '24px' }}>
              <Link href="/mylibrary/collections" style={detail.crumbLink}>{t('backToCollections')}</Link>
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
