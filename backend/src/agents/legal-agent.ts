import { BaseAgent } from './base-agent';
import { LegalResult, CompanyProfileContext } from '../types';
import { LeadDB, DealDB, LegalValidationDB, CompanyProfileDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { generateContractPDF } from '../services/pdf-generator';
import { EmailAgent } from './email-agent';

export class LegalAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('legal', 'opus', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('legal');
    const tos = this.companyProfile?.terms_of_service
      ? `\n\nOUR STANDARD SERVICE AGREEMENT TEMPLATE:\n${this.companyProfile.terms_of_service}`
      : '';

    return `${companyHeader}You are a Legal AI agent. Your job is to review B2B deals for compliance and generate a service contract.${tos}

When reviewing a deal:

1. IDENTITY & REGISTRY VERIFICATION:
   - If AFM (ΑΦΜ) is provided, treat it as verified — the lead was created via official ΓΕΜΗ lookup.
   - If ΓΕΜΗ number is provided, treat company registry as confirmed.
   - Only flag afmValid=false or companyRegistryValid=false if these fields are explicitly missing from the lead data provided to you.

2. GDPR: For B2B SaaS/services in Greece, standard GDPR B2B clauses in the contract are sufficient. Do not flag GDPR as non-compliant unless the deal involves processing of special category data.

3. CONTRACT: Generate a complete service contract adapted from the standard template above (or create one if no template is provided). Substitute all placeholders with the actual deal values. The contract should be professional, concise, and ready to send.

4. RISK ASSESSMENT: Only flag high risk for genuinely suspicious patterns (e.g., no identity information at all, contradictory data). A personal email alongside verified company data is low/medium risk at most.

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "step 3"],
  "decision": "Approved / Rejected / Review Required - brief reason",
  "data": {
    "afmValid": true/false,
    "companyRegistryValid": true/false,
    "gdprCompliant": true/false,
    "contractTermsValid": true/false,
    "riskLevel": "low" | "medium" | "high",
    "riskFlags": ["flag 1"],
    "approvalStatus": "approved" | "rejected" | "review_required",
    "notes": "brief summary of review outcome",
    "contractText": "Full plain-text service contract with all placeholders substituted. Ready to attach as PDF."
  }
}`;
  }

  buildUserPrompt(input: { dealId: string; lead: any; salesResult: any }): string {
    const { lead, salesResult } = input;

    const identityLines = [
      `- Company: ${lead.company_name}`,
      `- Contact: ${lead.contact_name}`,
      `- Email: ${lead.contact_email || 'Not provided'}`,
      `- Phone: ${lead.contact_phone || 'Not provided'}`,
      `- ΑΦΜ (VAT ID): ${lead.vat_id || 'NOT PROVIDED'}`,
      `- ΓΕΜΗ (Registry): ${lead.gemi_number || 'NOT PROVIDED'}`,
      `- ΔΟΥ (Tax Office): ${lead.tax_office || 'Not provided'}`,
      `- Legal Form: ${lead.legal_form || 'Not provided'}`,
      `- Address: ${[lead.address, lead.city, lead.postal_code].filter(Boolean).join(', ') || 'Not provided'}`,
      `- Industry: ${lead.industry || 'Not specified'}`,
      `- Website: ${lead.company_website || 'Not provided'}`,
    ];

    return `Review this B2B deal for legal compliance and generate the service contract:

CUSTOMER IDENTITY:
${identityLines.join('\n')}

DEAL DETAILS:
- Product/Service: ${salesResult.productName}
- Quantity: ${salesResult.quantity}
- Subtotal: €${salesResult.subtotal}
- FPA (24%): €${salesResult.fpaAmount}
- Total: €${salesResult.totalAmount}
- Summary: ${salesResult.proposalSummary || 'Standard service agreement'}

IMPORTANT:
- ΑΦΜ and ΓΕΜΗ provided above were populated via the official ΓΕΜΗ registry — treat them as verified.
- Generate the full contractText using the standard template, substituting [CLIENT_NAME]=${lead.company_name}, [CLIENT_AFM]=${lead.vat_id || 'N/A'}, [DATE]=today, [PRODUCT]=${salesResult.productName}, [AMOUNT]=€${salesResult.totalAmount}.
- Keep contractText as plain text (no markdown).`;
  }

  async reviewDeal(dealId: string, leadId: string, salesResult: any): Promise<LegalResult> {
    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'legal',
      targetAgent: 'legal',
      taskType: 'legal_review',
      title: `Legal review: deal #${dealId}`,
      inputData: { dealId },
      dealId,
      leadId,
      companyId: this.companyProfile?.id,
    });

    try {
      const result = await this.execute<LegalResult>(
        { dealId, lead, salesResult },
        { dealId, leadId, taskId }
      );

      await LegalValidationDB.create({
        company_id: this.companyProfile?.id,
        deal_id: dealId,
        afm_valid: result.data.afmValid,
        afm_number: lead.vat_id || '',
        company_registry_valid: result.data.companyRegistryValid,
        gdpr_compliant: result.data.gdprCompliant,
        contract_terms_valid: result.data.contractTermsValid,
        risk_level: result.data.riskLevel,
        risk_flags: JSON.stringify(result.data.riskFlags),
        approval_status: result.data.approvalStatus,
        approval_notes: result.data.notes,
      });

      if (result.data.approvalStatus === 'approved') {
        await DealDB.update(dealId, { status: 'invoicing' });
      } else if (result.data.approvalStatus === 'rejected') {
        await DealDB.update(dealId, { status: 'failed' });
      }

      // Send contract PDF to the customer (for approved or review_required)
      if (result.data.contractText && result.data.approvalStatus !== 'rejected' && lead.contact_email) {
        try {
          await this.sendContractEmail(dealId, lead, salesResult, result.data.contractText);
        } catch (emailErr: any) {
          console.error(`  ⚠️ Contract email failed (non-fatal): ${emailErr.message}`);
        }
      }

      await TaskQueue.complete(taskId, { approvalStatus: result.data.approvalStatus, riskLevel: result.data.riskLevel });

      return result;
    } catch (error: any) {
      await TaskQueue.fail(taskId, error.message);
      throw error;
    }
  }

  private async sendContractEmail(dealId: string, lead: any, salesResult: any, contractText: string): Promise<void> {
    const deal = await DealDB.findById(dealId);
    if (!deal) return;

    // Load the raw company profile for PDF generation (needs CompanyProfile type)
    const rawProfile = this.companyProfile?.id
      ? await CompanyProfileDB.getById(this.companyProfile.id)
      : undefined;
    if (!rawProfile) return;

    const pdfBuffer = await generateContractPDF({ deal, lead, companyProfile: rawProfile, contractText });
    const refId = dealId.slice(0, 8).toUpperCase();

    const emailAgent = new EmailAgent(this.companyProfile);
    const lang = this.companyProfile?.communication_language || 'Greek';
    const isGreek = lang.toLowerCase().includes('greek');

    const subject = isGreek
      ? `Σύμβαση Παροχής Υπηρεσιών — ${salesResult.productName} — ${lead.company_name}`
      : `Service Agreement — ${salesResult.productName} — ${lead.company_name}`;

    const body = isGreek
      ? `Αξιότιμε/η ${lead.contact_name},\n\nΣας αποστέλλουμε επισυναπτόμενη τη σύμβαση παροχής υπηρεσιών για την παραγγελία σας (${salesResult.productName}, €${salesResult.totalAmount}).\n\nΠαρακαλούμε να διαβάσετε τους όρους, να υπογράψετε και να μας επιστρέψετε σκαναρισμένη τη σύμβαση, ή να απαντήσετε σε αυτό το email για οποιαδήποτε ερώτηση.\n\nΜε εκτίμηση,\n${this.companyProfile?.name || 'Η ομάδα μας'}`
      : `Dear ${lead.contact_name},\n\nPlease find attached the service agreement for your order (${salesResult.productName}, €${salesResult.totalAmount}).\n\nKindly review, sign, and return a scanned copy, or reply to this email with any questions.\n\nBest regards,\n${this.companyProfile?.name || 'Our Team'}`;

    await emailAgent.deliver({
      to: lead.contact_email,
      subject,
      body,
      dealId,
      recipientName: lead.contact_name,
      emailType: 'confirmation',
      attachments: [{ filename: `Contract-${refId}.pdf`, content: pdfBuffer }],
    });

    console.log(`  📄 Contract sent to ${lead.contact_email} (${refId})`);
  }
}
