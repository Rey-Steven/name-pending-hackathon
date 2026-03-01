import { Router, Request, Response } from 'express';
import { MarketResearchDB, CompanyProfileDB } from '../database/db';
import { MarketingAgent } from '../agents/marketing-agent';
import { CompanyProfileContext } from '../types';

const router = Router();

function buildProfileContext(profile: any): CompanyProfileContext {
  const agentContexts = JSON.parse(profile.agent_context_json || '{}');
  return {
    id: profile.id!,
    name: profile.name,
    website: profile.website,
    industry: profile.industry,
    description: profile.description,
    business_model: profile.business_model,
    target_customers: profile.target_customers,
    products_services: profile.products_services,
    geographic_focus: profile.geographic_focus,
    agentContexts,
    pricing_model: profile.pricing_model,
    min_deal_value: profile.min_deal_value,
    max_deal_value: profile.max_deal_value,
    key_products: profile.key_products,
    unique_selling_points: profile.unique_selling_points,
    communication_language: profile.communication_language,
  };
}

// GET /api/research - Get all market research for active company
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const research = await MarketResearchDB.all(companyId);
    res.json(research);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/latest - Get most recent completed research
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const research = await MarketResearchDB.getLatest(companyId);
    if (!research) return res.status(404).json({ error: 'No completed research found' });
    res.json(research);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/:id - Get specific research by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const research = await MarketResearchDB.findById(req.params.id);
    if (!research) return res.status(404).json({ error: 'Research not found' });
    res.json(research);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/research/trigger - Manually trigger market research
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const profile = await CompanyProfileDB.get();
    if (!profile) return res.status(400).json({ error: 'No company profile configured' });

    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (companyId) {
      const running = await MarketResearchDB.hasRunning(companyId);
      if (running) return res.status(409).json({ error: 'Research is already running' });
    }

    const agent = new MarketingAgent(buildProfileContext(profile));
    const researchId = await agent.runMarketResearch('manual');
    res.json({ success: true, researchId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
