import { Router, Request, Response } from 'express';
import { AppSettingsDB } from '../database/db';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await AppSettingsDB.get();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const updated = await AppSettingsDB.update(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
