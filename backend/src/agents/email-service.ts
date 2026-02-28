import { BaseAgent } from './base-agent';
import { EmailResult } from '../types';
import { LeadDB, EmailDB } from '../database/db';

export class EmailService extends BaseAgent {
  constructor() {
    super('email', 'haiku');
  }

  getSystemPrompt(): string {
    return `You are an Email Notifications AI agent for a Greek B2B company. Your job is to compose professional emails in Greek.

When composing an email, you must:
1. Determine the appropriate tone (formal for new customers, warmer for existing)
2. Write in Greek language
3. Include all relevant business information
4. Be professional and concise

Email types:
- "confirmation": Deal closure confirmation
- "invoice": Invoice delivery email
- "follow_up": Follow-up message

Greek business email conventions:
- Start with: "Αξιότιμε/η κ." (Dear Mr./Ms.) for formal
- End with: "Με εκτίμηση" (With respect) or "Σας ευχαριστούμε" (Thank you)
- Include company name and contact details
- Reference invoice numbers when applicable

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Email composed - type and recipient",
  "data": {
    "subject": "email subject line in Greek",
    "body": "full email body in Greek",
    "recipientEmail": "email@example.com",
    "recipientName": "name",
    "emailType": "confirmation" | "invoice" | "follow_up"
  }
}`;
  }

  buildUserPrompt(input: { lead: any; emailType: string; salesResult?: any; invoiceData?: any; invoiceNumber?: string }): string {
    const { lead, emailType, salesResult, invoiceData, invoiceNumber } = input;

    let context = '';
    if (emailType === 'confirmation' && salesResult) {
      context = `
DEAL CONFIRMED:
- Product: ${salesResult.productName}
- Amount: €${salesResult.totalAmount}
- The deal has been closed successfully.
Compose a confirmation email thanking the customer.`;
    } else if (emailType === 'invoice' && invoiceData) {
      context = `
INVOICE TO SEND:
- Invoice Number: ${invoiceNumber}
- Subtotal: €${invoiceData.subtotal}
- FPA (24%): €${invoiceData.fpaAmount}
- Total: €${invoiceData.totalAmount}
- Payment Terms: ${invoiceData.paymentTerms}
- Due Date: ${invoiceData.dueDate}
Compose an invoice delivery email with payment instructions.`;
    } else {
      context = `
Compose a professional follow-up email.`;
    }

    return `Compose a professional Greek email:

RECIPIENT:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Email: ${lead.contact_email || 'customer@example.gr'}

TYPE: ${emailType}
${context}

Write the email in Greek language.`;
  }

  async sendEmail(
    leadId: number,
    emailType: 'confirmation' | 'invoice' | 'follow_up',
    context: { dealId?: number; salesResult?: any; invoiceData?: any; invoiceNumber?: string; invoiceId?: number }
  ): Promise<EmailResult> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI to compose email
    const result = await this.execute<EmailResult>(
      { lead, emailType, ...context },
      { dealId: context.dealId, leadId }
    );

    // Store email in database
    const emailId = EmailDB.create({
      task_id: undefined,
      deal_id: context.dealId,
      invoice_id: context.invoiceId,
      recipient_email: result.data.recipientEmail || lead.contact_email || 'customer@example.gr',
      recipient_name: result.data.recipientName || lead.contact_name,
      subject: result.data.subject,
      body: result.data.body,
      email_type: emailType,
      status: 'sent', // For demo, mark as sent immediately
    });

    console.log(`\n  📧 EMAIL SENT:`);
    console.log(`     To: ${result.data.recipientEmail || lead.contact_email}`);
    console.log(`     Subject: ${result.data.subject}`);
    console.log(`     Body preview: ${result.data.body.slice(0, 100)}...`);

    return result;
  }
}
