/**
 * Migration 003 — Backfill company_id on all working-data documents
 *
 * Adds `company_id` to every document in: leads, deals, tasks, invoices,
 * emails, legal_validations — using the active company from settings/active.
 *
 * Idempotent: skips documents that already have a non-null company_id.
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/003_add_company_id.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

const COLLECTIONS = ['leads', 'deals', 'tasks', 'invoices', 'emails', 'legal_validations'];

async function migrate() {
  const fdb = getFirestore();

  // Get the active company ID
  const settingsDoc = await fdb.doc('settings/active').get();
  if (!settingsDoc.exists) {
    console.log('❌ No settings/active found. Run migration 002 first.');
    process.exit(1);
  }
  const activeCompanyId = settingsDoc.data()!.active_company_id as string | null;
  if (!activeCompanyId) {
    console.log('❌ settings/active.active_company_id is null. Set up a company first.');
    process.exit(1);
  }

  console.log(`✅ Active company ID: ${activeCompanyId}`);
  console.log('Backfilling company_id on all working-data collections...\n');

  let totalUpdated = 0;

  for (const collection of COLLECTIONS) {
    const snap = await fdb.collection(collection).get();
    const toUpdate = snap.docs.filter(d => !d.data().company_id);

    if (toUpdate.length === 0) {
      console.log(`  ${collection}: already up-to-date (0 docs to update)`);
      continue;
    }

    // Firestore batch can handle up to 500 writes at a time
    const BATCH_SIZE = 400;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = fdb.batch();
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);
      for (const doc of chunk) {
        batch.update(doc.ref, { company_id: activeCompanyId });
      }
      await batch.commit();
    }

    console.log(`  ${collection}: updated ${toUpdate.length} docs`);
    totalUpdated += toUpdate.length;
  }

  console.log(`\n✅ Migration 003 complete — ${totalUpdated} documents updated.`);
}

migrate().catch(err => {
  console.error('Migration 003 failed:', err);
  process.exit(1);
});
