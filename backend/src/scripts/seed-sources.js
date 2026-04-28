/**
 * One-off: seed the eight default Sources that the original mock UI used to
 * hard-code, then back-fill `Publication.sourceId` for any pre-existing
 * publications by matching the historical `sourceLabel` against the
 * canonical Source.sourceId / Source.name.
 *
 * Run with:
 *
 *   node src/scripts/seed-sources.js
 *
 * Idempotent — re-running will skip sources that already exist (matched by
 * sourceId) and will only back-fill publications that are still missing a
 * sourceId ref.
 */
require('../config/env');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Source = require('../models/Source');
const Publication = require('../models/Publication');

const DEFAULT_SOURCES = [
  { sourceId: 'dita',        name: 'DITA',       type: 'Dita',                  category: '',           description: 'Default DITA source' },
  { sourceId: 'ud',          name: 'UD',         type: 'UnstructuredDocuments', category: '',           description: 'Default Unstructured Document source' },
  { sourceId: 'ait',         name: 'Author-it',  type: 'Authorit',              category: '',           description: 'Default Author-It source' },
  { sourceId: 'ftml',        name: 'FTML',       type: 'Ftml',                  category: '',           description: 'Default FTML source' },
  { sourceId: 'Paligo',      name: 'Paligo',     type: 'Paligo',                category: '',           description: '' },
  { sourceId: 'Confluence',  name: 'Confluence', type: 'Confluence',            category: 'Confluence', description: '' },
  { sourceId: 'PDF_open',    name: 'PDF_open',   type: 'UnstructuredDocuments', category: '',           description: 'PDFs that do not need authentication.' },
  { sourceId: 'Docebo_help', name: 'docebo',     type: 'ExternalDocument',      category: 'external source', description: 'Docebo Help' },
];

async function main() {
  await connectDB();

  let created = 0;
  let skipped = 0;
  for (const tpl of DEFAULT_SOURCES) {
    const existing = await Source.findOne({ sourceId: tpl.sourceId }).lean();
    if (existing) { skipped += 1; continue; }
    await Source.create({
      sourceId: tpl.sourceId,
      name: tpl.name,
      type: tpl.type,
      category: tpl.category,
      description: tpl.description,
      installationStatus: 'installed',
      permissions: { mode: 'admins', userIds: [], apiKeyHints: [] },
    });
    created += 1;
  }

  console.log(`✅ Sources: created ${created}, skipped ${skipped} (already existed)`);

  // Back-fill the Publication.sourceId ref on legacy rows. We try
  // `sourceLabel` against both the canonical `Source.sourceId` and
  // `Source.name` because the historical free-form label could have been
  // either, depending on which version of the UI uploaded it.
  const allSources = await Source.find({}).lean();
  let backfilled = 0;
  for (const s of allSources) {
    const filter = {
      sourceId: null,
      $or: [{ sourceLabel: s.sourceId }, { sourceLabel: s.name }],
    };
    const r = await Publication.updateMany(filter, {
      $set: { sourceId: s._id, sourceLabel: s.name },
    });
    backfilled += r.modifiedCount || 0;
  }
  console.log(`✅ Publications back-filled with sourceId ref: ${backfilled}`);

  const orphaned = await Publication.countDocuments({ sourceId: null });
  if (orphaned > 0) {
    console.log(`ℹ️  ${orphaned} publication(s) still have no sourceId — their sourceLabel didn't match any Source. They'll keep displaying their legacy label.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ seed-sources failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
