/**
 * Initialize a fresh Firestore database with default settings.
 *
 * Safe to run on an existing database — uses set() with merge so it won't
 * overwrite values that were already customized.
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/init_db.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

async function main() {
  const db = getFirestore();

  console.log('🔧 Initializing Firestore database...\n');

  // ── 1. App Settings ────────────────────────────────────────────────────────
  const defaultSettings = {
    reply_poll_interval_minutes: 30,
    stale_lead_days: 7,
    max_followup_attempts: 3,
    lost_deal_reopen_days: 60,
    satisfaction_email_days: 3,
    max_offer_rounds: 3,
  };

  await db.doc('settings/app').set(defaultSettings, { merge: true });
  console.log('✅ settings/app — default app settings written');

  // ── 2. Counters ────────────────────────────────────────────────────────────
  // Invoice counter for the current year — starts at 0 (first invoice = INV-YYYY-0001)
  const year = new Date().getFullYear();
  const counterRef = db.doc(`counters/invoices_${year}`);
  const counterSnap = await counterRef.get();
  if (!counterSnap.exists) {
    await counterRef.set({ count: 0 });
    console.log(`✅ counters/invoices_${year} — invoice counter initialized`);
  } else {
    console.log(`⏭️  counters/invoices_${year} — already exists (count: ${counterSnap.data()!.count}), skipped`);
  }

  console.log('\n✅ Database initialization complete.');
  console.log('\nNext step: open the app and complete the Company Setup wizard.');
  console.log('That will create settings/active and your company_profiles document.\n');
}

main().catch((err) => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
