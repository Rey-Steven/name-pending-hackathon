import { initializeDatabase, LeadDB } from './db';

// Greek mock data for demo
const sampleLeads = [
  {
    company_name: 'Κατασκευές Αθηνών ΑΕ',
    contact_name: 'Παναγιώτης Δημητρίου',
    contact_email: 'p.dimitriou@athensconstr.gr',
    contact_phone: '+30 210 1234567',
    product_interest: 'Wholesale building materials',
    company_website: 'https://athensconstr.gr',
  },
  {
    company_name: 'Θεσσαλονίκη Logistics ΕΠΕ',
    contact_name: 'Μαρία Παπαδοπούλου',
    contact_email: 'm.papadopoulou@theslog.gr',
    contact_phone: '+30 2310 987654',
    product_interest: 'Fleet management software',
    company_website: 'https://theslog.gr',
  },
  {
    company_name: 'Κρητικά Τρόφιμα ΙΚΕ',
    contact_name: 'Γιώργος Μανωλάκης',
    contact_email: 'g.manolakis@kritika.gr',
    contact_phone: '+30 2810 555123',
    product_interest: 'Packaging solutions for food export',
  },
  {
    company_name: 'Aegean Tech Solutions ΑΕ',
    contact_name: 'Ελένη Βασιλείου',
    contact_email: 'e.vasileiou@aegeantech.gr',
    contact_phone: '+30 210 7654321',
    product_interest: 'Cloud infrastructure services',
    company_website: 'https://aegeantech.gr',
  },
  {
    company_name: 'Πειραιώς Shipping ΟΕ',
    contact_name: 'Νίκος Καραγιάννης',
    contact_email: 'n.karagiannis@pirship.gr',
    product_interest: 'Marine equipment maintenance',
  },
];

export function seedDatabase() {
  console.log('🌱 Seeding database with Greek mock data...\n');

  initializeDatabase();

  for (const lead of sampleLeads) {
    const id = LeadDB.create(lead);
    console.log(`  ✅ Lead ${id}: ${lead.company_name} (${lead.contact_name})`);
  }

  console.log(`\n🌱 Seeded ${sampleLeads.length} sample leads`);
}

// Run directly if called from CLI
if (require.main === module) {
  seedDatabase();
}
