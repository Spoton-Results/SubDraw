import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const R2_PREFIX = "/r2/";

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function getAccountId(): string {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT ?? "";
  const match = endpoint.match(/https?:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com/);
  if (!match) throw new Error("Could not extract account ID from CLOUDFLARE_R2_ENDPOINT");
  return match[1];
}

function getBucket(): string {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME!;
}

export function isR2Path(path: string | null | undefined): boolean {
  return typeof path === "string" && path.startsWith(R2_PREFIX);
}

export function extractR2Key(path: string): string {
  return path.slice(R2_PREFIX.length);
}

export function makeR2Path(key: string): string {
  return `${R2_PREFIX}${key}`;
}

export function generateR2Key(folder: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  return `${folder}/${Date.now()}-${safe}`;
}

export async function getPresignedGetUrl(
  key: string,
  filename?: string
): Promise<string> {
  const client = getR2Client();
  const params: ConstructorParameters<typeof GetObjectCommand>[0] = {
    Bucket: getBucket(),
    Key: key,
  };
  if (filename) {
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }
  const cmd = new GetObjectCommand(params);
  return getSignedUrl(client, cmd, { expiresIn: 3600 });
}

/**
 * Upload a buffer to Cloudflare R2 via the Cloudflare REST API.
 * Uses api.cloudflare.com (reachable from server) instead of the R2 S3 endpoint.
 * Requires CLOUDFLARE_API_TOKEN env var with R2:Edit permission.
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN is not set. Please add it in Replit secrets.");
  }

  const accountId = getAccountId();
  const bucket = getBucket();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodedKey}`;

  console.log(`[r2] Uploading via Cloudflare API: ${key} (${buffer.length} bytes)`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}): ${body}`);
  }

  const publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  console.log(`[r2] Upload successful: ${publicBase}/${key}`);
  return `${publicBase}/${key}`;
}

export async function deleteFromR2(pathOrKey: string): Promise<void> {
  const key = isR2Path(pathOrKey) ? extractR2Key(pathOrKey) : pathOrKey;
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}
