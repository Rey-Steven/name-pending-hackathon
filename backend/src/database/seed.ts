import { initializeDatabase, LeadDB, db } from './db';

// Real email addresses for testing (cycled across leads)
const testEmails = [
  'k.kayioulis@butler.gr',
  's.vasos@butler.gr',
  'kagioulis.kostas@gmail.com',
  'stevenvasos@gmail.com',
  'co.scoo.bydoo@gmail.com',
];

// Real Greek companies from business registry + realistic additions
const sampleLeads = [
  // ── From business registry JSON ──
  {
    company_name: 'UNIQUE CONSTRUCTIONS AND TRADING SERVICES ΜΟΝΟΠΡΟΣΩΠΗ Ι.Κ.Ε.',
    contact_name: 'Κώστας Καγιούλης',
    contact_email: testEmails[0],
    contact_phone: '+30 210 1234567',
  },
  {
    company_name: 'ΖΑΜΠΕΛΗΣ Χ. ΚΑΙ ΠΕΛΕΚΑΝΟΥ Α. Ο.Ε.',
    contact_name: 'Στέφανος Βάσος',
    contact_email: testEmails[1],
    contact_phone: '+30 22860 71234',
  },
  {
    company_name: 'ΕΝΕΡΓΕΙΑΚΗ ΚΟΙΝΟΤΗΤΑ ΔΑΝΑΟΣ ΣΥΝ.Π.Ε.',
    contact_name: 'Δημήτρης Παπαδόπουλος',
    contact_email: testEmails[2],
    contact_phone: '+30 26310 55678',
  },
  {
    company_name: 'ΧΡΙΣΤΟΦΥΛΛΙΔΗΣ ΚΛΕΑΝΘΗΣ ΤΟΥ ΓΕΩΡΓΙΟΥ',
    contact_name: 'Κλεάνθης Χριστοφυλλίδης',
    contact_email: testEmails[3],
    contact_phone: '+30 25210 44321',
  },
  {
    company_name: 'ΤΡΙΑΝΤΑΦΥΛΛΟΥ ΒΑΣΙΛΕΙΟΣ ΤΟΥ ΝΙΚΟΛΑΟΥ',
    contact_name: 'Βασίλειος Τριανταφύλλου',
    contact_email: testEmails[4],
    contact_phone: '+30 210 7654321',
  },
  {
    company_name: 'ΜΑΚΡΗΣ ΣΤΕΦΑΝΟΣ ΤΟΥ ΝΙΚΟΛΑΟΥ',
    contact_name: 'Στέφανος Μακρής',
    contact_email: testEmails[0],
    contact_phone: '+30 24210 78900',
  },
  {
    company_name: 'ΣΑΜΑΡΤΖΙ Λ.-ΚΑΤΣΙΚΕΡΟΣ Κ. Ο.Ε.',
    contact_name: 'Κώστας Κατσίκερος',
    contact_email: testEmails[1],
    contact_phone: '+30 210 5551234',
  },
  {
    company_name: 'ΑΡΓΥΡΙΟΥ ΠΑΡΑΣΚΕΥΗ ΤΟΥ ΓΕΩΡΓΙΟΥ',
    contact_name: 'Παρασκευή Αργυρίου',
    contact_email: testEmails[2],
    contact_phone: '+30 210 3344556',
  },
  {
    company_name: 'ΞΟΡΚΙ-ΚΟΣΜΗΜΑ Ο.Ε.',
    contact_name: 'Ελένη Ξόρκη',
    contact_email: testEmails[3],
    contact_phone: '+30 210 3456789',
  },
  {
    company_name: 'ΚΩΝΣΤΑΝΤΙΝΟΠΟΥΛΟΥ ΕΙΡΗΝΗ ΤΟΥ ΕΥΑΓΓΕΛΟΥ',
    contact_name: 'Ειρήνη Κωνσταντινοπούλου',
    contact_email: testEmails[4],
    contact_phone: '+30 22610 33445',
  },
  {
    company_name: 'SINGH DEWINDER TOY SUCHA',
    contact_name: 'Dewinder Singh',
    contact_email: testEmails[0],
    contact_phone: '+30 22610 99887',
  },
  {
    company_name: 'ΒΕΛΟΓΛΟΥ ΚΩΝΣΤΑΝΤΙΝΟΣ ΤΟΥ ΕΜΜΑΝΟΥΗΛ',
    contact_name: 'Κωνσταντίνος Βελόγλου',
    contact_email: testEmails[1],
    contact_phone: '+30 210 6677889',
  },
  // ── HoReCa businesses (Hotels, Restaurants, Cafés) ──
  {
    company_name: 'ΞΕΝΟΔΟΧΕΙΟ ΑΚΡΟΠΟΛΙΣ ΠΑΛΛΑΣ Α.Ε.',
    contact_name: 'Γεώργιος Σταματίου',
    contact_email: testEmails[2],
    contact_phone: '+30 210 8901234',
  },
  {
    company_name: 'TAVERNA ΘΑΛΑΣΣΙΝΑ ΤΟΥ ΝΙΚΟΥ Ο.Ε.',
    contact_name: 'Νίκος Καλαμάρης',
    contact_email: testEmails[3],
    contact_phone: '+30 2810 667788',
  },
  {
    company_name: 'MYKONOS GRAND RESORT Ι.Κ.Ε.',
    contact_name: 'Αλεξάνδρα Ιωαννίδου',
    contact_email: testEmails[4],
    contact_phone: '+30 22890 71234',
  },
  {
    company_name: 'ΕΣΤΙΑΤΟΡΙΟ ΠΑΡΑΔΟΣΗ Ε.Π.Ε.',
    contact_name: 'Σοφία Δημητρίου',
    contact_email: testEmails[0],
    contact_phone: '+30 2310 112233',
  },
  {
    company_name: 'COFFEE ISLAND FRANCHISE - ΠΑΤΡΑ Ο.Ε.',
    contact_name: 'Παναγιώτης Κουρούσης',
    contact_email: testEmails[1],
    contact_phone: '+30 2610 44556',
  },
  {
    company_name: 'CRETA PALACE HOTELS & RESORTS Α.Ε.',
    contact_name: 'Μαρία Καλλέργη',
    contact_email: testEmails[2],
    contact_phone: '+30 28310 55667',
  },
  {
    company_name: 'ΟΥΖΕΡΙ Ο ΠΛΑΤΑΝΟΣ ΜΟΝΟΠΡΟΣΩΠΗ Ι.Κ.Ε.',
    contact_name: 'Θεόδωρος Παππάς',
    contact_email: testEmails[3],
    contact_phone: '+30 22650 33221',
  },
  {
    company_name: 'SANTORINI BOUTIQUE SUITES Ι.Κ.Ε.',
    contact_name: 'Κατερίνα Σιγάλα',
    contact_email: testEmails[4],
    contact_phone: '+30 22860 33445',
  },
  {
    company_name: 'ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ ΓΛΥΚΙΑ ΣΤΙΓΜΗ Ο.Ε.',
    contact_name: 'Αθανάσιος Γκούντας',
    contact_email: testEmails[0],
    contact_phone: '+30 2310 556677',
  },
  {
    company_name: 'NAXOS BEACH BAR & RESTAURANT Ε.Π.Ε.',
    contact_name: 'Χρήστος Ρόδης',
    contact_email: testEmails[1],
    contact_phone: '+30 22850 44556',
  },
  {
    company_name: 'RHODES PALACE INTERNATIONAL Α.Ε.',
    contact_name: 'Ιωάννα Καστελλοριζού',
    contact_email: testEmails[2],
    contact_phone: '+30 22410 66778',
  },
  {
    company_name: 'CATERING ΓΕΥΣΕΙΣ ΕΛΛΑΔΑΣ Ι.Κ.Ε.',
    contact_name: 'Λάζαρος Δεληγιάννης',
    contact_email: testEmails[3],
    contact_phone: '+30 210 4455667',
  },
  // ── Other industries ──
  {
    company_name: 'ΠΕΛΟΠΟΝΝΗΣΟΣ SOLAR Ι.Κ.Ε.',
    contact_name: 'Νίκος Αναγνωστόπουλος',
    contact_email: testEmails[4],
    contact_phone: '+30 27410 55667',
  },
  {
    company_name: 'ΑΙΓΑΙΟ ΝΑΥΤΙΛΙΑ Ο.Ε.',
    contact_name: 'Μιχάλης Σκαρμούτσος',
    contact_email: testEmails[0],
    contact_phone: '+30 22710 44556',
  },
  {
    company_name: 'ΔΕΛΦΟΙ ΤΕΧΝΟΛΟΓΙΑ Α.Ε.',
    contact_name: 'Δέσποινα Βλαχοπούλου',
    contact_email: testEmails[1],
    contact_phone: '+30 22650 88990',
  },
  {
    company_name: 'ΘΡΑΚΙΚΗ ΕΝΕΡΓΕΙΑ Α.Ε.',
    contact_name: 'Στέλιος Αλεξανδρίδης',
    contact_email: testEmails[2],
    contact_phone: '+30 25310 44556',
  },
  {
    company_name: 'ΚΟΡΙΝΘΙΑΚΟΣ ΑΛΟΥΜΙΝΙΟ Ο.Ε.',
    contact_name: 'Ανδρέας Λουκάς',
    contact_email: testEmails[3],
    contact_phone: '+30 27410 88990',
  },
  {
    company_name: 'ΖΑΚΥΝΘΟΣ OLIVE OIL CO. Ι.Κ.Ε.',
    contact_name: 'Σπύρος Μπότσαρης',
    contact_email: testEmails[4],
    contact_phone: '+30 26950 22334',
  },
];

export function seedDatabase() {
  console.log('🌱 Seeding database with Greek mock data...\n');

  // Drop all tables to ensure schema is fresh (handles column additions)
  db.exec('DROP TABLE IF EXISTS emails');
  db.exec('DROP TABLE IF EXISTS legal_validations');
  db.exec('DROP TABLE IF EXISTS invoices');
  db.exec('DROP TABLE IF EXISTS tasks');
  db.exec('DROP TABLE IF EXISTS deals');
  db.exec('DROP TABLE IF EXISTS leads');
  db.exec('DROP TABLE IF EXISTS audit_log');
  db.exec("DELETE FROM sqlite_sequence");

  // Recreate all tables from schema
  initializeDatabase();

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
