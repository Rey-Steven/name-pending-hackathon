-- Leads table (Marketing Agent)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  product_interest TEXT,
  company_website TEXT,
  -- Enriched data from Marketing Agent
  industry TEXT,
  company_size TEXT,
  annual_revenue TEXT,
  lead_score TEXT CHECK(lead_score IN ('A', 'B', 'C')),
  -- Metadata
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'qualified', 'contacted', 'converted', 'rejected')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Deals table (Sales Agent)
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  -- Deal details
  deal_value REAL NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  -- Pricing
  subtotal REAL NOT NULL,
  fpa_rate REAL DEFAULT 0.24,
  fpa_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  -- Sales decision
  qualification_result TEXT,
  sales_notes TEXT,
  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'proposal_sent', 'negotiating', 'legal_review', 'invoicing', 'completed', 'failed')),
  negotiation_round INTEGER DEFAULT 0,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Tasks table (Agent coordination)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER,
  lead_id INTEGER,
  -- Task routing
  source_agent TEXT NOT NULL CHECK(source_agent IN ('marketing', 'sales', 'legal', 'accounting', 'email')),
  target_agent TEXT NOT NULL CHECK(target_agent IN ('marketing', 'sales', 'legal', 'accounting', 'email')),
  task_type TEXT NOT NULL,
  -- Task data
  title TEXT NOT NULL,
  description TEXT,
  input_data TEXT, -- JSON
  output_data TEXT, -- JSON
  error_message TEXT,
  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (deal_id) REFERENCES deals(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Invoices table (Accounting Agent)
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date TEXT DEFAULT (date('now')),
  due_date TEXT,
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_afm TEXT NOT NULL,
  customer_doy TEXT,
  customer_address TEXT,
  customer_email TEXT,
  -- Line items (simplified - could be separate table)
  line_items TEXT NOT NULL, -- JSON array
  -- Amounts
  subtotal REAL NOT NULL,
  fpa_rate REAL DEFAULT 0.24,
  fpa_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  -- Payment
  payment_terms TEXT DEFAULT 'Net 30',
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'overdue')),
  paid_at TEXT,
  -- Status
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'paid', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- Emails table (Email Notifications)
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  deal_id INTEGER,
  invoice_id INTEGER,
  -- Email details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  email_type TEXT CHECK(email_type IN ('proposal', 'counter_offer', 'invoice', 'confirmation', 'follow_up', 'closing')),
  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  sent_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Audit log (tracks all agent actions)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT, -- 'lead', 'deal', 'task', 'invoice', 'email'
  entity_id INTEGER,
  details TEXT, -- JSON
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Legal validations table (Legal Agent)
CREATE TABLE IF NOT EXISTS legal_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  -- Validation checks
  afm_valid BOOLEAN DEFAULT 0,
  afm_number TEXT,
  company_registry_valid BOOLEAN DEFAULT 0,
  gdpr_compliant BOOLEAN DEFAULT 0,
  contract_terms_valid BOOLEAN DEFAULT 0,
  -- Risk assessment
  risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')),
  risk_flags TEXT, -- JSON array
  -- Decision
  approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected', 'review_required')),
  approval_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- Company profile (single-tenant: one row per installation)
CREATE TABLE IF NOT EXISTS company_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website TEXT,
  logo_path TEXT,
  industry TEXT,
  description TEXT,
  business_model TEXT,
  target_customers TEXT,
  products_services TEXT,
  geographic_focus TEXT,
  user_provided_text TEXT,
  raw_scraped_data TEXT,
  agent_context_json TEXT NOT NULL DEFAULT '{}',
  setup_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_target_agent ON tasks(target_agent, status);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_legal_validations_deal_id ON legal_validations(deal_id);
