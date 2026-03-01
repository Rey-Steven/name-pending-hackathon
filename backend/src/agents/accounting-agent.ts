import { BaseAgent } from './base-agent';
import { AccountingResult, CompanyProfileContext } from '../types';
import { LeadDB, InvoiceDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';

export class AccountingAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('accounting', 'opus', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('accounting');
    return `${companyHeader}You are an Accounting AI agent. Your job is to generate compliant invoices.

When generating an invoice, you must:
1. Create proper line items with descriptions matching the company's products/services
2. Calculate amounts correctly (subtotal, applicable tax, total)
3. Set appropriate payment terms for the industry
4. Create ledger entries (debit/credit)

Invoice requirements:
- Invoice number format: YYYY/NNN (e.g., 2026/001)
- Include customer tax ID information
- Apply the correct tax rate for the jurisdiction
- Payment terms: typically Net 30 days
- Due date: 30 days from invoice date

Accounting entries for a sale:

- DR: Accounts Receivable (total amount including tax)
- CR: Revenue (subtotal before tax)
- CR: Tax Payable (tax amount)

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Invoice generated - brief summary",
  "data": {
    "invoiceNumber": "will be overridden",
    "invoiceDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD",
    "lineItems": [
      {"description": "item", "quantity": 1, "unitPrice": 0, "total": 0}
    ],
    "subtotal": 0,
    "fpaRate": 0.24,
    "fpaAmount": 0,
    "totalAmount": 0,
    "paymentTerms": "Net 30 days",
    "ledgerEntries": [
      {"account": "Accounts Receivable", "debit": 0, "credit": 0},
      {"account": "Revenue", "debit": 0, "credit": 0},
      {"account": "Tax Payable", "debit": 0, "credit": 0}
    ]
  }
}`;
  }

  buildUserPrompt(input: { dealId: string; lead: any; salesResult: any }): string {
    const { lead, salesResult } = input;
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return `Generate a Greek invoice for this closed deal:

CUSTOMER:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Email: ${lead.contact_email || 'Not provided'}

DEAL DETAILS:
- Product: ${salesResult.productName}
- Quantity: ${salesResult.quantity}
- Unit Price: €${salesResult.unitPrice}
- Subtotal: €${salesResult.subtotal}
- FPA (24%): €${salesResult.fpaAmount}
- Total: €${salesResult.totalAmount}

Today's date: ${today}
Due date: ${dueDate}

Generate the full invoice and accounting entries.`;
  }

  async generateInvoice(dealId: string, leadId: string, salesResult: any): Promise<AccountingResult> {
    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'accounting',
      targetAgent: 'accounting',
      taskType: 'generate_invoice',
      title: `Generate invoice: deal #${dealId}`,
      inputData: { dealId },
      dealId,
      leadId,
      companyId: this.companyProfile?.id,
    });

    try {
      const result = await this.execute<AccountingResult>(
        { dealId, lead, salesResult },
        { dealId, leadId, taskId }
      );

      const invoiceNumber = await InvoiceDB.getNextInvoiceNumber();

      const invoiceId = await InvoiceDB.create({
        company_id: this.companyProfile?.id,
        deal_id: dealId,
        invoice_number: invoiceNumber,
        invoice_date: result.data.invoiceDate,
        due_date: result.data.dueDate,
        customer_name: lead.company_name,
        customer_afm: `${100000000 + Math.floor(Math.random() * 900000000)}`,
        customer_doy: 'ΔΟΥ Αθηνών',
        customer_address: 'Αθήνα, Ελλάδα',
        customer_email: lead.contact_email || '',
        line_items: JSON.stringify(result.data.lineItems),
        subtotal: result.data.subtotal,
        fpa_rate: result.data.fpaRate,
        fpa_amount: result.data.fpaAmount,
        total_amount: result.data.totalAmount,
        payment_terms: result.data.paymentTerms,
        status: 'draft',
      });

      await TaskQueue.complete(taskId, { invoiceId, invoiceNumber });

      await TaskQueue.createTask({
        sourceAgent: 'accounting',
        targetAgent: 'email',
        taskType: 'send_invoice',
        title: `Send invoice ${invoiceNumber}: ${lead.company_name}`,
        description: `Invoice amount: €${result.data.totalAmount.toFixed(2)}`,
        inputData: {
          dealId,
          leadId,
          invoiceId,
          invoiceNumber,
          invoiceData: result.data,
          emailType: 'invoice',
        },
        dealId,
        leadId,
        companyId: this.companyProfile?.id,
      });

      return result;
    } catch (error: any) {
      await TaskQueue.fail(taskId, error.message);
      throw error;
    }
  }
}
