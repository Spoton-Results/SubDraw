import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ownerNamespace, isOwnedPrivateKey, isRecord, privateDomainsDisabled, safeDownloadName } from "./privateStoragePolicy.js";

export class PrivateFileNotFound extends Error {}
function configuration() {
  const endpointValue = process.env.CLOUDFLARE_R2_ENDPOINT?.trim();
  const bucket = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME?.trim();
  const legacyBucket = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const appValue = process.env.APP_URL?.trim();
  if (!endpointValue || !bucket || !legacyBucket || bucket === legacyBucket || !accessKeyId || !secretAccessKey || !apiToken || !appValue) throw new Error("Dedicated private storage configuration is incomplete");
  const endpoint = new URL(endpointValue);
  const account = endpoint.hostname.match(/^([a-f0-9]+)\.r2\.cloudflarestorage\.com$/);
  if (endpoint.protocol !== "https:" || !account || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/") throw new Error("Private storage requires a standard HTTPS R2 endpoint");
  const app = new URL(appValue);
  if (app.protocol !== "https:" || app.username || app.password || app.search || app.hash) throw new Error("APP_URL must be a configured HTTPS application URL");
  return { endpoint: endpoint.origin, accountId: account[1], bucket, accessKeyId, secretAccessKey, apiToken, appOrigin: app.origin };
}
async function cloudflareResult(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Unable to inspect private bucket access settings");
  const body: unknown = await response.json();
  if (!isRecord(body) || body.success !== true || !("result" in body)) throw new Error("Invalid bucket access settings response");
  return body.result;
}
async function checkedConfiguration() {
  const config = configuration();
  const base = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${encodeURIComponent(config.bucket)}/domains`;
  const [managed, custom] = await Promise.all([
    cloudflareResult(`${base}/managed`, config.apiToken),
    cloudflareResult(`${base}/custom`, config.apiToken),
  ]);
  if (!privateDomainsDisabled(managed, custom)) throw new Error("Private bucket has public access enabled or unverifiable");
  return config;
}
function clientFor(config: ReturnType<typeof configuration>) {
  return new S3Client({ region: "auto", endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  });
}
export async function uploadPrivateFile(userId: string, buffer: Buffer, filename: string, contentType: string) {
  const config = await checkedConfiguration();
  const owner = ownerNamespace(userId);
  const key = `private/${owner}/${randomUUID()}`;
  const client = clientFor(config);
  try {
    await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer,
      ContentType: contentType, CacheControl: "private, no-store",
      Metadata: { owner, filename: safeDownloadName(filename) },
    }));
  } finally { client.destroy(); }
  return { objectPath: `/r2/${key}`, uploadURL: `${config.appOrigin}/api/storage/r2/${key}` };
}
export async function privateDownloadUrl(userId: string, key: string): Promise<string> {
  if (!isOwnedPrivateKey(key, userId)) throw new PrivateFileNotFound();
  const config = await checkedConfiguration();
  const client = clientFor(config);
  try {
    const metadata = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    if (metadata.Metadata?.owner !== ownerNamespace(userId)) throw new PrivateFileNotFound();
    return await getSignedUrl(client, new GetObjectCommand({
      Bucket: config.bucket, Key: key, ResponseCacheControl: "private, no-store",
      ResponseContentType: "application/octet-stream",
      ResponseContentDisposition: `attachment; filename="${safeDownloadName(metadata.Metadata.filename ?? "download")}"`,
    }), { expiresIn: 60 });
  } catch (error) {
    if (error instanceof PrivateFileNotFound || (error instanceof Error && ["NotFound", "NoSuchKey"].includes(error.name))) throw new PrivateFileNotFound();
    throw error;
  } finally { client.destroy(); }
}
