import { BaseAgent } from './base-agent';
import { MarketingResult, CompanyProfileContext } from '../types';
import { LeadDB, Lead } from '../database/db';
import { TaskQueue } from '../services/task-queue';

export class MarketingAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('marketing', 'sonnet', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('marketing');
    return `${companyHeader}You are a Marketing AI agent. Your job is to enrich and qualify incoming leads.

When given a lead, you must:
1. Analyze the company name and any available information
2. Infer the industry, company size, and annual revenue estimate
3. Score the lead quality (A = high value, B = medium, C = low) based on fit with your company's target customers
4. Recommend a sales approach tailored to your company's product/service

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1 of your analysis", "step 2", "..."],
  "decision": "Lead scored as X - brief summary",
  "data": {
    "industry": "the industry",
    "companySize": "e.g., 10-50 employees",
    "annualRevenue": "e.g., €500K-2M",
    "leadScore": "A" | "B" | "C",
    "recommendedApproach": "brief strategy recommendation"
  }
}`;
  }

  buildUserPrompt(lead: Lead): string {
    return `Analyze and qualify this incoming lead:

Company Name: ${lead.company_name}
Contact Person: ${lead.contact_name}
Email: ${lead.contact_email || 'Not provided'}
Phone: ${lead.contact_phone || 'Not provided'}
Product Interest: ${lead.product_interest || 'General inquiry'}
Website: ${lead.company_website || 'Not provided'}

Provide your analysis and lead score.`;
  }

  async processLead(leadId: number): Promise<MarketingResult> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI analysis
    const result = await this.execute<MarketingResult>(lead, { leadId });

    // Update lead with enriched data
    LeadDB.update(leadId, {
      industry: result.data.industry,
      company_size: result.data.companySize,
      annual_revenue: result.data.annualRevenue,
      lead_score: result.data.leadScore,
      status: 'qualified',
    });

    // Create task for Sales Agent
    TaskQueue.createTask({
      sourceAgent: 'marketing',
      targetAgent: 'sales',
      taskType: 'qualify_lead',
      title: `Qualify lead: ${lead.company_name}`,
      description: `Lead score: ${result.data.leadScore} - ${result.decision}`,
      inputData: { leadId, marketingResult: result.data },
      leadId,
    });

    return result;
  }
}
