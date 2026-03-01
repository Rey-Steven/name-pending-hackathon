import { MarketingAgent } from '../agents/marketing-agent';
import { SalesAgent } from '../agents/sales-agent';
import { LegalAgent } from '../agents/legal-agent';
import { AccountingAgent } from '../agents/accounting-agent';
import { EmailAgent } from '../agents/email-agent';
import { TaskQueue } from './task-queue';
import { DealDB, LeadDB, EmailDB, AuditLog, CompanyProfileDB, AppSettingsDB, PendingOfferDB, Lead } from '../database/db';
import { getElorusService } from './elorus-service';
import { generateOfferPDF } from './pdf-generator';
import { broadcastEvent } from '../routes/dashboard.routes';
import { CompanyProfileContext } from '../types';

async function loadCompanyProfile(companyId: string): Promise<CompanyProfileContext | null> {
  const raw = await CompanyProfileDB.getById(companyId);
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
      kad_codes: raw.kad_codes,
      pricing_model: raw.pricing_model,
      min_deal_value: raw.min_deal_value,
      max_deal_value: raw.max_deal_value,
      key_products: raw.key_products,
      unique_selling_points: raw.unique_selling_points,
      communication_language: raw.communication_language,
      terms_of_service: raw.terms_of_service || undefined,
    };
  } catch {
    return null;
  }
}

// MAX_OFFER_ROUNDS is now loaded dynamically from AppSettingsDB

// Statuses where we listen for customer replies
const REPLY_AWAITING_STATUSES = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'];

export class WorkflowEngine {

  private async createAgents(companyId: string) {
    const companyProfile = await loadCompanyProfile(companyId);
    return {
      companyProfile,
      marketingAgent: new MarketingAgent(companyProfile),
      salesAgent: new SalesAgent(companyProfile),
      legalAgent: new LegalAgent(companyProfile),
      accountingAgent: new AccountingAgent(companyProfile),
      emailAgent: new EmailAgent(companyProfile),
    };
  }

  // ─── PHASE 1: Lead → Marketing enrichment → Cold outreach ────

  async startWorkflow(leadId: string) {
    const startTime = Date.now();

    const bootstrapLead = await LeadDB.findById(leadId);
    if (!bootstrapLead?.company_id) throw new Error(`Lead ${leadId} has no company_id`);

    const { companyProfile, marketingAgent, salesAgent, emailAgent } = await this.createAgents(bootstrapLead.company_id);

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

      const emailTasks = await TaskQueue.getPending('email', companyProfile?.id || '');
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
          await emailAgent.sendEmail(
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

    if (!deal.company_id) throw new Error(`Deal ${dealId} has no company_id`);
    const { salesAgent, emailAgent } = await this.createAgents(deal.company_id);
    const { max_offer_rounds: MAX_OFFER_ROUNDS, min_replies_before_offer: MIN_REPLIES_BEFORE_OFFER } = await AppSettingsDB.get();

    // Normalize legacy statuses to new stage names for the agent
    const effectiveStage =
      deal.status === 'proposal_sent' || deal.status === 'negotiating' ? 'offer_sent' : (deal.status || 'lead_contacted');

    console.log('\n' + '═'.repeat(60));
    console.log('  📡 CHECKING FOR CUSTOMER REPLY');
    console.log(`  📋 Deal #${dealId} — ${lead.company_name} (${effectiveStage})`);
    console.log('═'.repeat(60));

    const reply = await emailAgent.getRepliesForDeal(dealId);

    if (!reply) {
      console.log('\n  📭 No reply found yet');
      return { status: 'waiting', dealId, message: 'No customer reply found yet' };
    }

    // Guard: if this message_id was already stored (processed for any deal), skip it.
    // This prevents the same reply from triggering multiple deals when the same
    // email address is a contact across several leads.
    const alreadyProcessed = await EmailDB.findByMessageId(reply.messageId);
    if (alreadyProcessed) {
      return { status: 'waiting', dealId, message: 'Reply already processed for another deal' };
    }

    console.log(`\n  📬 Reply from ${reply.from}: "${reply.subject}"`);
    console.log(`     Preview: ${reply.body.slice(0, 120)}...`);

    // Store inbound reply before processing so concurrent polls can't double-process
    await emailAgent.storeInboundReply(reply, dealId);

    const roundNumber = (deal.negotiation_round || 0) + 1;

    // Parse existing lead profile for context
    let currentLeadProfile: Record<string, any> | null = null;
    try {
      if (lead.lead_profile) currentLeadProfile = JSON.parse(lead.lead_profile);
    } catch { /* ignore parse errors — treat as no profile */ }

    const analysis = await salesAgent.analyzeReply({
      dealId,
      leadId: deal.lead_id,
      dealStatus: effectiveStage,
      customerReply: reply.body,
      currentDeal: deal,
      roundNumber,
      maxRounds: MAX_OFFER_ROUNDS,
      minRepliesBeforeOffer: MIN_REPLIES_BEFORE_OFFER,
      currentLeadProfile,
    });

    // Persist updated lead profile after each reply
    if (analysis.data.updatedLeadProfile) {
      await LeadDB.update(deal.lead_id, {
        lead_profile: JSON.stringify(analysis.data.updatedLeadProfile),
      });
    }

    const { action } = analysis.data;

    const duration = Date.now() - startTime;

    // ─── DISCOVERY: Asking questions to understand lead's needs ──
    if (action === 'discovery') {
      await DealDB.update(dealId, { status: 'in_pipeline', negotiation_round: roundNumber });
      await emailAgent.deliver({
        to: lead.contact_email!,
        subject: reply.subject,
        body: analysis.data.replyBody,
        dealId,
        recipientName: lead.contact_name,
        emailType: 'follow_up',
        inReplyTo: reply.messageId,
        references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
      });

      broadcastEvent({
        type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
        message: `Discovery phase — understanding lead needs (round ${roundNumber})`,
        timestamp: new Date().toISOString(),
      });

      return { status: 'in_pipeline', dealId, action, round: roundNumber, duration,
        message: `Discovery — learning lead's needs` };
    }

    // ─── ENGAGED: Lead showed interest, keep talking ─────────────
    if (action === 'engaged') {
      await DealDB.update(dealId, { status: 'in_pipeline', negotiation_round: roundNumber });
      await emailAgent.deliver({
        to: lead.contact_email!,
        subject: reply.subject,
        body: analysis.data.replyBody,
        dealId,
        recipientName: lead.contact_name,
        emailType: 'follow_up',
        inReplyTo: reply.messageId,
        references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
      });

      broadcastEvent({
        type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
        message: `Lead engaged — continuing conversation (round ${roundNumber})`,
        timestamp: new Date().toISOString(),
      });

      return { status: 'in_pipeline', dealId, action, round: roundNumber, duration,
        message: `Lead engaged — conversation ongoing` };
    }

    // ─── WANTS OFFER / COUNTER / NEW OFFER: Save draft, await human approval ─
    if (action === 'wants_offer' || action === 'counter' || action === 'new_offer') {
      const pendingOfferId = await PendingOfferDB.create({
        company_id: deal.company_id,
        deal_id: dealId,
        lead_id: deal.lead_id,
        action,
        offer_product_name: analysis.data.offerProductName || deal.product_name || '',
        offer_quantity: analysis.data.offerQuantity || deal.quantity || 1,
        offer_unit_price: analysis.data.offerUnitPrice || 0,
        offer_subtotal: analysis.data.offerSubtotal || deal.subtotal || 0,
        offer_fpa_rate: analysis.data.offerFpaRate || 0.24,
        offer_fpa_amount: analysis.data.offerFpaAmount || deal.fpa_amount || 0,
        offer_total_amount: analysis.data.offerTotalAmount || deal.total_amount || 0,
        offer_summary: analysis.data.offerSummary || undefined,
        reply_subject: reply.subject,
        reply_body: analysis.data.replyBody,
        in_reply_to: reply.messageId,
        references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
        round_number: roundNumber,
        status: 'pending',
      });

      await DealDB.update(dealId, {
        status: 'offer_pending_approval',
        negotiation_round: roundNumber,
      });

      const label = action === 'wants_offer' ? 'Offer draft ready' : action === 'counter' ? 'Counter-offer draft ready' : 'New offer draft ready';
      console.log(`\n  📋 ${label} — €${analysis.data.offerTotalAmount || deal.total_amount} (pending approval)`);

      broadcastEvent({
        type: 'offer_pending_approval',
        agent: 'sales',
        dealId,
        leadId: deal.lead_id,
        message: `${label} — review and approve before sending (round ${roundNumber})`,
        data: { pendingOfferId, offerTotal: analysis.data.offerTotalAmount },
        timestamp: new Date().toISOString(),
      } as any);

      return { status: 'offer_pending_approval', dealId, action, round: roundNumber, duration,
        pendingOfferId,
        offerTotal: analysis.data.offerTotalAmount,
        message: `${label} — awaiting approval` };
    }

    // ─── ACCEPTED: Run Legal → Accounting → Invoice pipeline ─────
    if (action === 'accepted') {
      // If the offer was issued via Elorus, email acceptance is not valid —
      // the customer must accept through the Elorus permalink.
      if (deal.elorus_estimate_id) {
        try {
          const elorusService = await getElorusService(deal.company_id!);
          if (elorusService) {
            const elorusEstimate = await elorusService.getEstimate(deal.elorus_estimate_id);
            if (elorusEstimate.status !== 'accepted') {
              // Not accepted on Elorus yet — redirect the customer
              const permalink = elorusEstimate.permalink || (deal as any).elorus_estimate_permalink;
              const redirectBody = permalink
                ? `Αγαπητέ/ή ${lead.contact_name},\n\nΕυχαριστούμε για την ανταπόκρισή σας!\n\nΓια να ισχύει επίσημα η αποδοχή της προσφοράς, παρακαλούμε επιβεβαιώστε μέσω του παρακάτω συνδέσμου:\n${permalink}\n\nΜόλις επιβεβαιώσετε, θα επεξεργαστούμε άμεσα την παραγγελία σας.\n\nΜε εκτίμηση`
                : `Αγαπητέ/ή ${lead.contact_name},\n\nΕυχαριστούμε για την ανταπόκρισή σας!\n\nΓια να ισχύει επίσημα η αποδοχή, παρακαλούμε αποδεχτείτε την προσφορά μέσω του συνδέσμου αποδοχής που σας εστάλη με το email της προσφοράς.\n\nΜε εκτίμηση`;

              await emailAgent.deliver({
                to: lead.contact_email!,
                subject: reply.subject,
                body: redirectBody,
                dealId,
                recipientName: lead.contact_name,
                emailType: 'follow_up',
                inReplyTo: reply.messageId,
                references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
              });

              console.log(`\n  🔗 Customer replied with acceptance — redirected to Elorus link (status: ${elorusEstimate.status})`);

              broadcastEvent({
                type: 'workflow_completed', agent: 'sales', dealId, leadId: deal.lead_id,
                message: 'Customer accepted by email — redirected to Elorus link for official confirmation',
                timestamp: new Date().toISOString(),
              });

              return { status: 'offer_sent', dealId, action: 'redirect_to_elorus', round: roundNumber, duration,
                message: 'Customer must accept via Elorus link — redirect email sent' };
            }
            // Estimate already accepted on Elorus — proceed with closing
            console.log('\n  ✅ Elorus estimate already accepted — proceeding with closure');
          }
        } catch (elorusError: any) {
          // If we can't check Elorus status, proceed with close (don't block deal)
          console.warn(`  ⚠️ Could not verify Elorus status: ${elorusError.message} — proceeding with close`);
        }
      }

      console.log('\n  ✅ OFFER ACCEPTED — Running Legal → Accounting → Invoice');

      await DealDB.update(dealId, { status: 'closed_won', negotiation_round: roundNumber });
      await LeadDB.update(deal.lead_id, { status: 'converted' });
      await emailAgent.deliver({
        to: lead.contact_email!,
        subject: reply.subject,
        body: analysis.data.replyBody,
        dealId,
        recipientName: lead.contact_name,
        emailType: 'confirmation',
        inReplyTo: reply.messageId,
        references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
      });

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

    await emailAgent.deliver({
      to: lead.contact_email!,
      subject: reply.subject,
      body: analysis.data.replyBody,
      dealId,
      recipientName: lead.contact_name,
      emailType: 'follow_up',
      inReplyTo: reply.messageId,
      references: reply.references ? `${reply.references} ${reply.messageId}` : reply.messageId,
    });

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

  async completeWorkflow(dealId: string, leadId: string, deal: any) {
    console.log('\n📍 Running Legal → Accounting → Invoice pipeline');

    const { companyProfile, legalAgent, accountingAgent, emailAgent } = await this.createAgents(deal.company_id);

    const salesData = {
      productName: deal.product_name,
      quantity: deal.quantity || 1,
      unitPrice: deal.subtotal / (deal.quantity || 1),
      subtotal: deal.subtotal,
      fpaRate: deal.fpa_rate || 0.24,
      fpaAmount: deal.fpa_amount,
      totalAmount: deal.total_amount,
      proposalSummary: deal.sales_notes || `${deal.product_name} — standard service agreement`,
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
    const invoiceEmailTasks = await TaskQueue.getPending('email', companyProfile?.id || '');
    for (const task of invoiceEmailTasks) {
      const taskData = await TaskQueue.getTaskWithData(task.id!);
      if (!taskData) continue;

      await TaskQueue.startProcessing(task.id!);
      try {
        await emailAgent.sendEmail(
          taskData.parsedInput.leadId,
          taskData.parsedInput.emailType || 'invoice',
          {
            dealId: taskData.parsedInput.dealId,
            taskId: task.id!,
            invoiceData: taskData.parsedInput.invoiceData,
            invoiceNumber: taskData.parsedInput.invoiceNumber,
            invoiceId: taskData.parsedInput.invoiceId,
            invoicePermalink: taskData.parsedInput.invoicePermalink,
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
