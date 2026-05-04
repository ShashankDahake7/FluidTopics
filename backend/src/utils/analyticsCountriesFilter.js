'use strict';

/**
 * Countries analytics (Fluid Topics–style): exclude requests for static assets from counts.
 * Aligns with “Jan 2024+” FT behavior — reduces noise from JS/CSS/fonts/images and Next chunks.
 *
 * Applied to Mongo `$match` alongside timestamp / other filters. Events with no `data.path`
 * (search, login, etc.) are always included.
 */

/** Mongo query fragment: exclude documents whose `data.path` looks like a static resource. */
function excludeStaticResourcePathsMatch() {
  return {
    $nor: [
      { 'data.path': { $regex: '^/_next/', $options: 'i' } },
      { 'data.path': { $regex: '^/static/', $options: 'i' } },
      {
        'data.path': {
          $regex: '\\.(?:js|mjs|cjs|css|map|ico|png|jpe?g|gif|webp|svg|woff2?|ttf|eot)(?:\\?|#|$)',
          $options: 'i',
        },
      },
      { 'data.path': { $regex: '/favicon\\.ico|/favicon|/robots\\.txt|/sitemap\\.xml', $options: 'i' } },
      { 'data.path': { $regex: '^/uploads/.+\\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$', $options: 'i' } },
    ],
  };
}

module.exports = {
  excludeStaticResourcePathsMatch,
};
