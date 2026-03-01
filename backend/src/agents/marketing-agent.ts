import { BaseAgent } from './base-agent';
import { MarketingResult, MarketResearchResult, SocialContentResult, CompanyProfileContext } from '../types';
import { LeadDB, Lead, MarketResearchDB, SocialContentDB, AuditLog, CompanyProfileDB } from '../database/db';
import { TaskQueue } from '../services/task-queue';
import { searchMultiple, WebSearchResponse } from '../services/web-search';
import { broadcastEvent } from '../routes/dashboard.routes';

type MarketingMode = 'lead_enrichment' | 'market_research' | 'content_creation';

export class MarketingAgent extends BaseAgent {
  private mode: MarketingMode = 'lead_enrichment';

  constructor(companyProfile: CompanyProfileContext | null = null) {
    super('marketing', 'opus', companyProfile);
  }

  // ─── Prompt routing (mode-switched) ───

  getSystemPrompt(): string {
    switch (this.mode) {
      case 'market_research':
        return this.getResearchSystemPrompt();
      case 'content_creation':
        return this.getContentSystemPrompt();
      default:
        return this.getLeadEnrichmentSystemPrompt();
    }
  }

  buildUserPrompt(input: any): string {
    switch (this.mode) {
      case 'market_research':
        return this.buildResearchUserPrompt(input);
      case 'content_creation':
        return this.buildContentUserPrompt(input);
      default:
        return this.buildLeadUserPrompt(input as Lead);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TASK 1: Lead Enrichment & Scoring (existing)
  // ═══════════════════════════════════════════════════════════

  private getLeadEnrichmentSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('marketing');
    return `${companyHeader}You are a Marketing AI agent. Your job is to enrich and qualify incoming leads.

When given a lead, you must:
1. Analyze the company name and any available information
2. Infer the industry, company size, and annual revenue estimate
3. Score the lead quality (A = high value, B = medium, C = low) based on fit with your company's target customers
4. Recommend a sales approach tailored to your company's product/service

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1 of your analysis", "step 2", "..."],
  "decision": "Lead scored as X - brief summary",
  "data": {
    "industry": "the industry",
    "companySize": "e.g., 10-50 employees",
    "annualRevenue": "e.g., €500K-2M",
    "leadScore": "A" | "B" | "C",
    "recommendedApproach": "brief strategy recommendation"
  }
}`;
  }

  private buildLeadUserPrompt(lead: Lead): string {
    return `Analyze and qualify this incoming lead:

Company Name: ${lead.company_name}
Contact Person: ${lead.contact_name}
Email: ${lead.contact_email || 'Not provided'}
Phone: ${lead.contact_phone || 'Not provided'}
Product Interest: ${lead.product_interest || 'General inquiry'}
Website: ${lead.company_website || 'Not provided'}

Provide your analysis and lead score.`;
  }

  async processLead(leadId: string): Promise<MarketingResult> {
    this.mode = 'lead_enrichment';

    const lead = await LeadDB.findById(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const enrichTaskId = await TaskQueue.createAndTrack({
      sourceAgent: 'marketing',
      targetAgent: 'marketing',
      taskType: 'lead_enrichment',
      title: `Enrich lead: ${lead.company_name}`,
      inputData: { leadId },
      leadId,
      companyId: lead.company_id,
    });

    try {
      const result = await this.execute<MarketingResult>(lead, { leadId, taskId: enrichTaskId });

      await LeadDB.update(leadId, {
        industry: result.data.industry,
        company_size: result.data.companySize,
        annual_revenue: result.data.annualRevenue,
        lead_score: result.data.leadScore,
        status: 'qualified',
      });

      await TaskQueue.complete(enrichTaskId, result.data);

      await TaskQueue.createTask({
        sourceAgent: 'marketing',
        targetAgent: 'sales',
        taskType: 'qualify_lead',
        title: `Qualify lead: ${lead.company_name}`,
        description: `Lead score: ${result.data.leadScore} - ${result.decision}`,
        inputData: { leadId, marketingResult: result.data },
        leadId,
        companyId: lead.company_id,
      });

      return result;
    } catch (error: any) {
      await TaskQueue.fail(enrichTaskId, error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TASK 2: Market Research
  // ═══════════════════════════════════════════════════════════

  private getResearchSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('marketing');
    return `${companyHeader}You are a Market Research AI analyst. Your job is to analyze web search results about market trends, competitors, and social media activity relevant to your company.

When given search results, you must:
1. Identify key market trends and their relevance to the company
2. Extract competitor activities and strategies
3. Highlight notable social media content from Instagram and LinkedIn
4. Identify opportunities and threats
5. Write a concise executive summary

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1 of your analysis", "step 2", "..."],
  "decision": "Brief summary of key findings",
  "data": {
    "marketTrends": [
      { "trend": "description", "relevance": "high" | "medium" | "low", "source": "url or description" }
    ],
    "competitorInsights": [
      { "competitor": "name", "activity": "what they did", "platform": "where", "takeaway": "what it means for us" }
    ],
    "socialMediaHighlights": [
      { "platform": "instagram or linkedin", "content": "summary of post/activity", "engagement": "high/medium/low or metrics if available", "relevance": "why it matters" }
    ],
    "opportunities": ["opportunity 1", "opportunity 2"],
    "threats": ["threat 1", "threat 2"],
    "summary": "2-3 paragraph executive summary of findings"
  }
}`;
  }

  private buildResearchUserPrompt(input: { searchResults: WebSearchResponse[]; companyContext: string }): string {
    const resultsText = input.searchResults.map(sr => {
      const items = sr.results.map(r =>
        `  - [${r.position}] ${r.title}\n    ${r.snippet}\n    URL: ${r.link}`
      ).join('\n');
      return `=== Search: "${sr.query}" ===\n${items}`;
    }).join('\n\n');

    return `Analyze the following web search results for market intelligence relevant to our company.

COMPANY CONTEXT:
${input.companyContext}

SEARCH RESULTS:
${resultsText}

Provide your analysis as a structured market research report.`;
  }

  async runMarketResearch(triggeredBy: 'schedule' | 'manual' = 'manual'): Promise<string> {
    this.mode = 'market_research';

    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) throw new Error('No active company configured');

    const cp = this.companyProfile;
    if (!cp) throw new Error('Company profile not loaded');

    const companyContext = [
      `Company: ${cp.name}`,
      `Industry: ${cp.industry || 'Not specified'}`,
      `Products/Services: ${cp.products_services || 'Not specified'}`,
      `Target Customers: ${cp.target_customers || 'Not specified'}`,
      `Geographic Focus: ${cp.geographic_focus || 'Not specified'}`,
    ].join('\n');

    const searchQueries: string[] = [
      `${cp.industry || cp.name} market trends ${new Date().getFullYear()}`,
      `${cp.industry || cp.name} competitors news`,
      `${cp.name} OR "${(cp.products_services || '').split(',')[0]?.trim() || cp.industry}" site:instagram.com`,
      `${cp.industry || cp.name} thought leadership site:linkedin.com`,
      `${cp.target_customers || cp.industry} challenges ${new Date().getFullYear()}`,
    ];

    const researchId = await MarketResearchDB.create({
      company_id: companyId,
      search_queries: JSON.stringify(searchQueries),
      status: 'running',
      triggered_by: triggeredBy,
    });

    console.log(`\n📊 MARKET RESEARCH started (ID: ${researchId}, triggered: ${triggeredBy})`);
    AuditLog.log('marketing', 'research_started', 'market_research', researchId, { triggeredBy, queries: searchQueries });

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'marketing',
      targetAgent: 'marketing',
      taskType: 'market_research',
      title: `Market research (${triggeredBy})`,
      inputData: { triggeredBy, queries: searchQueries },
      companyId,
    });

    broadcastEvent({
      type: 'agent_started',
      agent: 'marketing',
      taskId,
      message: `Market research started (${triggeredBy})`,
      timestamp: new Date().toISOString(),
    });

    try {
      const searchResults = await searchMultiple(searchQueries);

      const result = await this.execute<MarketResearchResult>(
        { searchResults, companyContext },
        { taskId }
      );

      await MarketResearchDB.update(researchId, {
        raw_search_results: JSON.stringify(searchResults),
        trends_json: JSON.stringify(result.data.marketTrends),
        competitors_json: JSON.stringify(result.data.competitorInsights),
        social_json: JSON.stringify(result.data.socialMediaHighlights),
        opportunities: JSON.stringify(result.data.opportunities),
        threats: JSON.stringify(result.data.threats),
        summary: result.data.summary,
        ai_reasoning: JSON.stringify(result.reasoning),
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      console.log(`  ✅ Market research completed (ID: ${researchId})`);
      AuditLog.log('marketing', 'research_completed', 'market_research', researchId, {
        trendCount: result.data.marketTrends.length,
        competitorCount: result.data.competitorInsights.length,
      });

      await TaskQueue.complete(taskId, { researchId });

      return researchId;
    } catch (err: any) {
      await MarketResearchDB.update(researchId, {
        status: 'failed',
        error_message: err.message,
      });
      AuditLog.log('marketing', 'research_failed', 'market_research', researchId, { error: err.message });
      await TaskQueue.fail(taskId, err.message);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TASK 3: Social Content Creation
  // ═══════════════════════════════════════════════════════════

  private getContentSystemPrompt(): string {
    const companyHeader = this.buildCompanyContextHeader('marketing');
    return `${companyHeader}You are a Social Media Content Creator AI. Your job is to create engaging social media post drafts for Instagram and LinkedIn based on market research findings.

For each platform, generate content that:
1. Is tailored to the platform's audience and format (Instagram: visual, casual, hashtag-heavy; LinkedIn: professional, thought-leadership)
2. Incorporates relevant market trends and insights from the research
3. Aligns with the company's brand voice and target audience
4. Includes appropriate hashtags
5. Suggests an image concept that would complement the post
6. Recommends the best time to post based on the platform

ALWAYS respond with valid JSON in this exact format:
{
  "reasoning": ["step 1 of your creative process", "step 2", "..."],
  "decision": "Brief description of the content theme",
  "data": {
    "instagram": {
      "postText": "The full Instagram caption text (use line breaks with \\n)",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
      "imageDescription": "Detailed description of the ideal image to accompany this post",
      "bestPostingTime": "e.g., Tuesday 11:00 AM",
      "tone": "e.g., inspiring, educational, casual"
    },
    "linkedin": {
      "postText": "The full LinkedIn post text (use line breaks with \\n)",
      "hashtags": ["#hashtag1", "#hashtag2"],
      "imageDescription": "Detailed description of the ideal image or graphic",
      "bestPostingTime": "e.g., Wednesday 9:00 AM",
      "tone": "e.g., professional, thought-leadership"
    },
    "contentTheme": "The overarching theme tying both posts together",
    "basedOnResearchId": "the research document ID"
  }
}`;
  }

  private buildContentUserPrompt(input: { researchSummary: string; researchId: string; trends: any[]; opportunities: string[] }): string {
    const trendsText = input.trends.map((t: any) =>
      `- [${t.relevance}] ${t.trend} (Source: ${t.source})`
    ).join('\n');

    return `Create social media content drafts based on the following market research.

RESEARCH SUMMARY:
${input.researchSummary}

KEY TRENDS:
${trendsText}

OPPORTUNITIES TO LEVERAGE:
${input.opportunities.map((o: string) => `- ${o}`).join('\n')}

RESEARCH ID: ${input.researchId}

Generate one Instagram post draft and one LinkedIn post draft.`;
  }

  async createSocialContent(researchId?: string, triggeredBy: 'schedule' | 'manual' = 'manual'): Promise<string[]> {
    this.mode = 'content_creation';

    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) throw new Error('No active company configured');

    let research;
    if (researchId) {
      research = await MarketResearchDB.findById(researchId);
    } else {
      research = await MarketResearchDB.getLatest(companyId);
    }

    if (!research || research.status !== 'completed') {
      throw new Error('No completed market research available. Run research first.');
    }

    console.log(`\n✍️  CONTENT CREATION started (research: ${research.id}, triggered: ${triggeredBy})`);
    AuditLog.log('marketing', 'content_started', 'social_content', undefined, { researchId: research.id, triggeredBy });

    const taskId = await TaskQueue.createAndTrack({
      sourceAgent: 'marketing',
      targetAgent: 'marketing',
      taskType: 'content_creation',
      title: `Social content creation (${triggeredBy})`,
      inputData: { researchId: research.id, triggeredBy },
      companyId,
    });

    broadcastEvent({
      type: 'agent_started',
      agent: 'marketing',
      taskId,
      message: `Content creation started (${triggeredBy})`,
      timestamp: new Date().toISOString(),
    });

    try {
      const trends = research.trends_json ? JSON.parse(research.trends_json) : [];
      const opportunities = research.opportunities ? JSON.parse(research.opportunities) : [];
      const researchSummary = research.summary || 'No summary available';

      const result = await this.execute<SocialContentResult>(
        {
          researchSummary,
          researchId: research.id!,
          trends,
          opportunities,
        },
        { taskId }
      );

      const contentIds: string[] = [];

      const igId = await SocialContentDB.create({
        company_id: companyId,
        research_id: research.id,
        platform: 'instagram',
        post_text: result.data.instagram.postText,
        hashtags: JSON.stringify(result.data.instagram.hashtags),
        image_description: result.data.instagram.imageDescription,
        best_posting_time: result.data.instagram.bestPostingTime,
        tone: result.data.instagram.tone,
        content_theme: result.data.contentTheme,
        ai_reasoning: JSON.stringify(result.reasoning),
        status: 'draft',
        triggered_by: triggeredBy,
      });
      contentIds.push(igId);

      const liId = await SocialContentDB.create({
        company_id: companyId,
        research_id: research.id,
        platform: 'linkedin',
        post_text: result.data.linkedin.postText,
        hashtags: JSON.stringify(result.data.linkedin.hashtags),
        image_description: result.data.linkedin.imageDescription,
        best_posting_time: result.data.linkedin.bestPostingTime,
        tone: result.data.linkedin.tone,
        content_theme: result.data.contentTheme,
        ai_reasoning: JSON.stringify(result.reasoning),
        status: 'draft',
        triggered_by: triggeredBy,
      });
      contentIds.push(liId);

      console.log(`  ✅ Content created: Instagram (${igId}), LinkedIn (${liId})`);
      AuditLog.log('marketing', 'content_completed', 'social_content', undefined, {
        researchId: research.id,
        instagramId: igId,
        linkedinId: liId,
        theme: result.data.contentTheme,
      });

      await TaskQueue.complete(taskId, { contentIds });

      return contentIds;
    } catch (error: any) {
      await TaskQueue.fail(taskId, error.message);
      throw error;
    }
  }
}
