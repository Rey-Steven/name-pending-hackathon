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

// ─── Helper ───────────────────────────────────────────────────

function serializeProfile(profile: any) {
  return {
    ...profile,
    agent_context_json: JSON.parse(profile.agent_context_json || '{}'),
  };
}

// ─── GET /api/company — active company profile ────────────────

router.get('/', async (_req: Request, res: Response) => {
  const profile = await CompanyProfileDB.get();
  if (!profile) {
    return res.status(404).json({ error: 'No company profile found' });
  }
  res.json(serializeProfile(profile));
});

// ─── GET /api/company/setup-status ───────────────────────────

router.get('/setup-status', async (_req: Request, res: Response) => {
  const setupComplete = await CompanyProfileDB.isSetupComplete();
  res.json({ setupComplete });
});

// ─── GET /api/company/help-center ────────────────────────────

router.get('/help-center', async (_req: Request, res: Response) => {
  const profile = await CompanyProfileDB.get();
  if (!profile?.help_center_json) {
    return res.status(404).json({ error: 'Help center content not yet generated. Run company setup first.' });
  }
  try {
    const content = JSON.parse(profile.help_center_json);
    res.json({
      companyName: profile.name,
      logoPath: profile.logo_path ? `/uploads/${profile.logo_path.replace('uploads/', '')}` : null,
      ...content,
    });
  } catch {
    res.status(500).json({ error: 'Failed to parse help center content' });
  }
});

// ─── POST /api/company/setup — create new company + activate ─

router.post(
  '/setup',
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'documents', maxCount: 10 }]),
  async (req: Request, res: Response) => {
    try {
      const {
        name, website, industry, userText,
        pricingModel, minDealValue, maxDealValue,
        keyProducts, uniqueSellingPoints, communicationLanguage,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const logoFile = files?.logo?.[0];
      const documentFiles = files?.documents || [];

      // 1. Scrape website
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

      // 3. Profile with Claude (richer input)
      const profileResult = await profileCompany({
        companyName: name,
        website,
        industry,
        userProvidedText: userText,
        scrapedWebsiteText: scrapedText || undefined,
        documentTexts: documentTexts.length > 0 ? documentTexts : undefined,
        pricingModel,
        minDealValue: minDealValue ? Number(minDealValue) : undefined,
        maxDealValue: maxDealValue ? Number(maxDealValue) : undefined,
        keyProducts,
        uniqueSellingPoints,
        communicationLanguage,
      });

      // 4. Always create a new company document (never upsert)
      const logoPath = logoFile ? `uploads/logos/${logoFile.filename}` : undefined;

      const newId = await CompanyProfileDB.create({
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
        kad_codes: JSON.stringify(profileResult.kad_codes ?? []),
        help_center_json: JSON.stringify(profileResult.help_center_content ?? {}),
        pricing_model: pricingModel || undefined,
        min_deal_value: minDealValue ? Number(minDealValue) : undefined,
        max_deal_value: maxDealValue ? Number(maxDealValue) : undefined,
        key_products: keyProducts || undefined,
        unique_selling_points: uniqueSellingPoints || undefined,
        communication_language: communicationLanguage || 'Greek',
        setup_complete: true,
      } as any);

      const saved = await CompanyProfileDB.get();
      res.json(serializeProfile(saved!));
    } catch (err: any) {
      console.error('Company setup error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── PUT /api/company — update active company basic fields ────

router.put('/', async (req: Request, res: Response) => {
  const activeId = await CompanyProfileDB.getActiveId();
  if (!activeId) {
    return res.status(404).json({ error: 'No active company profile found' });
  }
  const {
    name, website, industry, kad_codes,
    pricing_model, min_deal_value, max_deal_value,
    key_products, unique_selling_points, communication_language,
  } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (website !== undefined) updates.website = website;
  if (industry !== undefined) updates.industry = industry;
  if (kad_codes !== undefined) updates.kad_codes = kad_codes;
  if (pricing_model !== undefined) updates.pricing_model = pricing_model;
  if (min_deal_value !== undefined) updates.min_deal_value = Number(min_deal_value);
  if (max_deal_value !== undefined) updates.max_deal_value = Number(max_deal_value);
  if (key_products !== undefined) updates.key_products = key_products;
  if (unique_selling_points !== undefined) updates.unique_selling_points = unique_selling_points;
  if (communication_language !== undefined) updates.communication_language = communication_language;
  await CompanyProfileDB.update(activeId, updates);
  res.json({ success: true });
});

// ─── POST /api/company/rescrape ───────────────────────────────

router.post('/rescrape', async (_req: Request, res: Response) => {
  const profile = await CompanyProfileDB.get();
  const activeId = await CompanyProfileDB.getActiveId();
  if (!profile || !activeId) {
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
      pricingModel: profile.pricing_model,
      minDealValue: profile.min_deal_value,
      maxDealValue: profile.max_deal_value,
      keyProducts: profile.key_products,
      uniqueSellingPoints: profile.unique_selling_points,
      communicationLanguage: profile.communication_language,
    });

    await CompanyProfileDB.update(activeId, {
      industry: profileResult.industry,
      description: profileResult.description,
      business_model: profileResult.business_model,
      target_customers: profileResult.target_customers,
      products_services: profileResult.products_services,
      geographic_focus: profileResult.geographic_focus,
      raw_scraped_data: scrapedText || undefined,
      agent_context_json: JSON.stringify(profileResult.agentContexts),
      kad_codes: JSON.stringify(profileResult.kad_codes ?? []),
      help_center_json: JSON.stringify(profileResult.help_center_content ?? {}),
    });

    const updated = await CompanyProfileDB.get();
    res.json(serializeProfile(updated!));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/companies — list all saved companies ────────────

router.get('/all', async (_req: Request, res: Response) => {
  const [all, activeId] = await Promise.all([
    CompanyProfileDB.getAll(),
    CompanyProfileDB.getActiveId(),
  ]);
  const result = all.map(c => ({
    id: c.id,
    name: c.name,
    logo_path: c.logo_path,
    industry: c.industry,
    business_model: c.business_model,
    communication_language: c.communication_language,
    created_at: c.created_at,
    is_active: c.id === activeId,
  }));
  res.json(result);
});

// ─── POST /api/companies/:id/activate ────────────────────────

router.post('/:id/activate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const all = await CompanyProfileDB.getAll();
  const target = all.find(c => c.id === id);
  if (!target) {
    return res.status(404).json({ error: `Company ${id} not found` });
  }
  await CompanyProfileDB.setActive(id);
  const profile = await CompanyProfileDB.get();
  res.json(serializeProfile(profile!));
});

// ─── DELETE /api/companies/:id ────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const all = await CompanyProfileDB.getAll();
  if (all.length <= 1) {
    return res.status(409).json({ error: 'Cannot delete the only company profile' });
  }
  const target = all.find(c => c.id === id);
  if (!target) {
    return res.status(404).json({ error: `Company ${id} not found` });
  }
  await CompanyProfileDB.delete(id);
  res.json({ success: true });
});

export default router;
