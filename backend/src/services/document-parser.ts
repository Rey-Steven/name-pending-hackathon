import { PDFParse } from 'pdf-parse';

const MAX_CHARS = 6000;

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text.slice(0, MAX_CHARS);
  } catch (err: any) {
    console.warn('PDF parse error:', err.message);
    return '';
  }
}

export function parseTextFile(buffer: Buffer): string {
  return buffer.toString('utf-8').slice(0, MAX_CHARS);
}

export async function parseDocument(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    return parsePDF(buffer);
  }
  if (mimetype.startsWith('text/')) {
    return parseTextFile(buffer);
  }
  // Unsupported type (e.g. images) — return empty
  return '';
}
