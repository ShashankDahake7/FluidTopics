'use client';
import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

export default function IngestPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef();

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = () => {
    api.get('/ingest/jobs?limit=10').then(d => setJobs(d.jobs || [])).catch(() => {});
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.upload('/ingest/upload', fd);
      setResult(data);
      setFile(null);
      fetchJobs();
    } catch (e) { setError(e.message); }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document and all its topics?')) return;
    try {
      await api.delete(`/ingest/${id}`);
      fetchJobs();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <Header />
      <main style={{ position: 'relative', zIndex: 1 }} className="container">
        <div style={{ padding: '32px 0' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Content Ingestion</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Upload documents to parse and index</p>

          {/* Upload Zone */}
          <div
            className="card" onClick={() => inputRef.current?.click()}
            onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            style={{
              marginTop: '24px', textAlign: 'center', padding: '48px', cursor: 'pointer',
              border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: dragActive ? 'rgba(99,102,241,0.05)' : 'var(--bg-card)',
              transition: 'all 0.2s',
            }}>
            <span style={{ fontSize: '3rem' }}>📁</span>
            <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
              {file ? file.name : 'Drag & drop or click to select'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Supports HTML, Markdown, DOCX, XML, ZIP
            </p>
            <input ref={inputRef} type="file" hidden
              accept=".html,.htm,.md,.markdown,.docx,.xml,.zip,.txt"
              onChange={e => setFile(e.target.files[0])} />
          </div>

          {file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <span className="badge">{file.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button onClick={handleUpload} className="btn btn-primary" disabled={uploading}>
                {uploading ? '⏳ Processing...' : '🚀 Upload & Process'}
              </button>
            </div>
          )}

          {error && <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.85rem' }}>{error}</div>}

          {result && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--success)', fontWeight: 600 }}>✅ {result.message}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Created {result.document?.topicCount || 0} topics from "{result.document?.title}"
              </p>
            </div>
          )}

          {/* Jobs Table */}
          <div className="card" style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Ingestion History</h3>
            {jobs.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Title', 'Format', 'Size', 'Topics', 'Status', 'Date', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={td}>{job.title}</td>
                        <td style={td}><span className="badge">{job.sourceFormat}</span></td>
                        <td style={td}>{job.fileSize ? (job.fileSize / 1024).toFixed(1) + ' KB' : '—'}</td>
                        <td style={td}>{job.topicCount || 0}</td>
                        <td style={td}><span className={`badge badge-${job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'}`}>{job.status}</span></td>
                        <td style={td}>{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td style={td}><button onClick={() => handleDelete(job._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ color: 'var(--text-muted)' }}>No ingestion jobs yet</p>}
          </div>
        </div>
      </main>
    </>
  );
}

const td = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
