import { MarketingAgent } from '../agents/marketing-agent';
import { SalesAgent } from '../agents/sales-agent';
import { LegalAgent } from '../agents/legal-agent';
import { AccountingAgent } from '../agents/accounting-agent';
import { EmailService } from '../agents/email-service';
import { TaskQueue } from './task-queue';
import { DealDB, LeadDB, AuditLog, EmailDB, db } from '../database/db';
import { broadcastEvent } from '../routes/dashboard.routes';
import { fetchRepliesForDeal } from './email-transport';
import { sendRealEmail } from './email-transport';

// Instantiate all agents
const marketingAgent = new MarketingAgent();
const salesAgent = new SalesAgent();
const legalAgent = new LegalAgent();
const accountingAgent = new AccountingAgent();
const emailService = new EmailService();

const MAX_NEGOTIATION_ROUNDS = 3;

export class WorkflowEngine {

  // ─── PHASE 1: Lead → Marketing → Sales → Proposal Email → STOP ───

  async startWorkflow(leadId: number) {
    const startTime = Date.now();

    console.log('\n' + '═'.repeat(60));
    console.log('  🚀 WORKFLOW PHASE 1 - Lead Qualification & Proposal');
    console.log('  📋 Lead ID:', leadId);
    console.log('═'.repeat(60));

    AuditLog.log('workflow', 'workflow_started', 'lead', leadId, { leadId });

    try {
      // PHASE 1a: Marketing Agent - Qualify the lead
      console.log('\n📍 PHASE 1a: Marketing Agent');
      const marketingResult = await marketingAgent.processLead(leadId);

      // PHASE 1b: Sales Agent - Evaluate and create deal
      console.log('\n📍 PHASE 1b: Sales Agent');
      const { salesResult, dealId } = await salesAgent.processDeal(leadId, marketingResult.data);

      if (salesResult.data.qualification !== 'close' || !dealId) {
        const duration = Date.now() - startTime;
        console.log(`\n⚠️ Deal not closed: ${salesResult.data.qualification}`);
        broadcastEvent({
          type: 'workflow_completed',
          agent: 'sales',
          leadId,
          message: `Workflow ended - deal ${salesResult.data.qualification}`,
          timestamp: new Date().toISOString(),
        });
        return {
          status: salesResult.data.qualification,
          message: `Lead ${salesResult.data.qualification === 'nurture' ? 'moved to nurture' : 'rejected'}`,
          duration,
          marketingResult: marketingResult.data,
          salesResult: salesResult.data,
        };
      }

      // PHASE 1c: Send proposal email
      console.log('\n📍 PHASE 1c: Email Agent - Sending Proposal');

      const emailTasks = TaskQueue.getPending('email');
      for (const task of emailTasks) {
        const taskData = TaskQueue.getTaskWithData(task.id!);
        if (!taskData) continue;

        TaskQueue.startProcessing(task.id!);
        try {
          await emailService.sendEmail(
            taskData.parsedInput.leadId,
            taskData.parsedInput.emailType || 'proposal',
            {
              dealId: taskData.parsedInput.dealId,
              salesResult: taskData.parsedInput.salesResult,
            }
          );
          TaskQueue.complete(task.id!, { processed: true });
        } catch (error: any) {
          console.error(`  ❌ Email task ${task.id} failed:`, error.message);
          TaskQueue.fail(task.id!, error.message);
        }
      }

      const duration = Date.now() - startTime;

      console.log('\n' + '═'.repeat(60));
      console.log(`  📧 PROPOSAL SENT - Awaiting customer reply`);
      console.log(`  📋 Deal #${dealId} (${(duration / 1000).toFixed(1)}s)`);
      console.log(`  💡 Call POST /api/deals/${dealId}/check-reply after customer replies`);
      console.log('═'.repeat(60) + '\n');

      AuditLog.log('workflow', 'proposal_sent', 'deal', dealId, { leadId, dealId, duration });

      broadcastEvent({
        type: 'workflow_completed',
        agent: 'email',
        leadId,
        dealId,
        message: `Proposal sent for Deal #${dealId} - awaiting customer reply`,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'proposal_sent',
        dealId,
        duration,
        message: `Proposal sent in ${(duration / 1000).toFixed(1)}s - awaiting customer reply`,
      };
    } catch (error: any) {
      console.error('\n❌ WORKFLOW FAILED:', error.message);
      AuditLog.log('workflow', 'workflow_failed', 'lead', leadId, { error: error.message });
      broadcastEvent({
        type: 'workflow_completed',
        agent: 'sales',
        leadId,
        message: `Workflow failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  // ─── PHASE 2: Check Reply → Negotiate or Complete ───

  async processReply(dealId: number) {
    const startTime = Date.now();
    const deal = DealDB.findById(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    if (!['proposal_sent', 'negotiating'].includes(deal.status || '')) {
      throw new Error(`Deal ${dealId} is in '${deal.status}' status - not awaiting reply`);
    }

    const lead = LeadDB.findById(deal.lead_id);
    if (!lead) throw new Error(`Lead ${deal.lead_id} not found`);

    console.log('\n' + '═'.repeat(60));
    console.log('  📥 CHECKING FOR CUSTOMER REPLY');
    console.log(`  📋 Deal #${dealId} - ${lead.company_name}`);
    console.log(`  🔄 Round: ${(deal.negotiation_round || 0) + 1} of ${MAX_NEGOTIATION_ROUNDS}`);
    console.log('═'.repeat(60));

    // Fetch replies for this specific deal
    const reply = await fetchRepliesForDeal(dealId);

    if (!reply) {
      console.log('\n  📭 No reply found yet');
      return {
        status: 'waiting',
        dealId,
        message: 'No customer reply found yet',
        round: deal.negotiation_round || 0,
      };
    }

    console.log(`\n  📬 Reply found from ${reply.from}:`);
    console.log(`     Subject: ${reply.subject}`);
    console.log(`     Preview: ${reply.body.slice(0, 150)}...`);

    const roundNumber = (deal.negotiation_round || 0) + 1;

    // Sales Agent analyzes the reply
    const negotiationResult = await salesAgent.negotiateReply({
      dealId,
      leadId: deal.lead_id,
      customerReply: reply.body,
      currentDeal: deal,
      roundNumber,
      maxRounds: MAX_NEGOTIATION_ROUNDS,
    });

    const action = negotiationResult.data.action;

    // ─── HANDLE: Customer accepts ───
    if (action === 'accept') {
      console.log('\n  ✅ CUSTOMER ACCEPTED - Triggering Legal → Accounting → Invoice');

      DealDB.update(dealId, {
        status: 'legal_review',
        negotiation_round: roundNumber,
      });
      LeadDB.update(deal.lead_id, { status: 'converted' });

      // Send acceptance response email
      await sendRealEmail({
        to: lead.contact_email!,
        subject: negotiationResult.data.responseSubject,
        body: negotiationResult.data.responseBody,
      });
      EmailDB.create({
        deal_id: dealId,
        recipient_email: lead.contact_email!,
        recipient_name: lead.contact_name,
        subject: negotiationResult.data.responseSubject,
        body: negotiationResult.data.responseBody,
        email_type: 'confirmation',
        status: 'sent',
      });

      // Now run the rest of the pipeline: Legal → Accounting → Invoice Email
      const completionResult = await this.completeWorkflow(dealId, deal.lead_id, deal);
      const duration = Date.now() - startTime;

      return {
        status: 'completed',
        dealId,
        action: 'accept',
        round: roundNumber,
        duration,
        message: `Customer accepted! Full pipeline completed in ${(duration / 1000).toFixed(1)}s`,
        ...completionResult,
      };
    }

    // ─── HANDLE: Counter offer ───
    if (action === 'counter_offer') {
      console.log('\n  🤝 SENDING COUNTER-OFFER');

      // Update deal with revised pricing if provided
      const updates: any = {
        status: 'negotiating',
        negotiation_round: roundNumber,
      };
      if (negotiationResult.data.revisedSubtotal) {
        updates.subtotal = negotiationResult.data.revisedSubtotal;
        updates.deal_value = negotiationResult.data.revisedSubtotal;
      }
      if (negotiationResult.data.revisedFpaAmount) {
        updates.fpa_amount = negotiationResult.data.revisedFpaAmount;
      }
      if (negotiationResult.data.revisedTotal) {
        updates.total_amount = negotiationResult.data.revisedTotal;
      }
      DealDB.update(dealId, updates);

      // Send counter-offer email
      const sendResult = await sendRealEmail({
        to: lead.contact_email!,
        subject: negotiationResult.data.responseSubject,
        body: negotiationResult.data.responseBody,
      });

      EmailDB.create({
        deal_id: dealId,
        recipient_email: lead.contact_email!,
        recipient_name: lead.contact_name,
        subject: negotiationResult.data.responseSubject,
        body: negotiationResult.data.responseBody,
        email_type: 'counter_offer' as any,
        status: sendResult.sent ? 'sent' : 'failed',
        error_message: sendResult.error,
      });

      const duration = Date.now() - startTime;

      console.log('\n' + '═'.repeat(60));
      console.log(`  🤝 COUNTER-OFFER SENT (Round ${roundNumber}/${MAX_NEGOTIATION_ROUNDS})`);
      console.log(`  💰 Revised total: €${negotiationResult.data.revisedTotal || deal.total_amount}`);
      console.log(`  💡 Call POST /api/deals/${dealId}/check-reply after next reply`);
      console.log('═'.repeat(60) + '\n');

      broadcastEvent({
        type: 'workflow_completed',
        agent: 'sales',
        dealId,
        leadId: deal.lead_id,
        message: `Counter-offer sent (round ${roundNumber}) - awaiting reply`,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'negotiating',
        dealId,
        action: 'counter_offer',
        round: roundNumber,
        duration,
        revisedTotal: negotiationResult.data.revisedTotal,
        objection: negotiationResult.data.objectionSummary,
        message: `Counter-offer sent (round ${roundNumber}/${MAX_NEGOTIATION_ROUNDS})`,
      };
    }

    // ─── HANDLE: Give up ───
    console.log('\n  ❌ DEAL FAILED - Sending closing email');

    DealDB.update(dealId, {
      status: 'failed',
      negotiation_round: roundNumber,
      sales_notes: `FAILED: ${negotiationResult.data.failureReason || 'Customer declined after max rounds'}`,
    });

    // Send polite closing email
    const sendResult = await sendRealEmail({
      to: lead.contact_email!,
      subject: negotiationResult.data.responseSubject,
      body: negotiationResult.data.responseBody,
    });

    EmailDB.create({
      deal_id: dealId,
      recipient_email: lead.contact_email!,
      recipient_name: lead.contact_name,
      subject: negotiationResult.data.responseSubject,
      body: negotiationResult.data.responseBody,
      email_type: 'closing' as any,
      status: sendResult.sent ? 'sent' : 'failed',
      error_message: sendResult.error,
    });

    const duration = Date.now() - startTime;

    console.log('\n' + '═'.repeat(60));
    console.log(`  ❌ DEAL FAILED after ${roundNumber} rounds`);
    console.log(`  📝 Reason: ${negotiationResult.data.failureReason}`);
    console.log('═'.repeat(60) + '\n');

    AuditLog.log('workflow', 'deal_failed', 'deal', dealId, {
      round: roundNumber,
      failureReason: negotiationResult.data.failureReason,
      sentiment: negotiationResult.data.customerSentiment,
    });

    broadcastEvent({
      type: 'workflow_completed',
      agent: 'sales',
      dealId,
      leadId: deal.lead_id,
      message: `Deal failed: ${negotiationResult.data.failureReason}`,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'failed',
      dealId,
      action: 'give_up',
      round: roundNumber,
      duration,
      failureReason: negotiationResult.data.failureReason,
      message: `Deal failed after ${roundNumber} rounds: ${negotiationResult.data.failureReason}`,
    };
  }

  // ─── Complete workflow after acceptance: Legal → Accounting → Invoice ───

  private async completeWorkflow(dealId: number, leadId: number, deal: any) {
    console.log('\n📍 Running Legal → Accounting → Invoice pipeline');

    const salesData = {
      productName: deal.product_name,
      quantity: deal.quantity || 1,
      unitPrice: deal.subtotal / (deal.quantity || 1),
      subtotal: deal.subtotal,
      fpaRate: deal.fpa_rate || 0.24,
      fpaAmount: deal.fpa_amount,
      totalAmount: deal.total_amount,
    };

    // Legal Agent
    try {
      console.log('\n📍 Legal Agent');
      await legalAgent.reviewDeal(dealId, leadId, salesData);
    } catch (error: any) {
      console.error(`  ❌ Legal review failed: ${error.message}`);
    }

    // Accounting Agent
    try {
      console.log('\n📍 Accounting Agent');
      await accountingAgent.generateInvoice(dealId, leadId, salesData);
    } catch (error: any) {
      console.error(`  ❌ Invoice generation failed: ${error.message}`);
    }

    // Send invoice email (check if accounting created a task)
    const invoiceEmailTasks = TaskQueue.getPending('email');
    for (const task of invoiceEmailTasks) {
      const taskData = TaskQueue.getTaskWithData(task.id!);
      if (!taskData) continue;

      TaskQueue.startProcessing(task.id!);
      try {
        await emailService.sendEmail(
          taskData.parsedInput.leadId,
          taskData.parsedInput.emailType || 'invoice',
          {
            dealId: taskData.parsedInput.dealId,
            invoiceData: taskData.parsedInput.invoiceData,
            invoiceNumber: taskData.parsedInput.invoiceNumber,
            invoiceId: taskData.parsedInput.invoiceId,
          }
        );
        TaskQueue.complete(task.id!, { processed: true });
      } catch (error: any) {
        console.error(`  ❌ Invoice email failed: ${error.message}`);
        TaskQueue.fail(task.id!, error.message);
      }
    }

    // Mark deal completed
    DealDB.update(dealId, { status: 'completed' });

    AuditLog.log('workflow', 'workflow_completed', 'deal', dealId, { leadId, dealId });

    broadcastEvent({
      type: 'workflow_completed',
      agent: 'accounting',
      dealId,
      leadId,
      message: `Full pipeline completed - Deal #${dealId} closed and invoiced`,
      timestamp: new Date().toISOString(),
    });

    return { pipelineCompleted: true };
  }
}
