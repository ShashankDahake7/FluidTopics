const { S3Client } = require('@aws-sdk/client-s3');
const config = require('../../config/env');

// Singleton — every caller (route, worker, orchestrator) shares the same
// underlying connection pool. Endpoint + path-style overrides exist so this
// works against AWS, MinIO and LocalStack without code changes.
let _client = null;

function getS3Client() {
  if (_client) return _client;

  const opts = {
    region: config.s3.region,
    credentials: config.s3.accessKeyId
      ? {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        }
      : undefined, // fall back to default chain (instance role, env, ~/.aws/…)
  };

  if (config.s3.endpoint) {
    opts.endpoint = config.s3.endpoint;
    opts.forcePathStyle = config.s3.forcePathStyle;
  }

  _client = new S3Client(opts);
  return _client;
}

function assertS3Configured() {
  if (!config.s3.rawBucket || !config.s3.extractedBucket) {
    const err = new Error(
      'S3 buckets not configured. Set S3_RAW_BUCKET and S3_EXTRACTED_BUCKET in .env.'
    );
    err.status = 503;
    err.code = 's3_not_configured';
    throw err;
  }
}

module.exports = { getS3Client, assertS3Configured };
