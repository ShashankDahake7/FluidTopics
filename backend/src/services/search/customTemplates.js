// Custom-template "virtual" search hits.
//
// Custom templates are static React pages registered in the frontend at
// /dashboard/templates/<slug> — they are not stored in MongoDB so Atlas
// Search can never index them. This module surfaces them as virtual
// hits alongside the real Atlas results so a query like "release notes"
// can take the reader straight to the Release Notes dashboard page.
//
// === Single source of truth ===
// Template metadata (slug / title / description / search keywords) is
// loaded from the SAME manifest the frontend reads:
//   frontend/src/customTemplates/registry.json
// Adding a new template only needs an edit to that JSON file plus the
// new React component on the frontend; this matcher picks it up at the
// next backend restart with no code change here.
//
// If the manifest can't be located at runtime (e.g. backend-only deploy
// where the frontend tree isn't shipped) we fall back to an empty
// registry and log once. Search keeps working — only the template
// suggestions go quiet.

const path = require('path');
const fs = require('fs');

// Resolution order:
//   1. CUSTOM_TEMPLATES_REGISTRY env override (production / docker)
//   2. ../../../../frontend/src/customTemplates/registry.json (monorepo dev)
//   3. ./customTemplatesFallback.json next to this file (optional safety net)
function resolveManifestPath() {
  if (process.env.CUSTOM_TEMPLATES_REGISTRY) {
    return process.env.CUSTOM_TEMPLATES_REGISTRY;
  }
  const monorepoPath = path.resolve(
    __dirname,
    '../../../../frontend/src/customTemplates/registry.json'
  );
  if (fs.existsSync(monorepoPath)) return monorepoPath;
  const localFallback = path.resolve(__dirname, './customTemplatesFallback.json');
  if (fs.existsSync(localFallback)) return localFallback;
  return null;
}

function loadRegistry() {
  const manifestPath = resolveManifestPath();
  if (!manifestPath) {
    console.warn(
      '[customTemplates] No registry.json found. Searched env CUSTOM_TEMPLATES_REGISTRY, ' +
      'frontend/src/customTemplates/registry.json, and ./customTemplatesFallback.json. ' +
      'Custom-template search hits will be disabled.'
    );
    return [];
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed?.templates) ? parsed.templates : [];
    if (templates.length === 0) {
      console.warn('[customTemplates] Manifest at', manifestPath, 'has no templates entries.');
    }
    return templates;
  } catch (err) {
    console.warn('[customTemplates] Failed to load registry from', manifestPath, '-', err.message);
    return [];
  }
}

// Each entry's `keywords` field is the lower-cased token bag we match
// against. Built once at module load alongside a couple of derived
// fields used by the scoring loops below.
function enrich(rawTemplates) {
  return rawTemplates.map((t) => {
    const corpus = [t.title, t.description, ...(t.keywords || [])]
      .join(' ')
      .toLowerCase();
    return {
      slug: t.slug,
      title: t.title,
      description: t.description,
      keywords: t.keywords || [],
      href: `/dashboard/templates/${t.slug}`,
      corpus,
      titleLower: String(t.title || '').toLowerCase(),
      keywordSet: new Set((t.keywords || []).map((k) => String(k).toLowerCase())),
    };
  });
}

const ENRICHED = enrich(loadRegistry());

// Tokenise a query the same way for both match + suggest paths. We split
// on anything that isn't a word character so "release-notes", "release_notes",
// and "release notes" all collapse to ['release', 'notes'].
function tokenise(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// Score a template against a token list. Heuristic — we don't try to
// emulate Atlas's BM25, just give predictable ordering:
//   +5 per token that appears in the (lower-cased) title
//   +4 if the *full query phrase* equals one of the keyword phrases
//   +3 per token that appears in any keyword phrase as a whole word
//   +1 per token that appears anywhere in the corpus
// A title hit is worth more than a keyword hit which is worth more than a
// general body hit, so "release notes" → Release Notes template ranks
// above What's Upcoming (which only mentions release notes in passing).
function scoreTemplate(tpl, tokens, phrase) {
  if (tokens.length === 0) return 0;
  let score = 0;

  for (const tok of tokens) {
    if (tpl.titleLower.includes(tok)) score += 5;
  }

  if (phrase && tpl.keywordSet.has(phrase)) score += 4;

  for (const tok of tokens) {
    for (const kw of tpl.keywordSet) {
      const re = new RegExp(`(^|\\W)${escapeRegex(tok)}(\\W|$)`);
      if (re.test(kw)) { score += 3; break; }
    }
  }

  for (const tok of tokens) {
    if (tpl.corpus.includes(tok)) score += 1;
  }

  return score;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Public: return template hits matching `query`, sorted by score desc.
// Empty query → no hits (we don't want templates polluting match-all).
function matchCustomTemplates(query, { limit = 5 } = {}) {
  const phrase = String(query || '').trim().toLowerCase();
  const tokens = tokenise(phrase);
  if (tokens.length === 0) return [];

  const ranked = ENRICHED
    .map((tpl) => ({
      slug: tpl.slug,
      title: tpl.title,
      description: tpl.description,
      href: tpl.href,
      score: scoreTemplate(tpl, tokens, phrase),
    }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

// Public: prefix-style suggestions for the header autocomplete dropdown.
// Looser than matchCustomTemplates: we surface a template whenever ANY of
// its tokens (title or keyword) starts with the query prefix.
//
// Ranking (highest first):
//   +50  exact title match            ("release notes" → Release Notes)
//   +30  title starts with prefix     ("rele"          → Release Notes)
//   +20  any word in the title starts with prefix
//   +10  keyword phrase starts with prefix
//   +5   any word in any keyword phrase starts with prefix
// So title hits always outrank "incidental keyword" matches and the
// dropdown order matches what the user obviously meant.
function suggestCustomTemplates(prefix, { limit = 4 } = {}) {
  const p = String(prefix || '').trim().toLowerCase();
  if (p.length < 2) return [];

  const ranked = [];
  for (const tpl of ENRICHED) {
    let score = 0;

    if (tpl.titleLower === p) score += 50;
    else if (tpl.titleLower.startsWith(p)) score += 30;
    else if (tpl.titleLower.split(/\s+/).some((w) => w.startsWith(p))) score += 20;

    for (const kw of tpl.keywordSet) {
      if (kw.startsWith(p)) { score += 10; break; }
    }
    for (const kw of tpl.keywordSet) {
      if (kw.split(/\s+/).some((w) => w.startsWith(p))) { score += 5; break; }
    }

    if (score > 0) {
      ranked.push({
        id: `tpl:${tpl.slug}`,
        text: tpl.title,
        kind: 'template',
        slug: tpl.slug,
        href: tpl.href,
        description: tpl.description,
        // Always >= 100 so templates outrank Atlas topic-title scores
        // when both arrays are concatenated client-side.
        score: 100 + score,
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

module.exports = {
  matchCustomTemplates,
  suggestCustomTemplates,
  // Exported for tests / debugging — not used by the runtime.
  _registry: ENRICHED,
  _resolveManifestPath: resolveManifestPath,
};
