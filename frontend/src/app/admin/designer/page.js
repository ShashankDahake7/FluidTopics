'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Page type configuration
// ---------------------------------------------------------------------------

const PAGE_TYPES = [
  { value: 'homepage',       label: 'Homepage'        },
  { value: 'search-results', label: 'Search Results'  },
  { value: 'reader',         label: 'Reader'          },
  { value: 'custom',         label: 'Custom'          },
  { value: 'header',         label: 'Header'          },
  { value: 'shared',         label: 'Shared'          },
  { value: 'topic-template', label: 'Topic Template'  },
  { value: 'link-preview',   label: 'Link Preview'    },
];

const TYPE_COLORS = {
  'homepage':       '#4f46e5',
  'search-results': '#059669',
  'reader':         '#d97706',
  'custom':         '#7c3aed',
  'header':         '#0891b2',
  'shared':         '#db2777',
  'topic-template': '#65a30d',
  'link-preview':   '#ea580c',
};

// ---------------------------------------------------------------------------
// Portal Designer list page
// ---------------------------------------------------------------------------

export default function DesignerListPage() {
  const router = useRouter();

  const [pages, setPages]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // pageId being acted on

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/designer/pages');
      setPages(Array.isArray(data) ? data : (data.pages || []));
    } catch (err) {
      setError(err.message || 'Failed to load pages');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleDuplicate = async (page) => {
    setActionLoading(page._id + '-dup');
    try {
      await api.post(`/designer/pages/${page._id}/duplicate`, {});
      await fetchPages();
    } catch (err) {
      alert(`Duplicate failed: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleDelete = async (page) => {
    if (!window.confirm(`Delete page "${page.name}"? This cannot be undone.`)) return;
    setActionLoading(page._id + '-del');
    try {
      await api.delete(`/designer/pages/${page._id}`);
      await fetchPages();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
    setActionLoading(null);
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - var(--header-height))' }}>
      <main className="container" style={{ padding: '36px 0 56px' }}>

        {/* Header row */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'flex-start',
            marginBottom:   '28px',
            gap:            '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize:      '1.6rem',
                fontWeight:    700,
                letterSpacing: '-0.02em',
                marginBottom:  '4px',
              }}
            >
              Portal Designer
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Design custom content portal pages
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <a
              href="/admin"
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '6px',
                padding:      '8px 14px',
                border:       '1px solid var(--border-color)',
                borderRadius: '8px',
                background:   '#fff',
                color:        'var(--text-secondary)',
                fontSize:     '0.875rem',
                textDecoration: 'none',
                fontWeight:   500,
              }}
            >
              ← Admin
            </a>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '6px',
                padding:      '8px 16px',
                background:   'var(--accent-primary)',
                color:        '#fff',
                border:       'none',
                borderRadius: '8px',
                cursor:       'pointer',
                fontSize:     '0.875rem',
                fontWeight:   600,
              }}
            >
              + New Page
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div
            style={{
              padding:      '20px',
              background:   '#fef2f2',
              border:       '1px solid #fecaca',
              borderRadius: '10px',
              color:        '#dc2626',
              fontSize:     '0.875rem',
            }}
          >
            <strong>Error:</strong> {error}
            <button
              onClick={fetchPages}
              style={{
                marginLeft:   '12px',
                padding:      '4px 10px',
                background:   '#dc2626',
                color:        '#fff',
                border:       'none',
                borderRadius: '6px',
                cursor:       'pointer',
                fontSize:     '0.8rem',
              }}
            >
              Retry
            </button>
          </div>
        ) : pages.length === 0 ? (
          <EmptyState onCreateClick={() => setShowModal(true)} />
        ) : (
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap:                 '16px',
            }}
          >
            {pages.map((page) => (
              <PageCard
                key={page._id}
                page={page}
                actionLoading={actionLoading}
                onEdit={() => router.push(`/admin/designer/${page._id}`)}
                onDuplicate={() => handleDuplicate(page)}
                onDelete={() => handleDelete(page)}
              />
            ))}
          </div>
        )}
      </main>

      {/* New Page Modal */}
      {showModal && (
        <NewPageModal
          onClose={() => setShowModal(false)}
          onCreated={(newPage) => {
            setShowModal(false);
            router.push(`/admin/designer/${newPage._id}`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page card
// ---------------------------------------------------------------------------

function PageCard({ page, actionLoading, onEdit, onDuplicate, onDelete }) {
  const typeColor = TYPE_COLORS[page.type] || '#64748b';
  const isDuping  = actionLoading === page._id + '-dup';
  const isDeleting = actionLoading === page._id + '-del';

  return (
    <div
      className="card"
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
        position:      'relative',
      }}
    >
      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            background:   typeColor,
            color:        '#fff',
            padding:      '3px 8px',
            borderRadius: '99px',
            fontSize:     '0.7rem',
            fontWeight:   600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {page.type || 'custom'}
        </span>
        <span
          style={{
            background:   page.status === 'published' ? '#dcfce7' : '#f1f5f9',
            color:        page.status === 'published' ? '#15803d' : '#64748b',
            padding:      '3px 8px',
            borderRadius: '99px',
            fontSize:     '0.7rem',
            fontWeight:   500,
          }}
        >
          {page.status === 'published' ? 'Published' : 'Draft'}
        </span>
      </div>

      {/* Name */}
      <div>
        <h3
          style={{
            fontSize:   '0.95rem',
            fontWeight: 700,
            color:      'var(--text-primary)',
            marginBottom: '4px',
            overflow:   'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {page.name || 'Untitled Page'}
        </h3>
        <div
          style={{
            display:  'flex',
            gap:      '10px',
            fontSize: '0.78rem',
            color:    'var(--text-muted)',
          }}
        >
          {page.locale && (
            <span>🌐 {page.locale}</span>
          )}
          {page.updatedAt && (
            <span>
              Updated {new Date(page.updatedAt).toLocaleDateString('en-US')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          onClick={onEdit}
          style={{
            flex:         1,
            padding:      '7px 0',
            background:   'var(--accent-primary)',
            color:        '#fff',
            border:       'none',
            borderRadius: '7px',
            cursor:       'pointer',
            fontSize:     '0.82rem',
            fontWeight:   600,
          }}
        >
          Edit
        </button>
        <button
          onClick={onDuplicate}
          disabled={isDuping}
          style={{
            padding:      '7px 12px',
            background:   '#f1f5f9',
            color:        '#475569',
            border:       '1px solid var(--border-color)',
            borderRadius: '7px',
            cursor:       isDuping ? 'wait' : 'pointer',
            fontSize:     '0.82rem',
            opacity:      isDuping ? 0.7 : 1,
          }}
          title="Duplicate"
        >
          {isDuping ? '…' : '⧉'}
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          style={{
            padding:      '7px 12px',
            background:   '#fef2f2',
            color:        '#dc2626',
            border:       '1px solid #fecaca',
            borderRadius: '7px',
            cursor:       isDeleting ? 'wait' : 'pointer',
            fontSize:     '0.82rem',
            opacity:      isDeleting ? 0.7 : 1,
          }}
          title="Delete"
        >
          {isDeleting ? '…' : '🗑️'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }) {
  return (
    <div
      style={{
        textAlign:    'center',
        padding:      '60px 20px',
        background:   '#fff',
        borderRadius: '12px',
        border:       '1px solid var(--border-color)',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎨</div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>No pages yet</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px' }}>
        Create your first portal page to get started with the designer.
      </p>
      <button
        onClick={onCreateClick}
        style={{
          padding:      '9px 20px',
          background:   'var(--accent-primary)',
          color:        '#fff',
          border:       'none',
          borderRadius: '8px',
          cursor:       'pointer',
          fontSize:     '0.875rem',
          fontWeight:   600,
        }}
      >
        + Create your first page
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Page modal
// ---------------------------------------------------------------------------

function NewPageModal({ onClose, onCreated }) {
  const [name,   setName]   = useState('');
  const [type,   setType]   = useState('homepage');
  const [locale, setLocale] = useState('en');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.post('/designer/pages', {
        name:   name.trim(),
        type,
        locale: locale.trim() || 'en',
      });
      onCreated(data.page || data);
    } catch (err) {
      setError(err.message || 'Failed to create page');
    }
    setSaving(false);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.45)',
        zIndex:         2000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:         '440px',
          maxWidth:      'calc(100vw - 32px)',
          background:    '#ffffff',
          borderRadius:  '12px',
          boxShadow:     '0 20px 60px rgba(0,0,0,0.2)',
          overflow:      'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '16px 20px',
            borderBottom:   '1px solid #e2e8f0',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>New Page</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Page Name <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Homepage, Custom Search"
              required
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Page Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={inputStyle}
            >
              {PAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Locale</label>
            <input
              type="text"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="en"
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
                padding:      '9px 12px',
                background:   '#fef2f2',
                border:       '1px solid #fecaca',
                borderRadius: '7px',
                color:        '#dc2626',
                fontSize:     '0.82rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding:      '8px 16px',
                background:   '#f1f5f9',
                color:        '#475569',
                border:       '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                cursor:       'pointer',
                fontSize:     '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              style={{
                padding:      '8px 20px',
                background:   name.trim() && !saving ? '#4f46e5' : '#e2e8f0',
                color:        name.trim() && !saving ? '#fff' : '#94a3b8',
                border:       'none',
                borderRadius: '8px',
                cursor:       name.trim() && !saving ? 'pointer' : 'not-allowed',
                fontSize:     '0.875rem',
                fontWeight:   600,
              }}
            >
              {saving ? 'Creating…' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const labelStyle = {
  display:      'block',
  fontSize:     '0.82rem',
  fontWeight:   500,
  color:        '#475569',
  marginBottom: '5px',
};

const inputStyle = {
  width:        '100%',
  padding:      '8px 10px',
  border:       '1px solid #e2e8f0',
  borderRadius: '7px',
  fontSize:     '0.875rem',
  color:        '#1e293b',
  outline:      'none',
  background:   '#fff',
};
