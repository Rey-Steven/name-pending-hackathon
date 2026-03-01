import axios, { AxiosInstance } from 'axios';
import { CompanyProfileDB, LeadDB, Lead } from '../database/db';

const ELORUS_BASE_URL = 'https://api.elorus.com/v1.2';

// ─── Types ───────────────────────────────────────────────────

export interface ElorusPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ElorusContact {
  id: string;
  custom_id?: string;
  active: boolean;
  first_name: string;
  last_name: string;
  company: string;
  display_name: string;
  profession?: string;
  vat_number?: string;
  is_client: boolean;
  is_supplier: boolean;
  default_language?: string;
  default_currency_code?: string;
  addresses: Array<{
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    primary?: boolean;
  }>;
  email: Array<{ email: string; primary?: boolean }>;
  phones: Array<{ number: string; primary?: boolean }>;
  organization: string;
  created: string;
  modified: string;
}

export interface ElorusProduct {
  id: string;
  custom_id?: string;
  title: string;
  code?: string;
  description?: string;
  sales: boolean;
  sale_value?: string;
  purchases: boolean;
  purchase_value?: string;
  manage: boolean;
  stock?: string;
  unit_measure?: string;
  active: boolean;
  organization: string;
  created: string;
  modified: string;
}

export interface ElorusEstimate {
  id: string;
  custom_id?: string;
  representation: string;
  status: 'draft' | 'issued' | 'accepted' | 'rejected';
  draft: boolean;
  accept_status?: string;
  documenttype?: string;
  sequence_flat?: string;
  number?: string;
  date?: string;
  client: string;
  client_display_name?: string;
  client_vat_number?: string;
  currency_code?: string;
  calculator_mode?: string;
  items: Array<{
    id?: string;
    product?: string;
    title?: string;
    description?: string;
    quantity?: string;
    unit_measure?: string;
    unit_value?: string;
    taxes?: Array<{ tax: string; auto_calculate?: boolean }>;
  }>;
  initial?: string;
  net?: string;
  taxes?: Array<{ tax: string; amount?: string }>;
  total?: string;
  terms?: string;
  public_notes?: string;
  permalink?: string;
  organization: string;
  created: string;
  modified: string;
}

export interface ElorusInvoice {
  id: string;
  custom_id?: string;
  representation: string;
  status: 'draft' | 'pending' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';
  draft: boolean;
  documenttype?: string;
  sequence_flat?: string;
  number?: string;
  date: string;
  due_days?: number;
  client: string;
  client_display_name?: string;
  client_vat_number?: string;
  client_email?: string;
  currency_code?: string;
  calculator_mode?: string;
  items: Array<{
    id?: string;
    product?: string;
    title?: string;
    description?: string;
    quantity?: string;
    unit_measure?: string;
    unit_value?: string;
    taxes?: Array<{ tax: string; auto_calculate?: boolean }>;
  }>;
  initial?: string;
  net?: string;
  taxes?: Array<{ tax: string; amount?: string }>;
  total?: string;
  payable?: string;
  paid?: string;
  terms?: string;
  public_notes?: string;
  permalink?: string;
  organization: string;
  created: string;
  modified: string;
}

export interface ElorusTax {
  id: string;
  title: string;
  tax_type: string;
  operand: string;
  percentage?: string;
  amount?: string;
  active: boolean;
}

export interface ElorusDocumentType {
  id: string;
  title: string;
  active: boolean;
  application: number; // 1=Invoices, 2=Credit Notes, 3=Estimates
  default: boolean;
}

// ─── Service ─────────────────────────────────────────────────

export class ElorusService {
  private client: AxiosInstance;

  constructor(private apiKey: string, private organizationId: string) {
    const headers: Record<string, string> = {
      'Authorization': `Token ${apiKey}`,
      'X-Elorus-Organization': organizationId,
      'Content-Type': 'application/json',
    };
    if (process.env.ELORUS_DEMO === 'true') {
      headers['X-Elorus-Demo'] = 'true';
    }
    this.client = axios.create({
      baseURL: ELORUS_BASE_URL,
      headers,
    });
  }

  // ── Contacts ─────────────────────────────────────────────

  async listContacts(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    ctype?: string;
    active?: string;
  }): Promise<ElorusPaginatedResponse<ElorusContact>> {
    const { data } = await this.client.get('/contacts/', { params });
    return data;
  }

  async createContact(payload: {
    company?: string;
    first_name?: string;
    last_name?: string;
    client_type?: number;  // 1 = person, 2 = company
    vat_number?: string;
    profession?: string;
    is_client?: boolean;
    is_supplier?: boolean;
    custom_id?: string;
    default_language?: string;
    addresses?: Array<{ address?: string; city?: string; state?: string; zip?: string; country?: string }>;
    email?: Array<{ email: string; primary?: boolean }>;
    phones?: Array<{ number: string; primary?: boolean }>;
  }): Promise<ElorusContact> {
    const { data } = await this.client.post('/contacts/', payload);
    return data;
  }

  async getContact(id: string): Promise<ElorusContact> {
    const { data } = await this.client.get(`/contacts/${id}/`);
    return data;
  }

  // ── Products ─────────────────────────────────────────────

  async listProducts(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    active?: string;
    sales?: string;
  }): Promise<ElorusPaginatedResponse<ElorusProduct>> {
    const { data } = await this.client.get('/products/', { params });
    return data;
  }

  async getProduct(id: string): Promise<ElorusProduct> {
    const { data } = await this.client.get(`/products/${id}/`);
    return data;
  }

  // ── Estimates (Offers) ───────────────────────────────────

  async listEstimates(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    client?: string;
    draft?: string;
  }): Promise<ElorusPaginatedResponse<ElorusEstimate>> {
    const { data } = await this.client.get('/estimates/', { params });
    return data;
  }

  async createEstimate(payload: {
    client: string;
    items: Array<{
      product?: string;
      title?: string;
      description?: string;
      quantity?: string;
      unit_value?: string;
      unit_measure?: string;
      taxes?: Array<{ tax: string }>;
    }>;
    draft?: boolean;
    date?: string;
    due_days?: number;
    calculator_mode?: string;
    currency_code?: string;
    terms?: string;
    public_notes?: string;
    template?: number;
    documenttype?: string;
    sequence_flat?: string;
  }): Promise<ElorusEstimate> {
    const { data } = await this.client.post('/estimates/', payload);
    return data;
  }

  async getEstimate(id: string): Promise<ElorusEstimate> {
    const { data } = await this.client.get(`/estimates/${id}/`);
    return data;
  }

  async getEstimatePDF(id: string): Promise<Buffer> {
    const { data } = await this.client.get(`/estimates/${id}/pdf/`, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(data);
  }

  async updateEstimate(id: string, payload: {
    draft?: boolean;
    accept_status?: string;
    template?: number;
    custom_id?: string;
  }): Promise<ElorusEstimate> {
    const { data } = await this.client.patch(`/estimates/${id}/`, payload);
    return data;
  }

  // ── Invoices ─────────────────────────────────────────────

  async listInvoices(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    client?: string;
    fpaid?: string;
    overdue?: string;
    draft?: string;
    period_from?: string;
    period_to?: string;
  }): Promise<ElorusPaginatedResponse<ElorusInvoice>> {
    const { data } = await this.client.get('/invoices/', { params });
    return data;
  }

  async createInvoice(payload: {
    client: string;
    date: string;
    items: Array<{
      product?: string;
      title?: string;
      description?: string;
      quantity?: string;
      unit_value?: string;
      unit_measure?: string;
      taxes?: Array<{ tax: string }>;
    }>;
    draft?: boolean;
    due_days?: number;
    calculator_mode?: string;
    currency_code?: string;
    terms?: string;
    public_notes?: string;
    template?: number;
    documenttype?: string;
    sequence_flat?: string;
  }): Promise<ElorusInvoice> {
    const { data } = await this.client.post('/invoices/', payload);
    return data;
  }

  async getInvoice(id: string): Promise<ElorusInvoice> {
    const { data } = await this.client.get(`/invoices/${id}/`);
    return data;
  }

  async getInvoicePDF(id: string): Promise<Buffer> {
    const { data } = await this.client.get(`/invoices/${id}/pdf/`, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(data);
  }

  // ── Taxes & Document Types ───────────────────────────────

  async listTaxes(params?: {
    active?: string;
    tax_type?: string;
  }): Promise<ElorusPaginatedResponse<ElorusTax>> {
    const { data } = await this.client.get('/taxes/', { params });
    return data;
  }

  async listDocumentTypes(params?: {
    application?: number;
    active?: string;
  }): Promise<ElorusPaginatedResponse<ElorusDocumentType>> {
    const { data } = await this.client.get('/documenttypes/', { params });
    return data;
  }

  // ── Organization ──────────────────────────────────────────

  async getOrganization(): Promise<{ id: string; name: string; subdomain: string; [key: string]: any }> {
    const { data } = await this.client.get(`/organizations/${this.organizationId}/`);
    return data;
  }
}

// ─── Helper: get service for a company ───────────────────────

export async function getElorusService(companyId: string): Promise<ElorusService | null> {
  const profile = await CompanyProfileDB.getById(companyId);
  if (!profile) return null;
  if (!profile.elorus_api_key || !profile.elorus_organization_id) return null;
  return new ElorusService(profile.elorus_api_key, profile.elorus_organization_id);
}

// ─── Helper: get or create Elorus contact for a lead ─────────

export async function getOrCreateElorusContact(
  elorusService: ElorusService,
  lead: Lead,
): Promise<string> {
  // If lead already has an Elorus contact ID, return it
  if (lead.elorus_contact_id) return lead.elorus_contact_id;

  // Try to find by VAT number
  if (lead.vat_id) {
    const results = await elorusService.listContacts({ search: lead.vat_id, page_size: 5 });
    const match = results.results.find(c => c.vat_number === lead.vat_id);
    if (match) {
      await LeadDB.update(lead.id!, { elorus_contact_id: match.id });
      return match.id;
    }
  }

  // Create new contact
  const nameParts = (lead.contact_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const contact = await elorusService.createContact({
    company: lead.company_name,
    first_name: firstName,
    last_name: lastName,
    client_type: 2,  // 2 = company
    ...(lead.vat_id && { vat_number: lead.vat_id }),
    is_client: true,
    email: lead.contact_email ? [{ email: lead.contact_email, primary: true }] : [],
    phones: lead.contact_phone ? [{ number: lead.contact_phone, primary: true }] : [],
    addresses: lead.address ? [{
      address: lead.address,
      city: lead.city || '',
      zip: lead.postal_code || '',
      country: 'GR',
    }] : [],
  });

  await LeadDB.update(lead.id!, { elorus_contact_id: contact.id });
  return contact.id;
}
