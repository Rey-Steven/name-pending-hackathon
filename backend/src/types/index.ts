// Agent types matching the agents-plan.png
export type AgentType = 'marketing' | 'sales' | 'legal' | 'accounting' | 'email';

// Task types that agents create for each other
export type TaskType =
  | 'qualify_lead'       // Marketing → Sales
  | 'lead_enrichment'    // Marketing → Marketing
  | 'market_research'    // Marketing → Marketing
  | 'content_creation'   // Marketing → Marketing
  | 'process_deal'       // Sales → Sales
  | 'analyze_reply'      // Sales → Sales
  | 'legal_review'       // Legal → Legal
  | 'generate_invoice'   // Accounting → Accounting
  | 'send_proposal'      // Sales → Email
  | 'send_invoice'       // Accounting → Email
  | 'send_email'         // Email → Email (poller-triggered sends)
  | 'deliver_email'      // Email → Email (direct delivery)
  | 'reopen_deal'        // Sales → Marketing
  | 'close_deal'         // Sales internal
  | 'review_contract'    // Sales → Legal
  | 'send_confirmation'  // Sales → Email
  | 'send_follow_up';    // Any → Email

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type LeadScore = 'A' | 'B' | 'C';
export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'converted' | 'rejected';
// New pipeline statuses (active flow)
export type DealStatus =
  | 'lead_contacted'   // cold outreach sent, awaiting first reply
  | 'in_pipeline'      // lead showed interest, conversation ongoing
  | 'offer_sent'       // formal offer with pricing sent
  | 'closed_won'       // offer accepted → invoice pipeline runs
  | 'closed_lost'      // lead declined
  // Legacy statuses (kept for backward compatibility)
  | 'pending'
  | 'proposal_sent'
  | 'negotiating'
  | 'legal_review'
  | 'invoicing'
  | 'completed'
  | 'failed'
  | 'no_response'
  | 'reopened';
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
    contractText?: string;  // Full service contract text to be sent as PDF
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
    emailType: 'proposal' | 'invoice' | 'confirmation' | 'follow_up' | 'satisfaction' | 'cold_outreach';
  };
}

// Market Research output
export interface MarketResearchResult extends AgentResponse {
  data: {
    marketTrends: Array<{
      trend: string;
      relevance: 'high' | 'medium' | 'low';
      source: string;
    }>;
    competitorInsights: Array<{
      competitor: string;
      activity: string;
      platform: string;
      takeaway: string;
    }>;
    socialMediaHighlights: Array<{
      platform: string;
      content: string;
      engagement: string;
      relevance: string;
    }>;
    opportunities: string[];
    threats: string[];
    summary: string;
  };
}

// Social Content Creation output
export interface SocialContentResult extends AgentResponse {
  data: {
    instagram: {
      postText: string;
      hashtags: string[];
      imageDescription: string;
      bestPostingTime: string;
      tone: string;
    };
    linkedin: {
      postText: string;
      hashtags: string[];
      imageDescription: string;
      bestPostingTime: string;
      tone: string;
    };
    contentTheme: string;
    basedOnResearchId: string;
  };
}

// Reply analysis result (Sales Agent handling inbound customer replies)
export interface ReplyAnalysisResult extends AgentResponse {
  data: {
    action: 'discovery' | 'engaged' | 'wants_offer' | 'accepted' | 'counter' | 'new_offer' | 'declined';
    customerSentiment: 'positive' | 'neutral' | 'negative';
    customerIntent: string;
    replySubject: string;
    replyBody: string;
    // Populated when action is wants_offer / counter / new_offer:
    offerProductName?: string;
    offerQuantity?: number;
    offerUnitPrice?: number;
    offerSubtotal?: number;
    offerFpaRate?: number;
    offerFpaAmount?: number;
    offerTotalAmount?: number;
    offerSummary?: string;
    failureReason?: string;
    // Agent-built lead profile, updated after every reply
    updatedLeadProfile?: {
      company_background?: string;
      stated_needs?: string[];
      pain_points?: string[];
      scale_volume?: string;
      timeline?: string;
      budget_signals?: string;
      company_informed?: boolean;
      next_best_action?: string;
    } | null;
  };
}

// SSE event for real-time dashboard updates
export interface SSEEvent {
  type: 'agent_started' | 'agent_reasoning' | 'agent_completed' | 'agent_failed' | 'workflow_completed';
  agent: AgentType;
  taskId?: string;
  dealId?: string;
  leadId?: string;
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

// Company profile context passed to agents
export interface AgentCompanyContexts {
  marketing: string;
  sales: string;
  legal: string;
  accounting: string;
  email: string;
}

export interface CompanyProfileContext {
  id: string;
  name: string;
  website?: string;
  logo_path?: string;
  industry?: string;
  description?: string;
  business_model?: string;
  target_customers?: string;
  products_services?: string;
  geographic_focus?: string;
  agentContexts: AgentCompanyContexts;
  kad_codes?: string;
  // Richer AI context fields
  pricing_model?: string;
  min_deal_value?: number;
  max_deal_value?: number;
  key_products?: string;
  unique_selling_points?: string;
  communication_language?: string;
  terms_of_service?: string;
}

// API request bodies
export interface CreateLeadRequest {
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  vatId?: string;
  gemiNumber?: string;
  taxOffice?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  legalForm?: string;
  productInterest?: string;
  companyWebsite?: string;
}

export interface TriggerWorkflowRequest {
  leadId: string;
}
