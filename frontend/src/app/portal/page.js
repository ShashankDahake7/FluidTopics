'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PortalSearch from '@/components/portal/PortalSearch';
import PortalFooter from '@/components/portal/PortalFooter';
import UploadDialog from '@/components/portal/UploadDialog';
import { customTemplates, GenericDocIcon } from '@/customTemplates';
import { useTranslation } from '@/lib/i18n';

function TemplateTile({ tpl }) {
  const Icon = tpl.icon || GenericDocIcon;
  return (
    <Link href={`/portal/templates/${tpl.slug}`} style={styles.tile}>
      <div style={styles.tileBox}>
        <div style={styles.tileIconBox}>
          <Icon />
        </div>
      </div>
      <div style={styles.tileLabel}>{tpl.title}</div>
    </Link>
  );
}

function DocTile({ doc }) {
  return (
    <Link href={`/portal/docs/${doc._id}`} style={styles.tile}>
      <div style={styles.tileBox}>
        <div style={styles.tileIconBox}>
          <GenericDocIcon />
        </div>
      </div>
      <div style={styles.tileLabel}>{doc.title}</div>
    </Link>
  );
}

export default function PortalHomepage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const loadDocs = () => {
    setLoading(true);
    api.get('/portal/documents')
      .then((d) => setDocs(d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDocs(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const filtered = query
    ? docs.filter((d) =>
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.product?.toLowerCase().includes(query.toLowerCase()) ||
      d.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
    )
    : docs;

  const filteredTemplates = query
    ? customTemplates.filter((t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase())
    )
    : customTemplates;

  return (
    <div style={styles.page}>
      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <img src="/Group 79.png" alt="evolve. Everyday" style={styles.heroEvolve} />
          <div style={styles.heroCenter}>
            <h1 style={styles.heroTitle}>{t('portalTitle')}</h1>
            <PortalSearch />
          </div>
          <img src="/Group 4562.png" alt="" aria-hidden="true" style={styles.heroFigures} />
        </div>
      </section>

      {/* Tiles */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>{t('loadingDocs')}</span>
          </div>
        ) : filtered.length === 0 && filteredTemplates.length === 0 ? (
          <div style={styles.empty}>
            {docs.length === 0 ? t('noDocsPublished') : t('noResultsMatch')}
          </div>
        ) : (
          <>
            <div style={styles.grid}>
              <UploadTile onClick={() => setUploadOpen(true)} />
              {filteredTemplates.map((tpl) => (
                <TemplateTile key={tpl.slug} tpl={tpl} />
              ))}
              {filtered.map((doc, i) => (
                <DocTile key={doc._id} doc={doc} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { loadDocs(); }}
      />
      <section style={styles.disclaimer}>
        <div style={styles.disclaimerInner}>
          <strong>{t('disclaimerLabel')}</strong>: {t('disclaimerBody')}
        </div>
      </section>
      <PortalFooter />
    </div>
  );
}

function UploadTile({ onClick }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} style={{ ...styles.tile, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} aria-label={t('uploadDocument')}>
      <div style={styles.tileBox}>
        <div style={{ ...styles.tileIconBox, color: '#1d4ed8' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
      </div>
      <div style={styles.tileLabel}>{t('uploadDocument')}</div>
    </button>
  );
}

const styles = {
  page: {
    background: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  hero: {
    background: '#EDF6FF',
    padding: '32px 24px',
  },
  heroInner: {
    maxWidth: '1320px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr minmax(0, 760px) 1fr',
    alignItems: 'center',
    gap: '24px',
  },
  heroEvolve: {
    height: '110px',
    width: 'auto',
    justifySelf: 'start',
    objectFit: 'contain',
  },
  heroFigures: {
    height: '160px',
    width: 'auto',
    justifySelf: 'end',
    objectFit: 'contain',
  },
  heroCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    textAlign: 'center',
    width: '100%',
  },
  heroTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1d4ed8',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #cfd8e6',
    borderRadius: '6px',
    padding: '0',
    width: '100%',
    maxWidth: '720px',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '0.95rem',
    color: '#1f2937',
    padding: '12px 16px',
    fontFamily: 'var(--font-sans)',
  },
  searchBtn: {
    background: 'transparent',
    border: 'none',
    padding: '0 14px',
    height: '100%',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '48px 24px 64px',
    width: '100%',
    flex: 1,
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '20px',
    letterSpacing: '-0.01em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '24px 28px',
    justifyItems: 'center',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    textDecoration: 'none',
    width: '100%',
    maxWidth: '180px',
  },
  tileBox: {
    width: '150px',
    height: '150px',
    borderRadius: '14px',
    background: '#f3f4f6',
    boxShadow: '6px 6px 14px rgba(15, 23, 42, 0.06), -2px -2px 6px rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 150ms, box-shadow 150ms',
  },
  tileIconBox: {
    width: '76px',
    height: '76px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '80px 0',
    color: '#64748b',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '80px 0',
    fontSize: '0.95rem',
  },
  disclaimer: {
    background: '#FFFFFF',
    padding: '20px 32px',
  },
  disclaimerInner: {
    width: '100%',
    fontSize: '0.85rem',
    color: '#475569',
    lineHeight: 1.6,
  },
};
