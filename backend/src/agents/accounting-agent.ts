import { BaseAgent } from './base-agent';
import { AccountingResult, CompanyProfileContext } from '../types';
import { LeadDB, InvoiceDB, DealDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { getElorusService, getOrCreateElorusContact } from '../services/elorus-service';

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

      // Try Elorus first
      const companyId = this.companyProfile?.id;
      const elorusService = companyId ? await getElorusService(companyId) : null;
      let invoicePermalink: string | undefined;

      if (elorusService) {
        // Create Elorus invoice
        const elorusContactId = await getOrCreateElorusContact(elorusService, lead);

        // Fetch taxes and invoice document types in parallel
        const [taxes, docTypes] = await Promise.all([
          elorusService.listTaxes({ active: 'true' }),
          elorusService.listDocumentTypes({ application: 1, active: 'true' }),
        ]);

        const fpaTax = (taxes.results || []).find(
          (t: any) => parseFloat(t.percentage || '0') === 24
        );

        const invoiceDocType = (docTypes.results || []).find((dt: any) => dt.default) || docTypes.results?.[0];

        // Create invoice as draft first (same pattern as estimates — issuing directly with draft:false causes 400)
        const draftInvoice = await elorusService.createInvoice({
          client: elorusContactId,
          date: result.data.invoiceDate,
          due_days: 30,
          draft: true,
          calculator_mode: 'initial',
          currency_code: 'EUR',
          ...(invoiceDocType && { documenttype: invoiceDocType.id }),
          items: result.data.lineItems.map((item: any) => ({
            title: item.description,
            quantity: String(item.quantity),
            unit_value: String(item.unitPrice),
            taxes: fpaTax ? [{ tax: fpaTax.id }] : [],
          })),
        });

        // Issue the invoice (mark as non-draft)
        const invoice = await elorusService.updateInvoice(draftInvoice.id, { draft: false });
        invoicePermalink = invoice.permalink;

        // Store Elorus invoice ID (and permalink if available) on the deal
        await DealDB.update(dealId, {
          elorus_invoice_id: invoice.id,
          ...(invoicePermalink && { elorus_invoice_permalink: invoicePermalink }),
        } as any);
        console.log(`  📄 Elorus invoice issued: ${invoice.id}${invoicePermalink ? ` (${invoicePermalink})` : ''}`);

        await TaskQueue.complete(taskId, { elorusInvoiceId: invoice.id, invoicePermalink });
      } else {
        // Fallback to local invoice storage
        console.log('  ⚠️ Elorus not configured — creating local invoice record');

        const invoiceNumber = await InvoiceDB.getNextInvoiceNumber();

        const invoiceId = await InvoiceDB.create({
          company_id: companyId,
          deal_id: dealId,
          invoice_number: invoiceNumber,
          invoice_date: result.data.invoiceDate,
          due_date: result.data.dueDate,
          customer_name: lead.company_name,
          customer_afm: lead.vat_id || `${100000000 + Math.floor(Math.random() * 900000000)}`,
          customer_doy: lead.tax_office || 'ΔΟΥ Αθηνών',
          customer_address: lead.address || 'Αθήνα, Ελλάδα',
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
      }

      await TaskQueue.createTask({
        sourceAgent: 'accounting',
        targetAgent: 'email',
        taskType: 'send_invoice',
        title: `Send invoice: ${lead.company_name}`,
        description: `Invoice amount: €${result.data.totalAmount.toFixed(2)}`,
        inputData: {
          dealId,
          leadId,
          invoiceData: result.data,
          emailType: 'invoice',
          ...(invoicePermalink && { invoicePermalink }),
        },
        dealId,
        leadId,
        companyId,
      });

      return result;
    } catch (error: any) {
      // Surface Elorus API validation details when available
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`  ❌ Invoice generation failed: ${detail}`);
      await TaskQueue.fail(taskId, detail);
      throw new Error(detail);
    }
  }
}
