import { MarketingAgent } from '../agents/marketing-agent';
import { SalesAgent } from '../agents/sales-agent';
import { LegalAgent } from '../agents/legal-agent';
import { AccountingAgent } from '../agents/accounting-agent';
import { EmailService } from '../agents/email-service';
import { TaskQueue } from './task-queue';
import { DealDB, LeadDB, AuditLog, EmailDB, CompanyProfileDB } from '../database/db';
import { broadcastEvent } from '../routes/dashboard.routes';
import { CompanyProfileContext } from '../types';
import { fetchRepliesForDeal, sendRealEmail } from './email-transport';

async function loadCompanyProfile(): Promise<CompanyProfileContext | null> {
  const raw = await CompanyProfileDB.get();
  if (!raw) return null;
  try {
    const agentContexts = JSON.parse(raw.agent_context_json || '{}');
    return {
      id: raw.id!,
      name: raw.name,
      website: raw.website,
      logo_path: raw.logo_path,
      industry: raw.industry,
      description: raw.description,
      business_model: raw.business_model,
      target_customers: raw.target_customers,
      products_services: raw.products_services,
      geographic_focus: raw.geographic_focus,
      agentContexts,
    };
  } catch {
    return null;
  }
}

const MAX_OFFER_ROUNDS = 3;

// Statuses where we listen for customer replies
const REPLY_AWAITING_STATUSES = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'];

export class WorkflowEngine {

  private async createAgents() {
    const companyProfile = await loadCompanyProfile();
    return {
      companyProfile,
      marketingAgent: new MarketingAgent(companyProfile),
      salesAgent: new SalesAgent(companyProfile),
      legalAgent: new LegalAgent(companyProfile),
      accountingAgent: new AccountingAgent(companyProfile),
      emailService: new EmailService(companyProfile),
    };
  }

  // ─── PHASE 1: Lead → Marketing enrichment → Cold outreach ────

  async startWorkflow(leadId: string) {
    const startTime = Date.now();

    const { companyProfile, marketingAgent, salesAgent, emailService } = await this.createAgents();

    console.log('\n' + '═'.repeat(60));
    console.log('  🚀 WORKFLOW — Lead to Cold Outreach');
    console.log('  📋 Lead ID:', leadId);
    if (companyProfile) {
      console.log(`  🏢 Company: ${companyProfile.name}`);
    }
    console.log('═'.repeat(60));

    AuditLog.log('workflow', 'workflow_started', 'lead', leadId, { leadId });

    try {
      // PHASE 1a: Marketing Agent — enrich lead (score for prioritization)
      console.log('\n📍 PHASE 1a: Marketing Agent — Lead Enrichment');
      const marketingResult = await marketingAgent.processLead(leadId);

      // PHASE 1b: Sales Agent — create deal + plan cold outreach
      console.log('\n📍 PHASE 1b: Sales Agent — Deal Creation');
      const { salesResult, dealId } = await salesAgent.processDeal(leadId, marketingResult.data);

      // PHASE 1c: Send cold outreach email via task queue
      console.log('\n📍 PHASE 1c: Email Agent — Cold Outreach');

      const emailTasks = await TaskQueue.getPending('email');
      if (emailTasks.length === 0) {
        throw new Error(`No pending email task found for deal #${dealId}`);
      }

      let sentCount = 0;
      let failedCount = 0;
      for (const task of emailTasks) {
        const taskData = await TaskQueue.getTaskWithData(task.id!);
        if (!taskData) continue;

        await TaskQueue.startProcessing(task.id!);
        try {
          await emailService.sendEmail(
            taskData.parsedInput.leadId,
            taskData.parsedInput.emailType || 'cold_outreach',
            {
              dealId: taskData.parsedInput.dealId,
              taskId: task.id!,
              salesResult: taskData.parsedInput.salesResult,
            }
          );
          await TaskQueue.complete(task.id!, { processed: true });
          sentCount += 1;
        } catch (error: any) {
          console.error(`  ❌ Email task ${task.id} failed:`, error.message);
          await TaskQueue.fail(task.id!, error.message);
          failedCount += 1;
        }
      }

      const duration = Date.now() - startTime;

      if (sentCount === 0) {
        const failureMessage = `Cold outreach failed for Deal #${dealId}`;
        console.error(`\n❌ ${failureMessage}`);
        AuditLog.log('workflow', 'outreach_failed', 'deal', dealId, { leadId, dealId, duration });
        broadcastEvent({
          type: 'workflow_completed',
          agent: 'email',
          leadId,
          dealId,
          message: failureMessage,
          timestamp: new Date().toISOString(),
        });
        return { status: 'outreach_failed', dealId, duration, message: failureMessage };
      }

      console.log('\n' + '═'.repeat(60));
      console.log(`  📧 COLD OUTREACH SENT — Awaiting reply`);
      console.log(`  📋 Deal #${dealId} — Lead Score: ${marketingResult.data.leadScore} (${(duration / 1000).toFixed(1)}s)`);
      console.log('═'.repeat(60) + '\n');

      AuditLog.log('workflow', 'cold_outreach_sent', 'deal', dealId, { leadId, dealId, duration, leadScore: marketingResult.data.leadScore });

      broadcastEvent({
        type: 'workflow_completed',
        agent: 'email',
        leadId,
        dealId,
        message: `Cold outreach sent — Deal #${dealId} in pipeline`,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'lead_contacted',
        dealId,
        duration,
        message: `Cold outreach sent in ${(duration / 1000).toFixed(1)}s — awaiting customer reply`,
        leadScore: marketingResult.data.leadScore,
        salesResult: salesResult.data,
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

  // ─── PHASE 2: Check Reply → Progress through pipeline ────────

  async processReply(dealId: string) {
    const startTime = Date.now();
    const deal = await DealDB.findById(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    if (!REPLY_AWAITING_STATUSES.includes(deal.status || '')) {
      return {
        status: 'skipped',
        dealId,
        message: `Deal ${dealId} is in '${deal.status}' — not awaiting reply`,
      };
    }

    const lead = await LeadDB.findById(deal.lead_id);
    if (!lead) throw new Error(`Lead ${deal.lead_id} not found`);

    const { salesAgent } = await this.createAgents();

    // Normalize legacy statuses to new stage names for the agent
    const effectiveStage =
      deal.status === 'proposal_sent' || deal.status === 'negotiating' ? 'offer_sent' : (deal.status || 'lead_contacted');

    console.log('\n' + '═'.repeat(60));
    console.log('  📡 CHECKING FOR CUSTOMER REPLY');
    console.log(`  📋 Deal #${dealId} — ${lead.company_name} (${effectiveStage})`);
    console.log('═'.repeat(60));

    const reply = await fetchRepliesForDeal(dealId);

    if (!reply) {
      console.log('\n  📭 No reply found yet');
      return { status: 'waiting', dealId, message: 'No customer reply found yet' };
    }

    console.log(`\n  📬 Reply from ${reply.from}: "${reply.subject}"`);
    console.log(`     Preview: ${reply.body.slice(0, 120)}...`);

    // Store inbound reply (deduplicate by message_id)
    const existingInbound = await EmailDB.findByMessageId(reply.messageId);
    if (!existingInbound) {
      await EmailDB.create({
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

    const roundNumber = (deal.negotiation_round || 0) + 1;

    const analysis = await salesAgent.analyzeReply({
      dealId,
      leadId: deal.lead_id,
      dealStatus: effectiveStage,
      customerReply: reply.body,
      currentDeal: deal,
      roundNumber,
      maxRounds: MAX_OFFER_ROUNDS,
    });

    const { action } = analysis.data;

    // ─── Helper: save outbound email to DB ───────────────────────
    const saveOutbound = async (type: string) => {
      const sendResult = await sendRealEmail({
        to: lead.contact_email!,
        subject: analysis.data.replySubject,
        body: analysis.data.replyBody,
      });
      await EmailDB.create({
        deal_id: dealId,
        recipient_email: lead.contact_email!,
        recipient_name: lead.contact_name,
        subject: analysis.data.replySubject,
        body: analysis.data.replyBody,
        email_type: type as any,
        direction: 'outbound',
        message_id: sendResult.messageId,
        status: sendResult.sent ? 'sent' : 'failed',
        error_message: sendResult.error,
      });
      return sendResult;
    };

    const duration = Date.now() - startTime;

    // ─── ENGAGED: Lead showed interest, keep talking ─────────────
    if (action === 'engaged') {
      await DealDB.update(dealId, { status: 'in_pipeline', negotiation_round: roundNumber });
      await saveOutbound('follow_up');

      broadcastEvent({
        type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
        message: `Lead engaged — continuing conversation (round ${roundNumber})`,
        timestamp: new Date().toISOString(),
      });

      return { status: 'in_pipeline', dealId, action, round: roundNumber, duration,
        message: `Lead engaged — conversation ongoing` };
    }

    // ─── WANTS OFFER / COUNTER / NEW OFFER: Send formal offer ────
    if (action === 'wants_offer' || action === 'counter' || action === 'new_offer') {
      const offerUpdates: any = { status: 'offer_sent', negotiation_round: roundNumber };

      // Update deal pricing with the new offer details
      if (analysis.data.offerSubtotal) {
        offerUpdates.deal_value = analysis.data.offerSubtotal;
        offerUpdates.subtotal = analysis.data.offerSubtotal;
      }
      if (analysis.data.offerFpaAmount) offerUpdates.fpa_amount = analysis.data.offerFpaAmount;
      if (analysis.data.offerTotalAmount) offerUpdates.total_amount = analysis.data.offerTotalAmount;
      if (analysis.data.offerProductName) offerUpdates.product_name = analysis.data.offerProductName;
      if (analysis.data.offerQuantity) offerUpdates.quantity = analysis.data.offerQuantity;
      if (analysis.data.offerSummary) offerUpdates.sales_notes = analysis.data.offerSummary;

      await DealDB.update(dealId, offerUpdates);
      await saveOutbound('proposal');

      const label = action === 'wants_offer' ? 'Offer sent' : action === 'counter' ? 'Counter-offer sent' : 'New offer sent';
      console.log(`\n  💰 ${label} — €${analysis.data.offerTotalAmount || deal.total_amount}`);

      broadcastEvent({
        type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
        message: `${label} — round ${roundNumber}`,
        timestamp: new Date().toISOString(),
      });

      return { status: 'offer_sent', dealId, action, round: roundNumber, duration,
        offerTotal: analysis.data.offerTotalAmount,
        message: `${label} (round ${roundNumber}/${MAX_OFFER_ROUNDS})` };
    }

    // ─── ACCEPTED: Run Legal → Accounting → Invoice pipeline ─────
    if (action === 'accepted') {
      console.log('\n  ✅ OFFER ACCEPTED — Running Legal → Accounting → Invoice');

      await DealDB.update(dealId, { status: 'closed_won', negotiation_round: roundNumber });
      await LeadDB.update(deal.lead_id, { status: 'converted' });
      await saveOutbound('confirmation');

      const completionResult = await this.completeWorkflow(dealId, deal.lead_id, deal);

      broadcastEvent({
        type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
        message: `Deal closed won! Full pipeline completed.`,
        timestamp: new Date().toISOString(),
      });

      return { status: 'closed_won', dealId, action, round: roundNumber, duration,
        message: `Deal won in ${(duration / 1000).toFixed(1)}s — invoiced and closed`,
        ...completionResult };
    }

    // ─── DECLINED: Close as lost ──────────────────────────────────
    console.log('\n  ❌ DEAL CLOSED LOST');

    await DealDB.update(dealId, {
      status: 'closed_lost',
      negotiation_round: roundNumber,
      sales_notes: `CLOSED LOST: ${analysis.data.failureReason || analysis.data.customerIntent}`,
    });

    await saveOutbound('follow_up');

    AuditLog.log('sales', 'deal_closed_lost', 'deal', dealId, {
      round: roundNumber,
      reason: analysis.data.failureReason,
      sentiment: analysis.data.customerSentiment,
    });

    broadcastEvent({
      type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
      message: `Deal closed lost: ${analysis.data.failureReason || analysis.data.customerIntent}`,
      timestamp: new Date().toISOString(),
    });

    return { status: 'closed_lost', dealId, action, round: roundNumber, duration,
      reason: analysis.data.failureReason,
      message: `Deal lost: ${analysis.data.failureReason || analysis.data.customerIntent}` };
  }

  // ─── Complete pipeline after offer accepted ───────────────────

  private async completeWorkflow(dealId: string, leadId: string, deal: any) {
    console.log('\n📍 Running Legal → Accounting → Invoice pipeline');

    const { legalAgent, accountingAgent, emailService } = await this.createAgents();

    const salesData = {
      productName: deal.product_name,
      quantity: deal.quantity || 1,
      unitPrice: deal.subtotal / (deal.quantity || 1),
      subtotal: deal.subtotal,
      fpaRate: deal.fpa_rate || 0.24,
      fpaAmount: deal.fpa_amount,
      totalAmount: deal.total_amount,
    };

    try {
      console.log('\n📍 Legal Agent');
      await legalAgent.reviewDeal(dealId, leadId, salesData);
    } catch (error: any) {
      console.error(`  ❌ Legal review failed: ${error.message}`);
    }

    try {
      console.log('\n📍 Accounting Agent');
      await accountingAgent.generateInvoice(dealId, leadId, salesData);
    } catch (error: any) {
      console.error(`  ❌ Invoice generation failed: ${error.message}`);
    }

    // Send invoice email
    const invoiceEmailTasks = await TaskQueue.getPending('email');
    for (const task of invoiceEmailTasks) {
      const taskData = await TaskQueue.getTaskWithData(task.id!);
      if (!taskData) continue;

      await TaskQueue.startProcessing(task.id!);
      try {
        await emailService.sendEmail(
          taskData.parsedInput.leadId,
          taskData.parsedInput.emailType || 'invoice',
          {
            dealId: taskData.parsedInput.dealId,
            taskId: task.id!,
            invoiceData: taskData.parsedInput.invoiceData,
            invoiceNumber: taskData.parsedInput.invoiceNumber,
            invoiceId: taskData.parsedInput.invoiceId,
          }
        );
        await TaskQueue.complete(task.id!, { processed: true });
      } catch (error: any) {
        console.error(`  ❌ Invoice email failed: ${error.message}`);
        await TaskQueue.fail(task.id!, error.message);
      }
    }

    // Mark as completed (closed_won already set above; set to completed for accounting consistency)
    await DealDB.update(dealId, { status: 'completed' });

    AuditLog.log('workflow', 'workflow_completed', 'deal', dealId, { leadId, dealId });

    broadcastEvent({
      type: 'workflow_completed',
      agent: 'accounting',
      dealId,
      leadId,
      message: `Full pipeline completed — Deal #${dealId} invoiced`,
      timestamp: new Date().toISOString(),
    });

    return { pipelineCompleted: true };
  }
}
