import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ModelTier = 'sonnet' | 'haiku';

const MODELS: Record<ModelTier, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
};

export interface AIResponse {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  tier: ModelTier = 'sonnet',
  maxTokens: number = 4096
): Promise<AIResponse> {
  const model = MODELS[tier];

  console.log(`  🤖 Calling ${tier} (${model})...`);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const content = textBlock ? textBlock.text : '';

  if (response.stop_reason === 'max_tokens') {
    console.warn(`  ⚠️  Response hit max_tokens limit (${maxTokens}) — output may be truncated!`);
  }
  console.log(`  ✅ Response received (${response.usage.input_tokens} in / ${response.usage.output_tokens} out)`);

  return {
    content,
    model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

// Parse JSON from AI response, handling markdown code blocks and extra text
export function parseJSONResponse<T>(content: string): T {
  // Strip markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: try parsing the largest JSON object in the response
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonCandidate) as T;
    }
    throw new Error('Failed to parse AI JSON response');
  }
}
