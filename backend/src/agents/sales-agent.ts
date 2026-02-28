import { BaseAgent } from './base-agent';
import { SalesResult, CompanyProfileContext } from '../types';
import { LeadDB, DealDB, Lead } from '../database/db';
import { TaskQueue } from '../services/task-queue';

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
    return `Evaluate this qualified lead and decide on deal closure:

LEAD INFORMATION:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email || 'no email'})
- Product Interest: ${lead.product_interest || 'General inquiry'}
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
      // Create deal in database
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
        status: 'legal_review',
      });

      // Update lead status
      LeadDB.update(leadId, { status: 'converted' });

      // Create task for Legal Agent
      TaskQueue.createTask({
        sourceAgent: 'sales',
        targetAgent: 'legal',
        taskType: 'review_contract',
        title: `Legal review: ${lead.company_name}`,
        description: `Deal value: €${result.data.totalAmount.toFixed(2)}`,
        inputData: { dealId, leadId, salesResult: result.data },
        dealId,
        leadId,
      });

      // Create task for Accounting Agent
      TaskQueue.createTask({
        sourceAgent: 'sales',
        targetAgent: 'accounting',
        taskType: 'generate_invoice',
        title: `Generate invoice: ${lead.company_name}`,
        description: `Amount: €${result.data.totalAmount.toFixed(2)}`,
        inputData: { dealId, leadId, salesResult: result.data },
        dealId,
        leadId,
      });

      // Create task for Email (proposal confirmation)
      TaskQueue.createTask({
        sourceAgent: 'sales',
        targetAgent: 'email',
        taskType: 'send_confirmation',
        title: `Send confirmation: ${lead.company_name}`,
        description: `Confirm deal closure to ${lead.contact_name}`,
        inputData: { dealId, leadId, salesResult: result.data, emailType: 'confirmation' },
        dealId,
        leadId,
      });

      return { salesResult: result, dealId };
    }

    // If not closing, update lead status
    LeadDB.update(leadId, { status: result.data.qualification === 'nurture' ? 'contacted' : 'rejected' });
    return { salesResult: result };
  }
}
