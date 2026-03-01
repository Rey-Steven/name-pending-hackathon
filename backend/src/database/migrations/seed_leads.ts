/**
 * Seed 20 test leads into Firestore under the active company.
 *
 * Run with:
 *   cd backend && npx ts-node --project tsconfig.json src/database/migrations/seed_leads.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getFirestore } from '../firebase';

const CONTACT_NAME = 'Stavros Vasos';
const CONTACT_EMAIL = 'stevenvasos@gmail.com';
const CONTACT_PHONE = '+30 694 0000000';

const LEADS = [
  { company_name: 'Coffee Island',           company_website: 'https://coffeeisland.gr',      product_interest: 'Enterprise Plan' },
  { company_name: 'Lot 51 Restaurant',       company_website: 'https://lot51.gr',             product_interest: 'Standard Plan' },
  { company_name: 'Mikel Coffee Bar',        company_website: 'https://mikel.com.gr',         product_interest: 'Premium Support' },
  { company_name: 'The Burger Lab',          company_website: 'https://burgerlab.gr',         product_interest: 'Standard Plan' },
  { company_name: 'Greco Pizza',             company_website: 'https://grecopizza.gr',         product_interest: 'Entry-Level Plan' },
  { company_name: 'Blue Sea Travel Agency',  company_website: 'https://bluesea-travel.gr',    product_interest: 'Enterprise Plan' },
  { company_name: 'Olympus Fitness Club',    company_website: 'https://olympusfitness.gr',    product_interest: 'Standard Plan' },
  { company_name: 'Athens Dental Studio',    company_website: 'https://athensdentalstudio.gr', product_interest: 'Premium Support' },
  { company_name: 'Neon Nights Lounge',      company_website: 'https://neonnights.gr',        product_interest: 'Standard Plan' },
  { company_name: 'Urban Threads Boutique',  company_website: 'https://urbanthreads.gr',      product_interest: 'Entry-Level Plan' },
  { company_name: 'Golden Harvest Bakery',   company_website: 'https://goldenharvest.gr',     product_interest: 'Standard Plan' },
  { company_name: 'Petros Law Offices',      company_website: 'https://petroslaw.gr',         product_interest: 'Enterprise Plan' },
  { company_name: 'Acropolis Real Estate',   company_website: 'https://acropolisre.gr',       product_interest: 'Premium Support' },
  { company_name: 'Sparta Security Systems', company_website: 'https://spartasecurity.gr',    product_interest: 'Enterprise Plan' },
  { company_name: 'Thessaly Agricultural Co.',company_website: 'https://thessalyagri.gr',     product_interest: 'Standard Plan' },
  { company_name: 'Aegean Shipping Ltd',     company_website: 'https://aegeanshipping.gr',    product_interest: 'Enterprise Plan' },
  { company_name: 'Cyclades Ceramics',       company_website: 'https://cycladesceramics.gr',  product_interest: 'Entry-Level Plan' },
  { company_name: 'Delphi Software Solutions',company_website: 'https://delphisoftware.gr',   product_interest: 'Premium Support' },
  { company_name: 'Hellas Auto Parts',       company_website: 'https://hellasauto.gr',        product_interest: 'Standard Plan' },
  { company_name: 'Ioannina Fresh Market',   company_website: 'https://ioannina-fresh.gr',    product_interest: 'Entry-Level Plan' },
];

async function seedLeads() {
  const fdb = getFirestore();

  // Resolve active company
  const settingsDoc = await fdb.doc('settings/active').get();
  if (!settingsDoc.exists) {
    console.error('❌ No active company found in settings/active. Set up a company first.');
    process.exit(1);
  }
  const companyId = settingsDoc.data()!.active_company_id as string | null;
  if (!companyId) {
    console.error('❌ active_company_id is null. Set up a company first.');
    process.exit(1);
  }

  console.log(`\n🌱 Seeding 20 leads under company: ${companyId}\n`);

  const now = new Date().toISOString();
  const batch = fdb.batch();

  for (const lead of LEADS) {
    const ref = fdb.collection('leads').doc();
    batch.set(ref, {
      company_id: companyId,
      company_name: lead.company_name,
      contact_name: CONTACT_NAME,
      contact_email: CONTACT_EMAIL,
      contact_phone: CONTACT_PHONE,
      product_interest: lead.product_interest,
      company_website: lead.company_website,
      industry: null,
      company_size: null,
      annual_revenue: null,
      lead_score: null,
      status: 'new',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    console.log(`  + ${lead.company_name}`);
  }

  await batch.commit();
  console.log(`\n✅ ${LEADS.length} leads seeded successfully.`);
}

seedLeads().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
