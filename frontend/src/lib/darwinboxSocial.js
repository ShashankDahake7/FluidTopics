/**
 * Public Darwinbox URLs used in portal footer, templates, and admin email previews.
 * Keep in sync with PortalFooter / TemplateFooter.
 */
export const DARWINBOX_URL = {
  website: 'https://darwinbox.com',
  facebook: 'https://www.facebook.com/thedarwinbox',
  linkedin: 'https://www.linkedin.com/company/darwinbox',
  twitter: 'https://twitter.com/thedarwinbox',
  instagram: 'https://www.instagram.com/thedarwinbox',
};

/** Pipe-separated footer row (e.g. transactional email footers) */
export const DARWINBOX_FOOTER_LINK_ROW = [
  { label: 'Darwinbox', href: DARWINBOX_URL.website },
  { label: 'Facebook', href: DARWINBOX_URL.facebook },
  { label: 'LinkedIn', href: DARWINBOX_URL.linkedin },
  { label: 'Twitter', href: DARWINBOX_URL.twitter },
  { label: 'Instagram', href: DARWINBOX_URL.instagram },
];
