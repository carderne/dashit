import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize R2 client (S3-compatible)
export function getR2Client() {
  const accountId = process.env.CLOUDFLARE_R2_URL?.match(
    /https:\/\/(.+?)\.r2\.cloudflarestorage\.com/,
  )?.[1]

  if (!accountId) {
    throw new Error('CLOUDFLARE_R2_URL not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_URL,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}

// Generate pre-signed upload URL
export async function generatePresignedUploadUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const client = getR2Client()
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'application/octet-stream',
  })

  return await getSignedUrl(client, command, { expiresIn })
}

// Generate pre-signed download URL (for querying parquet files)
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const client = getR2Client()
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return await getSignedUrl(client, command, { expiresIn })
}
