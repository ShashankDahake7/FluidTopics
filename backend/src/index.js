const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/env');
const connectDB = require('./config/db');
const { initElasticsearch } = require('./config/elasticsearch');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const ingestionRoutes = require('./routes/ingestion');
const searchRoutes = require('./routes/search');
const topicsRoutes = require('./routes/topics');
const analyticsRoutes = require('./routes/analytics');
const recommendationsRoutes = require('./routes/recommendations');
const adminRoutes = require('./routes/admin');
const bookmarkRoutes = require('./routes/bookmarks');
const userRoutes = require('./routes/user');
const designerRoutes = require('./routes/designer');
const portalRoutes   = require('./routes/portal');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
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
app.use('/api/admin', adminRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/user', userRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api/portal',   portalRoutes);

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
    await initElasticsearch();

    app.listen(config.port, () => {
      console.log(`\n🚀 Fluid Topics API server running on http://localhost:${config.port}`);
      console.log(`📚 Environment: ${config.nodeEnv}`);
      console.log(`🔍 Elasticsearch: ${config.elasticsearch.url}`);
      console.log(`💾 MongoDB: connected\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

module.exports = app;
