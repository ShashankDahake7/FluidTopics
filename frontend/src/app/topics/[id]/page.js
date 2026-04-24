'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function TopicViewPage() {
  const params = useParams();
  const [topic, setTopic] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    api.get(`/topics/${params.id}`).then(d => {
      setTopic(d.topic);
      setLoading(false);
      // Track view for personalization
      api.post('/user/track-view', { topicId: params.id }).catch(() => {});
      // Check bookmark
      api.get(`/bookmarks/check/${params.id}`).then(b => setIsBookmarked(b.isBookmarked)).catch(() => {});
      // Related topics
      api.get(`/topics/${params.id}/related?limit=4`).then(r => setRelated(r.related || [])).catch(() => {});
    }).catch(e => { console.error(e); setLoading(false); });
  }, [params.id]);

  const toggleBookmark = async () => {
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await api.delete(`/bookmarks/${params.id}`);
        setIsBookmarked(false);
      } else {
        await api.post('/bookmarks', { topicId: params.id });
        setIsBookmarked(true);
      }
    } catch (e) { console.error(e); }
    setBookmarkLoading(false);
  };

  if (loading) return (<><Header /><div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div></>);
  if (!topic) return (<><Header /><div className="container" style={{ padding: '60px 0', textAlign: 'center' }}><h2>Topic not found</h2></div></>);

  return (
    <>
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }} className="container">
        <div style={{ display: 'flex', gap: '32px', padding: '32px 0' }}>
          {/* Content */}
          <article style={{ flex: 1, minWidth: 0 }}>
            {/* Breadcrumbs */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <a href="/topics" style={{ color: 'var(--text-muted)' }}>Docs</a>
              <span>›</span>
              {topic.hierarchy?.parent && (
                <>
                  <a href={`/topics/${topic.hierarchy.parent._id || topic.hierarchy.parent}`} style={{ color: 'var(--text-muted)' }}>
                    {topic.hierarchy.parent.title || 'Parent'}
                  </a>
                  <span>›</span>
                </>
              )}
              <span style={{ color: 'var(--text-secondary)' }}>{topic.title}</span>
            </nav>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 }}>{topic.title}</h1>
              <button onClick={toggleBookmark} disabled={bookmarkLoading}
                className="btn btn-ghost" title={isBookmarked ? 'Remove bookmark' : 'Bookmark this topic'}
                style={{ fontSize: '1.3rem', flexShrink: 0, color: isBookmarked ? 'var(--warning)' : 'var(--text-muted)' }}>
                {isBookmarked ? '★' : '☆'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {(topic.metadata?.tags || []).map((tag, i) => <span key={i} className="badge">{tag}</span>)}
              {topic.metadata?.product && <span className="badge badge-success">{topic.metadata.product}</span>}
            </div>

            {/* Content */}
            {topic.metadata?.aiSummary && (
              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-glass)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-10px', left: '16px', background: 'var(--bg-primary)', padding: '0 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-tertiary)' }}>
                  ✨ AI Summary
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                  {topic.metadata.aiSummary}
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: '32px', lineHeight: 1.8, color: 'var(--text-secondary)',
                fontSize: '0.95rem',
              }}
              dangerouslySetInnerHTML={{ __html: topic.content?.html || '<p>No content available</p>' }}
              className="topic-content"
            />

            {/* Children */}
            {topic.hierarchy?.children?.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Sub-topics</h3>
                {topic.hierarchy.children.map(child => (
                  <a key={child._id || child} href={`/topics/${child._id || child}`}
                    style={{ display: 'block', padding: '10px 16px', marginBottom: '8px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--accent-tertiary)', fontSize: '0.9rem' }}>
                    {child.title || 'Sub-topic'}
                  </a>
                ))}
              </div>
            )}

            {/* Footer meta */}
            <div style={{ marginTop: '40px', padding: '16px 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>👁 {topic.viewCount || 0} views</span>
              <span>Updated {new Date(topic.updatedAt).toLocaleDateString()}</span>
            </div>
          </article>

          {/* Sidebar */}
          {related.length > 0 && (
            <aside style={{ width: '260px', flexShrink: 0 }} className="hide-mobile">
              <div className="card" style={{ position: 'sticky', top: 'calc(var(--header-height) + 24px)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Related Topics</h4>
                {related.map(r => (
                  <a key={r._id} href={`/topics/${r._id}`}
                    style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--accent-tertiary)' }}>
                    {r.title}
                  </a>
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>

      <style jsx global>{`
        .topic-content h1, .topic-content h2, .topic-content h3, .topic-content h4 { color: var(--text-primary); margin-top: 1.5em; margin-bottom: 0.5em; }
        .topic-content h2 { font-size: 1.4rem; }
        .topic-content h3 { font-size: 1.15rem; }
        .topic-content p { margin-bottom: 1em; }
        .topic-content ul, .topic-content ol { margin: 1em 0; padding-left: 1.5em; }
        .topic-content li { margin-bottom: 0.4em; }
        .topic-content code { background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85em; }
        .topic-content pre { background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); overflow-x: auto; margin: 1em 0; }
        .topic-content pre code { background: none; padding: 0; }
        .topic-content table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        .topic-content th, .topic-content td { padding: 10px 14px; border: 1px solid var(--border-color); text-align: left; }
        .topic-content th { background: var(--bg-tertiary); font-weight: 600; color: var(--text-primary); }
        .topic-content img { border-radius: var(--radius-md); margin: 1em 0; }
        .topic-content blockquote { border-left: 3px solid var(--accent-primary); padding-left: 16px; color: var(--text-muted); margin: 1em 0; }
      `}</style>
    </>
  );
}
