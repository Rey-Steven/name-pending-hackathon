import { getJson } from 'serpapi';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  relatedSearches: string[];
}

export async function searchGoogle(query: string, numResults: number = 10): Promise<WebSearchResponse> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not configured');
  }

  console.log(`  🔍 Searching Google: "${query}"`);

  const response = await getJson({
    engine: 'google',
    q: query,
    api_key: apiKey,
    num: numResults,
    hl: 'en',
  });

  const organicResults: SearchResult[] = (response.organic_results || []).map((r: any) => ({
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
    position: r.position || 0,
  }));

  const relatedSearches: string[] = (response.related_searches || []).map((r: any) => r.query || '');

  console.log(`  ✅ Found ${organicResults.length} results for "${query}"`);

  return {
    query,
    results: organicResults,
    relatedSearches,
  };
}

export async function searchMultiple(queries: string[]): Promise<WebSearchResponse[]> {
  const results: WebSearchResponse[] = [];
  for (const query of queries) {
    try {
      const result = await searchGoogle(query);
      results.push(result);
    } catch (err: any) {
      console.error(`  ❌ Search failed for "${query}":`, err.message);
    }
  }
  return results;
}
