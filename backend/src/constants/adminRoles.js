// Administrative role id groups for `requireTierOrAdminRoles` in route modules.
// KHUB_ADMIN may override most Knowledge Hub–scoped operations.
//
// Matrix (tiers always include superadmin bypass):
//   CONTENT_PIPELINE — ingest, publications, sources, khub docs, assets, attachments, DITA-OT
//   METADATA — metadata-keys, pretty-urls, vocabularies
//   ENRICHMENT — enrich-rules
//   ANALYTICS — /api/analytics, /api/admin/stats
//   TRANSLATIONS — translation profiles (admin routes), PUT /api/languages/default
//   USERS — /api/groups
//   PORTAL — /api/designer/*
// Access rules API keeps its own KHUB_ADMIN gate (not CONTENT_PUBLISHER write).

module.exports = {
  CONTENT_PIPELINE: ['CONTENT_ADMIN', 'CONTENT_PUBLISHER', 'KHUB_ADMIN'],
  METADATA: ['METADATA_ADMIN', 'KHUB_ADMIN'],
  ENRICHMENT: ['ENRICHMENT_ADMIN', 'KHUB_ADMIN'],
  ANALYTICS: ['ANALYTICS_ADMIN'],
  TRANSLATIONS: ['TRANSLATIONS_ADMIN'],
  USERS: ['USERS_ADMIN'],
  PORTAL: ['PORTAL_ADMIN'],
};
