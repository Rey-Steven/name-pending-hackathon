import { BaseAgent } from './base-agent';
import { EmailResult, AgentResponse, CompanyProfileContext } from '../types';
import { LeadDB, EmailDB, DealDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { TaskLogger } from '../services/task-logger';
import {
  sendRealEmail,
  fetchInbox,
  fetchUnread,
  fetchReplies,
  fetchRepliesForDeal,
  InboxEmail,
} from '../services/email-transport';

// ─── Types ───

type EmailAgentMode = 'compose' | 'reply_analysis';

interface ReplyAnalysisResult extends AgentResponse {
  data: {
    subject: string;
    body: string;
    recipientEmail: string;
    recipientName: string;
    replyType: 'answer_question' | 'provide_info' | 'schedule_meeting' | 'escalate' | 'thank_you';
    sentiment: 'positive' | 'neutral' | 'negative';
    requiresHumanReview: boolean;
  };
}

interface DirectDeliveryParams {
  to: string;
  subject: string;
  body: string;
  dealId?: string;
  recipientName?: string;
  emailType: 'cold_outreach' | 'proposal' | 'confirmation' | 'invoice' | 'follow_up' | 'satisfaction' | 'payment_received';
  inReplyTo?: string;
  references?: string;
  invoiceId?: string;
  taskId?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

// ─── Unified Email Agent ───

export class EmailAgent extends BaseAgent {
  private mode: EmailAgentMode = 'compose';

  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('email', 'opus', companyProfile);
  }

  // ─── Prompt routing (mode-switched) ───

  getSystemPrompt(): string {
    if (this.mode === 'reply_analysis') {
      return this.getReplyAnalysisSystemPrompt();
    }
    return this.getComposeSystemPrompt();
  }

  buildUserPrompt(input: any): string {
    if (this.mode === 'reply_analysis') {
      return this.buildReplyAnalysisUserPrompt(input);
    }
    return this.buildComposeUserPrompt(input);
  }

  // ─── Compose mode prompts (from EmailService) ───

  private getComposeSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('email');
    return `${companyHeader}You are an Email Notifications AI agent. Your job is to compose professional business emails.

When composing an email, you must:
1. Determine the appropriate tone based on the company's style and the customer relationship
2. Write in the language appropriate for the company's geographic focus and customers
3. Include all relevant business information
4. Be professional and concise

Email types:
- "cold_outreach": First contact with a new lead — introduce company, NO pricing yet
- "proposal": Business proposal with pricing (invite customer to reply to discuss/accept)
- "confirmation": Deal closure confirmation
- "invoice": Invoice delivery email (may include a payment link)
- "follow_up": Stale offer follow-up reminder (up to 3 attempts)
- "satisfaction": Post-close satisfaction check-in (sent 3 days after deal completes)
- "payment_received": Thank-you email after invoice is marked as paid

IMPORTANT: The recipientEmail MUST be the exact email from the RECIPIENT section below. Do not make up emails.
Keep response concise to avoid truncation:
- reasoning: max 3 short bullet-style items
- subject: max 120 characters
- body: max 220 words

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Email composed - type and recipient",
  "data": {
    "subject": "email subject line",
    "body": "full email body",
    "recipientEmail": "MUST use exact email from recipient info",
    "recipientName": "name",
    "emailType": "cold_outreach" | "proposal" | "confirmation" | "invoice" | "follow_up" | "satisfaction" | "payment_received"
  }
}`;
  }

  private buildComposeUserPrompt(input: { lead: any; emailType: string; salesResult?: any; invoiceData?: any; invoiceNumber?: string; invoicePermalink?: string }): string {
    const { lead, emailType, salesResult, invoiceData, invoiceNumber, invoicePermalink } = input;

    let context = '';
    if (emailType === 'cold_outreach') {
      context = `
COLD OUTREACH — FIRST CONTACT:
- This is our VERY FIRST email to this lead. We have NOT discussed pricing yet.
- Lead's stated interest: ${lead.product_interest || 'general inquiry'}
- Lead's company: ${lead.company_name}

Compose a warm, concise cold outreach email that follows this structure:
1. Open by naming a specific challenge or problem that businesses like theirs typically face (infer from their stated interest — make it feel relevant, not generic)
2. Do NOT introduce our company by name or list our products/services
3. Ask ONE focused, open-ended discovery question about their current situation related to that challenge (e.g. how they currently handle X, what their biggest frustration is with Y)
4. Close with a low-pressure invitation: "Θα χαρούμε να ακούσουμε για την εμπειρία σας" (We'd love to hear about your experience)
The goal is curiosity, not selling. No pricing, no product catalog, no company pitch.`;
    } else if (emailType === 'proposal' && salesResult) {
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
- Invoice Number: ${invoiceNumber || 'N/A'}
- Subtotal: €${invoiceData.subtotal}
- FPA (24%): €${invoiceData.fpaAmount}
- Total: €${invoiceData.totalAmount}
- Payment Terms: ${invoiceData.paymentTerms}
- Due Date: ${invoiceData.dueDate}
${invoicePermalink ? `- Online Payment Link: ${invoicePermalink}` : ''}
Compose an invoice delivery email. ${invoicePermalink ? 'Include the payment link prominently so the customer can pay online.' : 'Include payment instructions.'}`;
    } else if (emailType === 'follow_up' && salesResult) {
      const attempt = (salesResult.followUpCount ?? 0) + 1;
      context = `
STALE PROPOSAL FOLLOW-UP (attempt ${attempt} of 3):
- Product: ${salesResult.productName}
- Total: €${salesResult.totalAmount}
- We sent a proposal ${salesResult.daysSinceProposal ?? 7}+ days ago and have not received a reply.
Compose a polite reminder asking if they had the chance to review our proposal and if they have any questions or would like to discuss terms.`;
    } else if (emailType === 'satisfaction' && salesResult) {
      context = `
POST-CLOSE SATISFACTION CHECK-IN:
- Product/Service delivered: ${salesResult.productName || 'our service'}
- Deal completed and invoice sent.
Compose a warm check-in email that: thanks the customer for choosing us, asks if they are satisfied with the product/service, invites any feedback or questions, and mentions we are available for future needs.`;
    } else if (emailType === 'payment_received' && salesResult) {
      context = `
PAYMENT RECEIVED CONFIRMATION:
- Product/Service: ${salesResult.productName || 'our service'}
- Amount paid: €${salesResult.totalAmount || ''}
- Invoice has been marked as paid.
Compose a short, warm thank-you email confirming receipt of payment and wishing them well with the product/service.`;
    } else {
      context = `
Compose a professional follow-up email.`;
    }

    const lang = this.companyProfile?.communication_language || 'Greek';
    return `Compose a professional email:

RECIPIENT:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Email: ${lead.contact_email}

TYPE: ${emailType}
${context}

Write the email in ${lang} language. Use the EXACT email address "${lead.contact_email}" as the recipientEmail.`;
  }

  // ─── Reply analysis mode prompts (from ReplyProcessor) ───

  private getReplyAnalysisSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('email');
    return `${companyHeader}You are an AI Reply Processor for a Greek B2B company (AgentFlow). Your job is to read customer email replies and compose appropriate follow-up responses in Greek.

When analyzing a reply, you must:
1. Determine the sentiment (positive, neutral, negative)
2. Classify the reply type (question, info request, meeting request, complaint, thank you)
3. Compose a professional reply in Greek
4. Flag if human review is needed (e.g., complaints, cancellations, legal concerns)

Greek business conventions:
- Start with: "Αξιότιμε/η κ." (Dear Mr./Ms.) for formal or "Αγαπητέ/ή" for warmer tone
- End with: "Με εκτίμηση" (With respect) or "Σας ευχαριστούμε" (Thank you)
- Be concise and professional
- Reference previous correspondence

ALWAYS respond with valid JSON:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Brief description of reply action",
  "data": {
    "subject": "Re: original subject",
    "body": "Full reply body in Greek",
    "recipientEmail": "customer email",
    "recipientName": "customer name",
    "replyType": "answer_question" | "provide_info" | "schedule_meeting" | "escalate" | "thank_you",
    "sentiment": "positive" | "neutral" | "negative",
    "requiresHumanReview": false
  }
}`;
  }

  private buildReplyAnalysisUserPrompt(input: {
    originalEmail: any;
    customerReply: string;
    customerName?: string;
    customerEmail?: string;
    dealId?: string;
    deal?: any;
    lead?: any;
  }): string {
    const { originalEmail, customerReply, customerName, customerEmail, deal, lead } = input;

    let dealContext = '';
    if (deal) {
      dealContext = `
DEAL CONTEXT:
- Product: ${deal.product_name}
- Value: €${deal.total_amount}
- Status: ${deal.status}
- Company: ${lead?.company_name || 'Unknown'}`;
    }

    return `Analyze this customer reply and compose a professional Greek response:

OUR ORIGINAL EMAIL:
- Subject: ${originalEmail.subject}
- Body: ${originalEmail.body?.slice(0, 500) || 'N/A'}
- Sent to: ${originalEmail.recipient_email || customerEmail}

CUSTOMER REPLY:
- From: ${customerName || originalEmail.recipient_name || 'Unknown'}
- Email: ${customerEmail || originalEmail.recipient_email}
- Message: ${customerReply}
${dealContext}

Compose a reply in Greek. Use the EXACT email "${customerEmail || originalEmail.recipient_email}" as recipientEmail.`;
  }

  // ─── AI-composed email sending (from EmailService) ───

  async sendEmail(
    leadId: string,
    emailType: 'cold_outreach' | 'proposal' | 'confirmation' | 'invoice' | 'follow_up' | 'satisfaction' | 'payment_received',
    context: { dealId?: string; taskId?: string; salesResult?: any; invoiceData?: any; invoiceNumber?: string; invoiceId?: string; invoicePermalink?: string; threadWith?: { messageId: string; subject: string } }
  ): Promise<EmailResult> {
    this.mode = 'compose';

    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Auto-create task if none was provided (e.g. lifecycle poller calls)
    const ownTask = !context.taskId;
    if (ownTask) {
      context.taskId = await TaskQueue.createAndTrack({
        sourceAgent: 'email',
        targetAgent: 'email',
        taskType: 'send_email',
        title: `Send ${emailType}: ${lead.company_name}`,
        inputData: { leadId, emailType },
        dealId: context.dealId,
        leadId,
        companyId: this.companyProfile?.id,
      });
    }

    let taskHandled = false;

    try {
      const result = await this.execute<EmailResult>(
        { lead, emailType, ...context },
        { dealId: context.dealId, leadId, taskId: context.taskId }
      );

      const recipientEmail = lead.contact_email || result.data.recipientEmail;
      const recipientName = result.data.recipientName || lead.contact_name;

      // Use thread subject + headers when threading with a previous email
      let subject = result.data.subject;
      let inReplyTo: string | undefined;
      let references: string | undefined;
      if (context.threadWith?.messageId) {
        const baseSubject = context.threadWith.subject.replace(/^(Re|RE|Απ|ΑΠ|Fwd|FWD|Πρ):\s*/g, '').trim();
        subject = `Re: ${baseSubject}`;
        inReplyTo = context.threadWith.messageId;
        references = context.threadWith.messageId;
      }

      const sendResult = await sendRealEmail({
        to: recipientEmail,
        subject,
        body: result.data.body,
        inReplyTo,
        references,
        companyContext: this.companyProfile ? {
          name: this.companyProfile.name,
          description: this.companyProfile.description,
          website: this.companyProfile.website,
        } : undefined,
      });

      await EmailDB.create({
        company_id: this.companyProfile?.id,
        task_id: context.taskId,
        deal_id: context.dealId,
        invoice_id: context.invoiceId,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject,
        body: result.data.body,
        email_type: emailType,
        direction: 'outbound',
        message_id: sendResult.messageId,
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

      if (ownTask && context.taskId) {
        taskHandled = true;
        if (sendResult.sent) {
          await TaskQueue.complete(context.taskId, { sent: true, emailType });
        } else {
          await TaskQueue.fail(context.taskId, sendResult.error || 'Email delivery failed');
        }
      }

      if (!sendResult.sent) {
        throw new Error(`Email delivery failed to ${recipientEmail}: ${sendResult.error || 'unknown error'}`);
      }

      return result;
    } catch (error: any) {
      if (ownTask && context.taskId && !taskHandled) {
        await TaskQueue.fail(context.taskId, error.message);
      }
      throw error;
    }
  }

  // ─── Direct delivery (no AI, content provided by another agent) ───

  async deliver(params: DirectDeliveryParams): Promise<{ sent: boolean; messageId?: string; error?: string }> {
    // Auto-create task if none was provided
    const ownTask = !params.taskId;
    if (ownTask) {
      params.taskId = await TaskQueue.createAndTrack({
        sourceAgent: 'email',
        targetAgent: 'email',
        taskType: 'deliver_email',
        title: `Deliver ${params.emailType}: ${params.recipientName || params.to}`,
        inputData: { emailType: params.emailType, to: params.to },
        dealId: params.dealId,
        companyId: this.companyProfile?.id,
      });
    }

    const sendResult = await sendRealEmail({
      to: params.to,
      subject: params.subject,
      body: params.body,
      inReplyTo: params.inReplyTo,
      references: params.references,
      attachments: params.attachments,
      companyContext: this.companyProfile ? {
        name: this.companyProfile.name,
        description: this.companyProfile.description,
        website: this.companyProfile.website,
      } : undefined,
    });

    await EmailDB.create({
      company_id: this.companyProfile?.id,
      task_id: params.taskId,
      deal_id: params.dealId,
      invoice_id: params.invoiceId,
      recipient_email: params.to,
      recipient_name: params.recipientName || '',
      subject: params.subject,
      body: params.body,
      email_type: params.emailType,
      direction: 'outbound',
      message_id: sendResult.messageId,
      status: sendResult.sent ? 'sent' : 'failed',
      error_message: sendResult.error,
    });

    console.log(`\n  📧 DELIVER ${sendResult.sent ? '✅ SENT' : '⚠️ LOGGED'}: To: ${params.to} | Subject: ${params.subject}`);

    // Record delivery result as a log entry (no AI call = no SSE events to capture)
    if (params.taskId && TaskLogger.has(params.taskId)) {
      TaskLogger.append(params.taskId, {
        type: sendResult.sent ? 'info' : 'warning',
        agent: 'email',
        message: sendResult.sent ? `Email delivered to ${params.to}` : `Email delivery failed: ${sendResult.error}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (ownTask && params.taskId) {
      if (sendResult.sent) {
        await TaskQueue.complete(params.taskId, { sent: true, emailType: params.emailType });
      } else {
        await TaskQueue.fail(params.taskId, sendResult.error || 'Email delivery failed');
      }
    }

    if (!sendResult.sent) {
      throw new Error(`Email delivery failed to ${params.to}: ${sendResult.error || 'unknown error'}`);
    }

    return sendResult;
  }

  // ─── AI-powered reply processing (from ReplyProcessor) ───

  async processReply(input: {
    originalEmail: any;
    customerReply: string;
    customerName?: string;
    customerEmail?: string;
    dealId?: string;
  }): Promise<{ replyResult: ReplyAnalysisResult; sent: boolean; messageId?: string }> {
    this.mode = 'reply_analysis';

    let deal: any = null;
    let lead: any = null;
    if (input.dealId) {
      deal = await DealDB.findById(input.dealId);
      if (deal) lead = await LeadDB.findById(deal.lead_id);
    }

    const result = await this.execute<ReplyAnalysisResult>(
      { ...input, deal, lead },
      { dealId: input.dealId }
    );

    const recipientEmail = input.customerEmail || input.originalEmail.recipient_email;

    // Preserve the original subject for Gmail threading (strip prefixes then re-add Re:)
    const baseSubject = input.originalEmail.subject.replace(/^(Re|RE|Απ|ΑΠ|Fwd|FWD|Πρ):\s*/g, '').trim();
    const threadSubject = `Re: ${baseSubject}`;

    const sendResult = await sendRealEmail({
      to: recipientEmail,
      subject: threadSubject,
      body: result.data.body,
      inReplyTo: input.originalEmail.message_id,
      references: input.originalEmail.message_id,
    });

    await EmailDB.create({
      company_id: this.companyProfile?.id,
      deal_id: input.dealId,
      recipient_email: recipientEmail,
      recipient_name: result.data.recipientName || input.customerName || '',
      subject: threadSubject,
      body: result.data.body,
      email_type: 'follow_up',
      direction: 'outbound',
      message_id: sendResult.messageId,
      status: sendResult.sent ? 'sent' : 'failed',
      error_message: sendResult.error,
    });

    console.log(`\n  📧 REPLY ${sendResult.sent ? '✅ SENT' : '⚠️ LOGGED'}:`);
    console.log(`     To: ${recipientEmail}`);
    console.log(`     Subject: ${result.data.subject}`);
    console.log(`     Sentiment: ${result.data.sentiment}`);
    console.log(`     Type: ${result.data.replyType}`);
    if (result.data.requiresHumanReview) {
      console.log(`     ⚠️ FLAGGED FOR HUMAN REVIEW`);
    }

    return {
      replyResult: result,
      sent: sendResult.sent,
      messageId: sendResult.messageId,
    };
  }

  async checkAndProcessReplies(): Promise<Array<{
    from: string;
    subject: string;
    sentiment: string;
    replyType: string;
    sent: boolean;
  }>> {
    console.log('\n  📥 Checking inbox for new replies...');

    const replies = await fetchReplies(this.companyProfile?.id || '');
    const results: Array<{
      from: string;
      subject: string;
      sentiment: string;
      replyType: string;
      sent: boolean;
    }> = [];

    if (replies.length === 0) {
      console.log('  📥 No new replies found');
      return results;
    }

    console.log(`  📥 Found ${replies.length} replies to process`);

    for (const reply of replies) {
      if (!reply.matchedEmailId) continue;

      const originalEmail = await EmailDB.findById(reply.matchedEmailId);
      if (!originalEmail) continue;

      try {
        const { replyResult, sent } = await this.processReply({
          originalEmail,
          customerReply: reply.body,
          customerName: reply.fromName,
          customerEmail: reply.from,
          dealId: reply.matchedDealId ?? undefined,
        });

        results.push({
          from: reply.from,
          subject: reply.subject,
          sentiment: replyResult.data.sentiment,
          replyType: replyResult.data.replyType,
          sent,
        });
      } catch (error: any) {
        console.error(`  ❌ Failed to process reply from ${reply.from}: ${error.message}`);
      }
    }

    console.log(`  📥 Processed ${results.length} replies`);
    return results;
  }

  // ─── Inbound email storage ───

  async storeInboundReply(reply: InboxEmail, dealId: string): Promise<void> {
    const existing = await EmailDB.findByMessageId(reply.messageId);
    if (existing) return;

    await EmailDB.create({
      company_id: this.companyProfile?.id,
      deal_id: dealId,
      recipient_email: process.env.GMAIL_USER || '',
      recipient_name: 'AgentFlow',
      sender_email: reply.from,
      subject: reply.subject,
      body: reply.body,
      email_type: 'follow_up',
      direction: 'inbound',
      message_id: reply.messageId,
      status: 'sent',
    });
  }

  // ─── Inbox operations (wrapping email-transport) ───

  async getInbox(limit: number = 20): Promise<InboxEmail[]> {
    return fetchInbox(limit);
  }

  async getUnread(): Promise<InboxEmail[]> {
    return fetchUnread();
  }

  async getReplies(): Promise<Array<InboxEmail & { matchedEmailId?: string; matchedDealId?: string | null }>> {
    return fetchReplies(this.companyProfile?.id || '');
  }

  async getRepliesForDeal(dealId: string): Promise<InboxEmail | null> {
    return fetchRepliesForDeal(dealId);
  }
}
