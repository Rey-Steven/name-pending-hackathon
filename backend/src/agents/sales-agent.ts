import { BaseAgent } from './base-agent';
import { SalesResult, NegotiationResult, CompanyProfileContext } from '../types';
import { LeadDB, DealDB, Lead } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { callAI, parseJSONResponse } from '../services/ai-service';
import { AuditLog } from '../database/db';
import { broadcastEvent } from '../routes/dashboard.routes';

const TEST_EMAIL_ALLOWLIST = new Set([
  'k.kayioulis@butler.gr',
  's.vasos@butler.gr',
  'kagioulis.kostas@gmail.com',
  'stevenvasos@gmail.com',
  'co.scoo.bydoo@gmail.com',
]);

function isAllowedTestEmail(email?: string): boolean {
  if (!email) return false;
  return TEST_EMAIL_ALLOWLIST.has(email.toLowerCase());
}

export class SalesAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('sales', 'sonnet', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('sales');
    return `${companyHeader}You are a Sales AI agent. Your job is to qualify leads and close deals.

When given a qualified lead, you must:
1. Evaluate using BANT criteria (Budget, Authority, Need, Timeline)
2. Determine if the deal should be closed, nurtured, or rejected
3. If closing, calculate pricing appropriate to the company's product/service
4. Generate a brief proposal summary

Pricing guidelines:
- Base unit price: calculate based on the company's products/services and the lead's company size
- Volume discounts: 5% for orders > €10K, 10% for > €50K
- Include applicable VAT/tax
- Payment terms: Net 30 days standard

Important qualification rules:
- Never set qualification = "reject" solely because of email domain quality (free/personal domain, gmail, or test-looking inbox).
- Approved test emails must be treated as valid for demo/testing and should not reduce qualification.
- Reject only for clear business disqualification (no fit, no need, no budget, or explicit refusal). If uncertain, prefer "nurture".

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Close deal / Nurture / Reject - brief reason",
  "data": {
    "qualification": "close" | "nurture" | "reject",
    "budget": true/false,
    "authority": true/false,
    "need": true/false,
    "timeline": true/false,
    "productName": "the product/service",
    "quantity": 1,
    "unitPrice": 0,
    "subtotal": 0,
    "fpaRate": 0.24,
    "fpaAmount": 0,
    "totalAmount": 0,
    "proposalSummary": "brief proposal text"
  }
}`;
  }

  buildUserPrompt(input: { lead: Lead; marketingResult: any }): string {
    const { lead, marketingResult } = input;
    const testEmailOverride = isAllowedTestEmail(lead.contact_email);
    return `Evaluate this qualified lead and decide on deal closure:

LEAD INFORMATION:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email || 'no email'})
- Test Email Override: ${testEmailOverride ? 'YES - approved test email, treat as valid contact' : 'NO'}
- Website: ${lead.company_website || 'N/A'}

MARKETING ANALYSIS:
- Industry: ${marketingResult.industry}
- Company Size: ${marketingResult.companySize}
- Annual Revenue: ${marketingResult.annualRevenue}
- Lead Score: ${marketingResult.leadScore}
- Recommended Approach: ${marketingResult.recommendedApproach}

Evaluate BANT criteria, decide to close/nurture/reject, and calculate pricing if closing.`;
  }

  async processDeal(leadId: number, marketingResult: any): Promise<{ salesResult: SalesResult; dealId?: number }> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI analysis
    const result = await this.execute<SalesResult>({ lead, marketingResult }, { leadId });

    if (result.data.qualification === 'close') {
      // Create deal with 'proposal_sent' status — NOT 'legal_review'
      // Legal/Accounting only run after customer accepts the proposal
      const dealId = DealDB.create({
        lead_id: leadId,
        deal_value: result.data.subtotal,
        product_name: result.data.productName,
        quantity: result.data.quantity,
        subtotal: result.data.subtotal,
        fpa_rate: result.data.fpaRate,
        fpa_amount: result.data.fpaAmount,
        total_amount: result.data.totalAmount,
        qualification_result: JSON.stringify({
          budget: result.data.budget,
          authority: result.data.authority,
          need: result.data.need,
          timeline: result.data.timeline,
        }),
        sales_notes: result.data.proposalSummary,
        negotiation_round: 0,
        status: 'proposal_sent',
      });

      // Update lead status
      LeadDB.update(leadId, { status: 'contacted' });

      // Create ONLY the proposal email task — no Legal/Accounting yet
      TaskQueue.createTask({
        sourceAgent: 'sales',
        targetAgent: 'email',
        taskType: 'send_proposal',
        title: `Send proposal: ${lead.company_name}`,
        description: `Proposal for €${result.data.totalAmount.toFixed(2)} - awaiting customer reply`,
        inputData: { dealId, leadId, salesResult: result.data, emailType: 'proposal' },
        dealId,
        leadId,
      });

      return { salesResult: result, dealId };
    }

    // If not closing, update lead status
    LeadDB.update(leadId, { status: result.data.qualification === 'nurture' ? 'contacted' : 'rejected' });
    return { salesResult: result };
  }

  // Negotiation: analyze customer reply and decide next action
  async negotiateReply(params: {
    dealId: number;
    leadId: number;
    customerReply: string;
    currentDeal: any;
    roundNumber: number;
    maxRounds: number;
  }): Promise<NegotiationResult> {
    const { dealId, leadId, customerReply, currentDeal, roundNumber, maxRounds } = params;
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const isLastRound = roundNumber >= maxRounds;

    const systemPrompt = `You are a Sales Negotiation AI agent for a Greek B2B company. A customer has replied to your proposal and you must analyze their response and decide the next action.

You are in negotiation round ${roundNumber} of ${maxRounds} maximum rounds.

RULES:
- If the customer ACCEPTS the offer (positive response, agrees to terms, wants to proceed): action = "accept"
- If the customer DECLINES or has objections but negotiation is possible: action = "counter_offer"
  - You may adjust price by up to 15% total from original
  - You may adjust payment terms (Net 30 → Net 45/60)
  - You may add value (free shipping, extended warranty, volume bonus)
  - Always maintain minimum 10% margin
- If this is the LAST round (${isLastRound ? 'YES - THIS IS THE LAST ROUND' : 'no'}), or customer firmly refuses: action = "give_up"
  - Provide a detailed failureReason analyzing WHY the deal did not go through

IMPORTANT: Write the responseBody in Greek language. This is the email that will be sent to the customer.
${isLastRound ? '\nIMPORTANT: This is the FINAL round. If the customer has not accepted, you MUST give_up and provide a failureReason.' : ''}

ALWAYS respond with valid JSON:
{
  "reasoning": ["step 1 - analyze customer reply", "step 2 - evaluate objection", "step 3 - decide action", "..."],
  "decision": "Brief description of negotiation decision",
  "data": {
    "action": "accept" | "counter_offer" | "give_up",
    "customerSentiment": "positive" | "neutral" | "negative",
    "objectionSummary": "What the customer objects to",
    "revisedSubtotal": null or new number,
    "revisedFpaAmount": null or new number,
    "revisedTotal": null or new number,
    "revisedTerms": null or "new payment terms",
    "responseSubject": "Re: original subject in Greek",
    "responseBody": "Full email reply in Greek",
    "failureReason": null or "detailed analysis of why deal failed"
  }
}`;

    const userPrompt = `CURRENT DEAL:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email})
- Product: ${currentDeal.product_name}
- Current Price: €${currentDeal.subtotal} + FPA (24%) = €${currentDeal.total_amount}
- Payment Terms: Net 30 days
- Negotiation Round: ${roundNumber} of ${maxRounds}

CUSTOMER'S REPLY:
"${customerReply}"

Analyze the customer's reply and decide your next move. Write your response email in Greek.`;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`  🤝 SALES NEGOTIATION - Round ${roundNumber}/${maxRounds}`);
    console.log(`  📋 Deal #${dealId} - ${lead.company_name}`);
    console.log(`${'='.repeat(50)}`);

    broadcastEvent({
      type: 'agent_started',
      agent: 'sales',
      dealId,
      leadId,
      message: `Sales negotiation round ${roundNumber} - analyzing customer reply`,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await callAI(systemPrompt, userPrompt, 'sonnet');
      const result = parseJSONResponse<NegotiationResult>(response.content);

      // Log reasoning
      if (result.reasoning) {
        console.log(`\n  🧠 Negotiation reasoning:`);
        result.reasoning.forEach((step, i) => {
          console.log(`     ${i + 1}. ${step}`);
        });
      }
      console.log(`  📋 Decision: ${result.decision}`);
      console.log(`  🎯 Action: ${result.data.action}`);
      console.log(`  💭 Sentiment: ${result.data.customerSentiment}`);
      console.log(`  📝 Objection: ${result.data.objectionSummary}`);

      if (result.data.action === 'counter_offer' && result.data.revisedTotal) {
        console.log(`  💰 Revised price: €${result.data.revisedTotal}`);
      }
      if (result.data.action === 'give_up' && result.data.failureReason) {
        console.log(`  ❌ Why deal failed: ${result.data.failureReason}`);
      }

      broadcastEvent({
        type: 'agent_completed',
        agent: 'sales',
        dealId,
        leadId,
        message: `Negotiation round ${roundNumber}: ${result.data.action} - ${result.decision}`,
        reasoning: result.reasoning,
        data: result.data,
        timestamp: new Date().toISOString(),
      });

      AuditLog.log('sales', 'negotiation_round', 'deal', dealId, {
        round: roundNumber,
        action: result.data.action,
        sentiment: result.data.customerSentiment,
        objection: result.data.objectionSummary,
        revisedTotal: result.data.revisedTotal,
        failureReason: result.data.failureReason,
      });

      return result;
    } catch (error: any) {
      console.error(`  ❌ Negotiation failed: ${error.message}`);

      broadcastEvent({
        type: 'agent_failed',
        agent: 'sales',
        dealId,
        leadId,
        message: `Negotiation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}
