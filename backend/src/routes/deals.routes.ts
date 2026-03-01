import { Router, Request, Response } from 'express';
import { DealDB, LeadDB, InvoiceDB, LegalValidationDB, TaskDB, CompanyProfileDB, PendingOfferDB } from '../database/db';
import { generateOfferPDF } from '../services/pdf-generator';
import { EmailAgent } from '../agents/email-agent';
import { broadcastEvent } from './dashboard.routes';

const router = Router();

// GET /api/deals - Get all deals
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const deals = await DealDB.all(companyId);
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/pending-offers - List all offers awaiting approval
router.get('/pending-offers', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });

    const offers = await PendingOfferDB.allPending(companyId);

    // Enrich with lead + deal info
    const enriched = await Promise.all(offers.map(async (offer) => {
      const [deal, lead] = await Promise.all([
        DealDB.findById(offer.deal_id),
        LeadDB.findById(offer.lead_id),
      ]);
      return { ...offer, deal, lead };
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id - Get deal with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get related data in parallel
    const [lead, invoice, legalValidation, tasks] = await Promise.all([
      deal.lead_id ? LeadDB.findById(deal.lead_id) : Promise.resolve(null),
      InvoiceDB.findByDeal(dealId),
      LegalValidationDB.findByDeal(dealId),
      TaskDB.findByDeal(dealId),
    ]);

    res.json({ ...deal, lead, invoice, legalValidation, tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id/pdf - Download offer PDF
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (!deal.subtotal || deal.subtotal === 0) {
      return res.status(400).json({ error: 'Deal has no pricing yet — offer PDF not available until the customer expresses interest' });
    }

    const lead = await LeadDB.findById(deal.lead_id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found for this deal' });
    }

    const companyProfile = await CompanyProfileDB.get();
    if (!companyProfile) {
      return res.status(500).json({ error: 'Company profile not configured' });
    }

    const pdfBuffer = await generateOfferPDF({ deal, lead, companyProfile });

    const refId = dealId.slice(0, 8).toUpperCase();
    const filename = `Prosfora-${refId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/check-reply - Check inbox for customer reply and negotiate
router.post('/:id/check-reply', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const deal = await DealDB.findById(dealId);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const replyStatuses = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'];
    if (!replyStatuses.includes(deal.status || '')) {
      return res.status(400).json({
        error: `Deal is in '${deal.status}' status. Only deals in ${replyStatuses.join(', ')} can check for replies.`,
      });
    }

    const { WorkflowEngine } = await import('../services/workflow-engine');
    const engine = new WorkflowEngine();
    const result = await engine.processReply(dealId);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Check reply error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/approve-offer - Approve draft offer, generate PDF + send
router.post('/:id/approve-offer', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;
    const {
      offer_product_name,
      offer_quantity,
      offer_unit_price,
      reply_body,
    } = req.body;

    const pending = await PendingOfferDB.findByDeal(dealId);
    if (!pending) return res.status(404).json({ error: 'No pending offer found for this deal' });

    const deal = await DealDB.findById(dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const lead = await LeadDB.findById(deal.lead_id);
    if (!lead || !lead.contact_email) return res.status(404).json({ error: 'Lead not found or missing email' });

    const companyProfile = await CompanyProfileDB.get();
    if (!companyProfile) return res.status(500).json({ error: 'Company profile not configured' });

    // Recalculate pricing from (possibly edited) values
    const qty = offer_quantity ?? pending.offer_quantity;
    const unitPrice = offer_unit_price ?? pending.offer_unit_price;
    const productName = offer_product_name ?? pending.offer_product_name;
    const emailBody = reply_body ?? pending.reply_body;
    const subtotal = qty * unitPrice;
    const fpaRate = pending.offer_fpa_rate;
    const fpaAmount = Math.round(subtotal * fpaRate * 100) / 100;
    const totalAmount = Math.round((subtotal + fpaAmount) * 100) / 100;

    // Update deal with final offer pricing
    await DealDB.update(dealId, {
      status: 'offer_sent',
      product_name: productName,
      quantity: qty,
      deal_value: subtotal,
      subtotal,
      fpa_rate: fpaRate,
      fpa_amount: fpaAmount,
      total_amount: totalAmount,
      sales_notes: pending.offer_summary || deal.sales_notes,
    });

    const updatedDeal = await DealDB.findById(dealId);
    if (!updatedDeal) throw new Error('Deal not found after update');

    // Generate PDF with final pricing
    const pdfBuffer = await generateOfferPDF({ deal: updatedDeal, lead, companyProfile });
    const refId = dealId.slice(0, 8).toUpperCase();

    // Send the email with PDF attached
    const companyProfileCtx = {
      id: companyProfile.id!,
      name: companyProfile.name,
      industry: companyProfile.industry,
      description: companyProfile.description,
      business_model: companyProfile.business_model,
      target_customers: companyProfile.target_customers,
      products_services: companyProfile.products_services,
      geographic_focus: companyProfile.geographic_focus,
      agentContexts: JSON.parse(companyProfile.agent_context_json || '{}'),
      communication_language: companyProfile.communication_language,
    };

    const emailAgent = new EmailAgent(companyProfileCtx);
    await emailAgent.deliver({
      to: lead.contact_email,
      subject: pending.reply_subject,
      body: emailBody,
      dealId,
      recipientName: lead.contact_name,
      emailType: 'proposal',
      inReplyTo: pending.in_reply_to,
      references: pending.references,
      attachments: [{ filename: `Prosfora-${refId}.pdf`, content: pdfBuffer }],
    });

    // Mark pending offer as approved
    await PendingOfferDB.update(pending.id!, { status: 'approved' });

    const label = pending.action === 'counter' ? 'Counter-offer' : pending.action === 'new_offer' ? 'New offer' : 'Offer';
    console.log(`\n  ✅ ${label} approved and sent — €${totalAmount} to ${lead.contact_email}`);

    broadcastEvent({
      type: 'workflow_completed',
      agent: 'sales',
      dealId,
      leadId: deal.lead_id,
      message: `${label} approved and sent — €${totalAmount} (PDF attached)`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, status: 'offer_sent', totalAmount });
  } catch (error: any) {
    console.error('Approve offer error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/reject-offer - Reject draft, move deal back to in_pipeline
router.post('/:id/reject-offer', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.id;

    const pending = await PendingOfferDB.findByDeal(dealId);
    if (!pending) return res.status(404).json({ error: 'No pending offer found for this deal' });

    await PendingOfferDB.update(pending.id!, { status: 'rejected' });
    await DealDB.update(dealId, { status: 'in_pipeline' });

    broadcastEvent({
      type: 'workflow_completed',
      agent: 'sales',
      dealId,
      leadId: (await DealDB.findById(dealId))?.lead_id || '',
      message: 'Offer draft rejected — deal moved back to pipeline',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, status: 'in_pipeline' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
