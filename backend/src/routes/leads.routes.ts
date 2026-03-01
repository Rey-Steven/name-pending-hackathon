import { Router, Request, Response } from 'express';
import { LeadDB, CompanyProfileDB } from '../database/db';
import { CreateLeadRequest } from '../types';

const router = Router();

// GET /api/leads/lookup-afm?vatId=xxx - Proxy to businessportal.gr GEMI autocomplete
router.get('/lookup-afm', async (req: Request, res: Response) => {
  try {
    const vatId = (req.query.vatId as string)?.trim();
    if (!vatId) return res.status(400).json({ error: 'vatId is required' });

    const response = await fetch('https://publicity.businessportal.gr/api/autocomplete/butler%20chat', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,el;q=0.8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Cookie': 'next-i18next=el',
        'DNT': '1',
        'Origin': 'https://publicity.businessportal.gr',
        'Pragma': 'no-cache',
        'Referer': 'https://publicity.businessportal.gr/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      },
      body: JSON.stringify({ token: vatId, language: 'el' }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
    const { companyName, contactName, contactEmail, contactPhone, vatId, gemiNumber, taxOffice, address, city, postalCode, legalForm, productInterest, companyWebsite } = req.body;

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
      vat_id: vatId,
      gemi_number: gemiNumber,
      tax_office: taxOffice,
      address,
      city,
      postal_code: postalCode,
      legal_form: legalForm,
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
