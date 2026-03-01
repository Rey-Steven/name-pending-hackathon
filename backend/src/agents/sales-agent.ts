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

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'sales',
      targetAgent: 'sales',
      taskType: 'process_deal',
      title: `Process deal: ${lead.company_name}`,
      inputData: { leadId },
      leadId,
      companyId: this.companyProfile?.id,
    });

    try {
      const result = await this.execute<SalesResult>({ lead, marketingResult }, { leadId, taskId });

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

      await TaskQueue.complete(taskId, { dealId, action: 'deal_created' });

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
    } catch (error: any) {
      await TaskQueue.fail(taskId, error.message);
      throw error;
    }
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
    minRepliesBeforeOffer: number;
    currentLeadProfile: Record<string, any> | null;
  }): Promise<ReplyAnalysisResult> {
    const { dealId, leadId, dealStatus, customerReply, currentDeal, roundNumber, maxRounds, minRepliesBeforeOffer, currentLeadProfile } = params;
    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const isLastRound = roundNumber >= maxRounds;
    const offerUnlocked = roundNumber >= minRepliesBeforeOffer && currentLeadProfile?.company_informed === true;
    const offerLockedReason = roundNumber < minRepliesBeforeOffer
      ? `reply threshold not met (${roundNumber}/${minRepliesBeforeOffer})`
      : !currentLeadProfile?.company_informed
        ? 'company not yet introduced to lead'
        : null;

    const systemPrompt = `You are a consultative Sales AI agent handling email conversations with leads for a Greek B2B company.

Your philosophy: understand before you sell. Build a genuine relationship, understand their world, and make sure they know who we are before you ever mention pricing. Leads who feel understood close faster.

=== CURRENT STAGE: "${dealStatus}" ===

Stage definitions and STRICT valid actions:

- "lead_contacted": This is their VERY FIRST reply to our cold outreach.
  → "discovery": ALWAYS use this for the first reply — ask one focused question about their current challenge or situation. DO NOT mention pricing, products, or solutions yet.
  → "declined": They clearly have no interest.
  [FORBIDDEN at this stage: wants_offer, engaged, counter, new_offer, accepted]

- "in_pipeline": We are building understanding. Use discovery questions to learn their world.
  → "discovery": Still gathering info — we don't yet know their specific need, scale, and timeline.
  → "engaged": We understand their need well enough to have a warm conversation (no pricing yet).
  → "wants_offer": ONLY valid when ALL conditions in GUARDRAIL 1 and GUARDRAIL 2 are satisfied AND (1) specific pain/need, (2) approximate scale or volume, (3) rough timeline are all known.
  → "declined": Lost interest.

- "offer_sent": We sent a formal offer. They are responding to it.
  → "accepted": Agrees to terms, wants to proceed.
  → "counter": Wants to negotiate (price, terms, scope).
  → "new_offer": Declines this offer but wants a different one.
  → "declined": Firmly declines.${isLastRound ? '\n\n⚠️ FINAL ROUND: Must use "accepted" or "declined".' : ''}

=== CONVERSATION GUARDRAILS ===

GUARDRAIL 1 — MINIMUM EXCHANGES:
The lead has sent ${roundNumber} ${roundNumber === 1 ? 'reply' : 'replies'}. Minimum required before any offer: ${minRepliesBeforeOffer}.
${roundNumber < minRepliesBeforeOffer
  ? `OFFER LOCKED — only ${roundNumber} of ${minRepliesBeforeOffer} required replies received. "wants_offer" is FORBIDDEN. Use "discovery" or "engaged".`
  : 'Reply threshold met ✓'}

GUARDRAIL 2 — COMPANY INTRODUCTION:
Before presenting any offer, the lead must understand who we are and what we do.
Current status: ${currentLeadProfile?.company_informed ? 'Company introduced ✓' : 'NOT YET INTRODUCED ✗'}
${!currentLeadProfile?.company_informed
  ? `- At a natural point in your reply, briefly describe what the company does and the value it provides. Weave it naturally into the conversation — do NOT make it feel like a sales pitch.
- Once you have introduced the company, set company_informed: true in updatedLeadProfile.
- "wants_offer" is FORBIDDEN until company_informed is true.`
  : '- Already introduced — no need to repeat.'}

GUARDRAIL 3 — LEAD PROFILING (REQUIRED every reply):
After reading the lead's message, update the lead profile with everything you have learned so far.
Build it incrementally — preserve existing knowledge and add new details. Fields to maintain:
  • company_background: what the lead's company does
  • stated_needs: array of specific needs they have mentioned
  • pain_points: array of problems or frustrations they have expressed
  • scale_volume: any indication of size, volume, or quantity
  • timeline: any urgency or timeline hints
  • budget_signals: any budget indicators (explicit or implicit)
  • company_informed: true once you have introduced our company to the lead in a reply
  • next_best_action: your concise assessment of the ideal next step

${!offerUnlocked ? `⚠️ "wants_offer" is currently FORBIDDEN. Reason: ${offerLockedReason}. Focus on discovery and relationship building.` : ''}

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
    "failureReason": null,
    "updatedLeadProfile": {
      "company_background": "what the lead's company does",
      "stated_needs": [],
      "pain_points": [],
      "scale_volume": "",
      "timeline": "",
      "budget_signals": "",
      "company_informed": false,
      "next_best_action": ""
    }
  }
}`;

    const offerStatusNote = offerUnlocked
      ? '"wants_offer" is ALLOWED if need + scale + timeline are all known.'
      : `"wants_offer" is FORBIDDEN. Reason: ${offerLockedReason}.`;

    const discoveryNote = dealStatus === 'lead_contacted'
      ? '\nNOTE: This is their FIRST reply. You MUST use action "discovery". Do not mention pricing or products.'
      : dealStatus === 'in_pipeline'
        ? `\nNOTE: ${offerStatusNote} Otherwise use "discovery" or "engaged".`
        : '';

    const profileSection = currentLeadProfile
      ? `CURRENT LEAD PROFILE (update and return as updatedLeadProfile):
${JSON.stringify(currentLeadProfile, null, 2)}`
      : `CURRENT LEAD PROFILE: None yet — start building it from this first reply.`;

    const userPrompt = `DEAL CONTEXT:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name} (${lead.contact_email})
- Lead's stated interest: ${lead.product_interest || 'General inquiry'}
- Current Stage: ${dealStatus}
- Round: ${roundNumber} of ${maxRounds}
- Conversation notes so far: ${currentDeal.sales_notes || 'Cold outreach sent'}
${dealStatus === 'offer_sent' ? `- Offer on the table: €${currentDeal.subtotal} + FPA 24% = €${currentDeal.total_amount}` : ''}
GUARDRAIL STATUS:
- Replies received: ${roundNumber} / minimum before offer: ${minRepliesBeforeOffer}
- Company introduced to lead: ${currentLeadProfile?.company_informed ? 'Yes' : 'No — must introduce before any offer'}
- "wants_offer" allowed: ${offerUnlocked ? 'YES (if need + scale + timeline known)' : 'NO — ' + offerLockedReason}

${profileSection}

CUSTOMER'S REPLY:
"${customerReply}"
${discoveryNote}
Analyze this reply in stage "${dealStatus}" and decide the next action. Remember to include updatedLeadProfile in your response.`;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`  📥 REPLY ANALYSIS — Stage: ${dealStatus} (round ${roundNumber}/${maxRounds})`);
    console.log(`  📋 Deal #${dealId} — ${lead.company_name}`);
    console.log(`${'='.repeat(50)}`);

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'sales',
      targetAgent: 'sales',
      taskType: 'analyze_reply',
      title: `Analyze reply: ${lead.company_name} (${dealStatus})`,
      inputData: { dealId, dealStatus, roundNumber },
      dealId,
      leadId,
      companyId: this.companyProfile?.id,
    });

    broadcastEvent({
      type: 'agent_started',
      agent: 'sales',
      taskId,
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
        taskId,
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

      await TaskQueue.complete(taskId, { action: result.data.action, sentiment: result.data.customerSentiment });

      return result;
    } catch (error: any) {
      console.error(`  ❌ Reply analysis failed: ${error.message}`);

      broadcastEvent({
        type: 'agent_failed',
        agent: 'sales',
        taskId,
        dealId,
        leadId,
        message: `Reply analysis failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      await TaskQueue.fail(taskId, error.message);

      throw error;
    }
  }
}
