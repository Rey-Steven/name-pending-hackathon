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

// ─── Interfaces ───────────────────────────────────────────────

export interface Lead {
  id?: string;
  company_id?: string;
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
      product_interest: lead.product_interest || null,
      company_website: lead.company_website || null,
      industry: lead.industry || null,
      company_size: lead.company_size || null,
      annual_revenue: lead.annual_revenue || null,
      lead_score: lead.lead_score || null,
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
      .get();
    return snapToDocs<Lead>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
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
      .get();
    return snapToDocs<Deal>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  findByStatus: async (statuses: string[], companyId: string): Promise<Deal[]> => {
    const snap = await fdb().collection('deals')
      .where('company_id', '==', companyId)
      .get();
    return snapToDocs<Deal>(snap).filter(d => statuses.includes(d.status || ''));
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
      .get();
    return snapToDocs<Task>(snap)
      .filter(t => t.status === 'pending')
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
      .get();
    return snapToDocs<Task>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  findByDeal: async (dealId: string): Promise<Task[]> => {
    const snap = await fdb().collection('tasks').where('deal_id', '==', dealId).get();
    const tasks = snapToDocs<Task>(snap);
    return tasks.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
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
    const snap = await fdb().collection('invoices').where('deal_id', '==', dealId).get();
    if (snap.empty) return undefined;
    const docs = snapToDocs<Invoice>(snap);
    return docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
  },

  all: async (companyId: string): Promise<Invoice[]> => {
    const snap = await fdb().collection('invoices')
      .where('company_id', '==', companyId)
      .get();
    return snapToDocs<Invoice>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
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
      .get();
    return snapToDocs<Email>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  // Used by email-transport.ts to match inbox replies to our sent emails
  findSent: async (companyId: string): Promise<Array<{ id: string; deal_id: string | null; recipient_email: string; subject: string }>> => {
    const snap = await fdb().collection('emails').where('company_id', '==', companyId).get();
    return snap.docs
      .filter(d => !d.data().deleted_at && d.data().status === 'sent')
      .map(d => ({
        id: d.id,
        deal_id: (d.data().deal_id as string | null) || null,
        recipient_email: d.data().recipient_email as string,
        subject: d.data().subject as string,
      }));
  },

  findSentByDeal: async (dealId: string): Promise<Array<{ id: string; recipient_email: string; subject: string; created_at: string }>> => {
    const snap = await fdb().collection('emails').where('deal_id', '==', dealId).get();
    const docs = snap.docs
      .filter(d => !d.data().deleted_at && d.data().status === 'sent')
      .map(d => ({
        id: d.id,
        recipient_email: d.data().recipient_email as string,
        subject: d.data().subject as string,
        created_at: (d.data().created_at as string) || '',
      }));
    return docs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  findByDeal: async (dealId: string): Promise<Email[]> => {
    const snap = await fdb().collection('emails').where('deal_id', '==', dealId).get();
    const emails = snapToDocs<Email>(snap);
    return emails.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
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
    const snap = await fdb().collection('legal_validations').where('deal_id', '==', dealId).get();
    if (snap.empty) return undefined;
    const docs = snapToDocs<LegalValidation>(snap);
    return docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
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
      .get();
    const docs = snapToDocs<MarketResearch>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return docs[0];
  },

  all: async (companyId: string): Promise<MarketResearch[]> => {
    const snap = await fdb().collection('market_research')
      .where('company_id', '==', companyId)
      .get();
    return snapToDocs<MarketResearch>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
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
      .get();
    return snapToDocs<SocialContent>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  findByResearch: async (researchId: string): Promise<SocialContent[]> => {
    const snap = await fdb().collection('social_content')
      .where('research_id', '==', researchId)
      .get();
    return snapToDocs<SocialContent>(snap);
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

// ─── App Settings ─────────────────────────────────────────────
// Stored in Firebase at settings/app

export interface AppSettings {
  reply_poll_interval_minutes: number;  // default: 30
  stale_lead_days: number;              // default: 7
  max_followup_attempts: number;        // default: 3
  lost_deal_reopen_days: number;        // default: 60
  satisfaction_email_days: number;      // default: 3
  max_offer_rounds: number;             // default: 3
}

const DEFAULT_SETTINGS: AppSettings = {
  reply_poll_interval_minutes: 30,
  stale_lead_days: 7,
  max_followup_attempts: 3,
  lost_deal_reopen_days: 60,
  satisfaction_email_days: 3,
  max_offer_rounds: 3,
};

export const AppSettingsDB = {
  get: async (): Promise<AppSettings> => {
    const doc = await fdb().doc('settings/app').get();
    if (!doc.exists) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...doc.data() } as AppSettings;
  },

  update: async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    // Only allow known keys with numeric values
    const allowed = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
    const safe: Partial<AppSettings> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safe[key] = updates[key] as number;
    }
    await fdb().doc('settings/app').set(safe, { merge: true });
    return AppSettingsDB.get();
  },
};

// ─── Company Profile ──────────────────────────────────────────
// Multi-company: company_profiles/{auto-id} collection
// Active company pointer: settings/active.active_company_id

export const CompanyProfileDB = {
  // Resolve active company
  get: async (): Promise<CompanyProfile | undefined> => {
    const settingsDoc = await fdb().doc('settings/active').get();
    if (!settingsDoc.exists) return undefined;
    const activeId = settingsDoc.data()!.active_company_id as string | null;
    if (!activeId) return undefined;
    const doc = await fdb().collection('company_profiles').doc(activeId).get();
    return docToObj<CompanyProfile>(doc);
  },

  getAll: async (): Promise<CompanyProfile[]> => {
    const snap = await fdb().collection('company_profiles').get();
    return snapToDocs<CompanyProfile>(snap)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  getById: async (id: string): Promise<CompanyProfile | undefined> => {
    const doc = await fdb().collection('company_profiles').doc(id).get();
    return docToObj<CompanyProfile>(doc);
  },

  getActiveId: async (): Promise<string | null> => {
    const doc = await fdb().doc('settings/active').get();
    if (!doc.exists) return null;
    return (doc.data()!.active_company_id as string) || null;
  },

  setActive: async (id: string): Promise<void> => {
    await fdb().doc('settings/active').set({ active_company_id: id });
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
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    // Make the new company active immediately
    await fdb().doc('settings/active').set({ active_company_id: ref.id });
    return ref.id;
  },

  update: async (id: string, updates: Partial<CompanyProfile>): Promise<void> => {
    const { id: _id, deleted_at: _da, ...rest } = updates as any;
    await fdb().collection('company_profiles').doc(id).update({
      ...rest,
      updated_at: new Date().toISOString(),
    });
  },

  delete: async (id: string): Promise<void> => {
    await softDeleteDoc('company_profiles', id);
    // Clear the active pointer if this was the active company
    const settingsDoc = await fdb().doc('settings/active').get();
    if (settingsDoc.exists && settingsDoc.data()!.active_company_id === id) {
      await fdb().doc('settings/active').set({ active_company_id: null });
    }
  },

  isSetupComplete: async (): Promise<boolean> => {
    const settingsDoc = await fdb().doc('settings/active').get();
    if (!settingsDoc.exists) return false;
    const activeId = settingsDoc.data()!.active_company_id as string | null;
    if (!activeId) return false;
    const doc = await fdb().collection('company_profiles').doc(activeId).get();
    return doc.exists && !doc.data()!.deleted_at;
  },
};
