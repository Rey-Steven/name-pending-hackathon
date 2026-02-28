import { Router, Request, Response } from 'express';
import { DealDB, LeadDB, InvoiceDB, LegalValidationDB, TaskDB } from '../database/db';

const router = Router();

// GET /api/deals - Get all deals
router.get('/', async (_req: Request, res: Response) => {
  try {
    const deals = await DealDB.all();
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id - Get deal with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get related data in parallel
    const [lead, invoice, legalValidation, tasks] = await Promise.all([
      deal.lead_id ? LeadDB.findById(deal.lead_id) : Promise.resolve(null),
      InvoiceDB.findByDeal(dealId),
      LegalValidationDB.findByDeal(dealId),
      TaskDB.findByDeal(dealId),
    ]);

    res.json({ ...deal, lead, invoice, legalValidation, tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/check-reply - Check inbox for customer reply and negotiate
router.post('/:id/check-reply', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (!['proposal_sent', 'negotiating'].includes(deal.status || '')) {
      return res.status(400).json({
        error: `Deal is in '${deal.status}' status. Only 'proposal_sent' or 'negotiating' deals can check for replies.`,
      });
    }

    const { WorkflowEngine } = await import('../services/workflow-engine');
    const engine = new WorkflowEngine();
    const result = await engine.processReply(dealId);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Check reply error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
