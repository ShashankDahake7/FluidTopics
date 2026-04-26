// Registry of custom (non-ingested) doc templates.
//
// Each entry is rendered as a tile on the dashboard home page, and selecting it
// opens /dashboard/templates/<slug>, which loads the matching component below.
// Add new templates by dropping a file in this folder and registering it
// here — the registry is the single source of truth.

import LegalChanges from './LegalChanges';
import WhatsUpcoming from './WhatsUpcoming';
import ReleaseNotes from './ReleaseNotes';
import FAQs from './FAQs';
import ComingSoon from './ComingSoon';
import {
  WhatsUpcomingIcon,
  ReleaseNotesIcon,
  LegalChangesIcon,
  FAQsIcon,
  ComingSoonIcon,
  GenericDocIcon,
} from './icons';

export const customTemplates = [
  {
    slug: 'whats-upcoming',
    title: "What's Upcoming",
    description: 'A pointer to the latest release notes — what to expect in upcoming Darwinbox releases.',
    icon: WhatsUpcomingIcon,
    component: WhatsUpcoming,
  },
  {
    slug: 'release-notes',
    title: 'Release Notes',
    description: "Darwinbox's quarterly release notes — updates, enhancements, and bug fixes by year.",
    icon: ReleaseNotesIcon,
    component: ReleaseNotes,
  },
  {
    slug: 'legal-changes',
    title: 'Legal Changes',
    description: 'Track upcoming and recent legal changes across countries, modules, and Darwinbox releases.',
    icon: LegalChangesIcon,
    component: LegalChanges,
  },
  {
    slug: 'faqs',
    title: 'FAQs',
    description: 'Answers to common questions about accessing and using the Darwinbox Help Portal.',
    icon: FAQsIcon,
    component: FAQs,
  },
  {
    slug: 'coming-soon',
    title: 'Coming Soon',
    description: 'Placeholder page for modules whose content is still on the way.',
    icon: ComingSoonIcon,
    component: ComingSoon,
  },
];

export const getTemplate = (slug) =>
  customTemplates.find((t) => t.slug === slug) || null;

export { GenericDocIcon };
