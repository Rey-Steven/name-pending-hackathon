import { callAI, parseJSONResponse } from './ai-service';
import { AgentCompanyContexts } from '../types';

export interface KadCode {
  code: string;
  description: string;
}

export interface HelpCenterContent {
  intro: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface CompanyProfileResult {
  description: string;
  industry: string;
  business_model: string;
  target_customers: string;
  products_services: string;
  geographic_focus: string;
  agentContexts: AgentCompanyContexts;
  kad_codes: KadCode[];
  help_center_content: HelpCenterContent;
}

interface ProfilerInput {
  companyName: string;
  website?: string;
  industry?: string;
  userProvidedText?: string;
  scrapedWebsiteText?: string;
  documentTexts?: string[];
}

const SYSTEM_PROMPT = `You are a business intelligence analyst. Given information about a company from multiple sources, create a comprehensive company profile and generate tailored operational context for each department's AI agent.

Your output will be used to customize AI agents that run the company's operations (marketing, sales, legal, accounting, email).

Also suggest 3–5 Greek KAD codes (Κωδικός Αριθμός Δραστηριότητας) that match this company's business activities, and generate 6–8 customer-facing FAQ entries for a help center page.

ALWAYS respond with valid JSON in this exact format:
{
  "description": "2-3 sentence company overview",
  "industry": "Primary industry/sector",
  "business_model": "e.g. B2B SaaS / B2C Retail / Professional Services / etc.",
  "target_customers": "Detailed description of who buys from this company",
  "products_services": "What products or services they offer",
  "geographic_focus": "Where they operate (country/region/global)",
  "agentContexts": {
    "marketing": "Detailed guidance for the Marketing agent: what makes a high-quality lead for this specific company, lead scoring criteria, industry signals to look for, recommended outreach approach, typical deal size range",
    "sales": "Detailed guidance for the Sales agent: pricing strategy and typical deal values, BANT criteria specific to this business, what qualification looks like for their product/service, proposal language and value props to emphasize, discount thresholds, payment terms common in their industry",
    "legal": "Detailed guidance for the Legal agent: industry-specific regulatory requirements, relevant compliance frameworks (GDPR, industry regulations, export controls), contract type typically used, specific risk factors for this business model and sector, required legal clauses for their product/service",
    "accounting": "Detailed guidance for the Accounting agent: currency and tax jurisdiction, applicable VAT/tax rates, invoice format requirements, typical payment terms for this industry, standard line item descriptions for their products/services, accounting treatment specifics",
    "email": "Detailed guidance for the Email agent: language and locale for communications, appropriate tone and formality level for their industry/customers, key value propositions to reference, company voice and brand guidelines inferred from the above, how to address customers (formal/informal)"
  },
  "kad_codes": [
    { "code": "6201", "description": "Computer programming activities" }
  ],
  "help_center_content": {
    "intro": "2-3 sentence welcome paragraph for the public help center, written from the company's perspective",
    "faqs": [
      { "question": "What services do you offer?", "answer": "..." },
      { "question": "How do I get started?", "answer": "..." }
    ]
  }
}`;

export async function profileCompany(input: ProfilerInput): Promise<CompanyProfileResult> {
  const sources: string[] = [];

  sources.push(`Company Name: ${input.companyName}`);
  if (input.website) sources.push(`Website: ${input.website}`);
  if (input.industry) sources.push(`Industry (user-specified): ${input.industry}`);

  if (input.userProvidedText) {
    sources.push(`\n--- USER DESCRIPTION ---\n${input.userProvidedText}`);
  }

  if (input.scrapedWebsiteText) {
    sources.push(`\n--- SCRAPED WEBSITE CONTENT ---\n${input.scrapedWebsiteText}`);
  }

  if (input.documentTexts && input.documentTexts.length > 0) {
    input.documentTexts.forEach((text, i) => {
      if (text.trim()) {
        sources.push(`\n--- UPLOADED DOCUMENT ${i + 1} ---\n${text}`);
      }
    });
  }

  const userPrompt = `Analyze the following company information and generate a comprehensive profile with tailored AI agent contexts:\n\n${sources.join('\n')}`;

  console.log(`  🔍 Profiling company: ${input.companyName}...`);
  const response = await callAI(SYSTEM_PROMPT, userPrompt, 'sonnet', 4096);
  const result = parseJSONResponse<CompanyProfileResult>(response.content);

  console.log(`  ✅ Company profile generated: ${result.industry} / ${result.business_model}`);
  return result;
}
