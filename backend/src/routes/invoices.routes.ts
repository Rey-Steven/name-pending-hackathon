import { Router, Request, Response } from 'express';
import { InvoiceDB, CompanyProfileDB } from '../database/db';

const router = Router();

// GET /api/invoices - Get all invoices
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const invoices = await InvoiceDB.all(companyId);
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await InvoiceDB.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
