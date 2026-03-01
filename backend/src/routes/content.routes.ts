import { Router, Request, Response } from 'express';
import { SocialContentDB, CompanyProfileDB } from '../database/db';
import { MarketingAgent } from '../agents/marketing-agent';
import { CompanyProfileContext } from '../types';
import { generateImages } from '../services/image-generator';

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
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
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

    const current = await SocialContentDB.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ error: 'Content not found' });
    }

    await SocialContentDB.update(req.params.id, { status });

    // Trigger image generation when approving a draft with an image description
    if (status === 'approved' && current.status === 'draft' && current.image_description) {
      await SocialContentDB.update(req.params.id, { image_generation_status: 'generating' });

      const contentId = req.params.id;
      const prompt = current.image_description;

      // Fire-and-forget: generate in background, don't block the response
      generateImages(prompt, 2)
        .then(async (images) => {
          const imageUrls = images.map(img => img.relativePath);
          await SocialContentDB.update(contentId, {
            image_urls: JSON.stringify(imageUrls),
            image_generation_status: 'completed',
          });
          console.log(`  ✅ Images generated for content ${contentId}: ${imageUrls.join(', ')}`);
        })
        .catch(async (err) => {
          console.error(`  ❌ Image generation failed for content ${contentId}:`, err.message);
          await SocialContentDB.update(contentId, {
            image_generation_status: 'failed',
          });
        });
    }

    const updated = await SocialContentDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/content/:id/select-image - Select one of the generated images
router.patch('/:id/select-image', async (req: Request, res: Response) => {
  try {
    const { image_url } = req.body;
    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    const content = await SocialContentDB.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Validate the URL is one of the generated candidates
    const candidates: string[] = content.image_urls ? JSON.parse(content.image_urls) : [];
    if (!candidates.includes(image_url)) {
      return res.status(400).json({ error: 'image_url must be one of the generated images' });
    }

    await SocialContentDB.update(req.params.id, { selected_image_url: image_url });
    const updated = await SocialContentDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/content/:id/regenerate-images - Regenerate images using current image_description
router.post('/:id/regenerate-images', async (req: Request, res: Response) => {
  try {
    const content = await SocialContentDB.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    if (!content.image_description) {
      return res.status(400).json({ error: 'No image description to generate from' });
    }

    // Reset image state and start generating
    await SocialContentDB.update(req.params.id, {
      image_generation_status: 'generating',
      selected_image_url: '',
      image_urls: '',
    });

    const contentId = req.params.id;
    const prompt = content.image_description;

    // Fire-and-forget
    generateImages(prompt, 2)
      .then(async (images) => {
        const imageUrls = images.map(img => img.relativePath);
        await SocialContentDB.update(contentId, {
          image_urls: JSON.stringify(imageUrls),
          image_generation_status: 'completed',
        });
        console.log(`  ✅ Images regenerated for content ${contentId}: ${imageUrls.join(', ')}`);
      })
      .catch(async (err) => {
        console.error(`  ❌ Image regeneration failed for content ${contentId}:`, err.message);
        await SocialContentDB.update(contentId, {
          image_generation_status: 'failed',
        });
      });

    const updated = await SocialContentDB.findById(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/content/:id - Edit content text and/or image description
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { post_text, hashtags, image_description } = req.body;
    const updates: any = {};
    if (post_text !== undefined) updates.post_text = post_text;
    if (hashtags !== undefined) updates.hashtags = JSON.stringify(hashtags);
    if (image_description !== undefined) updates.image_description = image_description;
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

    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const profile = await CompanyProfileDB.getById(companyId);
    if (!profile) return res.status(400).json({ error: 'No company profile configured' });

    const agent = new MarketingAgent(buildProfileContext(profile));
    const contentIds = await agent.createSocialContent(researchId, 'manual');
    res.json({ success: true, contentIds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
