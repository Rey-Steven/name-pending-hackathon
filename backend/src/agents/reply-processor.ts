import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types';
import { EmailDB, LeadDB, DealDB } from '../database/db';
import { sendRealEmail, fetchReplies, InboxEmail } from '../services/email-transport';

interface ReplyResult extends AgentResponse {
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

export class ReplyProcessor extends BaseAgent {
  constructor() {
    super('email', 'haiku');
  }

  getSystemPrompt(): string {
    return `You are an AI Reply Processor for a Greek B2B company (AgentFlow). Your job is to read customer email replies and compose appropriate follow-up responses in Greek.

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

  buildUserPrompt(input: {
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

  async processReply(input: {
    originalEmail: any;
    customerReply: string;
    customerName?: string;
    customerEmail?: string;
    dealId?: string;
  }): Promise<{ replyResult: ReplyResult; sent: boolean; messageId?: string }> {
    // Pre-fetch deal and lead context so buildUserPrompt can use them synchronously
    let deal: any = null;
    let lead: any = null;
    if (input.dealId) {
      deal = await DealDB.findById(input.dealId);
      if (deal) lead = await LeadDB.findById(deal.lead_id);
    }

    const result = await this.execute<ReplyResult>(
      { ...input, deal, lead },
      { dealId: input.dealId }
    );

    const recipientEmail = input.customerEmail || input.originalEmail.recipient_email;

    const sendResult = await sendRealEmail({
      to: recipientEmail,
      subject: result.data.subject,
      body: result.data.body,
      inReplyTo: input.originalEmail.message_id,
      references: input.originalEmail.message_id,
    });

    await EmailDB.create({
      deal_id: input.dealId,
      recipient_email: recipientEmail,
      recipient_name: result.data.recipientName || input.customerName || '',
      subject: result.data.subject,
      body: result.data.body,
      email_type: 'follow_up',
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

    const replies = await fetchReplies();
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
          dealId: reply.matchedDealId,
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
}
