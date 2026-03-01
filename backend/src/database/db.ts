import * as admin from 'firebase-admin';
import { getFirestore } from './firebase';

const fdb = () => getFirestore();

// ─── Helpers ──────────────────────────────────────────────────

// Soft-deleted docs (deleted_at is a non-null string) are treated as non-existent.
function docToObj<T>(doc: admin.firestore.DocumentSnapshot): T | undefined {
  if (!doc.exists) return undefined;
  const data = doc.data()!;
  if (data.deleted_at) return undefined;
  return { id: doc.id, ...data } as T;
}

function snapToDocs<T>(snap: admin.firestore.QuerySnapshot): T[] {
  return snap.docs
    .filter(d => !d.data().deleted_at)
    .map(d => ({ id: d.id, ...d.data() })) as T[];
}

async function softDeleteDoc(collection: string, id: string): Promise<void> {
  await fdb().collection(collection).doc(id).update({
    deleted_at: new Date().toISOString(),
  });
}

// Count documents in a collection with optional status filter (much cheaper than fetching full docs)
async function countDocs(collection: string, companyId: string, status?: string): Promise<number> {
  let query: FirebaseFirestore.Query = fdb().collection(collection)
    .where('company_id', '==', companyId)
    .where('deleted_at', '==', null);
  if (status) query = query.where('status', '==', status);
  const snap = await query.count().get();
  return snap.data().count;
}

// ─── Interfaces ───────────────────────────────────────────────

export interface Lead {
  id?: string;
  company_id?: string;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  vat_id?: string;
  gemi_number?: string;
  tax_office?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  legal_form?: string;
  product_interest?: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  annual_revenue?: string;
  lead_score?: 'A' | 'B' | 'C';
  lead_profile?: string | null;  // JSON: agent-built profile, updated after each reply
  status?: string;
  elorus_contact_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Deal {
  id?: string;
  company_id?: string;
  lead_id: string;
  deal_value: number;
  product_name: string;
  quantity?: number;
  subtotal: number;
  fpa_rate?: number;
  fpa_amount: number;
  total_amount: number;
  qualification_result?: string;
  sales_notes?: string;
  negotiation_round?: number;
  follow_up_count?: number;
  satisfaction_sent?: boolean;
  status?: string;
  elorus_estimate_id?: string;
  elorus_invoice_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Task {
  id?: string;
  company_id?: string;
  deal_id?: string;
  lead_id?: string;
  source_agent: 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';
  target_agent: 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';
  task_type: string;
  title: string;
  description?: string;
  input_data?: string;
  output_data?: string;
  error_message?: string;
  logs?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  deleted_at?: string | null;
}

export interface Invoice {
  id?: string;
  company_id?: string;
  deal_id: string;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  customer_name: string;
  customer_afm: string;
  customer_doy?: string;
  customer_address?: string;
  customer_email?: string;
  line_items: string; // JSON string
  subtotal: number;
  fpa_rate?: number;
  fpa_amount: number;
  total_amount: number;
  payment_terms?: string;
  payment_status?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Email {
  id?: string;
  company_id?: string;
  task_id?: string;
  deal_id?: string;
  invoice_id?: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  email_type?: 'proposal' | 'invoice' | 'confirmation' | 'follow_up' | 'satisfaction' | 'cold_outreach';
  direction?: 'outbound' | 'inbound';
  message_id?: string;
  sender_email?: string;
  status?: 'pending' | 'sent' | 'failed';
  error_message?: string;
  created_at?: string;
  sent_at?: string;
  deleted_at?: string | null;
}

export interface LegalValidation {
  id?: string;
  company_id?: string;
  deal_id: string;
  afm_valid?: boolean;
  afm_number?: string;
  company_registry_valid?: boolean;
  gdpr_compliant?: boolean;
  contract_terms_valid?: boolean;
  risk_level?: 'low' | 'medium' | 'high';
  risk_flags?: string; // JSON string
  approval_status?: 'pending' | 'approved' | 'rejected' | 'review_required';
  approval_notes?: string;
  reviewed_at?: string;
  created_at?: string;
  deleted_at?: string | null;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  website?: string;
  logo_path?: string;
  industry?: string;
  description?: string;
  business_model?: string;
  target_customers?: string;
  products_services?: string;
  geographic_focus?: string;
  user_provided_text?: string;
  raw_scraped_data?: string;
  agent_context_json: string; // JSON string
  setup_complete?: boolean;
  kad_codes?: string;              // JSON: [{ code: "6201", description: "..." }]
  help_center_json?: string;       // JSON: { intro: string, faqs: [{question, answer}] }
  // Richer AI context fields
  pricing_model?: string;          // 'one_time' | 'subscription' | 'project_based' | 'hourly' | 'retainer'
  min_deal_value?: number;         // typical minimum deal value in EUR
  max_deal_value?: number;         // typical maximum deal value in EUR
  key_products?: string;           // JSON: [{ name, description, price? }]
  unique_selling_points?: string;  // free-text bullet points
  communication_language?: string; // 'Greek' | 'English' | 'Greek and English'
  terms_of_service?: string | null; // Plain-text standard service agreement template (AI-generated at setup)
  gemi_number?: string;            // GEMI registry number (e.g. "123456703000")
  elorus_api_key?: string;         // Elorus API key (per-company)
  elorus_organization_id?: string; // Elorus organization ID (per-company)
  elorus_base_url?: string;        // Elorus web base URL (e.g. https://demo-xxx.elorus.com)
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// ─── Lead Operations ──────────────────────────────────────────

export const LeadDB = {
  create: async (lead: Lead): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('leads').add({
      company_id: lead.company_id || null,
      company_name: lead.company_name,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email || null,
      contact_phone: lead.contact_phone || null,
      vat_id: lead.vat_id || null,
      gemi_number: lead.gemi_number || null,
      tax_office: lead.tax_office || null,
      address: lead.address || null,
      city: lead.city || null,
      postal_code: lead.postal_code || null,
      legal_form: lead.legal_form || null,
      product_interest: lead.product_interest || null,
      company_website: lead.company_website || null,
      industry: lead.industry || null,
      company_size: lead.company_size || null,
      annual_revenue: lead.annual_revenue || null,
      lead_score: lead.lead_score || null,
      lead_profile: lead.lead_profile || null,
      status: lead.status || 'new',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<Lead | undefined> => {
    const doc = await fdb().collection('leads').doc(id).get();
    return docToObj<Lead>(doc);
  },

  update: async (id: string, updates: Partial<Lead>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    await fdb().collection('leads').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('leads', id),

  all: async (companyId: string): Promise<Lead[]> => {
    const snap = await fdb().collection('leads')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
  },
};

// ─── Deal Operations ──────────────────────────────────────────

export const DealDB = {
  create: async (deal: Deal): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('deals').add({
      company_id: deal.company_id || null,
      lead_id: deal.lead_id,
      deal_value: deal.deal_value,
      product_name: deal.product_name,
      quantity: deal.quantity || 1,
      subtotal: deal.subtotal,
      fpa_rate: deal.fpa_rate || 0.24,
      fpa_amount: deal.fpa_amount,
      total_amount: deal.total_amount,
      qualification_result: deal.qualification_result || null,
      sales_notes: deal.sales_notes || null,
      negotiation_round: deal.negotiation_round || 0,
      status: deal.status || 'pending',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<Deal | undefined> => {
    const doc = await fdb().collection('deals').doc(id).get();
    return docToObj<Deal>(doc);
  },

  update: async (id: string, updates: Partial<Deal>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    await fdb().collection('deals').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('deals', id),

  all: async (companyId: string): Promise<Deal[]> => {
    const snap = await fdb().collection('deals')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Deal[];
  },

  findByStatus: async (statuses: string[], companyId: string): Promise<Deal[]> => {
    const snap = await fdb().collection('deals')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .where('status', 'in', statuses)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Deal[];
  },
};

// ─── Task Operations ──────────────────────────────────────────

export const TaskDB = {
  create: async (task: Task): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('tasks').add({
      company_id: task.company_id || null,
      deal_id: task.deal_id || null,
      lead_id: task.lead_id || null,
      source_agent: task.source_agent,
      target_agent: task.target_agent,
      task_type: task.task_type,
      title: task.title,
      description: task.description || null,
      input_data: task.input_data || null,
      output_data: null,
      error_message: null,
      logs: null,
      status: task.status || 'pending',
      priority: task.priority || 0,
      created_at: now,
      started_at: null,
      completed_at: null,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<Task | undefined> => {
    const doc = await fdb().collection('tasks').doc(id).get();
    return docToObj<Task>(doc);
  },

  findPending: async (targetAgent: string, companyId: string): Promise<Task[]> => {
    const snap = await fdb().collection('tasks')
      .where('target_agent', '==', targetAgent)
      .where('company_id', '==', companyId)
      .where('status', '==', 'pending')
      .where('deleted_at', '==', null)
      .get();
    return (snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[])
      .sort((a, b) => {
        const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
        if (pDiff !== 0) return pDiff;
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
  },

  update: async (id: string, updates: Partial<Task>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    const data: any = { ...rest };
    if (data.status === 'processing') data.started_at = new Date().toISOString();
    if (data.status === 'completed') data.completed_at = new Date().toISOString();
    await fdb().collection('tasks').doc(id).update(data);
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('tasks', id),

  all: async (companyId: string): Promise<Task[]> => {
    const snap = await fdb().collection('tasks')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
  },

  findByDeal: async (dealId: string): Promise<Task[]> => {
    const snap = await fdb().collection('tasks')
      .where('deal_id', '==', dealId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
  },

  // Find tasks stuck in pending/processing older than the given threshold (ms).
  // Uses created_at for pending tasks, started_at (fallback: created_at) for processing tasks.
  findStale: async (pendingThresholdMs: number, processingThresholdMs: number): Promise<Task[]> => {
    const snap = await fdb().collection('tasks')
      .where('deleted_at', '==', null)
      .where('status', 'in', ['pending', 'processing'])
      .get();
    const pendingCutoff = new Date(Date.now() - pendingThresholdMs).toISOString();
    const processingCutoff = new Date(Date.now() - processingThresholdMs).toISOString();
    return (snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[])
      .filter(t => {
        if (t.status === 'pending') return (t.created_at || '') < pendingCutoff;
        if (t.status === 'processing') return (t.started_at || t.created_at || '') < processingCutoff;
        return false;
      });
  },
};

// ─── Invoice Operations ───────────────────────────────────────

export const InvoiceDB = {
  create: async (invoice: Invoice): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('invoices').add({
      company_id: invoice.company_id || null,
      deal_id: invoice.deal_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date || null,
      due_date: invoice.due_date || null,
      customer_name: invoice.customer_name,
      customer_afm: invoice.customer_afm,
      customer_doy: invoice.customer_doy || null,
      customer_address: invoice.customer_address || null,
      customer_email: invoice.customer_email || null,
      line_items: invoice.line_items,
      subtotal: invoice.subtotal,
      fpa_rate: invoice.fpa_rate || 0.24,
      fpa_amount: invoice.fpa_amount,
      total_amount: invoice.total_amount,
      payment_terms: invoice.payment_terms || 'Net 30',
      payment_status: invoice.payment_status || 'unpaid',
      status: invoice.status || 'draft',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<Invoice | undefined> => {
    const doc = await fdb().collection('invoices').doc(id).get();
    return docToObj<Invoice>(doc);
  },

  findByDeal: async (dealId: string): Promise<Invoice | undefined> => {
    const snap = await fdb().collection('invoices')
      .where('deal_id', '==', dealId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Invoice;
  },

  all: async (companyId: string): Promise<Invoice[]> => {
    const snap = await fdb().collection('invoices')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Invoice[];
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('invoices', id),

  getNextInvoiceNumber: async (): Promise<string> => {
    const year = new Date().getFullYear();
    const counterRef = fdb().doc(`counters/invoices_${year}`);
    const count = await fdb().runTransaction(async (tx) => {
      const doc = await tx.get(counterRef);
      const next = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
      tx.set(counterRef, { count: next });
      return next;
    });
    return `${year}/${String(count).padStart(3, '0')}`;
  },
};

// ─── Email Operations ─────────────────────────────────────────

export const EmailDB = {
  create: async (email: Email): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('emails').add({
      company_id: email.company_id || null,
      task_id: email.task_id || null,
      deal_id: email.deal_id || null,
      invoice_id: email.invoice_id || null,
      recipient_email: email.recipient_email,
      recipient_name: email.recipient_name,
      subject: email.subject,
      body: email.body,
      email_type: email.email_type || null,
      direction: email.direction || 'outbound',
      message_id: email.message_id || null,
      sender_email: email.sender_email || null,
      status: email.status || 'pending',
      error_message: email.error_message || null,
      created_at: now,
      sent_at: email.status === 'sent' ? now : null,
      deleted_at: null,
    });
    return ref.id;
  },

  update: async (id: string, updates: Partial<Email>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    const data: any = { ...rest };
    if (data.status === 'sent') data.sent_at = new Date().toISOString();
    await fdb().collection('emails').doc(id).update(data);
  },

  findById: async (id: string): Promise<Email | undefined> => {
    const doc = await fdb().collection('emails').doc(id).get();
    return docToObj<Email>(doc);
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('emails', id),

  all: async (companyId: string): Promise<Email[]> => {
    const snap = await fdb().collection('emails')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Email[];
  },

  // Used by email-transport.ts to match inbox replies to our sent emails
  findSent: async (companyId: string): Promise<Array<{ id: string; deal_id: string | null; recipient_email: string; subject: string }>> => {
    const snap = await fdb().collection('emails')
      .where('company_id', '==', companyId)
      .where('status', '==', 'sent')
      .where('deleted_at', '==', null)
      .get();
    return snap.docs.map(d => ({
      id: d.id,
      deal_id: (d.data().deal_id as string | null) || null,
      recipient_email: d.data().recipient_email as string,
      subject: d.data().subject as string,
    }));
  },

  findSentByDeal: async (dealId: string): Promise<Array<{ id: string; recipient_email: string; subject: string; created_at: string }>> => {
    const snap = await fdb().collection('emails')
      .where('deal_id', '==', dealId)
      .where('status', '==', 'sent')
      .where('deleted_at', '==', null)
      .get();
    return snap.docs
      .map(d => ({
        id: d.id,
        recipient_email: d.data().recipient_email as string,
        subject: d.data().subject as string,
        created_at: (d.data().created_at as string) || '',
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  findByDeal: async (dealId: string): Promise<Email[]> => {
    const snap = await fdb().collection('emails')
      .where('deal_id', '==', dealId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Email[];
  },

  findByMessageId: async (messageId: string): Promise<Email | undefined> => {
    if (!messageId) return undefined;
    const snap = await fdb().collection('emails')
      .where('message_id', '==', messageId)
      .where('direction', '==', 'inbound')
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    if (doc.data().deleted_at) return undefined;
    return { id: doc.id, ...doc.data() } as Email;
  },
};

// ─── Legal Validation Operations ──────────────────────────────

export const LegalValidationDB = {
  create: async (validation: LegalValidation): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('legal_validations').add({
      company_id: validation.company_id || null,
      deal_id: validation.deal_id,
      afm_valid: validation.afm_valid ?? false,
      afm_number: validation.afm_number || null,
      company_registry_valid: validation.company_registry_valid ?? false,
      gdpr_compliant: validation.gdpr_compliant ?? false,
      contract_terms_valid: validation.contract_terms_valid ?? false,
      risk_level: validation.risk_level || null,
      risk_flags: validation.risk_flags || null,
      approval_status: validation.approval_status || 'pending',
      approval_notes: validation.approval_notes || null,
      reviewed_at: null,
      created_at: now,
      deleted_at: null,
    });
    return ref.id;
  },

  findByDeal: async (dealId: string): Promise<LegalValidation | undefined> => {
    const snap = await fdb().collection('legal_validations')
      .where('deal_id', '==', dealId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as LegalValidation;
  },

  update: async (id: string, updates: Partial<LegalValidation>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    const data: any = { ...rest };
    if (data.approval_status && data.approval_status !== 'pending') {
      data.reviewed_at = new Date().toISOString();
    }
    await fdb().collection('legal_validations').doc(id).update(data);
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('legal_validations', id),
};

// ─── Market Research ─────────────────────────────────────────

export interface MarketResearch {
  id?: string;
  company_id?: string;
  search_queries?: string;     // JSON string: string[]
  raw_search_results?: string; // JSON string: serialized search results
  trends_json?: string;        // JSON string: trend objects
  competitors_json?: string;   // JSON string: competitor insight objects
  social_json?: string;        // JSON string: social media highlight objects
  opportunities?: string;      // JSON string: string[]
  threats?: string;            // JSON string: string[]
  summary?: string;
  ai_reasoning?: string;       // JSON string: string[]
  status?: 'running' | 'completed' | 'failed';
  error_message?: string;
  triggered_by?: 'schedule' | 'manual';
  created_at?: string;
  completed_at?: string;
  deleted_at?: string | null;
}

export const MarketResearchDB = {
  create: async (research: MarketResearch): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('market_research').add({
      company_id: research.company_id || null,
      search_queries: research.search_queries || null,
      raw_search_results: research.raw_search_results || null,
      trends_json: research.trends_json || null,
      competitors_json: research.competitors_json || null,
      social_json: research.social_json || null,
      opportunities: research.opportunities || null,
      threats: research.threats || null,
      summary: research.summary || null,
      ai_reasoning: research.ai_reasoning || null,
      status: research.status || 'running',
      error_message: null,
      triggered_by: research.triggered_by || 'manual',
      created_at: now,
      completed_at: null,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<MarketResearch | undefined> => {
    const doc = await fdb().collection('market_research').doc(id).get();
    return docToObj<MarketResearch>(doc);
  },

  update: async (id: string, updates: Partial<MarketResearch>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    await fdb().collection('market_research').doc(id).update(rest);
  },

  getLatest: async (companyId: string): Promise<MarketResearch | undefined> => {
    const snap = await fdb().collection('market_research')
      .where('company_id', '==', companyId)
      .where('status', '==', 'completed')
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as MarketResearch;
  },

  hasRunning: async (companyId: string): Promise<boolean> => {
    const snap = await fdb().collection('market_research')
      .where('company_id', '==', companyId)
      .where('status', '==', 'running')
      .where('deleted_at', '==', null)
      .limit(1)
      .get();
    return !snap.empty;
  },

  all: async (companyId: string): Promise<MarketResearch[]> => {
    const snap = await fdb().collection('market_research')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as MarketResearch[];
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('market_research', id),
};

// ─── Social Content ──────────────────────────────────────────

export interface SocialContent {
  id?: string;
  company_id?: string;
  research_id?: string;
  platform: 'instagram' | 'linkedin';
  post_text: string;
  hashtags?: string;           // JSON string: string[]
  image_description?: string;
  image_urls?: string;         // JSON string: string[] — 2 candidate image paths
  selected_image_url?: string; // The user-chosen image path
  image_generation_status?: 'pending' | 'generating' | 'completed' | 'failed';
  best_posting_time?: string;
  tone?: string;
  content_theme?: string;
  ai_reasoning?: string;       // JSON string: string[]
  status?: 'draft' | 'approved' | 'posted' | 'archived';
  triggered_by?: 'schedule' | 'manual';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export const SocialContentDB = {
  create: async (content: SocialContent): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('social_content').add({
      company_id: content.company_id || null,
      research_id: content.research_id || null,
      platform: content.platform,
      post_text: content.post_text,
      hashtags: content.hashtags || null,
      image_description: content.image_description || null,
      best_posting_time: content.best_posting_time || null,
      tone: content.tone || null,
      content_theme: content.content_theme || null,
      ai_reasoning: content.ai_reasoning || null,
      status: content.status || 'draft',
      triggered_by: content.triggered_by || 'manual',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<SocialContent | undefined> => {
    const doc = await fdb().collection('social_content').doc(id).get();
    return docToObj<SocialContent>(doc);
  },

  update: async (id: string, updates: Partial<SocialContent>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    await fdb().collection('social_content').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
  },

  all: async (companyId: string): Promise<SocialContent[]> => {
    const snap = await fdb().collection('social_content')
      .where('company_id', '==', companyId)
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SocialContent[];
  },

  findByResearch: async (researchId: string): Promise<SocialContent[]> => {
    const snap = await fdb().collection('social_content')
      .where('research_id', '==', researchId)
      .where('deleted_at', '==', null)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SocialContent[];
  },

  delete: async (id: string): Promise<void> => softDeleteDoc('social_content', id),
};

// ─── Audit Log ────────────────────────────────────────────────

export const AuditLog = {
  // Fire-and-forget: keeps synchronous call signature so callers need no await
  log: (agentType: string, action: string, entityType?: string, entityId?: string, details?: any): void => {
    fdb().collection('audit_log').add({
      agent_type: agentType,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date().toISOString(),
    }).catch(e => console.error('AuditLog write failed:', e));
  },

  getRecent: async (limit: number = 50): Promise<any[]> => {
    const snap = await fdb().collection('audit_log').orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};

// ─── Dashboard Stats (optimized aggregation) ─────────────────
// Uses count() aggregation where possible to avoid fetching full documents

export const DashboardStatsDB = {
  getStats: async (companyId: string) => {
    // Parallel count queries for collections that only need counts
    const [
      // Leads
      leadsTotal, leadsNew, leadsQualified, leadsConverted,
      // Tasks
      tasksTotal, tasksPending, tasksProcessing, tasksCompleted, tasksFailed,
      // Emails
      emailsTotal, emailsSent,
      // Research
      researchTotal, researchCompleted,
      // Content
      contentTotal, contentDrafts, contentApproved, contentPosted,
      // Deals (need full docs for value aggregation)
      deals,
      // Invoices (need full docs for amount aggregation)
      invoices,
      // Latest research (just 1 doc)
      latestResearch,
    ] = await Promise.all([
      // Lead counts
      countDocs('leads', companyId),
      countDocs('leads', companyId, 'new'),
      countDocs('leads', companyId, 'qualified'),
      countDocs('leads', companyId, 'converted'),
      // Task counts
      countDocs('tasks', companyId),
      countDocs('tasks', companyId, 'pending'),
      countDocs('tasks', companyId, 'processing'),
      countDocs('tasks', companyId, 'completed'),
      countDocs('tasks', companyId, 'failed'),
      // Email counts
      countDocs('emails', companyId),
      countDocs('emails', companyId, 'sent'),
      // Research counts
      countDocs('market_research', companyId),
      countDocs('market_research', companyId, 'completed'),
      // Content counts
      countDocs('social_content', companyId),
      countDocs('social_content', companyId, 'draft'),
      countDocs('social_content', companyId, 'approved'),
      countDocs('social_content', companyId, 'posted'),
      // Deals - full docs needed for value sums
      DealDB.all(companyId),
      // Invoices - full docs needed for amount sums
      InvoiceDB.all(companyId),
      // Latest research date
      MarketResearchDB.getLatest(companyId),
    ]);

    const OPEN_STATUSES = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating', 'legal_review', 'invoicing'];
    const openDeals = deals.filter(d => OPEN_STATUSES.includes(d.status ?? ''));
    const wonDeals = deals.filter(d => ['closed_won', 'completed'].includes(d.status ?? ''));
    const lostDeals = deals.filter(d => ['closed_lost', 'failed'].includes(d.status ?? ''));
    const closedTotal = wonDeals.length + lostDeals.length;

    return {
      leads: {
        total: leadsTotal,
        new: leadsNew,
        qualified: leadsQualified,
        converted: leadsConverted,
      },
      deals: {
        total: deals.length,
        open: openDeals.length,
        lead_contacted: deals.filter(d => d.status === 'lead_contacted').length,
        in_pipeline: deals.filter(d => d.status === 'in_pipeline').length,
        offer_sent: deals.filter(d => d.status === 'offer_sent').length,
        closed_won: wonDeals.length,
        closed_lost: lostDeals.length,
        pipelineValue: openDeals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        wonValue: wonDeals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        winRate: closedTotal > 0 ? Math.round((wonDeals.length / closedTotal) * 100) : null,
        totalValue: deals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        pending: deals.filter(d => d.status === 'pending').length,
        completed: deals.filter(d => d.status === 'completed').length,
      },
      tasks: {
        total: tasksTotal,
        pending: tasksPending,
        processing: tasksProcessing,
        completed: tasksCompleted,
        failed: tasksFailed,
      },
      invoices: {
        total: invoices.length,
        totalAmount: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
      },
      emails: {
        total: emailsTotal,
        sent: emailsSent,
      },
      research: {
        total: researchTotal,
        completed: researchCompleted,
        latestDate: latestResearch?.created_at || null,
      },
      content: {
        total: contentTotal,
        drafts: contentDrafts,
        approved: contentApproved,
        posted: contentPosted,
      },
    };
  },
};

// ─── App Settings ─────────────────────────────────────────────
// Stored in Firebase at settings/app

export interface AppSettings {
  reply_poll_interval_minutes: number;  // default: 30
  stale_lead_days: number;              // default: 7
  max_followup_attempts: number;        // default: 3
  lost_deal_reopen_days: number;        // default: 60
  satisfaction_email_days: number;      // default: 3
  max_offer_rounds: number;             // default: 3
  min_replies_before_offer: number;     // default: 3
}

const DEFAULT_SETTINGS: AppSettings = {
  reply_poll_interval_minutes: 30,
  stale_lead_days: 7,
  max_followup_attempts: 3,
  lost_deal_reopen_days: 60,
  satisfaction_email_days: 3,
  max_offer_rounds: 3,
  min_replies_before_offer: 3,
};

// In-memory cache with TTL for frequently read settings
let _settingsCache: { data: AppSettings; expiry: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const AppSettingsDB = {
  get: async (): Promise<AppSettings> => {
    if (_settingsCache && Date.now() < _settingsCache.expiry) {
      return _settingsCache.data;
    }
    const doc = await fdb().doc('settings/app').get();
    const settings = doc.exists
      ? { ...DEFAULT_SETTINGS, ...doc.data() } as AppSettings
      : { ...DEFAULT_SETTINGS };
    _settingsCache = { data: settings, expiry: Date.now() + SETTINGS_CACHE_TTL_MS };
    return settings;
  },

  update: async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    // Only allow known keys with numeric values
    const allowed = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
    const safe: Partial<AppSettings> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safe[key] = updates[key] as number;
    }
    await fdb().doc('settings/app').set(safe, { merge: true });
    _settingsCache = null; // Invalidate cache on write
    return AppSettingsDB.get();
  },
};

// ─── Company Profile ──────────────────────────────────────────
// Multi-company: company_profiles/{auto-id} collection
// Active company pointer: settings/active.active_company_id

let _activeIdCache: { data: string | null; expiry: number } | null = null;
let _allProfilesCache: { data: CompanyProfile[]; expiry: number } | null = null;
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function invalidateProfileCaches() {
  _activeIdCache = null;
  _allProfilesCache = null;
}

export const CompanyProfileDB = {
  // Resolve active company
  get: async (): Promise<CompanyProfile | undefined> => {
    const activeId = await CompanyProfileDB.getActiveId();
    if (!activeId) return undefined;
    const doc = await fdb().collection('company_profiles').doc(activeId).get();
    return docToObj<CompanyProfile>(doc);
  },

  getAll: async (): Promise<CompanyProfile[]> => {
    if (_allProfilesCache && Date.now() < _allProfilesCache.expiry) {
      return _allProfilesCache.data;
    }
    const snap = await fdb().collection('company_profiles')
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    const profiles = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CompanyProfile[];
    _allProfilesCache = { data: profiles, expiry: Date.now() + PROFILE_CACHE_TTL_MS };
    return profiles;
  },

  getById: async (id: string): Promise<CompanyProfile | undefined> => {
    const doc = await fdb().collection('company_profiles').doc(id).get();
    return docToObj<CompanyProfile>(doc);
  },

  getActiveId: async (): Promise<string | null> => {
    if (_activeIdCache && Date.now() < _activeIdCache.expiry) {
      return _activeIdCache.data;
    }
    const doc = await fdb().doc('settings/active').get();
    if (!doc.exists) {
      _activeIdCache = { data: null, expiry: Date.now() + PROFILE_CACHE_TTL_MS };
      return null;
    }
    const activeId = (doc.data()!.active_company_id as string) || null;
    _activeIdCache = { data: activeId, expiry: Date.now() + PROFILE_CACHE_TTL_MS };
    return activeId;
  },

  setActive: async (id: string): Promise<void> => {
    await fdb().doc('settings/active').set({ active_company_id: id });
    invalidateProfileCaches();
  },

  create: async (profile: CompanyProfile): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('company_profiles').add({
      name: profile.name,
      website: profile.website || null,
      logo_path: profile.logo_path || null,
      industry: profile.industry || null,
      description: profile.description || null,
      business_model: profile.business_model || null,
      target_customers: profile.target_customers || null,
      products_services: profile.products_services || null,
      geographic_focus: profile.geographic_focus || null,
      user_provided_text: profile.user_provided_text || null,
      raw_scraped_data: profile.raw_scraped_data || null,
      agent_context_json: profile.agent_context_json,
      setup_complete: profile.setup_complete ?? true,
      kad_codes: profile.kad_codes || null,
      help_center_json: profile.help_center_json || null,
      pricing_model: profile.pricing_model || null,
      min_deal_value: profile.min_deal_value ?? null,
      max_deal_value: profile.max_deal_value ?? null,
      key_products: profile.key_products || null,
      unique_selling_points: profile.unique_selling_points || null,
      communication_language: profile.communication_language || 'Greek',
      terms_of_service: profile.terms_of_service || null,
      gemi_number: profile.gemi_number || null,
      elorus_api_key: profile.elorus_api_key || null,
      elorus_organization_id: profile.elorus_organization_id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    // Make the new company active immediately
    await fdb().doc('settings/active').set({ active_company_id: ref.id });
    invalidateProfileCaches();
    return ref.id;
  },

  update: async (id: string, updates: Partial<CompanyProfile>): Promise<void> => {
    const { id: _id, deleted_at: _da, ...rest } = updates as any;
    await fdb().collection('company_profiles').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
    invalidateProfileCaches();
  },

  delete: async (id: string): Promise<void> => {
    await softDeleteDoc('company_profiles', id);
    // Clear the active pointer if this was the active company
    const activeId = await CompanyProfileDB.getActiveId();
    if (activeId === id) {
      await fdb().doc('settings/active').set({ active_company_id: null });
    }
    invalidateProfileCaches();
  },

  isSetupComplete: async (): Promise<boolean> => {
    const activeId = await CompanyProfileDB.getActiveId();
    if (!activeId) return false;
    const doc = await fdb().collection('company_profiles').doc(activeId).get();
    return doc.exists && !doc.data()!.deleted_at;
  },
};

// ─── Pending Offers (draft offers awaiting human approval) ────

export interface PendingOffer {
  id?: string;
  company_id?: string;
  deal_id: string;
  lead_id: string;
  action: 'wants_offer' | 'counter' | 'new_offer';
  // Offer fields — editable before approval
  offer_product_name: string;
  offer_quantity: number;
  offer_unit_price: number;
  offer_subtotal: number;
  offer_fpa_rate: number;
  offer_fpa_amount: number;
  offer_total_amount: number;
  offer_summary?: string;
  // Email fields — editable before approval
  reply_subject: string;
  reply_body: string;
  // Threading data — not editable
  in_reply_to?: string;
  references?: string;
  round_number: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export const PendingOfferDB = {
  create: async (offer: PendingOffer): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('pending_offers').add({
      company_id: offer.company_id || null,
      deal_id: offer.deal_id,
      lead_id: offer.lead_id,
      action: offer.action,
      offer_product_name: offer.offer_product_name,
      offer_quantity: offer.offer_quantity,
      offer_unit_price: offer.offer_unit_price,
      offer_subtotal: offer.offer_subtotal,
      offer_fpa_rate: offer.offer_fpa_rate,
      offer_fpa_amount: offer.offer_fpa_amount,
      offer_total_amount: offer.offer_total_amount,
      offer_summary: offer.offer_summary || null,
      reply_subject: offer.reply_subject,
      reply_body: offer.reply_body,
      in_reply_to: offer.in_reply_to || null,
      references: offer.references || null,
      round_number: offer.round_number,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    return ref.id;
  },

  findById: async (id: string): Promise<PendingOffer | undefined> => {
    const doc = await fdb().collection('pending_offers').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as PendingOffer;
  },

  findByDeal: async (dealId: string): Promise<PendingOffer | undefined> => {
    const snap = await fdb().collection('pending_offers')
      .where('deal_id', '==', dealId)
      .where('status', '==', 'pending')
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as PendingOffer;
  },

  allPending: async (companyId: string): Promise<PendingOffer[]> => {
    const snap = await fdb().collection('pending_offers')
      .where('company_id', '==', companyId)
      .where('status', '==', 'pending')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingOffer))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  update: async (id: string, updates: Partial<PendingOffer>): Promise<void> => {
    const { id: _id, ...rest } = updates as any;
    await fdb().collection('pending_offers').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
  },
};

// ─── GEMI Companies (global, not company-scoped) ─────────────

export interface GemiCompany {
  id?: string;
  gemi_number: string;
  company_id_num: number;
  chamber_id: number;
  branch_code: string;
  name: string;
  title?: string;
  afm?: string;
  chamber_name?: string;
  status?: string;
  foundation_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  legal_form?: string;
  kad_primary?: string;    // JSON: { code, description }
  kad_secondary?: string;  // JSON: [{ code, description }]
  raw_response: string;
  created_at?: string;
  updated_at?: string;
}

export const GemiCompanyDB = {
  create: async (company: GemiCompany): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await fdb().collection('gemi_companies').add({
      gemi_number: company.gemi_number,
      company_id_num: company.company_id_num,
      chamber_id: company.chamber_id,
      branch_code: company.branch_code,
      name: company.name,
      title: company.title || null,
      afm: company.afm || null,
      chamber_name: company.chamber_name || null,
      status: company.status || null,
      foundation_date: company.foundation_date || null,
      phone: company.phone || null,
      email: company.email || null,
      address: company.address || null,
      legal_form: company.legal_form || null,
      kad_primary: company.kad_primary || null,
      kad_secondary: company.kad_secondary || null,
      raw_response: company.raw_response,
      created_at: now,
      updated_at: now,
    });
    return ref.id;
  },

  findByGemiNumber: async (gemiNumber: string): Promise<GemiCompany | undefined> => {
    const snap = await fdb().collection('gemi_companies')
      .where('gemi_number', '==', gemiNumber)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as GemiCompany;
  },

  getHighestCompanyId: async (): Promise<number | null> => {
    const snap = await fdb().collection('gemi_companies')
      .orderBy('company_id_num', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data().company_id_num as number;
  },

  count: async (): Promise<number> => {
    const snap = await fdb().collection('gemi_companies').count().get();
    return snap.data().count;
  },

  list: async (options: {
    limit?: number;
    startAfter?: string;        // document ID for cursor-based pagination
    status?: string;
    legalForm?: string;
    chamberName?: string;
    search?: string;            // client-side filter on name/afm (Firestore has no LIKE)
  } = {}): Promise<{ companies: GemiCompany[]; lastId: string | null }> => {
    const limit = options.limit || 50;
    let query: FirebaseFirestore.Query = fdb().collection('gemi_companies')
      .orderBy('company_id_num', 'desc');

    // Firestore equality filters (these use indexes)
    if (options.status) {
      query = query.where('status', '==', options.status);
    }
    if (options.legalForm) {
      query = query.where('legal_form', '==', options.legalForm);
    }
    if (options.chamberName) {
      query = query.where('chamber_name', '==', options.chamberName);
    }

    // Cursor-based pagination
    if (options.startAfter) {
      const cursorDoc = await fdb().collection('gemi_companies').doc(options.startAfter).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Fetch extra to allow client-side text filtering
    const fetchLimit = options.search ? limit * 5 : limit;
    const snap = await query.limit(fetchLimit).get();

    let companies = snap.docs.map(d => {
      const data = d.data();
      // Exclude raw_response from list results to keep payloads small
      const { raw_response, ...rest } = data;
      return { id: d.id, ...rest } as GemiCompany;
    });

    // Client-side text search (Firestore has no full-text search)
    if (options.search) {
      const q = options.search.toLowerCase();
      companies = companies.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.afm?.includes(q) ||
        c.gemi_number?.includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
      companies = companies.slice(0, limit);
    }

    const lastId = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;
    return { companies, lastId };
  },

  getById: async (id: string): Promise<GemiCompany | undefined> => {
    const doc = await fdb().collection('gemi_companies').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as GemiCompany;
  },
};

// ─── GEMI Scraper State (singleton at settings/gemi_scraper) ──

export interface GemiScraperState {
  last_company_id: number;
  last_run_started_at: string | null;
  last_run_completed_at: string | null;
  status: 'idle' | 'running' | 'stopped';
  total_companies_found: number;
  companies_found_this_run: number;
  consecutive_misses: number;
  last_error?: string;
  current_company_id?: number;
}

const DEFAULT_GEMI_STATE: GemiScraperState = {
  last_company_id: 1889646,
  last_run_started_at: null,
  last_run_completed_at: null,
  status: 'idle',
  total_companies_found: 0,
  companies_found_this_run: 0,
  consecutive_misses: 0,
};

export const GemiScraperStateDB = {
  get: async (): Promise<GemiScraperState> => {
    const doc = await fdb().doc('settings/gemi_scraper').get();
    if (!doc.exists) return { ...DEFAULT_GEMI_STATE };
    return { ...DEFAULT_GEMI_STATE, ...doc.data() } as GemiScraperState;
  },

  update: async (updates: Partial<GemiScraperState>): Promise<void> => {
    await fdb().doc('settings/gemi_scraper').set(updates, { merge: true });
  },
};
