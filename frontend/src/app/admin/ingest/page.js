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
      <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
        <main className="container" style={{ padding: '36px 0 56px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Content Ingestion</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>Upload documents to parse and index</p>
          </div>

          {/* Upload Zone */}
          <div
            className="card"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            style={{
              textAlign: 'center', padding: '56px 24px', cursor: 'pointer',
              border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: dragActive ? 'rgba(79,70,229,0.04)' : '#fff',
              transition: 'all 200ms', boxShadow: 'none',
            }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.6rem' }}>
              📁
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px', padding: '12px 16px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <span className="badge">{file.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button onClick={handleUpload} className="btn btn-primary btn-sm" disabled={uploading} style={{ marginLeft: 'auto' }}>
                {uploading ? 'Processing…' : 'Upload & Process'}
              </button>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '14px', padding: '12px 16px',
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: 'var(--radius-md)', color: '#dc2626', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          {result && (
            <div style={{
              marginTop: '14px', padding: '14px 18px',
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ color: '#166534', fontWeight: 600, fontSize: '0.9rem' }}>✓ {result.message}</p>
              <p style={{ color: '#15803d', fontSize: '0.82rem', marginTop: '3px' }}>
                Created {result.document?.topicCount || 0} topics from "{result.document?.title}"
              </p>
            </div>
          )}

          {/* Jobs Table */}
          <div className="card" style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Ingestion History</h3>
            {jobs.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Title', 'Format', 'Size', 'Topics', 'Status', 'Date', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
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
                        <td style={td}>
                          <button onClick={() => handleDelete(job._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)', padding: '4px 8px' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No ingestion jobs yet</p>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

const td = { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
