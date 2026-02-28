import { BaseAgent } from './base-agent';
import { AccountingResult } from '../types';
import { LeadDB, InvoiceDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';

export class AccountingAgent extends BaseAgent {
  constructor() {
    super('accounting', 'haiku');
  }

  getSystemPrompt(): string {
    return `You are an Accounting AI agent for a Greek B2B company. Your job is to generate compliant Greek invoices.

When generating an invoice, you must:
1. Create proper line items with descriptions
2. Calculate amounts correctly (subtotal, FPA at 24%, total)
3. Set appropriate payment terms
4. Create ledger entries (debit/credit)

Greek invoice requirements:
- Invoice number format: YYYY/NNN (e.g., 2026/001)
- Must include customer AFM (ΑΦΜ) and DOY (ΔΟΥ - tax office)
- FPA (ΦΠΑ) rate: 24% for standard goods/services
- Payment terms: typically Net 30 days
- Due date: 30 days from invoice date
- All amounts in EUR (€)

Accounting entries for a sale:
- DR: Accounts Receivable (total amount including FPA)
- CR: Revenue (subtotal before FPA)
- CR: FPA Payable (FPA amount)

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
      {"account": "FPA Payable", "debit": 0, "credit": 0}
    ]
  }
}`;
  }

  buildUserPrompt(input: { dealId: number; lead: any; salesResult: any }): string {
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

  async generateInvoice(dealId: number, leadId: number, salesResult: any): Promise<AccountingResult> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI
    const result = await this.execute<AccountingResult>(
      { dealId, lead, salesResult },
      { dealId, leadId }
    );

    // Get next invoice number from database
    const invoiceNumber = InvoiceDB.getNextInvoiceNumber();

    // Create invoice in database
    const invoiceId = InvoiceDB.create({
      deal_id: dealId,
      invoice_number: invoiceNumber,
      invoice_date: result.data.invoiceDate,
      due_date: result.data.dueDate,
      customer_name: lead.company_name,
      customer_afm: `${100000000 + Math.floor(Math.random() * 900000000)}`, // Mock AFM
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

    // Create task for Email to send invoice
    TaskQueue.createTask({
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
    });

    return result;
  }
}
