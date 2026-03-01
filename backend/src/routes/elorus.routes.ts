import { Router, Request, Response } from 'express';
import { CompanyProfileDB } from '../database/db';
import { ElorusService } from '../services/elorus-service';

const router = Router();

// ─── Helper: resolve Elorus service for the current company ──

async function resolveElorus(req: Request, res: Response): Promise<ElorusService | null> {
  const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
  if (!companyId) {
    res.status(400).json({ error: 'No active company' });
    return null;
  }
  const profile = await CompanyProfileDB.getById(companyId);
  if (!profile) {
    res.status(404).json({ error: 'Company not found' });
    return null;
  }
  if (!profile.elorus_api_key || !profile.elorus_organization_id) {
    res.json({ configured: false, message: 'Elorus not configured for this company. Add your API credentials in Company Setup.' });
    return null;
  }
  return new ElorusService(profile.elorus_api_key, profile.elorus_organization_id);
}

// ─── Status ──────────────────────────────────────────────────

router.get('/status', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.json({ configured: false });
    const profile = await CompanyProfileDB.getById(companyId);
    if (!profile) return res.json({ configured: false });
    const configured = !!(profile.elorus_api_key && profile.elorus_organization_id);
    if (!configured) return res.json({ configured: false });

    res.json({
      configured: true,
      organizationId: profile.elorus_organization_id,
      webBaseUrl: profile.elorus_base_url || '',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Test Connection ─────────────────────────────────────────

router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    // Try listing one contact to verify credentials
    await elorus.listContacts({ page_size: 1 });
    res.json({ success: true, message: 'Connection successful' });
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 403) {
      res.json({ success: false, message: 'Invalid API key or organization ID' });
    } else if (status === 401) {
      res.json({ success: false, message: 'Invalid API key' });
    } else {
      res.json({ success: false, message: error.message });
    }
  }
});

// ─── Contacts ────────────────────────────────────────────────

router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listContacts({
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      search: req.query.search as string | undefined,
      ctype: req.query.ctype as string | undefined,
      active: req.query.active as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const contact = await elorus.createContact(req.body);
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const contact = await elorus.getContact(req.params.id);
    res.json(contact);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// ─── Products ────────────────────────────────────────────────

router.get('/products', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listProducts({
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      search: req.query.search as string | undefined,
      active: req.query.active as string | undefined,
      sales: req.query.sales as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const product = await elorus.getProduct(req.params.id);
    res.json(product);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// ─── Estimates (Offers) ──────────────────────────────────────

router.get('/estimates', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listEstimates({
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      client: req.query.client as string | undefined,
      draft: req.query.draft as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.post('/estimates', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const estimate = await elorus.createEstimate(req.body);
    res.status(201).json(estimate);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/estimates/:id', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const estimate = await elorus.getEstimate(req.params.id);
    res.json(estimate);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/estimates/:id/pdf', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const pdfBuffer = await elorus.getEstimatePDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estimate-${req.params.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.patch('/estimates/:id', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const estimate = await elorus.updateEstimate(req.params.id, req.body);
    res.json(estimate);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// ─── Invoices ────────────────────────────────────────────────

router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listInvoices({
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      client: req.query.client as string | undefined,
      fpaid: req.query.fpaid as string | undefined,
      overdue: req.query.overdue as string | undefined,
      draft: req.query.draft as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const invoice = await elorus.createInvoice(req.body);
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const invoice = await elorus.getInvoice(req.params.id);
    res.json(invoice);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/invoices/:id/pdf', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const pdfBuffer = await elorus.getInvoicePDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// ─── Taxes & Document Types ──────────────────────────────────

router.get('/taxes', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listTaxes({
      active: req.query.active as string | undefined,
      tax_type: req.query.tax_type as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

router.get('/document-types', async (req: Request, res: Response) => {
  try {
    const elorus = await resolveElorus(req, res);
    if (!elorus) return;
    const result = await elorus.listDocumentTypes({
      application: req.query.application ? Number(req.query.application) : undefined,
      active: req.query.active as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

export default router;
