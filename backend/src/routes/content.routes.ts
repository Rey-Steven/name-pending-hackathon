import { Router, Request, Response } from 'express';
import { SocialContentDB, CompanyProfileDB } from '../database/db';
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

// GET /api/content - Get all social content drafts for active company
router.get('/', async (_req: Request, res: Response) => {
  try {
    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const content = await SocialContentDB.all(companyId);
    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/content/:id - Get specific content draft
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const content = await SocialContentDB.findById(req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/content/:id/status - Update content status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['draft', 'approved', 'posted', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use: draft, approved, posted, archived' });
    }
    await SocialContentDB.update(req.params.id, { status });
    const updated = await SocialContentDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/content/:id - Edit content text
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { post_text, hashtags } = req.body;
    const updates: any = {};
    if (post_text !== undefined) updates.post_text = post_text;
    if (hashtags !== undefined) updates.hashtags = JSON.stringify(hashtags);
    await SocialContentDB.update(req.params.id, updates);
    const updated = await SocialContentDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/content/trigger - Manually trigger content creation
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.body;

    const profile = await CompanyProfileDB.get();
    if (!profile) return res.status(400).json({ error: 'No company profile configured' });

    const agent = new MarketingAgent(buildProfileContext(profile));
    const contentIds = await agent.createSocialContent(researchId, 'manual');
    res.json({ success: true, contentIds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
