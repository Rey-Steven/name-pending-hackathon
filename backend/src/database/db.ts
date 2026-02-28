import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');

// Initialize database connection
export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    db.exec(statement + ';');
  }

  console.log('✅ Database initialized successfully');
}

// Helper functions for common operations

export interface Lead {
  id?: number;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  product_interest?: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  annual_revenue?: string;
  lead_score?: 'A' | 'B' | 'C';
  status?: string;
}

export interface Deal {
  id?: number;
  lead_id: number;
  deal_value: number;
  product_name: string;
  quantity?: number;
  subtotal: number;
  fpa_rate?: number;
  fpa_amount: number;
  total_amount: number;
  qualification_result?: string;
  sales_notes?: string;
  status?: string;
}

export interface Task {
  id?: number;
  deal_id?: number;
  lead_id?: number;
  source_agent: 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';
  target_agent: 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';
  task_type: string;
  title: string;
  description?: string;
  input_data?: string;
  output_data?: string;
  error_message?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
}

export interface Invoice {
  id?: number;
  deal_id: number;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  customer_name: string;
  customer_afm: string;
  customer_doy?: string;
  customer_address?: string;
  customer_email?: string;
  line_items: string; // JSON
  subtotal: number;
  fpa_rate?: number;
  fpa_amount: number;
  total_amount: number;
  payment_terms?: string;
  payment_status?: string;
  status?: string;
}

export interface Email {
  id?: number;
  task_id?: number;
  deal_id?: number;
  invoice_id?: number;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  email_type?: 'proposal' | 'invoice' | 'confirmation' | 'follow_up';
  status?: 'pending' | 'sent' | 'failed';
  error_message?: string;
}

export interface LegalValidation {
  id?: number;
  deal_id: number;
  afm_valid?: boolean;
  afm_number?: string;
  company_registry_valid?: boolean;
  gdpr_compliant?: boolean;
  contract_terms_valid?: boolean;
  risk_level?: 'low' | 'medium' | 'high';
  risk_flags?: string; // JSON
  approval_status?: 'pending' | 'approved' | 'rejected' | 'review_required';
  approval_notes?: string;
}

// Lead operations
export const LeadDB = {
  create: (lead: Lead) => {
    const stmt = db.prepare(`
      INSERT INTO leads (company_name, contact_name, contact_email, contact_phone,
                         product_interest, company_website, industry, company_size,
                         annual_revenue, lead_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      lead.company_name,
      lead.contact_name,
      lead.contact_email || null,
      lead.contact_phone || null,
      lead.product_interest || null,
      lead.company_website || null,
      lead.industry || null,
      lead.company_size || null,
      lead.annual_revenue || null,
      lead.lead_score || null,
      lead.status || 'new'
    );
    return result.lastInsertRowid as number;
  },

  findById: (id: number): Lead | undefined => {
    const stmt = db.prepare('SELECT * FROM leads WHERE id = ?');
    return stmt.get(id) as Lead | undefined;
  },

  update: (id: number, updates: Partial<Lead>) => {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`);
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);

    const stmt = db.prepare(`
      UPDATE leads
      SET ${fields.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(...values, id);
  },

  all: (): Lead[] => {
    const stmt = db.prepare('SELECT * FROM leads ORDER BY created_at DESC');
    return stmt.all() as Lead[];
  }
};

// Deal operations
export const DealDB = {
  create: (deal: Deal) => {
    const stmt = db.prepare(`
      INSERT INTO deals (lead_id, deal_value, product_name, quantity, subtotal,
                        fpa_rate, fpa_amount, total_amount, qualification_result,
                        sales_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      deal.lead_id,
      deal.deal_value,
      deal.product_name,
      deal.quantity || 1,
      deal.subtotal,
      deal.fpa_rate || 0.24,
      deal.fpa_amount,
      deal.total_amount,
      deal.qualification_result || null,
      deal.sales_notes || null,
      deal.status || 'pending'
    );
    return result.lastInsertRowid as number;
  },

  findById: (id: number): Deal | undefined => {
    const stmt = db.prepare('SELECT * FROM deals WHERE id = ?');
    return stmt.get(id) as Deal | undefined;
  },

  update: (id: number, updates: Partial<Deal>) => {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`);
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);

    const stmt = db.prepare(`
      UPDATE deals
      SET ${fields.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(...values, id);
  },

  all: (): Deal[] => {
    const stmt = db.prepare('SELECT * FROM deals ORDER BY created_at DESC');
    return stmt.all() as Deal[];
  }
};

// Task operations
export const TaskDB = {
  create: (task: Task) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (deal_id, lead_id, source_agent, target_agent, task_type,
                        title, description, input_data, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      task.deal_id || null,
      task.lead_id || null,
      task.source_agent,
      task.target_agent,
      task.task_type,
      task.title,
      task.description || null,
      task.input_data || null,
      task.status || 'pending',
      task.priority || 0
    );
    return result.lastInsertRowid as number;
  },

  findById: (id: number): Task | undefined => {
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id) as Task | undefined;
  },

  findPending: (targetAgent: string): Task[] => {
    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE target_agent = ? AND status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `);
    return stmt.all(targetAgent) as Task[];
  },

  update: (id: number, updates: Partial<Task>) => {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`);
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);

    const updateFields = fields.join(', ');
    const setCompleted = updates.status === 'completed' ? ', completed_at = datetime(\'now\')' : '';
    const setStarted = updates.status === 'processing' ? ', started_at = datetime(\'now\')' : '';

    const stmt = db.prepare(`
      UPDATE tasks
      SET ${updateFields}${setCompleted}${setStarted}
      WHERE id = ?
    `);
    stmt.run(...values, id);
  },

  all: (): Task[] => {
    const stmt = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
    return stmt.all() as Task[];
  },

  findByDeal: (dealId: number): Task[] => {
    const stmt = db.prepare('SELECT * FROM tasks WHERE deal_id = ? ORDER BY created_at DESC');
    return stmt.all(dealId) as Task[];
  }
};

// Invoice operations
export const InvoiceDB = {
  create: (invoice: Invoice) => {
    const stmt = db.prepare(`
      INSERT INTO invoices (deal_id, invoice_number, invoice_date, due_date,
                          customer_name, customer_afm, customer_doy, customer_address,
                          customer_email, line_items, subtotal, fpa_rate, fpa_amount,
                          total_amount, payment_terms, payment_status, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      invoice.deal_id,
      invoice.invoice_number,
      invoice.invoice_date || null,
      invoice.due_date || null,
      invoice.customer_name,
      invoice.customer_afm,
      invoice.customer_doy || null,
      invoice.customer_address || null,
      invoice.customer_email || null,
      invoice.line_items,
      invoice.subtotal,
      invoice.fpa_rate || 0.24,
      invoice.fpa_amount,
      invoice.total_amount,
      invoice.payment_terms || 'Net 30',
      invoice.payment_status || 'unpaid',
      invoice.status || 'draft'
    );
    return result.lastInsertRowid as number;
  },

  findById: (id: number): Invoice | undefined => {
    const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
    return stmt.get(id) as Invoice | undefined;
  },

  findByDeal: (dealId: number): Invoice | undefined => {
    const stmt = db.prepare('SELECT * FROM invoices WHERE deal_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(dealId) as Invoice | undefined;
  },

  all: (): Invoice[] => {
    const stmt = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC');
    return stmt.all() as Invoice[];
  },

  getNextInvoiceNumber: (): string => {
    const year = new Date().getFullYear();
    const stmt = db.prepare(`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ?
      ORDER BY invoice_number DESC
      LIMIT 1
    `);
    const lastInvoice = stmt.get(`${year}/%`) as { invoice_number: string } | undefined;

    if (!lastInvoice) {
      return `${year}/001`;
    }

    const lastNumber = parseInt(lastInvoice.invoice_number.split('/')[1]);
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `${year}/${nextNumber}`;
  }
};

// Email operations
export const EmailDB = {
  create: (email: Email) => {
    const stmt = db.prepare(`
      INSERT INTO emails (task_id, deal_id, invoice_id, recipient_email, recipient_name,
                         subject, body, email_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      email.task_id || null,
      email.deal_id || null,
      email.invoice_id || null,
      email.recipient_email,
      email.recipient_name,
      email.subject,
      email.body,
      email.email_type || null,
      email.status || 'pending'
    );
    return result.lastInsertRowid as number;
  },

  update: (id: number, updates: Partial<Email>) => {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`);
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);

    const setSent = updates.status === 'sent' ? ', sent_at = datetime(\'now\')' : '';

    const stmt = db.prepare(`
      UPDATE emails
      SET ${fields.join(', ')}${setSent}
      WHERE id = ?
    `);
    stmt.run(...values, id);
  },

  all: (): Email[] => {
    const stmt = db.prepare('SELECT * FROM emails ORDER BY created_at DESC');
    return stmt.all() as Email[];
  }
};

// Legal validation operations
export const LegalValidationDB = {
  create: (validation: LegalValidation) => {
    const stmt = db.prepare(`
      INSERT INTO legal_validations (deal_id, afm_valid, afm_number, company_registry_valid,
                                     gdpr_compliant, contract_terms_valid, risk_level,
                                     risk_flags, approval_status, approval_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      validation.deal_id,
      validation.afm_valid ? 1 : 0,
      validation.afm_number || null,
      validation.company_registry_valid ? 1 : 0,
      validation.gdpr_compliant ? 1 : 0,
      validation.contract_terms_valid ? 1 : 0,
      validation.risk_level || null,
      validation.risk_flags || null,
      validation.approval_status || 'pending',
      validation.approval_notes || null
    );
    return result.lastInsertRowid as number;
  },

  findByDeal: (dealId: number): LegalValidation | undefined => {
    const stmt = db.prepare('SELECT * FROM legal_validations WHERE deal_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(dealId) as LegalValidation | undefined;
  },

  update: (id: number, updates: Partial<LegalValidation>) => {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`);
    const values = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => (updates as any)[k]);

    const setReviewed = updates.approval_status !== 'pending' ? ', reviewed_at = datetime(\'now\')' : '';

    const stmt = db.prepare(`
      UPDATE legal_validations
      SET ${fields.join(', ')}${setReviewed}
      WHERE id = ?
    `);
    stmt.run(...values, id);
  }
};

// Audit log
export const AuditLog = {
  log: (agentType: string, action: string, entityType?: string, entityId?: number, details?: any) => {
    const stmt = db.prepare(`
      INSERT INTO audit_log (agent_type, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      agentType,
      action,
      entityType || null,
      entityId || null,
      details ? JSON.stringify(details) : null
    );
  },

  getRecent: (limit: number = 50): any[] => {
    const stmt = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as any[];
  }
};

// Export database instance and initialization function
export default {
  db,
  initializeDatabase,
  LeadDB,
  DealDB,
  TaskDB,
  InvoiceDB,
  EmailDB,
  LegalValidationDB,
  AuditLog
};
