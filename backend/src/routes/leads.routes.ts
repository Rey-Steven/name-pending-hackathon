import { Router, Request, Response } from 'express';
import { LeadDB } from '../database/db';
import { CreateLeadRequest } from '../types';

const router = Router();

// GET /api/leads - Get all leads
router.get('/', (_req: Request, res: Response) => {
  try {
    const leads = LeadDB.all();
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/leads/:id - Get lead by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const lead = LeadDB.findById(parseInt(req.params.id));
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leads - Create new lead
router.post('/', (req: Request<{}, {}, CreateLeadRequest>, res: Response) => {
  try {
    const { companyName, contactName, contactEmail, contactPhone, companyWebsite } = req.body;

    if (!companyName || !contactName) {
      return res.status(400).json({ error: 'companyName and contactName are required' });
    }

    const leadId = LeadDB.create({
      company_name: companyName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      company_website: companyWebsite,
    });

    const lead = LeadDB.findById(leadId);
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
