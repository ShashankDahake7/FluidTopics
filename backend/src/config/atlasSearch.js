const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Atlas Search index definitions for the `topics` collection.
//
// These are the source of truth. Edit the JSON here when the Topic model
// changes — the reconciler at the bottom of this file detects drift on
// boot and creates / updates the index in Atlas via the regular MongoDB
// connection (no Atlas Admin API key required).
//
// Drops are deliberately NOT automated — removing an index from the array
// here will NOT delete it from Atlas. If you need to drop one, do it from
// the Atlas UI or call `db.<coll>.dropSearchIndex(name)` explicitly.
// ---------------------------------------------------------------------------

const COLLECTION = 'topics';

const INDEX_DEFINITIONS = [
  {
    name: process.env.ATLAS_SEARCH_INDEX || 'default',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          title: [{ type: 'string' }],
          content: {
            type: 'document',
            fields: {
              text: [{ type: 'string' }],
            },
          },
          metadata: {
            type: 'document',
            fields: {
              tags: [
                { type: 'string' },
                { type: 'token' },
                { type: 'stringFacet' },
              ],
              product:  [{ type: 'token' }, { type: 'stringFacet' }],
              version:  [{ type: 'token' }, { type: 'stringFacet' }],
              language: [{ type: 'token' }, { type: 'stringFacet' }],
              author:   [{ type: 'token' }],
            },
          },
          documentId: [{ type: 'objectId' }],
          hierarchy: {
            type: 'document',
            fields: {
              level: [{ type: 'number', representation: 'int64' }],
            },
          },
          viewCount: [{ type: 'number', representation: 'int64' }],
          createdAt: [{ type: 'date' }],
          updatedAt: [{ type: 'date' }],
        },
      },
    },
  },
  {
    name: process.env.ATLAS_AUTOCOMPLETE_INDEX || 'autocomplete_title',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          title: [{
            type: 'autocomplete',
            tokenization: 'edgeGram',
            minGrams: 2,
            maxGrams: 15,
            foldDiacritics: true,
          }],
        },
      },
    },
  },
];

// Stable serialization for deep-equal so { a: 1, b: 2 } and { b: 2, a: 1 }
// compare equal — Atlas may return fields in a different order than we sent.
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => {
      acc[k] = canonical(v[k]);
      return acc;
    }, {});
  }
  return v;
};
const definitionsEqual = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const initAtlasSearch = async () => {
  if (String(process.env.ATLAS_SEARCH_AUTO_MANAGE || 'true').toLowerCase() === 'false') {
    console.log('ℹ️  ATLAS_SEARCH_AUTO_MANAGE=false — skipping Atlas Search reconciliation');
    return;
  }

  const coll = mongoose.connection.db.collection(COLLECTION);

  let existing;
  try {
    existing = await coll.listSearchIndexes().toArray();
  } catch (err) {
    // Self-hosted Mongo or an Atlas tier without Search support → fail open.
    // Search endpoints will error at query time, which is the right signal.
    console.warn(`⚠️  Atlas Search not available on this cluster: ${err.message}`);
    console.warn('⚠️  Search endpoints will not work. Use MongoDB Atlas (M10+) for production.');
    return;
  }

  const byName = new Map(existing.map((i) => [i.name, i]));

  for (const { name, definition } of INDEX_DEFINITIONS) {
    const found = byName.get(name);

    if (!found) {
      console.log(`• Creating Atlas Search index "${name}"…`);
      try {
        await coll.createSearchIndex({ name, definition });
        console.log(`  ↳ creation queued — Atlas builds asynchronously (status: PENDING → BUILDING → READY)`);
      } catch (err) {
        console.error(`❌ Failed to create "${name}": ${err.message}`);
      }
      continue;
    }

    if (!definitionsEqual(found.latestDefinition, definition)) {
      console.log(`• Updating Atlas Search index "${name}" (definition drift detected)…`);
      try {
        await coll.updateSearchIndex(name, definition);
        console.log(`  ↳ update queued — Atlas rebuilds in the background; queries keep using the old index until the new one is READY`);
      } catch (err) {
        console.error(`❌ Failed to update "${name}": ${err.message}`);
      }
    } else {
      console.log(`✅ Atlas Search index "${name}" up to date (status: ${found.status || 'unknown'})`);
    }
  }
};

module.exports = { initAtlasSearch, INDEX_DEFINITIONS };
