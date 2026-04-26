#!/usr/bin/env node
/**
 * One-shot script: reindex every Topic from MongoDB into Elasticsearch.
 *
 * Usage (from project root):
 *   node backend/src/scripts/reindex.js
 */
const mongoose = require('mongoose');
const config = require('../config/env');
const { initElasticsearch, getElasticClient } = require('../config/elasticsearch');
const Topic = require('../models/Topic');
const { indexTopics } = require('../services/search/indexingService');

const BATCH = 250;

async function main() {
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  console.log('• Connecting to MongoDB…');
  await mongoose.connect(config.mongodbUri);

  console.log('• Initializing Elasticsearch…');
  await initElasticsearch();

  // Wipe the index first so stale docs disappear
  const client = getElasticClient();
  console.log('• Clearing existing index docs…');
  await client.deleteByQuery({
    index: config.elasticsearch.index,
    body: { query: { match_all: {} } },
    refresh: true,
  });

  const total = await Topic.countDocuments();
  console.log(`• Reindexing ${total} topics in batches of ${BATCH}…`);

  let processed = 0;
  const cursor = Topic.find({}).lean().cursor();
  let buffer = [];
  for await (const t of cursor) {
    buffer.push(t);
    if (buffer.length >= BATCH) {
      await indexTopics(buffer);
      processed += buffer.length;
      console.log(`  …${processed}/${total}`);
      buffer = [];
    }
  }
  if (buffer.length) {
    await indexTopics(buffer);
    processed += buffer.length;
  }

  console.log(`✓ Reindexed ${processed} topics`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Reindex failed:', err);
  process.exit(1);
});
