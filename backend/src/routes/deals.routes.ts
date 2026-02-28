import { Router, Request, Response } from 'express';
import { DealDB, LeadDB, InvoiceDB, LegalValidationDB, TaskDB } from '../database/db';

const router = Router();

// GET /api/deals - Get all deals
router.get('/', (_req: Request, res: Response) => {
  try {
    const deals = DealDB.all();
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id - Get deal with full details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.id);
    const deal = DealDB.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get related data
    const lead = deal.lead_id ? LeadDB.findById(deal.lead_id) : null;
    const invoice = InvoiceDB.findByDeal(dealId);
    const legalValidation = LegalValidationDB.findByDeal(dealId);
    const tasks = TaskDB.findByDeal(dealId);

    res.json({
      ...deal,
      lead,
      invoice,
      legalValidation,
      tasks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
