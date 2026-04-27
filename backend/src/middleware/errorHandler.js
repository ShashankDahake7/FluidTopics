const config = require('../config/env');

// Translate raw bytes into a human MB string for the multer 413 message so we
// don't have to keep it in sync with MAX_FILE_SIZE manually.
function formatLimit(bytes) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

const errorHandler = (err, req, res, next) => {
  console.error(`❌ Error: ${err.message}`);
  if (err.stack && process.env.NODE_ENV !== 'production') console.error(err.stack);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation Error', details: messages });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `File too large. Maximum size is ${formatLimit(config.upload.maxFileSize)}.`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({
        error: 'Malformed multipart body. The upload may have been truncated by a proxy.',
      });
    }
    return res.status(400).json({ error: err.message });
  }

  // Surface explicit S3-not-configured / role / status errors set by handlers.
  if (err.status && Number.isInteger(err.status)) {
    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? (err.message || 'Internal server error') : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
