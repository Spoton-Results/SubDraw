import {
  S3Client,
  PutObjectCommand,
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
  });
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

export async function getPresignedPutUrl(
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const cmd = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: 900 });
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

export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    })
  );
  return makeR2Path(key);
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
