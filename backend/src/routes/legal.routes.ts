import { Router, Request, Response } from 'express';
import { LegalValidationDB, DealDB, LeadDB, CompanyProfileDB } from '../database/db';
import { generateContractPDF } from '../services/pdf-generator';

const router = Router();

// GET /api/legal/reviews - List all legal reviews for the active company
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const validations = await LegalValidationDB.all(companyId);

    // Enrich with deal + lead info
    const enriched = await Promise.all(validations.map(async (v) => {
      const [deal, lead] = await Promise.all([
        v.deal_id ? DealDB.findById(v.deal_id) : Promise.resolve(null),
        null as any, // Will resolve from deal
      ]);
      const leadData = deal?.lead_id ? await LeadDB.findById(deal.lead_id) : null;
      return {
        ...v,
        company_name: leadData?.company_name || null,
        contact_name: leadData?.contact_name || null,
        product_name: deal?.product_name || null,
        deal_value: deal?.total_amount || 0,
        deal_status: deal?.status || null,
      };
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/reviews/:id - Get a single legal review with deal + lead details
router.get('/reviews/:id', async (req: Request, res: Response) => {
  try {
    const validations = await LegalValidationDB.all('');
    // findByDeal won't work here — we need to find by validation ID
    // Use the collection directly via findByDeal with deal_id from the validation
    // For now, get all and filter (the all method doesn't support findById)
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const allValidations = await LegalValidationDB.all(companyId);
    const validation = allValidations.find(v => v.id === req.params.id);
    if (!validation) return res.status(404).json({ error: 'Legal review not found' });

    const deal = validation.deal_id ? await DealDB.findById(validation.deal_id) : null;
    const lead = deal?.lead_id ? await LeadDB.findById(deal.lead_id) : null;

    res.json({ ...validation, deal, lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/contracts - List all approved legal reviews (contracts)
router.get('/contracts', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const validations = await LegalValidationDB.all(companyId);
    // Contracts are reviews with approval_status === 'approved'
    const contracts = validations.filter(v => v.approval_status === 'approved');

    const enriched = await Promise.all(contracts.map(async (v) => {
      const deal = v.deal_id ? await DealDB.findById(v.deal_id) : null;
      const lead = deal?.lead_id ? await LeadDB.findById(deal.lead_id) : null;
      return {
        ...v,
        company_name: lead?.company_name || null,
        contact_name: lead?.contact_name || null,
        contact_email: lead?.contact_email || null,
        product_name: deal?.product_name || null,
        deal_value: deal?.total_amount || 0,
        deal_status: deal?.status || null,
      };
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/legal/contracts/:dealId/pdf - Download contract PDF for a deal
router.get('/contracts/:dealId/pdf', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.dealId;
    const deal = await DealDB.findById(dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const lead = deal.lead_id ? await LeadDB.findById(deal.lead_id) : null;
    if (!lead) return res.status(404).json({ error: 'Lead not found for this deal' });

    const validation = await LegalValidationDB.findByDeal(dealId);
    if (!validation) return res.status(404).json({ error: 'No legal review found for this deal' });

    const companyProfile = await CompanyProfileDB.get();
    if (!companyProfile) return res.status(500).json({ error: 'Company profile not configured' });

    // Regenerate contract PDF from validation notes (the contract text isn't stored in DB,
    // so we use the approval notes as a fallback summary)
    const contractText = validation.approval_notes || 'Contract details not available.';

    const pdfBuffer = await generateContractPDF({ deal, lead, companyProfile, contractText });

    const refId = dealId.slice(0, 8).toUpperCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Contract-${refId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Contract PDF generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
