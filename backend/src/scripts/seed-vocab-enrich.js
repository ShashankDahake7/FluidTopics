/**
 * Seed script for Vocabulary, Enrich and Clean demo.
 * 
 * Run with:
 *   node src/scripts/seed-vocab-enrich.js
 */
require('../config/env');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Vocabulary = require('../models/Vocabulary');
const VocabularyTerm = require('../models/VocabularyTerm');
const EnrichRule = require('../models/EnrichRule');
const MetadataKey = require('../models/MetadataKey');

async function main() {
  await connectDB();

  console.log('🌱 Seeding Vocabulary, Enrich and Clean demo data...');

  // 1. Create a Metadata Key
  let mk = await MetadataKey.findOne({ name: 'product' });
  if (!mk) {
    mk = await MetadataKey.create({
      name: 'product',
      displayName: 'Product',
      isIndexed: true,
      manual: true,
      valuesSample: ['Fluid Topics', 'Darwinbox']
    });
    console.log('✅ Created MetadataKey: product');
  }

  // 2. Create a Vocabulary
  let vocab = await Vocabulary.findOne({ name: 'products' });
  if (!vocab) {
    vocab = await Vocabulary.create({
      name: 'products',
      displayName: 'Products Vocabulary',
      format: 'csv',
      sourceFilename: 'demo-products.csv',
      languages: ['en'],
      usedInSearch: true,
      status: 'ready',
      termCount: 2,
      updatedSinceReprocess: false
    });
    console.log('✅ Created Vocabulary: products');
  }

  // 3. Create Vocabulary Terms
  const terms = [
    {
      vocabularyId: vocab._id,
      termId: 'ft',
      language: 'en',
      prefLabel: 'Fluid Topics',
      altLabels: ['FT', 'FluidTopics', 'Knowledge Hub']
    },
    {
      vocabularyId: vocab._id,
      termId: 'db',
      language: 'en',
      prefLabel: 'Darwinbox',
      altLabels: ['DB', 'Darwin', 'HCM']
    }
  ];

  for (const t of terms) {
    await VocabularyTerm.findOneAndUpdate(
      { vocabularyId: t.vocabularyId, termId: t.termId, language: t.language },
      t,
      { upsert: true }
    );
  }
  console.log('✅ Created Vocabulary Terms');

  // 4. Create Enrichment Rule
  const enrichRule = await EnrichRule.findOne({ metadataKey: 'product', type: 'enrich' });
  if (!enrichRule) {
    await EnrichRule.create({
      metadataKey: 'product',
      type: 'enrich',
      config: {
        vocabularyId: vocab._id.toString()
      },
      priority: 10,
      scope: 'all',
      enabled: true
    });
    console.log('✅ Created Enrichment Rule');
  }

  // 5. Create Cleaning Rule (Trim)
  const cleanRule = await EnrichRule.findOne({ metadataKey: 'product', type: 'clean' });
  if (!cleanRule) {
    await EnrichRule.create({
      metadataKey: 'product',
      type: 'clean',
      config: {},
      priority: 5, // Runs before enrich
      scope: 'all',
      enabled: true
    });
    console.log('✅ Created Cleaning Rule (Trim)');
  }

  console.log('✨ Seeding complete!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Seeding failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
