import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const OUTPUT_DIR = path.join(__dirname, '../../uploads/generated-images');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
 * Generate images using DALL-E 3 and save them locally.
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
    const filePath = path.join(OUTPUT_DIR, filename);

    await downloadFile(imageUrl, filePath);

    const relativePath = `/uploads/generated-images/${filename}`;
    results.push({ filename, relativePath });
    console.log(`  ✅ Image ${i + 1} saved: ${relativePath}`);
  }

  return results;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}
