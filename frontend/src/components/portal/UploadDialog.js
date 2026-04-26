'use client';
import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';

const ACCEPT = '.html,.htm,.md,.markdown,.docx,.xml,.zip,.txt';

export default function UploadDialog({ open, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUp] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFile(null); setError(''); setResult(null); setUp(false); setDrag(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickFile = () => inputRef.current?.click();
  const onPick = (e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(''); } };
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUp(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.upload('/ingest/upload', fd);
      setResult(data);
      setFile(null);
      onUploaded?.(data);
    } catch (e) { setError(e.message || 'Upload failed'); }
    setUp(false);
  };

  return (
    <div role="dialog" aria-modal="true" style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>Upload document</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={S.close}>×</button>
        </div>

        <div
          onClick={pickFile}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          style={{
            ...S.dropZone,
            borderColor: drag ? '#1d4ed8' : '#cbd5e1',
            background: drag ? '#eff6ff' : '#FFFFFF',
          }}
        >
          <div style={S.dropIcon}>📁</div>
          <div style={S.dropTitle}>
            {file ? file.name : 'Drag & drop or click to select'}
          </div>
          <div style={S.dropHint}>Supports HTML, Markdown, DOCX, XML, ZIP</div>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onPick} />
        </div>

        {error && <div style={S.error}>{error}</div>}
        {result && (
          <div style={S.success}>
            <strong>Uploaded.</strong> Parsed {result.topicCount ?? result.topics?.length ?? '—'} topic(s).
          </div>
        )}

        <div style={S.actions}>
          <button type="button" onClick={onClose} style={S.btnSecondary}>Close</button>
          <button type="button" onClick={handleUpload} disabled={!file || uploading} style={{
            ...S.btnPrimary,
            opacity: !file || uploading ? 0.6 : 1,
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
          }}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, padding: '20px',
  },
  modal: {
    background: '#fff', borderRadius: '12px',
    width: '100%', maxWidth: '520px',
    boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
    fontFamily: 'var(--font-sans)',
    padding: '20px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '14px',
  },
  title: { fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  close: {
    background: 'transparent', border: 'none', fontSize: '1.4rem',
    color: '#64748b', cursor: 'pointer', lineHeight: 1, padding: 0,
  },
  dropZone: {
    border: '2px dashed', borderRadius: '10px',
    padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
    transition: 'background 150ms, border-color 150ms',
  },
  dropIcon: {
    width: '52px', height: '52px', borderRadius: '14px',
    background: '#eff6ff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px', fontSize: '1.5rem',
  },
  dropTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  dropHint: { fontSize: '0.8rem', color: '#64748b', marginTop: '4px' },
  error: {
    marginTop: '12px', padding: '10px 12px',
    background: '#fef2f2', color: '#991b1b',
    border: '1px solid #fecaca', borderRadius: '6px',
    fontSize: '0.85rem',
  },
  success: {
    marginTop: '12px', padding: '10px 12px',
    background: '#ecfdf5', color: '#065f46',
    border: '1px solid #a7f3d0', borderRadius: '6px',
    fontSize: '0.85rem',
  },
  actions: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px',
  },
  btnSecondary: {
    padding: '8px 16px', background: '#fff', color: '#374151',
    border: '1px solid #cbd5e1', borderRadius: '6px',
    fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  btnPrimary: {
    padding: '8px 18px', background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: '6px',
    fontSize: '0.88rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
};
