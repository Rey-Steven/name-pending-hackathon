import { DealDB, LeadDB, EmailDB, AppSettingsDB, MarketResearchDB, SocialContentDB, TaskDB, Task } from '../database/db';
import { CompanyProfileDB } from '../database/db';
import { EmailAgent } from '../agents/email-agent';
import { CompanyProfileContext } from '../types';
import { TaskQueue } from './task-queue';
import { TaskLogger } from './task-logger';

// ─── Helpers ──────────────────────────────────────────────────

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function buildEmailAgent(profile: any): EmailAgent {
  return new EmailAgent(buildProfileContext(profile));
}

// ─── Stale Lead Follow-up ─────────────────────────────────────
// Deals in proposal_sent with no update for 7+ days: send follow-up (max 3 attempts)

let pollingStale = false;

export async function pollStaleLeads(): Promise<void> {
  if (pollingStale) return;
  pollingStale = true;

  try {
    const { stale_lead_days, max_followup_attempts } = await AppSettingsDB.get();
    const companies = await CompanyProfileDB.getAll();

    for (const company of companies) {
      // Offer-stage deals: send follow-up reminder emails
      const offerDeals = await DealDB.findByStatus(['offer_sent', 'proposal_sent', 'offer_pending_approval'], company.id!);
      const staleOffers = offerDeals.filter(d => {
        const updatedAt = d.updated_at || d.created_at || '';
        return updatedAt && daysSince(updatedAt) >= stale_lead_days && (d.follow_up_count ?? 0) < max_followup_attempts;
      });

      if (staleOffers.length > 0) {
        console.log(`\n📬 Stale offers [${company.name}]: ${staleOffers.length} deal(s) need follow-up`);
        const emailAgent = buildEmailAgent(company);

        for (const deal of staleOffers) {
          try {
            const lead = await LeadDB.findById(deal.lead_id);
            if (!lead || !lead.contact_email) {
              console.warn(`  ⚠️  Deal #${deal.id}: no lead/email — skipping`);
              continue;
            }

            const followUpCount = deal.follow_up_count ?? 0;
            const dealEmails = await EmailDB.findByDeal(deal.id!);
            const lastEmail = dealEmails.length > 0 ? dealEmails[dealEmails.length - 1] : undefined;
            const threadWith = lastEmail?.message_id ? { messageId: lastEmail.message_id, subject: lastEmail.subject } : undefined;

            await emailAgent.sendEmail(deal.lead_id, 'follow_up', {
              dealId: deal.id,
              salesResult: {
                productName: deal.product_name,
                totalAmount: deal.total_amount,
                followUpCount,
                daysSinceProposal: Math.floor(daysSince(deal.updated_at || deal.created_at || '')),
              },
              threadWith,
            });

            const newCount = followUpCount + 1;
            await DealDB.update(deal.id!, {
              follow_up_count: newCount,
              ...(newCount >= max_followup_attempts ? { status: 'closed_lost', sales_notes: 'CLOSED LOST: No response after maximum follow-up attempts' } : {}),
            });

            console.log(`  ✅ Deal #${deal.id}: follow-up #${newCount} sent${newCount >= max_followup_attempts ? ' → closed_lost (no response)' : ''}`);
          } catch (err: any) {
            console.error(`  ❌ Deal #${deal.id} follow-up error:`, err.message);
          }
        }
      }

      // Early-stage deals (contacted/in_pipeline): close if lead went silent
      const earlyDeals = await DealDB.findByStatus(['lead_contacted', 'in_pipeline'], company.id!);
      const silentLeads = earlyDeals.filter(d => {
        const updatedAt = d.updated_at || d.created_at || '';
        // Give 2× the stale threshold before closing early-stage — they may just be slow to reply
        return updatedAt && daysSince(updatedAt) >= stale_lead_days * 2 && (d.follow_up_count ?? 0) >= max_followup_attempts;
      });

      for (const deal of silentLeads) {
        try {
          await DealDB.update(deal.id!, {
            status: 'closed_lost',
            sales_notes: 'CLOSED LOST: Lead went silent during discovery/outreach phase',
          });
          console.log(`  🔕 Deal #${deal.id}: early-stage silent lead → closed_lost`);
        } catch (err: any) {
          console.error(`  ❌ Deal #${deal.id} silent close error:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('pollStaleLeads error:', err.message);
  } finally {
    pollingStale = false;
  }
}

// ─── Lost Deal Reopening ──────────────────────────────────────
// Deals in failed/no_response with no update for 60+ days: create fresh lead + restart workflow

let pollingLost = false;

export async function pollLostDeals(): Promise<void> {
  if (pollingLost) return;
  pollingLost = true;

  try {
    const { lost_deal_reopen_days } = await AppSettingsDB.get();
    const companies = await CompanyProfileDB.getAll();

    const { WorkflowEngine } = await import('./workflow-engine');

    for (const company of companies) {
      // Include both new ('closed_lost') and legacy ('failed', 'no_response') statuses
      const deals = await DealDB.findByStatus(['closed_lost', 'failed', 'no_response'], company.id!);
      const toReopen = deals.filter(d => {
        const updatedAt = d.updated_at || d.created_at || '';
        return updatedAt && daysSince(updatedAt) >= lost_deal_reopen_days;
      });

      if (toReopen.length === 0) continue;
      console.log(`\n🔄 Lost deals [${company.name}]: ${toReopen.length} deal(s) eligible for reopening`);

      for (const deal of toReopen) {
        try {
          const lead = await LeadDB.findById(deal.lead_id);
          if (!lead) {
            console.warn(`  ⚠️  Deal #${deal.id}: original lead not found — skipping`);
            continue;
          }

          const taskId = await TaskQueue.createAndTrack({
            sourceAgent: 'sales',
            targetAgent: 'marketing',
            taskType: 'reopen_deal',
            title: `Reopen lost deal: ${lead.company_name}`,
            inputData: { dealId: deal.id, originalLeadId: deal.lead_id },
            dealId: deal.id,
            leadId: deal.lead_id,
            companyId: company.id,
          });

          TaskLogger.append(taskId, {
            type: 'info',
            agent: 'sales',
            message: `Reopening lost deal #${deal.id} (${lead.company_name})`,
            timestamp: new Date().toISOString(),
          });

          // Mark old deal as reopened so we don't process it again
          await DealDB.update(deal.id!, { status: 'reopened' });

          // Create a fresh lead with the same company/contact info
          const newLeadId = await LeadDB.create({
            company_id: lead.company_id,
            company_name: lead.company_name,
            contact_name: lead.contact_name,
            contact_email: lead.contact_email,
            contact_phone: lead.contact_phone,
            product_interest: lead.product_interest,
            company_website: lead.company_website,
            status: 'new',
          });

          // Restart the full workflow for the new lead
          const engine = new WorkflowEngine();
          engine.startWorkflow(newLeadId).catch((err: Error) => {
            console.error(`  ❌ Workflow error for reopened lead #${newLeadId}:`, err.message);
          });

          await TaskQueue.complete(taskId, { newLeadId });

          console.log(`  ✅ Deal #${deal.id} reopened → new lead #${newLeadId} created`);
        } catch (err: any) {
          console.error(`  ❌ Deal #${deal.id} reopen error:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('pollLostDeals error:', err.message);
  } finally {
    pollingLost = false;
  }
}

// ─── Satisfaction Emails ──────────────────────────────────────
// Deals in completed, satisfaction_sent != true, 3–4 days after completion

let pollingSatisfaction = false;

export async function pollSatisfactionEmails(): Promise<void> {
  if (pollingSatisfaction) return;
  pollingSatisfaction = true;

  try {
    const { satisfaction_email_days } = await AppSettingsDB.get();
    const companies = await CompanyProfileDB.getAll();

    for (const company of companies) {
      // Include both new ('closed_won') and legacy ('completed') statuses
      const deals = await DealDB.findByStatus(['closed_won', 'completed'], company.id!);
      const toNotify = deals.filter(d => {
        if (d.satisfaction_sent) return false;
        const updatedAt = d.updated_at || d.created_at || '';
        const age = daysSince(updatedAt);
        return age >= satisfaction_email_days && age < satisfaction_email_days + 1;
      });

      if (toNotify.length === 0) continue;
      console.log(`\n😊 Satisfaction emails [${company.name}]: ${toNotify.length} deal(s) ready`);

      const emailAgent = buildEmailAgent(company);

      for (const deal of toNotify) {
        try {
          await emailAgent.sendEmail(deal.lead_id, 'satisfaction', {
            dealId: deal.id,
            salesResult: { productName: deal.product_name },
          });

          await DealDB.update(deal.id!, { satisfaction_sent: true });
          console.log(`  ✅ Deal #${deal.id}: satisfaction email sent`);
        } catch (err: any) {
          console.error(`  ❌ Deal #${deal.id} satisfaction error:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('pollSatisfactionEmails error:', err.message);
  } finally {
    pollingSatisfaction = false;
  }
}

// ─── Daily Market Research ───────────────────────────────────

function buildProfileContext(profile: any): CompanyProfileContext {
  const agentContexts = JSON.parse(profile.agent_context_json || '{}');
  return {
    id: profile.id!,
    name: profile.name,
    website: profile.website,
    industry: profile.industry,
    description: profile.description,
    business_model: profile.business_model,
    target_customers: profile.target_customers,
    products_services: profile.products_services,
    geographic_focus: profile.geographic_focus,
    agentContexts,
    pricing_model: profile.pricing_model,
    min_deal_value: profile.min_deal_value,
    max_deal_value: profile.max_deal_value,
    key_products: profile.key_products,
    unique_selling_points: profile.unique_selling_points,
    communication_language: profile.communication_language,
  };
}

let pollingResearch = false;

export async function pollMarketResearch(): Promise<void> {
  if (pollingResearch) return;
  pollingResearch = true;

  try {
    const profile = await CompanyProfileDB.get();
    if (!profile) return;

    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) return;

    // Skip if research is already running
    const running = await MarketResearchDB.hasRunning(companyId);
    if (running) {
      console.log('  ⏭️  Market research already running, skipping');
      return;
    }

    // Check if research already ran today
    const latest = await MarketResearchDB.getLatest(companyId);
    if (latest && latest.created_at) {
      const hoursAgo = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 22) return;
    }

    console.log('\n📊 Daily market research: starting scheduled run');

    const { MarketingAgent } = await import('../agents/marketing-agent');
    const agent = new MarketingAgent(buildProfileContext(profile));
    const researchId = await agent.runMarketResearch('schedule');
    console.log(`  ✅ Scheduled research completed: ${researchId}`);
  } catch (err: any) {
    console.error('pollMarketResearch error:', err.message);
  } finally {
    pollingResearch = false;
  }
}

// ─── Stale Task Recovery ─────────────────────────────────────
// Finds tasks stuck in pending/processing and re-triggers the responsible agent.
// pending > 5 min → agent never picked it up (e.g. backend restarted before processing)
// processing > 10 min → agent crashed mid-execution

let pollingStuckTasks = false;

export async function pollStaleTasks(): Promise<void> {
  if (pollingStuckTasks) return;
  pollingStuckTasks = true;

  try {
    const PENDING_THRESHOLD_MS = 5 * 60 * 1000;   // 5 minutes
    const PROCESSING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

    const staleTasks = await TaskDB.findStale(PENDING_THRESHOLD_MS, PROCESSING_THRESHOLD_MS);

    if (staleTasks.length === 0) return;

    console.log(`\n🔁 Stale task recovery: ${staleTasks.length} stuck task(s) found`);

    for (const task of staleTasks) {
      try {
        console.log(`  🔍 Stale task ${task.id}: [${task.source_agent} → ${task.target_agent}] ${task.title} (status: ${task.status})`);

        if (task.target_agent === 'email') {
          await recoverEmailTask(task);
        } else {
          // Non-email tasks: we can't safely re-trigger without risking duplicate side-effects
          // (e.g. duplicate invoices, duplicate legal reviews). Mark as failed for visibility.
          await TaskDB.update(task.id!, {
            status: 'failed',
            error_message: `Task stuck in '${task.status}' for >${task.status === 'processing' ? '10' : '5'} min. Marked failed — re-trigger manually if needed.`,
          });
          console.warn(`  ⚠️  Task ${task.id} (${task.task_type}): marked failed — requires manual review`);
        }
      } catch (err: any) {
        console.error(`  ❌ Recovery error for task ${task.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('pollStaleTasks error:', err.message);
  } finally {
    pollingStuckTasks = false;
  }
}

async function recoverEmailTask(task: Task): Promise<void> {
  if (!task.company_id) {
    await TaskDB.update(task.id!, { status: 'failed', error_message: 'Recovery failed: no company_id on task' });
    return;
  }

  const parsedInput = task.input_data ? (() => { try { return JSON.parse(task.input_data!); } catch { return null; } })() : null;
  if (!parsedInput) {
    await TaskDB.update(task.id!, { status: 'failed', error_message: 'Recovery failed: could not parse input_data' });
    return;
  }

  const companyRaw = await CompanyProfileDB.getById(task.company_id);
  if (!companyRaw) {
    await TaskDB.update(task.id!, { status: 'failed', error_message: 'Recovery failed: company profile not found' });
    return;
  }

  // Reset to processing before attempting (handles tasks that were already in processing)
  await TaskDB.update(task.id!, { status: 'processing' });

  try {
    const emailAgent = buildEmailAgent(companyRaw);
    await emailAgent.sendEmail(
      parsedInput.leadId,
      parsedInput.emailType || 'cold_outreach',
      {
        dealId: parsedInput.dealId,
        taskId: task.id!,
        salesResult: parsedInput.salesResult,
        invoiceData: parsedInput.invoiceData,
        invoiceNumber: parsedInput.invoiceNumber,
        invoiceId: parsedInput.invoiceId,
      }
    );
    await TaskQueue.complete(task.id!, { recovered: true });
    console.log(`  ✅ Task ${task.id}: recovered — ${parsedInput.emailType || 'email'} sent`);
  } catch (err: any) {
    await TaskQueue.fail(task.id!, `Recovery failed: ${err.message}`);
    console.error(`  ❌ Task ${task.id}: recovery attempt failed:`, err.message);
  }
}

// ─── Daily Content Creation ──────────────────────────────────

let pollingContent = false;

export async function pollContentCreation(): Promise<void> {
  if (pollingContent) return;
  pollingContent = true;

  try {
    const profile = await CompanyProfileDB.get();
    if (!profile) return;

    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) return;

    // Only run if fresh research exists (completed today)
    const latestResearch = await MarketResearchDB.getLatest(companyId);
    if (!latestResearch || !latestResearch.created_at) return;

    const researchAge = (Date.now() - new Date(latestResearch.created_at).getTime()) / (1000 * 60 * 60);
    if (researchAge > 24) return;

    // Check if content was already created for this research
    const existingContent = await SocialContentDB.findByResearch(latestResearch.id!);
    if (existingContent.length > 0) return;

    console.log('\n✍️  Daily content creation: starting scheduled run');

    const { MarketingAgent } = await import('../agents/marketing-agent');
    const agent = new MarketingAgent(buildProfileContext(profile));
    const contentIds = await agent.createSocialContent(latestResearch.id, 'schedule');
    console.log(`  ✅ Scheduled content created: ${contentIds.join(', ')}`);
  } catch (err: any) {
    console.error('pollContentCreation error:', err.message);
  } finally {
    pollingContent = false;
  }
}
