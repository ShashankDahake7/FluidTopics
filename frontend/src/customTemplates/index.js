// Registry of custom (non-ingested) dashboard templates.
//
// Each entry is rendered as a tile on the dashboard home page, and selecting
// it opens /dashboard/templates/<slug>, which loads the matching component
// below.
//
// === Single source of truth ===
// Title / description / search keywords for every template live in
// `registry.json`. The backend search matcher
// (backend/src/services/search/customTemplates.js) reads the SAME json file
// so adding a new template makes it searchable automatically — no backend
// edit required.
//
// What still has to live here in JS (because JSON can't reference React):
//   - the per-template `icon` import from ./icons
//   - the per-template `component` import for the page body
//
// Adding a new template:
//   1. Drop the component file in this folder, e.g. `Onboarding.js`.
//   2. (Optional) Add an icon export in ./icons.
//   3. Append an entry under `templates` in `registry.json`.
//   4. Add ONE line below mapping slug -> { icon, component }.
// That's it. Both the dashboard tile AND search will pick it up.

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
import registry from './registry.json';

// slug -> React-only bindings. Anything missing here falls back to a
// placeholder so a manifest entry without a component never crashes the
// dashboard.
const COMPONENTS = {
  'whats-upcoming':  { icon: WhatsUpcomingIcon, component: WhatsUpcoming },
  'release-notes':   { icon: ReleaseNotesIcon,  component: ReleaseNotes },
  'legal-changes':   { icon: LegalChangesIcon,  component: LegalChanges },
  'faqs':            { icon: FAQsIcon,          component: FAQs },
  'coming-soon':     { icon: ComingSoonIcon,    component: ComingSoon },
};

function MissingComponent() {
  return (
    <div style={{ padding: '40px', color: '#dc2626' }}>
      Template component not registered. Add it to COMPONENTS in
      <code> frontend/src/customTemplates/index.js</code>.
    </div>
  );
}

// Merge the JSON manifest with the slug→component map. Title /
// description always come from JSON; icon / component from this file.
export const customTemplates = (registry.templates || []).map((meta) => {
  const bindings = COMPONENTS[meta.slug] || {};
  return {
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    icon: bindings.icon || GenericDocIcon,
    component: bindings.component || MissingComponent,
  };
});

export const getTemplate = (slug) =>
  customTemplates.find((t) => t.slug === slug) || null;

export { GenericDocIcon };
