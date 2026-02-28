import { BaseAgent } from './base-agent';
import { EmailResult, CompanyProfileContext } from '../types';
import { LeadDB, EmailDB } from '../database/db';
import { sendRealEmail } from '../services/email-transport';

export class EmailService extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('email', 'haiku', companyProfile);
  }

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('email');
    return `${companyHeader}You are an Email Notifications AI agent. Your job is to compose professional business emails.

When composing an email, you must:
1. Determine the appropriate tone based on the company's style and the customer relationship
2. Write in the language appropriate for the company's geographic focus and customers
3. Include all relevant business information
4. Be professional and concise

Email types:
- "proposal": Business proposal with pricing (invite customer to reply to discuss/accept)
- "confirmation": Deal closure confirmation
- "invoice": Invoice delivery email
- "follow_up": Follow-up message

IMPORTANT: The recipientEmail MUST be the exact email from the RECIPIENT section below. Do not make up emails.

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Email composed - type and recipient",
  "data": {
    "subject": "email subject line",
    "body": "full email body",
    "recipientEmail": "MUST use exact email from recipient info",
    "recipientName": "name",
    "emailType": "proposal" | "confirmation" | "invoice" | "follow_up"
  }
}`;
  }

  buildUserPrompt(input: { lead: any; emailType: string; salesResult?: any; invoiceData?: any; invoiceNumber?: string }): string {
    const { lead, emailType, salesResult, invoiceData, invoiceNumber } = input;

    let context = '';
    if (emailType === 'proposal' && salesResult) {
      context = `
PROPOSAL TO SEND:
- Product: ${salesResult.productName}
- Quantity: ${salesResult.quantity}
- Unit Price: €${salesResult.unitPrice}
- Subtotal: €${salesResult.subtotal}
- FPA (24%): €${salesResult.fpaAmount}
- Total Amount: €${salesResult.totalAmount}
- Payment Terms: Net 30 days
- Proposal Summary: ${salesResult.proposalSummary}

Compose a professional proposal email that:
1. Presents the offer with full pricing breakdown
2. Highlights the value proposition
3. CLEARLY invites the customer to reply - either to accept or to discuss/negotiate terms
4. Make it clear they can reply directly to this email`;
    } else if (emailType === 'confirmation' && salesResult) {
      context = `
DEAL CONFIRMED:
- Product: ${salesResult.productName}
- Amount: €${salesResult.totalAmount}
- The deal has been closed successfully after negotiation.
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
- Email: ${lead.contact_email}

TYPE: ${emailType}
${context}

Write the email in Greek language. Use the EXACT email address "${lead.contact_email}" as the recipientEmail.`;
  }

  async sendEmail(
    leadId: number,
    emailType: 'proposal' | 'confirmation' | 'invoice' | 'follow_up',
    context: { dealId?: number; salesResult?: any; invoiceData?: any; invoiceNumber?: string; invoiceId?: number }
  ): Promise<EmailResult> {
    const lead = LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Execute AI to compose email
    const result = await this.execute<EmailResult>(
      { lead, emailType, ...context },
      { dealId: context.dealId, leadId }
    );

    // Use the lead's actual email, not whatever the AI returns
    const recipientEmail = lead.contact_email || result.data.recipientEmail;
    const recipientName = result.data.recipientName || lead.contact_name;

    // Send real email via Gmail SMTP
    const sendResult = await sendRealEmail({
      to: recipientEmail,
      subject: result.data.subject,
      body: result.data.body,
    });

    // Store email in database
    EmailDB.create({
      task_id: undefined,
      deal_id: context.dealId,
      invoice_id: context.invoiceId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject: result.data.subject,
      body: result.data.body,
      email_type: emailType,
      status: sendResult.sent ? 'sent' : 'failed',
      error_message: sendResult.error,
    });

    console.log(`\n  📧 EMAIL ${sendResult.sent ? '✅ DELIVERED' : '⚠️ LOGGED'}:`);
    console.log(`     To: ${recipientEmail}`);
    console.log(`     Subject: ${result.data.subject}`);
    console.log(`     Body preview: ${result.data.body.slice(0, 100)}...`);
    if (sendResult.messageId) {
      console.log(`     Message ID: ${sendResult.messageId}`);
    }

    return result;
  }
}
