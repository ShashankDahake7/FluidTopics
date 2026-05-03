'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api, { API_BASE, getStoredToken } from '@/lib/api';

export default function KhubFileViewerPage() {
  const params = useParams();
  const id = params?.id;
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [blobUrl, setBlobUrl] = useState('');
  const blobRef = useRef('');

  useEffect(() => {
    if (!id) return;
    setErr('');
    setMeta(null);
    api
      .get(`/khub/documents/${id}/metadata`)
      .then(setMeta)
      .catch((e) => setErr(e.message || 'Failed to load'));
  }, [id]);

  useEffect(() => {
    if (!id || !meta) return;
    const token = getStoredToken();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/khub/documents/${id}/content`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || res.statusText || 'Could not load file');
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not load file');
      }
    })();

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = '';
      }
    };
  }, [id, meta]);

  if (!id) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-sans)' }}>
        <p>Missing document id.</p>
        <Link href="/dashboard" style={{ color: '#1d4ed8' }}>Back to Knowledge Hub</Link>
      </div>
    );
  }

  if (err && !meta) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-sans)' }}>
        <p style={{ color: '#b91c1c' }}>{err}</p>
        <Link href="/dashboard" style={{ color: '#1d4ed8' }}>Back to Knowledge Hub</Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div className="spinner" />
      </div>
    );
  }

  const mime = meta.mimeType || 'application/octet-stream';
  const isPdf = mime.includes('pdf');

  return (
    <div style={{ minHeight: 'calc(100vh - var(--header-height))', fontFamily: 'var(--font-sans)', background: '#f8fafc' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/search" style={{ color: '#64748b', fontSize: '0.875rem' }}>← Search</Link>
        <Link href="/dashboard" style={{ color: '#64748b', fontSize: '0.875rem' }}>Knowledge Hub</Link>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a', flex: 1 }}>{meta.title}</h1>
        {blobUrl && (
          <a
            href={blobUrl}
            download={meta.title || 'document'}
            style={{
              padding: '8px 14px',
              background: '#1976D2',
              color: '#fff',
              borderRadius: 6,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            Download
          </a>
        )}
      </div>
      {err && (
        <div style={{ padding: '12px 24px', color: '#b91c1c', fontSize: '0.9rem' }}>{err}</div>
      )}
      <div style={{ height: 'calc(100vh - var(--header-height) - 57px)', background: '#525659' }}>
        {blobUrl && isPdf && (
          <iframe
            title={meta.title}
            src={blobUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}
        {blobUrl && !isPdf && mime.startsWith('text/') && (
          <iframe
            title={meta.title}
            src={blobUrl}
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          />
        )}
        {blobUrl && !isPdf && !mime.startsWith('text/') && (
          <div style={{ padding: 48, textAlign: 'center', color: '#fff' }}>
            <p style={{ marginBottom: 16 }}>Preview is not available for this file type.</p>
            <a href={blobUrl} download={meta.title || 'file'} style={{ color: '#93c5fd' }}>
              Download to open locally
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
