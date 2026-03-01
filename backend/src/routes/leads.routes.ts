import { Router, Request, Response } from 'express';
import { LeadDB, CompanyProfileDB, GemiCompanyDB } from '../database/db';
import { CreateLeadRequest } from '../types';

const router = Router();

const AFM_LOOKUP_URL = 'https://www.fundamenta.gr/api/search/companies';
const FETCH_TIMEOUT_MS = 15000;

// GET /api/leads/lookup-afm?vatId=xxx - Lookup company info via fundamenta.gr
router.get('/lookup-afm', async (req: Request, res: Response) => {
  try {
    const vatId = (req.query.vatId as string)?.trim();
    if (!vatId) return res.status(400).json({ error: 'vatId is required' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `${AFM_LOOKUP_URL}?q=${encodeURIComponent(vatId)}&per_page=10&filter=all`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    }

    const data: any = await response.json();
    res.json(data);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
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

// POST /api/leads/import-gemi - Bulk-import GEMI companies as leads
const TEST_EMAILS = [
  'stevenvasos@gmail.com',
  'kagioulis.kostas@gmail.com',
  'avothereal@gmail.com',
  'coscoobydoo@gmail.com',
  'k.kayioulis@butler.gr',
  's.vasos@butler.gr',
];

router.post('/import-gemi', async (req: Request, res: Response) => {
  try {
    const { count, replaceEmails } = req.body;

    if (!count || typeof count !== 'number' || count < 1 || count > 500) {
      return res.status(400).json({ error: 'count must be between 1 and 500' });
    }

    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    // Performant dedup: fetch only gemi_number field from existing leads
    const existingGemiNumbers = await LeadDB.getExistingGemiNumbers(companyId);

    // Paginate through active GEMI companies, skipping already-imported ones
    const collected: any[] = [];
    let cursor: string | undefined = undefined;

    while (collected.length < count) {
      const result = await GemiCompanyDB.list({
        limit: 50,
        startAfter: cursor,
        status: 'Ενεργή',
      });

      if (result.companies.length === 0) break;

      for (const gc of result.companies) {
        if (existingGemiNumbers.has(gc.gemi_number)) continue;
        collected.push(gc);
        if (collected.length >= count) break;
      }

      cursor = result.lastId || undefined;
      if (!result.lastId) break;
    }

    if (collected.length === 0) {
      return res.status(404).json({ error: 'No new active GEMI companies available to import' });
    }

    // Create leads from collected GEMI companies
    const createdIds: string[] = [];
    for (let i = 0; i < collected.length; i++) {
      const gc = collected[i];
      const contactEmail = replaceEmails
        ? TEST_EMAILS[i % TEST_EMAILS.length]
        : gc.email || undefined;

      const leadId = await LeadDB.create({
        company_id: companyId,
        company_name: gc.name,
        contact_name: gc.name,
        contact_email: contactEmail,
        contact_phone: gc.phone || undefined,
        vat_id: gc.afm || undefined,
        gemi_number: gc.gemi_number,
        address: gc.address || undefined,
        legal_form: gc.legal_form || undefined,
      });
      createdIds.push(leadId);
    }

    res.status(201).json({
      success: true,
      imported: createdIds.length,
      requested: count,
    });
  } catch (error: any) {
    console.error('GEMI import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadDB.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { companyName, contactName, contactEmail, contactPhone, vatId, gemiNumber, taxOffice, address, city, postalCode, legalForm, productInterest, companyWebsite } = req.body;

    if (companyName !== undefined && !companyName) {
      return res.status(400).json({ error: 'companyName cannot be empty' });
    }
    if (contactName !== undefined && !contactName) {
      return res.status(400).json({ error: 'contactName cannot be empty' });
    }

    await LeadDB.update(req.params.id, {
      ...(companyName !== undefined && { company_name: companyName }),
      ...(contactName !== undefined && { contact_name: contactName }),
      ...(contactEmail !== undefined && { contact_email: contactEmail }),
      ...(contactPhone !== undefined && { contact_phone: contactPhone }),
      ...(vatId !== undefined && { vat_id: vatId }),
      ...(gemiNumber !== undefined && { gemi_number: gemiNumber }),
      ...(taxOffice !== undefined && { tax_office: taxOffice }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(postalCode !== undefined && { postal_code: postalCode }),
      ...(legalForm !== undefined && { legal_form: legalForm }),
      ...(productInterest !== undefined && { product_interest: productInterest }),
      ...(companyWebsite !== undefined && { company_website: companyWebsite }),
    });

    const updated = await LeadDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/leads/:id - Soft-delete lead
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadDB.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    await LeadDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
