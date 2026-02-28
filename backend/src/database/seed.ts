import { initializeDatabase, LeadDB, db } from './db';

// Greek mock data with REAL email addresses for testing
const sampleLeads = [
  {
    company_name: 'Κατασκευές Αθηνών ΑΕ',
    contact_name: 'Κώστας Καγιούλης',
    contact_email: 'k.kayioulis@butler.gr',
    contact_phone: '+30 210 1234567',
    product_interest: 'Wholesale building materials',
    company_website: 'https://butler.gr',
  },
  {
    company_name: 'Θεσσαλονίκη Logistics ΕΠΕ',
    contact_name: 'Στέφανος Βάσος',
    contact_email: 's.vasos@butler.gr',
    contact_phone: '+30 2310 987654',
    product_interest: 'Fleet management software',
    company_website: 'https://butler.gr',
  },
  {
    company_name: 'Κρητικά Τρόφιμα ΙΚΕ',
    contact_name: 'Κώστας Καγιούλης',
    contact_email: 'kagioulis.kostas@gmail.com',
    contact_phone: '+30 2810 555123',
    product_interest: 'Packaging solutions for food export',
  },
  {
    company_name: 'Aegean Tech Solutions ΑΕ',
    contact_name: 'Στέφανος Βάσος',
    contact_email: 'stevenvasos@gmail.com',
    contact_phone: '+30 210 7654321',
    product_interest: 'Cloud infrastructure services',
    company_website: 'https://aegeantech.gr',
  },
  {
    company_name: 'Πειραιώς Shipping ΟΕ',
    contact_name: 'Scooby Doo',
    contact_email: 'co.scoo.bydoo@gmail.com',
    product_interest: 'Marine equipment maintenance',
  },
];

export function seedDatabase() {
  console.log('🌱 Seeding database with Greek mock data...\n');

  initializeDatabase();

  // Clear all data and reset auto-increment counters
  db.exec('DELETE FROM emails');
  db.exec('DELETE FROM legal_validations');
  db.exec('DELETE FROM invoices');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM deals');
  db.exec('DELETE FROM leads');
  db.exec('DELETE FROM audit_log');
  db.exec("DELETE FROM sqlite_sequence");

  for (const lead of sampleLeads) {
    const id = LeadDB.create(lead);
    console.log(`  ✅ Lead ${id}: ${lead.company_name} (${lead.contact_name}) → ${lead.contact_email}`);
  }

  console.log(`\n🌱 Seeded ${sampleLeads.length} sample leads`);
}

// Run directly if called from CLI
if (require.main === module) {
  seedDatabase();
}
