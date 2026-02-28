import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { CompanyProfileDB } from '../database/db';
import { scrapeWebsite } from '../services/web-scraper';
import { parseDocument } from '../services/document-parser';
import { profileCompany } from '../services/company-profiler';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'logo'
      ? path.join(__dirname, '../../uploads/logos')
      : path.join(__dirname, '../../uploads/documents');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// GET /api/company - get current company profile
router.get('/', (_req: Request, res: Response) => {
  const profile = CompanyProfileDB.get();
  if (!profile) {
    return res.status(404).json({ error: 'No company profile found' });
  }
  const parsed = {
    ...profile,
    agent_context_json: JSON.parse(profile.agent_context_json || '{}'),
  };
  res.json(parsed);
});

// GET /api/company/setup-status
router.get('/setup-status', (_req: Request, res: Response) => {
  const setupComplete = CompanyProfileDB.isSetupComplete();
  res.json({ setupComplete });
});

// POST /api/company/setup - full onboarding setup
router.post(
  '/setup',
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'documents', maxCount: 10 }]),
  async (req: Request, res: Response) => {
    try {
      const { name, website, industry, userText } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const logoFile = files?.logo?.[0];
      const documentFiles = files?.documents || [];

      // 1. Scrape website (if provided)
      let scrapedText = '';
      if (website) {
        console.log(`  🌐 Scraping website: ${website}`);
        try {
          scrapedText = await scrapeWebsite(website);
        } catch (err: any) {
          console.warn('  ⚠️ Website scraping failed:', err.message);
        }
      }

      // 2. Parse uploaded documents
      const documentTexts: string[] = [];
      for (const docFile of documentFiles) {
        const buffer = fs.readFileSync(docFile.path);
        const text = await parseDocument(buffer, docFile.mimetype);
        if (text.trim()) documentTexts.push(text);
      }

      // 3. Call Claude to profile the company
      const profileResult = await profileCompany({
        companyName: name,
        website,
        industry,
        userProvidedText: userText,
        scrapedWebsiteText: scrapedText || undefined,
        documentTexts: documentTexts.length > 0 ? documentTexts : undefined,
      });

      // 4. Save to database (delete any previous profile first for single-tenant)
      const existing = CompanyProfileDB.get();
      const logoPath = logoFile ? `uploads/logos/${logoFile.filename}` : existing?.logo_path;

      if (existing?.id) {
        CompanyProfileDB.update(existing.id, {
          name,
          website: website || undefined,
          logo_path: logoPath,
          industry: profileResult.industry,
          description: profileResult.description,
          business_model: profileResult.business_model,
          target_customers: profileResult.target_customers,
          products_services: profileResult.products_services,
          geographic_focus: profileResult.geographic_focus,
          user_provided_text: userText || undefined,
          raw_scraped_data: scrapedText || undefined,
          agent_context_json: JSON.stringify(profileResult.agentContexts),
          setup_complete: 1,
        });
      } else {
        CompanyProfileDB.create({
          name,
          website: website || undefined,
          logo_path: logoPath,
          industry: profileResult.industry,
          description: profileResult.description,
          business_model: profileResult.business_model,
          target_customers: profileResult.target_customers,
          products_services: profileResult.products_services,
          geographic_focus: profileResult.geographic_focus,
          user_provided_text: userText || undefined,
          raw_scraped_data: scrapedText || undefined,
          agent_context_json: JSON.stringify(profileResult.agentContexts),
          setup_complete: 1,
        });
      }

      const saved = CompanyProfileDB.get()!;

      res.json({
        ...saved,
        agent_context_json: JSON.parse(saved.agent_context_json),
      });
    } catch (err: any) {
      console.error('Company setup error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/company - update basic fields (no re-scrape)
router.put('/', async (req: Request, res: Response) => {
  const profile = CompanyProfileDB.get();
  if (!profile?.id) {
    return res.status(404).json({ error: 'No company profile found' });
  }
  const { name, website, industry } = req.body;
  CompanyProfileDB.update(profile.id, { name, website, industry });
  res.json({ success: true });
});

// POST /api/company/rescrape - re-run scraping + re-profile
router.post('/rescrape', async (_req: Request, res: Response) => {
  const profile = CompanyProfileDB.get();
  if (!profile?.id) {
    return res.status(404).json({ error: 'No company profile found' });
  }

  try {
    let scrapedText = '';
    if (profile.website) {
      scrapedText = await scrapeWebsite(profile.website);
    }

    const profileResult = await profileCompany({
      companyName: profile.name,
      website: profile.website,
      industry: profile.industry,
      userProvidedText: profile.user_provided_text,
      scrapedWebsiteText: scrapedText || undefined,
    });

    CompanyProfileDB.update(profile.id, {
      industry: profileResult.industry,
      description: profileResult.description,
      business_model: profileResult.business_model,
      target_customers: profileResult.target_customers,
      products_services: profileResult.products_services,
      geographic_focus: profileResult.geographic_focus,
      raw_scraped_data: scrapedText || undefined,
      agent_context_json: JSON.stringify(profileResult.agentContexts),
    });

    const updated = CompanyProfileDB.get()!;
    res.json({ ...updated, agent_context_json: JSON.parse(updated.agent_context_json) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
