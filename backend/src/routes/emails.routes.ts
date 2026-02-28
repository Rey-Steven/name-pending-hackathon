import { Router, Request, Response } from 'express';
import { EmailDB, db } from '../database/db';
import { fetchInbox, fetchUnread, fetchReplies, sendRealEmail } from '../services/email-transport';

const router = Router();

// GET /api/emails - Get all sent emails from our database
router.get('/', (_req: Request, res: Response) => {
  try {
    const emails = EmailDB.all();
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
    const emailId = parseInt(req.params.id);
    const { customMessage } = req.body;

    // Get the original sent email from our DB
    const sentEmail = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as any;
    if (!sentEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Import reply processor (lazy to avoid circular deps)
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
