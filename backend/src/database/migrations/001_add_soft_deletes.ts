/**
 * Migration 001 — Add soft deletes
 *
 * Backfills `deleted_at: null` on every existing document in all data
 * collections so that the soft-delete filter in db.ts works correctly
 * for pre-migration records.
 *
 * Safe to run multiple times (skips docs that already have the field).
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/001_add_soft_deletes.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

const DATA_COLLECTIONS = [
  'leads',
  'deals',
  'tasks',
  'invoices',
  'emails',
  'legal_validations',
];

async function migrate() {
  const db = getFirestore();

  for (const collectionName of DATA_COLLECTIONS) {
    const snap = await db.collection(collectionName).get();

    if (snap.empty) {
      console.log(`  ${collectionName}: empty — skipped`);
      continue;
    }

    // Only patch docs that don't yet have the field
    const needsPatch = snap.docs.filter(d => !('deleted_at' in d.data()));

    if (needsPatch.length === 0) {
      console.log(`  ${collectionName}: ${snap.size} docs already migrated`);
      continue;
    }

    // Commit in batches of 500 (Firestore limit)
    const chunks: typeof needsPatch[] = [];
    for (let i = 0; i < needsPatch.length; i += 500) {
      chunks.push(needsPatch.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(d => batch.update(d.ref, { deleted_at: null }));
      await batch.commit();
    }

    console.log(`  ${collectionName}: patched ${needsPatch.length} / ${snap.size} docs`);
  }

  console.log('\nMigration 001 complete.');
}

migrate().then(() => process.exit(0)).catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
