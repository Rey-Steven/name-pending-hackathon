import { DealDB, LeadDB } from '../database/db';
import { CompanyProfileDB } from '../database/db';
import { EmailService } from '../agents/email-service';

// ─── Helpers ──────────────────────────────────────────────────

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

async function getEmailService(): Promise<EmailService> {
  const profile = await CompanyProfileDB.get();
  if (!profile) return new EmailService(null);
  const agentContexts = JSON.parse(profile.agent_context_json || '{}');
  return new EmailService({
    id: 'main',
    name: profile.name,
    website: profile.website,
    logo_path: profile.logo_path,
    industry: profile.industry,
    description: profile.description,
    business_model: profile.business_model,
    target_customers: profile.target_customers,
    products_services: profile.products_services,
    geographic_focus: profile.geographic_focus,
    agentContexts,
    kad_codes: profile.kad_codes,
  });
}

// ─── Stale Lead Follow-up ─────────────────────────────────────
// Deals in proposal_sent with no update for 7+ days: send follow-up (max 3 attempts)

let pollingStale = false;

export async function pollStaleLeads(): Promise<void> {
  if (pollingStale) return;
  pollingStale = true;

  try {
    const deals = await DealDB.findByStatus(['proposal_sent']);
    const stale = deals.filter(d => {
      const updatedAt = d.updated_at || d.created_at || '';
      return updatedAt && daysSince(updatedAt) >= 7 && (d.follow_up_count ?? 0) < 3;
    });

    if (stale.length === 0) return;
    console.log(`\n📬 Stale leads: ${stale.length} deal(s) need follow-up`);

    const emailService = await getEmailService();

    for (const deal of stale) {
      try {
        const lead = await LeadDB.findById(deal.lead_id);
        if (!lead || !lead.contact_email) {
          console.warn(`  ⚠️  Deal #${deal.id}: no lead/email — skipping`);
          continue;
        }

        const followUpCount = deal.follow_up_count ?? 0;
        await emailService.sendEmail(deal.lead_id, 'follow_up', {
          dealId: deal.id,
          salesResult: {
            productName: deal.product_name,
            totalAmount: deal.total_amount,
            followUpCount,
            daysSinceProposal: Math.floor(daysSince(deal.updated_at || deal.created_at || '')),
          },
        });

        const newCount = followUpCount + 1;
        await DealDB.update(deal.id!, {
          follow_up_count: newCount,
          ...(newCount >= 3 ? { status: 'no_response' } : {}),
        });

        console.log(`  ✅ Deal #${deal.id}: follow-up #${newCount} sent${newCount >= 3 ? ' → marked no_response' : ''}`);
      } catch (err: any) {
        console.error(`  ❌ Deal #${deal.id} follow-up error:`, err.message);
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
    const deals = await DealDB.findByStatus(['failed', 'no_response']);
    const toReopen = deals.filter(d => {
      const updatedAt = d.updated_at || d.created_at || '';
      return updatedAt && daysSince(updatedAt) >= 60;
    });

    if (toReopen.length === 0) return;
    console.log(`\n🔄 Lost deals: ${toReopen.length} deal(s) eligible for reopening`);

    const { WorkflowEngine } = await import('./workflow-engine');

    for (const deal of toReopen) {
      try {
        const lead = await LeadDB.findById(deal.lead_id);
        if (!lead) {
          console.warn(`  ⚠️  Deal #${deal.id}: original lead not found — skipping`);
          continue;
        }

        // Mark old deal as reopened so we don't process it again
        await DealDB.update(deal.id!, { status: 'reopened' });

        // Create a fresh lead with the same company/contact info
        const newLeadId = await LeadDB.create({
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

        console.log(`  ✅ Deal #${deal.id} reopened → new lead #${newLeadId} created`);
      } catch (err: any) {
        console.error(`  ❌ Deal #${deal.id} reopen error:`, err.message);
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
    const deals = await DealDB.findByStatus(['completed']);
    const toNotify = deals.filter(d => {
      if (d.satisfaction_sent) return false;
      const updatedAt = d.updated_at || d.created_at || '';
      const age = daysSince(updatedAt);
      return age >= 3 && age < 4;
    });

    if (toNotify.length === 0) return;
    console.log(`\n😊 Satisfaction emails: ${toNotify.length} deal(s) ready`);

    const emailService = await getEmailService();

    for (const deal of toNotify) {
      try {
        await emailService.sendEmail(deal.lead_id, 'satisfaction', {
          dealId: deal.id,
          salesResult: { productName: deal.product_name },
        });

        await DealDB.update(deal.id!, { satisfaction_sent: true });
        console.log(`  ✅ Deal #${deal.id}: satisfaction email sent`);
      } catch (err: any) {
        console.error(`  ❌ Deal #${deal.id} satisfaction error:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('pollSatisfactionEmails error:', err.message);
  } finally {
    pollingSatisfaction = false;
  }
}
