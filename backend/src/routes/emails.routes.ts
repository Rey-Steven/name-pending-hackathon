import { Router, Request, Response } from 'express';
import { EmailDB, DealDB, LeadDB, TaskDB } from '../database/db';
import { fetchInbox, fetchUnread, fetchReplies, sendRealEmail } from '../services/email-transport';

const router = Router();

// GET /api/emails - Get all sent emails from our database
router.get('/', async (_req: Request, res: Response) => {
  try {
    const emails = await EmailDB.all();
    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/inbox - Fetch recent emails from Gmail inbox via IMAP
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const emails = await fetchInbox(limit);
    res.json({ count: emails.length, emails });
  } catch (error: any) {
    console.error('Inbox fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/unread - Fetch only unread emails from inbox
router.get('/unread', async (_req: Request, res: Response) => {
  try {
    const emails = await fetchUnread();
    res.json({ count: emails.length, emails });
  } catch (error: any) {
    console.error('Unread fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/threads - Get email threads grouped by deal
router.get('/threads', async (_req: Request, res: Response) => {
  try {
    const allEmails = await EmailDB.all();

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
    const replies = await fetchReplies();
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

    const { ReplyProcessor } = await import('../agents/reply-processor');
    const processor = new ReplyProcessor();

    const result = await processor.processReply({
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
    const { ReplyProcessor } = await import('../agents/reply-processor');
    const processor = new ReplyProcessor();

    const results = await processor.checkAndProcessReplies();

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
