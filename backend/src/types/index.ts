// Agent types matching the agents-plan.png
export type AgentType = 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';

// Task types that agents create for each other
export type TaskType =
  | 'qualify_lead'       // Marketing → Sales
  | 'close_deal'         // Sales internal
  | 'review_contract'    // Sales → Legal
  | 'generate_invoice'   // Sales → Accounting
  | 'send_proposal'      // Sales → Email
  | 'send_invoice'       // Accounting → Email
  | 'send_confirmation'  // Sales → Email
  | 'send_follow_up';    // Any → Email

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type LeadScore = 'A' | 'B' | 'C';
export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'converted' | 'rejected';
export type DealStatus = 'pending' | 'proposal_sent' | 'negotiating' | 'legal_review' | 'invoicing' | 'completed' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high';

// Agent response from Claude
export interface AgentResponse {
  reasoning: string[];  // Step-by-step reasoning for demo
  decision: string;
  data: Record<string, any>;
}

// Marketing Agent output
export interface MarketingResult extends AgentResponse {
  data: {
    industry: string;
    companySize: string;
    annualRevenue: string;
    leadScore: LeadScore;
    recommendedApproach: string;
  };
}

// Sales Agent output
export interface SalesResult extends AgentResponse {
  data: {
    qualification: 'close' | 'nurture' | 'reject';
    budget: boolean;
    authority: boolean;
    need: boolean;
    timeline: boolean;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    fpaRate: number;
    fpaAmount: number;
    totalAmount: number;
    proposalSummary: string;
  };
}

// Legal Agent output
export interface LegalResult extends AgentResponse {
  data: {
    afmValid: boolean;
    companyRegistryValid: boolean;
    gdprCompliant: boolean;
    contractTermsValid: boolean;
    riskLevel: RiskLevel;
    riskFlags: string[];
    approvalStatus: 'approved' | 'rejected' | 'review_required';
    notes: string;
  };
}

// Accounting Agent output
export interface AccountingResult extends AgentResponse {
  data: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    fpaRate: number;
    fpaAmount: number;
    totalAmount: number;
    paymentTerms: string;
    ledgerEntries: Array<{ account: string; debit: number; credit: number }>;
  };
}

// Email Service output
export interface EmailResult extends AgentResponse {
  data: {
    subject: string;
    body: string;
    recipientEmail: string;
    recipientName: string;
    emailType: 'proposal' | 'invoice' | 'confirmation' | 'follow_up';
  };
}

// SSE event for real-time dashboard updates
export interface SSEEvent {
  type: 'agent_started' | 'agent_reasoning' | 'agent_completed' | 'agent_failed' | 'workflow_completed';
  agent: AgentType;
  taskId?: number;
  dealId?: number;
  leadId?: number;
  message: string;
  reasoning?: string[];
  data?: Record<string, any>;
  timestamp: string;
}

// Negotiation Agent output (Sales Agent in negotiation mode)
export interface NegotiationResult extends AgentResponse {
  data: {
    action: 'accept' | 'counter_offer' | 'give_up';
    customerSentiment: 'positive' | 'neutral' | 'negative';
    objectionSummary: string;
    revisedSubtotal?: number;
    revisedFpaAmount?: number;
    revisedTotal?: number;
    revisedTerms?: string;
    responseSubject: string;
    responseBody: string;
    failureReason?: string;
  };
}

// API request bodies
export interface CreateLeadRequest {
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  productInterest?: string;
  companyWebsite?: string;
}

export interface TriggerWorkflowRequest {
  leadId: number;
}
