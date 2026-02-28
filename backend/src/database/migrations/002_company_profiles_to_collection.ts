/**
 * Migration 002 — company_profiles/main → collection
 *
 * Moves the singleton `company_profiles/main` document to a randomly-generated
 * document ID inside the `company_profiles/` collection, then creates
 * `settings/active` pointing at the new document.
 *
 * Idempotent: if `settings/active` already exists the migration is skipped.
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/002_company_profiles_to_collection.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

async function migrate() {
  const db = getFirestore();

  // Check if already migrated
  const settingsDoc = await db.doc('settings/active').get();
  if (settingsDoc.exists && settingsDoc.data()!.active_company_id) {
    console.log('settings/active already exists — migration already applied, skipping.');
    return;
  }

  const mainDoc = await db.doc('company_profiles/main').get();
  if (!mainDoc.exists || mainDoc.data()!.deleted_at) {
    console.log('company_profiles/main not found or already deleted — nothing to migrate.');
    // Still ensure settings/active exists even if empty
    if (!settingsDoc.exists) {
      await db.doc('settings/active').set({ active_company_id: null });
      console.log('Created empty settings/active.');
    }
    return;
  }

  const data = mainDoc.data()!;
  const now = new Date().toISOString();

  // Write to new auto-ID doc
  const newRef = await db.collection('company_profiles').add({
    ...data,
    deleted_at: null,
    updated_at: data.updated_at || now,
    created_at: data.created_at || now,
  });
  console.log(`Created company_profiles/${newRef.id}`);

  // Set as active
  await db.doc('settings/active').set({ active_company_id: newRef.id });
  console.log(`Set settings/active.active_company_id = ${newRef.id}`);

  // Soft-delete the old /main doc
  await db.doc('company_profiles/main').update({ deleted_at: now });
  console.log('Soft-deleted company_profiles/main');

  console.log('\nMigration 002 complete.');
}

migrate().then(() => process.exit(0)).catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
