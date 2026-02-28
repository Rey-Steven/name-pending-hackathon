import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_CHARS = 8000;

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CompanyProfiler/1.0)',
      },
    });

    clearTimeout(timer);

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractText(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('script, style, nav, footer, header, iframe, noscript, [class*="cookie"], [class*="popup"]').remove();

  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';

  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 0)
    .join(' | ');

  const paragraphs = $('p, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 20)
    .join(' ');

  return [title, metaDesc, ogDesc, headings, paragraphs]
    .filter(Boolean)
    .join('\n\n');
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, '');
}

export async function scrapeWebsite(websiteUrl: string): Promise<string> {
  const base = normalizeUrl(websiteUrl);
  const pagesToTry = [base, `${base}/about`, `${base}/about-us`, `${base}/company`];

  const texts: string[] = [];

  for (const url of pagesToTry) {
    const html = await fetchWithTimeout(url);
    if (html) {
      const text = extractText(html);
      if (text.length > 100) {
        texts.push(`[Page: ${url}]\n${text}`);
      }
    }
    // Stop early if we have enough content
    if (texts.join('\n').length > MAX_CONTENT_CHARS) break;
  }

  const combined = texts.join('\n\n---\n\n');
  return combined.slice(0, MAX_CONTENT_CHARS);
}
