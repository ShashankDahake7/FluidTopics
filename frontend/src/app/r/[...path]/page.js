'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import DocumentReader from '@/components/portal/DocumentReader';
import { useTranslation } from '@/lib/i18n';

// /r/<...path> — pretty URL resolver page.
//
// Calls GET /api/portal/by-pretty-url?path=<...path> with the slash-joined
// segments and renders the shared <DocumentReader/> for whatever the
// backend matched.
//
//   - If the backend returns a `document` match we render the doc with
//     its first topic selected.
//   - If the backend returns a `topic` match (a topic-scope template was
//     the winner) we render the parent doc with that topic pre-selected.
//   - 404 surfaces a friendly "no content matches that URL" message.
//
// We deliberately keep the page client-only — auth tokens live in
// session/localStorage, so SSR-resolving here would force an extra
// public read path on the backend.
export default function PrettyUrlResolverPage() {
  const params = useParams();
  const search = useSearchParams();
  const { t } = useTranslation();

  // Next.js gives us the rest-segment as `path` (string[] for catch-all).
  const segments = Array.isArray(params?.path) ? params.path : [];
  const fullPath = segments.map((p) => decodeURIComponent(p)).join('/');

  const [state, setState] = useState({ status: 'loading', match: null, error: null });

  useEffect(() => {
    if (!fullPath) {
      setState({ status: 'notfound', match: null, error: null });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', match: null, error: null });
    api.get(`/portal/by-pretty-url?path=${encodeURIComponent(fullPath)}`)
      .then((data) => {
        if (cancelled) return;
        if (!data?.document) {
          setState({ status: 'notfound', match: null, error: null });
          return;
        }
        setState({ status: 'ready', match: data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 404) {
          setState({ status: 'notfound', match: null, error: null });
          return;
        }
        setState({ status: 'error', match: null, error: err?.message || 'Resolution failed' });
      });
    return () => { cancelled = true; };
  }, [fullPath]);

  if (state.status === 'loading') {
    return (
      <div style={S.loading}>
        <div style={S.spinner} />
        <span>Loading…</span>
      </div>
    );
  }

  if (state.status === 'notfound') {
    return (
      <div style={S.notFound}>
        <p>{t('documentNotFound') || 'No content matches that URL.'}</p>
        <Link href="/dashboard" style={{ color: '#1d4ed8' }}>
          {t('backToPortal') || 'Back to Knowledge Hub'}
        </Link>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={S.notFound}>
        <p>{state.error}</p>
        <Link href="/dashboard" style={{ color: '#1d4ed8' }}>
          {t('backToPortal') || 'Back to Knowledge Hub'}
        </Link>
      </div>
    );
  }

  // Topic-level pretty URLs flow through the same reader; we just hand
  // the matched topic id to the component so it skips its own selection
  // logic. ?topic=<id> from search params still wins if explicitly set.
  const documentId = state.match.document._id || state.match.document.id;
  const initialTopicId = state.match.topic?._id || search?.get('topic') || null;

  return (
    <DocumentReader
      documentId={String(documentId)}
      initialTopicId={initialTopicId ? String(initialTopicId) : null}
      allDocsHref="/dashboard"
    />
  );
}

const S = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - var(--header-height))',
    gap: '14px',
    color: '#64748b',
  },
  notFound: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - var(--header-height))',
    gap: '12px',
    color: '#374151',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid #e2e8f0',
    borderTopColor: '#1455C0',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
