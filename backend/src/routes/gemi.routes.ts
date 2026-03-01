import { Router, Request, Response } from 'express';
import { triggerGemiScraper, stopGemiScraper, getGemiScraperStatus } from '../services/gemi-scraper';
import { GemiCompanyDB } from '../database/db';

const router = Router();

// GET /api/gemi/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getGemiScraperStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gemi/trigger
router.post('/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await triggerGemiScraper();
    res.status(result.started ? 200 : 409).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gemi/stop
router.post('/stop', async (_req: Request, res: Response) => {
  try {
    const result = await stopGemiScraper();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gemi/companies/count
router.get('/companies/count', async (_req: Request, res: Response) => {
  try {
    const total = await GemiCompanyDB.count();
    res.json({ total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gemi/companies?limit=50&startAfter=docId&search=foo&status=...&legalForm=...&chamberName=...
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const { limit, startAfter, search, status, legalForm, chamberName } = req.query;
    const result = await GemiCompanyDB.list({
      limit: limit ? parseInt(limit as string, 10) : 50,
      startAfter: startAfter as string | undefined,
      search: search as string | undefined,
      status: status as string | undefined,
      legalForm: legalForm as string | undefined,
      chamberName: chamberName as string | undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gemi/companies/:id
router.get('/companies/:id', async (req: Request, res: Response) => {
  try {
    const company = await GemiCompanyDB.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
