import { Router, Request, Response } from 'express';
import { DealDB, LeadDB, InvoiceDB, LegalValidationDB, TaskDB, CompanyProfileDB } from '../database/db';
import { generateOfferPDF } from '../services/pdf-generator';

const router = Router();

// GET /api/deals - Get all deals
router.get('/', async (_req: Request, res: Response) => {
  try {
    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const deals = await DealDB.all(companyId);
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

// GET /api/deals/:id/pdf - Download offer PDF
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (!deal.subtotal || deal.subtotal === 0) {
      return res.status(400).json({ error: 'Deal has no pricing yet — offer PDF not available until the customer expresses interest' });
    }

    const lead = await LeadDB.findById(deal.lead_id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found for this deal' });
    }

    const companyProfile = await CompanyProfileDB.get();
    if (!companyProfile) {
      return res.status(500).json({ error: 'Company profile not configured' });
    }

    const pdfBuffer = await generateOfferPDF({ deal, lead, companyProfile });

    const refId = dealId.slice(0, 8).toUpperCase();
    const filename = `Prosfora-${refId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error.message);
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

    const replyStatuses = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'];
    if (!replyStatuses.includes(deal.status || '')) {
      return res.status(400).json({
        error: `Deal is in '${deal.status}' status. Only deals in ${replyStatuses.join(', ')} can check for replies.`,
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
