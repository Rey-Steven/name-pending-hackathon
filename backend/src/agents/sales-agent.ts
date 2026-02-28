import { BaseAgent } from './base-agent';
import { SalesResult, ReplyAnalysisResult, CompanyProfileContext } from '../types';
import { LeadDB, DealDB, Lead } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { callAI, parseJSONResponse } from '../services/ai-service';
import { AuditLog } from '../database/db';
import { broadcastEvent } from '../routes/dashboard.routes';

export class SalesAgent extends BaseAgent {
  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('sales', 'opus', companyProfile);
  }

  // ─── System prompt for initial deal processing ───────────────

  getSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('sales');
    return `${companyHeader}You are a Sales AI agent. ALL incoming leads are contacted — your job is to engage every lead without exception.

Use BANT analysis only to:
1. Inform pricing tier (A-score leads → premium, B → standard, C → entry-level)
2. Tailor the cold outreach angle and hook

Pricing guidelines:
- Calculate pricing based on the company's products/services and the lead's profile
- Volume discounts: 5% for orders > €10K, 10% for > €50K
- Include FPA at 24%
- Payment terms: Net 30 days standard

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1", "step 2", "..."],
  "decision": "Contact - brief reason",
  "data": {
    "qualification": "close",
    "budget": true,
    "authority": true,
    "need": true,
    "timeline": true,
    "productName": "the product/service to offer",
    "quantity": 1,
    "unitPrice": 0,
    "subtotal": 0,
    "fpaRate": 0.24,
    "fpaAmount": 0,
    "totalAmount": 0,
    "proposalSummary": "cold outreach angle — what hook to use for this specific lead"
  }
}`;
  }

  buildUserPrompt(input: { lead: Lead; marketingResult: any }): string {
    const { lead, marketingResult } = input;
    return `A new lead has been created. Plan the cold outreach and estimate initial pricing:

LEAD INFORMATION:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email || 'no email'})
- Product Interest: ${lead.product_interest || 'General inquiry'}
- Website: ${lead.company_website || 'N/A'}

MARKETING ANALYSIS:
- Industry: ${marketingResult.industry}
- Company Size: ${marketingResult.companySize}
- Annual Revenue: ${marketingResult.annualRevenue}
- Lead Score: ${marketingResult.leadScore}
- Recommended Approach: ${marketingResult.recommendedApproach}

Set "qualification" to "close" — we always contact this lead. Use BANT to inform pricing and outreach strategy.`;
  }

  // ─── Phase 1: Create deal + queue cold outreach ───────────────

  async processDeal(leadId: string, marketingResult: any): Promise<{ salesResult: SalesResult; dealId: string }> {
    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const result = await this.execute<SalesResult>({ lead, marketingResult }, { leadId });

    // Always force qualification to close — BANT is informational only
    result.data.qualification = 'close';

    // Pricing deferred — set to 0 until customer expresses interest and we understand their needs.
    // Actual pricing is calculated when the customer replies and triggers wants_offer/counter/new_offer.
    const dealId = await DealDB.create({
      company_id: this.companyProfile?.id,
      lead_id: leadId,
      deal_value: 0,
      product_name: result.data.productName,
      quantity: 0,
      subtotal: 0,
      fpa_rate: 0.24,
      fpa_amount: 0,
      total_amount: 0,
      qualification_result: JSON.stringify({
        budget: result.data.budget,
        authority: result.data.authority,
        need: result.data.need,
        timeline: result.data.timeline,
      }),
      sales_notes: result.data.proposalSummary,
      negotiation_round: 0,
      status: 'lead_contacted',
    });

    await LeadDB.update(leadId, { status: 'contacted' });

    // Queue cold outreach email — first contact, no pricing
    await TaskQueue.createTask({
      sourceAgent: 'sales',
      targetAgent: 'email',
      taskType: 'send_proposal',
      title: `Cold outreach: ${lead.company_name}`,
      description: `First contact — ${result.data.proposalSummary}`,
      inputData: { dealId, leadId, salesResult: result.data, emailType: 'cold_outreach' },
      dealId,
      leadId,
      companyId: this.companyProfile?.id,
    });

    return { salesResult: result, dealId };
  }

  // ─── Phase 2: Analyze inbound customer reply ──────────────────

  async analyzeReply(params: {
    dealId: string;
    leadId: string;
    dealStatus: string;
    customerReply: string;
    currentDeal: any;
    roundNumber: number;
    maxRounds: number;
  }): Promise<ReplyAnalysisResult> {
    const { dealId, leadId, dealStatus, customerReply, currentDeal, roundNumber, maxRounds } = params;
    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const isLastRound = roundNumber >= maxRounds;

    const systemPrompt = `You are a consultative Sales AI agent handling email conversations with leads for a Greek B2B company.

Your philosophy: understand before you sell. Never pitch products or name prices until you genuinely understand the lead's problem, scale, and timeline. Leads who feel understood close faster.

=== CURRENT STAGE: "${dealStatus}" ===

Stage definitions and STRICT valid actions:

- "lead_contacted": This is their VERY FIRST reply to our cold outreach.
  → "discovery": ALWAYS use this for the first reply — ask one focused question about their current challenge or situation. DO NOT mention pricing, products, or solutions yet.
  → "declined": They clearly have no interest.
  [FORBIDDEN at this stage: wants_offer, engaged, counter, new_offer, accepted]

- "in_pipeline": We are building understanding. Use discovery questions to learn their world.
  → "discovery": Still gathering info — we don't yet know their specific need, scale, and timeline.
  → "engaged": We understand their need well enough to have a warm conversation (no pricing yet).
  → "wants_offer": ONLY use this when ALL THREE are known: (1) specific pain/need, (2) approximate scale or volume, (3) rough timeline. If any is missing, use "discovery" instead.
  → "declined": Lost interest.

- "offer_sent": We sent a formal offer. They are responding to it.
  → "accepted": Agrees to terms, wants to proceed.
  → "counter": Wants to negotiate (price, terms, scope).
  → "new_offer": Declines this offer but wants a different one.
  → "declined": Firmly declines.${isLastRound ? '\n\n⚠️ FINAL ROUND: Must use "accepted" or "declined".' : ''}

=== WRITING RULES ===
- Write ALL emails (replyBody) in Greek language
- "discovery" replies: ask ONE specific, open-ended question about their business challenge or situation. Be warm and curious, not salesy. NEVER mention prices, product names, or our catalog.
- "engaged" replies: continue the conversation naturally. NO prices, NO product specifics. Ask a follow-up question if needed.
- "wants_offer" emails: open by summarising what you understood about their challenge and how your solution addresses it. THEN present full pricing (offerProductName, offerQuantity, offerUnitPrice, offerSubtotal, offerFpaRate 0.24, offerFpaAmount, offerTotalAmount). Lead with value, not numbers.
- "counter" emails: acknowledge their concern, adjust price by up to 15% from original (maintain 10% minimum margin), restate the value.
- "accepted" emails: warm, professional deal confirmation.
- "declined" emails: respectful closing, leave door open for future.

ALWAYS respond with valid JSON:
{
  "reasoning": ["step 1", "step 2", "step 3"],
  "decision": "Brief description",
  "data": {
    "action": "discovery" | "engaged" | "wants_offer" | "accepted" | "counter" | "new_offer" | "declined",
    "customerSentiment": "positive" | "neutral" | "negative",
    "customerIntent": "one sentence summary",
    "replySubject": "email subject",
    "replyBody": "full email in Greek",
    "offerProductName": null,
    "offerQuantity": null,
    "offerUnitPrice": null,
    "offerSubtotal": null,
    "offerFpaRate": 0.24,
    "offerFpaAmount": null,
    "offerTotalAmount": null,
    "offerSummary": null,
    "failureReason": null
  }
}`;

    const discoveryNote = dealStatus === 'lead_contacted'
      ? '\nNOTE: This is their FIRST reply. You MUST use action "discovery". Do not mention pricing or products.'
      : dealStatus === 'in_pipeline'
        ? '\nNOTE: Use "wants_offer" only if you already know their specific need, scale, AND timeline from prior exchanges. Otherwise use "discovery".'
        : '';

    const userPrompt = `DEAL CONTEXT:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email})
- Lead's stated interest: ${lead.product_interest || 'General inquiry'}
- Current Stage: ${dealStatus}
- Round: ${roundNumber} of ${maxRounds}
- Conversation notes so far: ${currentDeal.sales_notes || 'Cold outreach sent'}
${dealStatus === 'offer_sent' ? `- Offer on the table: €${currentDeal.subtotal} + FPA 24% = €${currentDeal.total_amount}` : ''}
CUSTOMER'S REPLY:
"${customerReply}"
${discoveryNote}
Analyze this reply in stage "${dealStatus}" and decide the next action.`;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`  📥 REPLY ANALYSIS — Stage: ${dealStatus} (round ${roundNumber}/${maxRounds})`);
    console.log(`  📋 Deal #${dealId} — ${lead.company_name}`);
    console.log(`${'='.repeat(50)}`);

    broadcastEvent({
      type: 'agent_started',
      agent: 'sales',
      dealId,
      leadId,
      message: `Analyzing customer reply — stage: ${dealStatus}`,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await callAI(systemPrompt, userPrompt, 'opus');
      const result = parseJSONResponse<ReplyAnalysisResult>(response.content);

      if (result.reasoning) {
        console.log('\n  🧠 Analysis:');
        result.reasoning.forEach((step, i) => console.log(`     ${i + 1}. ${step}`));
      }
      console.log(`  📋 Decision: ${result.decision}`);
      console.log(`  🎯 Action: ${result.data.action}`);
      console.log(`  💭 Sentiment: ${result.data.customerSentiment}`);
      console.log(`  📝 Intent: ${result.data.customerIntent}`);

      if (['wants_offer', 'counter', 'new_offer'].includes(result.data.action) && result.data.offerTotalAmount) {
        console.log(`  💰 Offer total: €${result.data.offerTotalAmount}`);
      }
      if (result.data.action === 'declined' && result.data.failureReason) {
        console.log(`  ❌ Reason: ${result.data.failureReason}`);
      }

      broadcastEvent({
        type: 'agent_completed',
        agent: 'sales',
        dealId,
        leadId,
        message: `Reply analyzed: ${result.data.action} — ${result.decision}`,
        reasoning: result.reasoning,
        data: result.data,
        timestamp: new Date().toISOString(),
      });

      AuditLog.log('sales', 'reply_analyzed', 'deal', dealId, {
        stage: dealStatus,
        round: roundNumber,
        action: result.data.action,
        sentiment: result.data.customerSentiment,
        intent: result.data.customerIntent,
      });

      return result;
    } catch (error: any) {
      console.error(`  ❌ Reply analysis failed: ${error.message}`);

      broadcastEvent({
        type: 'agent_failed',
        agent: 'sales',
        dealId,
        leadId,
        message: `Reply analysis failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}
