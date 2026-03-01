import axios from 'axios';

function getConfig() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || '',
    apiToken: process.env.R2_API_TOKEN || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  };
}

function getCfR2Base() {
  const { accountId, bucketName } = getConfig();
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects`;
}

/**
 * Upload a file to R2 via the Cloudflare REST API and return its public URL.
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  const { accountId, apiToken, bucketName } = getConfig();
  if (!accountId || !apiToken || !bucketName) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_API_TOKEN, R2_BUCKET_NAME env vars.');
  }
  await axios.put(`${getCfR2Base()}/${key}`, body, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': contentType,
    },
    maxBodyLength: Infinity,
  });
  return getR2PublicUrl(key);
}

/**
 * Get the public URL for an R2 object key.
 */
export function getR2PublicUrl(key: string): string {
  const { publicUrl } = getConfig();
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL env var not configured.');
  }
  return `${publicUrl}/${key}`;
}

/**
 * Fetch an object from R2 as a buffer (for proxying old /uploads/ paths).
 */
export async function getFromR2(key: string): Promise<{ body: Buffer; contentType: string }> {
  const { accountId, apiToken, bucketName } = getConfig();
  if (!accountId || !apiToken || !bucketName) {
    throw new Error('R2 credentials not configured.');
  }
  const response = await axios.get(`${getCfR2Base()}/${key}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
    responseType: 'arraybuffer',
  });
  return {
    body: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'application/octet-stream',
  };
}

/**
 * Check if R2 is configured (all required env vars present).
 */
export function isR2Configured(): boolean {
  const { accountId, apiToken, bucketName, publicUrl } = getConfig();
  return !!(accountId && apiToken && bucketName && publicUrl);
}
