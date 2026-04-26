'use client';

const SOCIAL = [
  { label: 'Darwinbox', href: 'https://darwinbox.com' },
  { label: 'Facebook',  href: 'https://www.facebook.com/Darwinbox' },
  { label: 'Linkedin',  href: 'https://www.linkedin.com/company/darwinbox' },
  { label: 'Twitter',   href: 'https://x.com/Darwinbox' },
  { label: 'Instagram', href: 'https://www.instagram.com/Darwinbox' },
];

export default function TemplateFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={s.footer}>
      <div style={s.links}>
        {SOCIAL.map((item, i) => (
          <span key={item.label}>
            <a href={item.href} target="_blank" rel="noopener noreferrer" style={s.link}>
              {item.label}
            </a>
            {i < SOCIAL.length - 1 && <span style={s.sep}> | </span>}
          </span>
        ))}
      </div>
      <div style={s.copy}>
        Copyright ©{year}. Darwinbox Digital Solutions Pvt. Ltd. All Rights Reserved
      </div>
    </footer>
  );
}

const s = {
  footer: {
    borderTop: '1px solid #e5e7eb',
    padding: '22px 32px 28px',
    textAlign: 'center',
    background: '#ffffff',
    fontFamily: 'var(--font-sans)',
  },
  links: {
    fontSize: '0.85rem',
    color: '#1d4ed8',
    marginBottom: '8px',
  },
  link: { color: '#1d4ed8', textDecoration: 'none' },
  sep: { color: '#94a3b8' },
  copy: { fontSize: '0.75rem', color: '#64748b' },
};
