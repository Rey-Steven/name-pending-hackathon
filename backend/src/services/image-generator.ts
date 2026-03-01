import OpenAI from 'openai';
import * as https from 'https';
import { uploadToR2 } from './r2-storage';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface GeneratedImage {
  filename: string;
  relativePath: string;
}

/**
 * Generate images using DALL-E 3 and upload them to R2.
 * DALL-E 3 only supports n=1, so we loop for each image.
 */
export async function generateImages(prompt: string, count: number = 2): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];
  const timestamp = Date.now();
  const uniqueId = Math.round(Math.random() * 1e6);

  for (let i = 0; i < count; i++) {
    console.log(`  🎨 Generating image ${i + 1}/${count} via DALL-E 3...`);

    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      response_format: 'url',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      console.warn(`  ⚠️ No URL returned for image ${i + 1}`);
      continue;
    }

    const filename = `${timestamp}-${uniqueId}-${i}.png`;
    const buffer = await downloadToBuffer(imageUrl);
    const r2Url = await uploadToR2(`generated-images/${filename}`, buffer, 'image/png');

    results.push({ filename, relativePath: r2Url });
    console.log(`  ✅ Image ${i + 1} uploaded to R2: ${r2Url}`);
  }

  return results;
}

function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadToBuffer(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}
