import { Router, Request, Response } from 'express';
import { LeadDB, CompanyProfileDB } from '../database/db';
import { CreateLeadRequest } from '../types';

const router = Router();

// GET /api/leads - Get all leads
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const leads = await LeadDB.all(companyId);
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/leads/:id - Get lead by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadDB.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leads - Create new lead
router.post('/', async (req: Request<{}, {}, CreateLeadRequest>, res: Response) => {
  try {
    const { companyName, contactName, contactEmail, contactPhone, productInterest, companyWebsite } = req.body;

    if (!companyName || !contactName) {
      return res.status(400).json({ error: 'companyName and contactName are required' });
    }

    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const leadId = await LeadDB.create({
      company_id: companyId,
      company_name: companyName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      product_interest: productInterest,
      company_website: companyWebsite,
    });

    const lead = await LeadDB.findById(leadId);
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
