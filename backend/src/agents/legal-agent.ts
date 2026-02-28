import { BaseAgent } from './base-agent';
import { LegalResult, CompanyProfileContext } from '../types';
import { LeadDB, DealDB, LegalValidationDB } from '../database/db';

export class LegalAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('legal', 'sonnet', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('legal');
    return `${companyHeader}You are a Legal AI agent. Your job is to review deals for legal compliance.

When reviewing a deal, you must check:
1. Customer tax ID / company registry validity (based on jurisdiction)
2. GDPR compliance - ensure proper consent for data processing
3. Contract terms - payment terms, delivery, liability, warranties
4. Industry-specific regulatory requirements
5. Risk assessment - flag any concerns

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Approved / Rejected / Review Required - brief reason",
  "data": {
    "afmValid": true/false,
    "companyRegistryValid": true/false,
    "gdprCompliant": true/false,
    "contractTermsValid": true/false,
    "riskLevel": "low" | "medium" | "high",
    "riskFlags": ["flag 1", "flag 2"],
    "approvalStatus": "approved" | "rejected" | "review_required",
    "notes": "detailed notes about the review"
  }
}`;
  }

  buildUserPrompt(input: { dealId: number; lead: any; salesResult: any }): string {
    const { lead, salesResult } = input;
    return `Review this deal for legal compliance:

CUSTOMER:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Email: ${lead.contact_email || 'Not provided'}
- Industry: ${lead.industry || 'Unknown'}

DEAL DETAILS:
- Product: ${salesResult.productName}
- Quantity: ${salesResult.quantity}
- Subtotal: €${salesResult.subtotal}
- FPA (24%): €${salesResult.fpaAmount}
- Total: €${salesResult.totalAmount}
- Proposal: ${salesResult.proposalSummary}

Please verify AFM validity, company registry, GDPR compliance, contract terms, and assess risk level.
Note: For this B2B transaction, generate a realistic AFM number for validation purposes.`;
  }

  async reviewDeal(dealId: number, leadId: number, salesResult: any): Promise<LegalResult> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI review
    const result = await this.execute<LegalResult>(
      { dealId, lead, salesResult },
      { dealId, leadId }
    );

    // Store legal validation
    LegalValidationDB.create({
      deal_id: dealId,
      afm_valid: result.data.afmValid,
      afm_number: `${100000000 + Math.floor(Math.random() * 900000000)}`, // Generate mock AFM
      company_registry_valid: result.data.companyRegistryValid,
      gdpr_compliant: result.data.gdprCompliant,
      contract_terms_valid: result.data.contractTermsValid,
      risk_level: result.data.riskLevel,
      risk_flags: JSON.stringify(result.data.riskFlags),
      approval_status: result.data.approvalStatus,
      approval_notes: result.data.notes,
    });

    // Update deal status based on legal review
    if (result.data.approvalStatus === 'approved') {
      DealDB.update(dealId, { status: 'invoicing' });
    } else if (result.data.approvalStatus === 'rejected') {
      DealDB.update(dealId, { status: 'failed' });
    }

    return result;
  }
}
