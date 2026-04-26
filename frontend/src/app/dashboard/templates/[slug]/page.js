'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getTemplate } from '@/customTemplates';
import TemplateFooter from '@/customTemplates/TemplateFooter';

export default function CustomTemplatePage() {
  const { slug } = useParams();
  const tpl = getTemplate(slug);

  if (!tpl) {
    return (
      <div style={s.notFound}>
        <p>Template not found.</p>
        <Link href="/portal" style={{ color: '#1d4ed8' }}>← Back to portal</Link>
      </div>
    );
  }

  const Component = tpl.component;
  return (
    <div style={s.shell}>
      <main style={s.main}>
        <Component />
      </main>
      <TemplateFooter />
    </div>
  );
}

const s = {
  shell: {
    minHeight: 'calc(100vh - var(--header-height))',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
  },
  main: { flex: 1 },
  notFound: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '12px',
    minHeight: 'calc(100vh - var(--header-height))',
    color: '#374151',
  },
};
