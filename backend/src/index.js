const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/env');
const connectDB = require('./config/db');
const { initAtlasSearch } = require('./config/atlasSearch');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const ingestionRoutes = require('./routes/ingestion');
const searchRoutes = require('./routes/search');
const topicsRoutes = require('./routes/topics');
const analyticsRoutes = require('./routes/analytics');
const recommendationsRoutes = require('./routes/recommendations');
const adminRoutes = require('./routes/admin');
const adminUsersRoutes = require('./routes/adminUsers');
const bookmarkRoutes = require('./routes/bookmarks');
const userRoutes = require('./routes/user');
const designerRoutes = require('./routes/designer');
const portalRoutes = require('./routes/portal');
const feedbackRoutes = require('./routes/feedback');
const collectionsRoutes = require('./routes/collections');
const ratingsRoutes = require('./routes/ratings');
const attachmentsRoutes = require('./routes/attachments');
const assetsRoutes = require('./routes/assets');
const localesRoutes = require('./routes/locales');
const sectionsRoutes = require('./routes/sections');
const khubDocumentsRoutes = require('./routes/khubDocuments');
const groupsRoutes = require('./routes/groups');
const savedSearchesRoutes = require('./routes/savedSearches');
const personalBooksRoutes = require('./routes/personalBooks');
const languagesRoutes = require('./routes/languages');
const aiRoutes = require('./routes/ai');
const portalAssetsRoutes = require('./routes/portalAssets');
const publicationsRoutes = require('./routes/publications');
const sourcesRoutes = require('./routes/sources');
const ditaOtRoutes = require('./routes/ditaOt');
const metadataKeysRoutes = require('./routes/metadataKeys');
const seoConfigRoutes = require('./routes/seoConfig');
const seoPublicRoutes = require('./routes/seoPublic');
const openSearchConfigRoutes = require('./routes/openSearchConfig');
const openSearchPublicRoutes = require('./routes/openSearchPublic');
const prettyUrlsRoutes = require('./routes/prettyUrls');
const vocabulariesRoutes = require('./routes/vocabularies');
const enrichRulesRoutes = require('./routes/enrichRules');
const legalTermsRoutes = require('./routes/legalTerms');
const accessRulesRoutes = require('./routes/accessRules');
const authAdminRoutes     = require('./routes/authAdmin');
const emailAdminRoutes    = require('./routes/emailAdmin');
const feedbackAdminRoutes = require('./routes/feedbackAdmin');
const notificationsAdminRoutes = require('./routes/notificationsAdmin');

const app = express();

// CORS allow-list — overridable via CORS_ORIGINS env var (comma-separated).
// In production set this to your real origin(s); the dev defaults below
// cover the typical Next.js ports.
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl (no Origin header) and anything in the allow-list.
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files (uploaded media)
app.use('/uploads', express.static(path.resolve(config.upload.dir)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ingest', ingestionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
// Manage Users routes mount FIRST so they win over the legacy `/api/admin`
// router for shared paths (e.g. `/users`, `/audit-log`, `/default-roles`).
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin/access-rules', accessRulesRoutes);
app.use('/api/admin/auth', authAdminRoutes);
app.use('/api/admin/email', emailAdminRoutes);
app.use('/api/admin/feedback', feedbackAdminRoutes);
// Notification admin (Rating + Alerts) — also serves the public-read
// `/api/portal/rating-rules/applicable` endpoint mounted in the same router.
app.use('/api', notificationsAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/user', userRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api', portalAssetsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/collections', collectionsRoutes);

// Knowledge Hub-equivalent routes (parity with FT /khub/* surface).
// Ratings is mounted first so its absolute paths win over the /api/khub/documents
// mount below for the /:id/rating sub-path.
app.use('/api',                  ratingsRoutes);        // /api/topics/:id/rating, /api/documents/:id/rating, /api/khub/documents/:id/rating
app.use('/api/portal',           ratingsRoutes);        // /api/portal/documents/:id/rating
app.use('/api/khub/documents',   khubDocumentsRoutes);  // unstructured documents
app.use('/api/attachments',      attachmentsRoutes);
app.use('/api/assets',           assetsRoutes);
app.use('/api/locales',          localesRoutes);
app.use('/api/languages',        languagesRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/sections',         sectionsRoutes);
app.use('/api/groups',           groupsRoutes);
app.use('/api/saved-searches',   savedSearchesRoutes);
app.use('/api/personal-books',   personalBooksRoutes);
app.use('/api/publications',     publicationsRoutes);
app.use('/api/sources',          sourcesRoutes);
app.use('/api/dita-ot',          ditaOtRoutes);
app.use('/api/metadata-keys',    metadataKeysRoutes);
app.use('/api/pretty-urls',      prettyUrlsRoutes);
app.use('/api/vocabularies',     vocabulariesRoutes);
app.use('/api/enrich-rules',     enrichRulesRoutes);
app.use('/api/legal-terms',      legalTermsRoutes);
app.use('/api/seo-config',       seoConfigRoutes);
app.use('/api/opensearch-config', openSearchConfigRoutes);
app.use('/',                     openSearchPublicRoutes);
app.use('/',                     seoPublicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handler
app.use(errorHandler);

// Start server
const start = async () => {
  try {
    await connectDB();
    await initAtlasSearch();

    if (process.env.VERCEL) {
      console.log('✅ Server running in serverless mode (Vercel)');
    } else {
      app.listen(config.port, () => {
        console.log(`\n🚀 Fluid Topics API server running on http://localhost:${config.port}`);
        console.log(`📚 Environment: ${config.nodeEnv}`);
        console.log(`🔍 Search: MongoDB Atlas Search (index: ${process.env.ATLAS_SEARCH_INDEX || 'default'})`);
        console.log(`💾 MongoDB: connected\n`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

module.exports = app;
