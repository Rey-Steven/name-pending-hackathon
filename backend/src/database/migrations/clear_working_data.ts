/**
 * Clear all working-data documents from Firebase.
 * Deletes: leads, deals, tasks, invoices, emails, legal_validations, audit_log
 * Leaves company_profiles and settings untouched.
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/clear_working_data.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

const COLLECTIONS = ['leads', 'deals', 'tasks', 'invoices', 'emails', 'legal_validations', 'audit_log'];

async function clearAll() {
  const fdb = getFirestore();
  const BATCH_SIZE = 400;

  for (const col of COLLECTIONS) {
    const snap = await fdb.collection(col).get();
    if (snap.empty) {
      console.log(`  ${col}: already empty`);
      continue;
    }

    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = fdb.batch();
      snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    console.log(`  ${col}: deleted ${snap.docs.length} docs`);
  }

  console.log('\n✅ Clean slate — all working data cleared.');
}

clearAll().catch(err => {
  console.error('Clear failed:', err);
  process.exit(1);
});
