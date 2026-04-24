'use client';
import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import api from '@/lib/api';

export default function TopicViewPage() {
  const params = useParams();
  const pathname = usePathname();
  const [topic, setTopic] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    let active = true;

    setLoading(true);
    setTopic(null);

    api.get(`/topics/${id}`).then(d => {
      if (!active) return;
      setTopic(d.topic);
      setLoading(false);
      api.post('/user/track-view', { topicId: id }).catch(() => {});
      api.get(`/bookmarks/check/${id}`).then(b => {
        if (active) setIsBookmarked(b.isBookmarked);
      }).catch(() => {});
      api.get(`/topics/${id}/related?limit=4`).then(r => {
        if (active) setRelated(r.related || []);
      }).catch(() => {});
    }).catch(e => {
      if (!active) return;
      console.error(e);
      setLoading(false);
    });

    return () => { active = false; };
  }, [pathname]);

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

  if (loading) return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    </>
  );

  if (!topic) return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Topic not found</h2>
          <a href="/topics" className="btn btn-secondary" style={{ marginTop: '16px' }}>Back to Docs</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '28px 0 56px' }}>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

            {/* Main content */}
            <article style={{ flex: 1, minWidth: 0 }}>
              {/* Breadcrumb */}
              <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{topic.title}</span>
              </nav>

              {/* Card wrapper */}
              <div className="card" style={{ padding: '32px 36px' }}>
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    {topic.title}
                  </h1>
                  <button
                    onClick={toggleBookmark} disabled={bookmarkLoading}
                    className="btn btn-secondary btn-sm" style={{ flexShrink: 0, fontSize: '1rem' }}
                    title={isBookmarked ? 'Remove bookmark' : 'Bookmark this topic'}>
                    {isBookmarked ? '★' : '☆'}
                  </button>
                </div>

                {/* Tags */}
                {((topic.metadata?.tags || []).length > 0 || topic.metadata?.product) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '14px' }}>
                    {(topic.metadata?.tags || []).map((tag, i) => <span key={i} className="badge">{tag}</span>)}
                    {topic.metadata?.product && <span className="badge badge-success">{topic.metadata.product}</span>}
                  </div>
                )}

                {/* AI Summary */}
                {topic.metadata?.aiSummary && (
                  <div style={{
                    marginTop: '24px', padding: '16px 20px',
                    background: 'rgba(79,70,229,0.04)',
                    border: '1px solid rgba(79,70,229,0.15)',
                    borderRadius: 'var(--radius-md)',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', top: '-10px', left: '16px',
                      background: 'var(--bg-card)', padding: '0 8px',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)',
                    }}>
                      AI Summary
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                      {topic.metadata.aiSummary}
                    </p>
                  </div>
                )}

                {/* Content */}
                <div
                  style={{ marginTop: '28px', lineHeight: 1.8, color: 'var(--text-primary)', fontSize: '0.95rem' }}
                  dangerouslySetInnerHTML={{ __html: topic.content?.html || '<p>No content available</p>' }}
                  className="topic-content"
                />

                {/* Sub-topics */}
                {topic.hierarchy?.children?.length > 0 && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sub-topics</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {topic.hierarchy.children.map(child => (
                        <a key={child._id || child} href={`/topics/${child._id || child}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 14px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 500,
                            transition: 'border-color 150ms, background 150ms',
                          }}>
                          <span style={{ color: 'var(--text-muted)' }}>›</span>
                          {child.title || 'Sub-topic'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer meta */}
                <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>{topic.viewCount || 0} views</span>
                  <span>Updated {new Date(topic.updatedAt).toLocaleDateString('en-US')}</span>
                </div>
              </div>
            </article>

            {/* Related sidebar */}
            {related.length > 0 && (
              <aside style={{ width: '240px', flexShrink: 0 }} className="hide-mobile">
                <div className="card" style={{ position: 'sticky', top: 'calc(var(--header-height) + 20px)', padding: '20px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Related Topics</h4>
                  {related.map(r => (
                    <a key={r._id} href={`/topics/${r._id}`}
                      style={{ display: 'block', padding: '7px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {r.title}
                    </a>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .topic-content h1, .topic-content h2, .topic-content h3, .topic-content h4 {
          color: var(--text-primary); margin-top: 1.6em; margin-bottom: 0.5em; font-weight: 600;
        }
        .topic-content h2 { font-size: 1.35rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
        .topic-content h3 { font-size: 1.1rem; }
        .topic-content h4 { font-size: 1rem; }
        .topic-content p { margin-bottom: 1em; color: var(--text-primary); }
        .topic-content ul, .topic-content ol { margin: 1em 0; padding-left: 1.6em; }
        .topic-content li { margin-bottom: 0.4em; color: var(--text-primary); }
        .topic-content code {
          background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;
          font-family: var(--font-mono); font-size: 0.85em; color: #c7254e;
          border: 1px solid var(--border-color);
        }
        .topic-content pre {
          background: #f8fafc; border: 1px solid var(--border-color);
          padding: 16px 20px; border-radius: var(--radius-md); overflow-x: auto; margin: 1.2em 0;
        }
        .topic-content pre code { background: none; padding: 0; border: none; color: var(--text-primary); font-size: 0.875em; }
        .topic-content table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: 0.9em; }
        .topic-content th, .topic-content td { padding: 10px 14px; border: 1px solid var(--border-color); text-align: left; }
        .topic-content th { background: var(--bg-tertiary); font-weight: 600; color: var(--text-primary); }
        .topic-content img { border-radius: var(--radius-md); margin: 1em 0; max-width: 100%; }
        .topic-content blockquote {
          border-left: 3px solid var(--accent-primary); padding: 8px 16px;
          color: var(--text-secondary); margin: 1em 0;
          background: rgba(79,70,229,0.04); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }
        .topic-content a { color: var(--accent-primary); text-decoration: underline; text-underline-offset: 2px; }
        .topic-content a:hover { color: var(--accent-secondary); }
        .topic-content hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
      `}</style>
    </>
  );
}
