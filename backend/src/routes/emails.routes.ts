import { Router, Request, Response } from 'express';
import { EmailDB, DealDB, LeadDB, TaskDB, CompanyProfileDB } from '../database/db';
import { EmailAgent } from '../agents/email-agent';
import { CompanyProfileContext } from '../types';

const router = Router();

async function getEmailAgent(): Promise<{ agent: EmailAgent; companyId: string | null }> {
  const profile = await CompanyProfileDB.get();
  if (!profile) return { agent: new EmailAgent(null), companyId: null };
  try {
    const agentContexts = JSON.parse(profile.agent_context_json || '{}');
    const ctx: CompanyProfileContext = {
      id: profile.id!,
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
      pricing_model: profile.pricing_model,
      min_deal_value: profile.min_deal_value,
      max_deal_value: profile.max_deal_value,
      key_products: profile.key_products,
      unique_selling_points: profile.unique_selling_points,
      communication_language: profile.communication_language,
    };
    return { agent: new EmailAgent(ctx), companyId: profile.id! };
  } catch {
    return { agent: new EmailAgent(null), companyId: null };
  }
}

// GET /api/emails - Get all sent emails from our database
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const emails = await EmailDB.all(companyId);
    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/inbox - Fetch recent emails from Gmail inbox via IMAP
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const { agent: emailAgent } = await getEmailAgent();
    const emails = await emailAgent.getInbox(limit);
    res.json({ count: emails.length, emails });
  } catch (error: any) {
    console.error('Inbox fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/unread - Fetch only unread emails from inbox
router.get('/unread', async (_req: Request, res: Response) => {
  try {
    const { agent: emailAgent } = await getEmailAgent();
    const emails = await emailAgent.getUnread();
    res.json({ count: emails.length, emails });
  } catch (error: any) {
    console.error('Unread fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/threads - Get email threads grouped by deal
router.get('/threads', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const allEmails = await EmailDB.all(companyId);

    // Group by deal_id
    const threadMap = new Map<string, any[]>();
    const orphanEmails: any[] = [];

    for (const email of allEmails) {
      if (email.deal_id) {
        if (!threadMap.has(email.deal_id)) {
          threadMap.set(email.deal_id, []);
        }
        threadMap.get(email.deal_id)!.push(email);
      } else {
        orphanEmails.push(email);
      }
    }

    // Build thread objects with deal/lead/task context
    const threads = await Promise.all(
      Array.from(threadMap.entries()).map(async ([dealId, emails]) => {
        // Sort chronologically (oldest first)
        emails.sort((a: any, b: any) =>
          (a.created_at || '').localeCompare(b.created_at || '')
        );

        const [deal, tasks] = await Promise.all([
          DealDB.findById(dealId),
          TaskDB.findByDeal(dealId),
        ]);

        let lead = null;
        if (deal?.lead_id) {
          lead = await LeadDB.findById(deal.lead_id);
        }

        // Filter to email-related tasks
        const emailTasks = tasks.filter((t: any) =>
          t.target_agent === 'email' ||
          ['send_proposal', 'send_invoice', 'send_confirmation', 'send_follow_up'].includes(t.task_type)
        );

        const lastEmail = emails[emails.length - 1];
        const firstEmail = emails[0];

        return {
          deal_id: dealId,
          deal_status: deal?.status,
          lead_name: lead?.company_name,
          contact_name: lead?.contact_name,
          contact_email: lead?.contact_email,
          subject: firstEmail.subject,
          email_count: emails.length,
          last_activity: lastEmail.created_at,
          emails,
          tasks: emailTasks,
        };
      })
    );

    // Sort threads by last activity (newest first)
    threads.sort((a, b) => (b.last_activity || '').localeCompare(a.last_activity || ''));

    res.json({
      count: threads.length,
      threads,
      orphan_emails: orphanEmails,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/replies - Fetch replies matched to our sent emails
router.get('/replies', async (_req: Request, res: Response) => {
  try {
    const { agent: emailAgent } = await getEmailAgent();
    const replies = await emailAgent.getReplies();
    res.json({ count: replies.length, replies });
  } catch (error: any) {
    console.error('Replies fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/reply/:id - AI-powered reply to a specific email thread
router.post('/reply/:id', async (req: Request, res: Response) => {
  try {
    const { customMessage } = req.body;

    // Get the original sent email from our DB
    const sentEmail = await EmailDB.findById(req.params.id);
    if (!sentEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const { agent: emailAgent } = await getEmailAgent();
    const result = await emailAgent.processReply({
      originalEmail: sentEmail,
      customerReply: customMessage || 'Follow-up requested',
      dealId: sentEmail.deal_id,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Reply error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/check-replies - Check inbox for new replies and auto-process them
router.post('/check-replies', async (_req: Request, res: Response) => {
  try {
    const { agent: emailAgent } = await getEmailAgent();
    const results = await emailAgent.checkAndProcessReplies();

    res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Check replies error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
