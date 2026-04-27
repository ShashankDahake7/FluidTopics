const path = require('path');
const fs = require('fs');

// Try multiple .env locations
const envPaths = [
  path.resolve(__dirname, '../../../.env'),  // from backend/src/config/ → project root
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

const config = {
  port: process.env.BACKEND_PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  atlasSearch: {
    // Names of the Atlas Search indexes defined on the `topics` collection.
    // See backend/ATLAS_SEARCH.md for the index JSON to paste into the
    // Atlas UI / API.
    index:             process.env.ATLAS_SEARCH_INDEX        || 'default',
    autocompleteIndex: process.env.ATLAS_AUTOCOMPLETE_INDEX  || 'autocomplete_title',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
  },
  s3: {
    // Accept either the AWS-canonical names (AWS_*) or the project-scoped
    // overrides (S3_*) so .env files written for either convention work
    // out-of-the-box. The S3_* values win when both are set.
    region:          process.env.S3_REGION          || process.env.AWS_REGION          || 'us-east-1',
    accessKeyId:     process.env.S3_ACCESS_KEY_ID   || process.env.AWS_ACCESS_KEY_ID   || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    // S3_RAW_BUCKET is the canonical name in our code; S3_UPLOAD_BUCKET is
    // accepted as an alias so AWS-console-style naming ("upload bucket") also
    // works.
    rawBucket:       process.env.S3_RAW_BUCKET      || process.env.S3_UPLOAD_BUCKET    || '',
    extractedBucket: process.env.S3_EXTRACTED_BUCKET || '',
    endpoint:        process.env.S3_ENDPOINT || '',
    forcePathStyle:  String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
    presignExpires:  parseInt(process.env.S3_PRESIGN_EXPIRES, 10) || 900,
  },
  publishing: {
    // Cap on a single extracted zip-entry. Anything over this aborts the
    // extraction and is logged as `entry_too_large`.
    maxEntryBytes: parseInt(process.env.PUBLISH_MAX_ENTRY_BYTES, 10) || 1073741824,
  },
};

module.exports = config;
