import { Buffer } from "node:buffer";
const PRIVATE_KEY = /^private\/[A-Za-z0-9_-]{1,512}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function ownerNamespace(userId: string): string {
  if (!userId || Buffer.byteLength(userId, "utf8") > 384) throw new Error("Invalid file owner");
  return Buffer.from(userId, "utf8").toString("base64url");
}
export function isOwnedPrivateKey(key: string, userId: string): boolean {
  try { return PRIVATE_KEY.test(key) && key.startsWith(`private/${ownerNamespace(userId)}/`); }
  catch { return false; }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function privateDomainsDisabled(managed: unknown, custom: unknown): boolean {
  return isRecord(managed) && managed.enabled === false && isRecord(custom)
    && Array.isArray(custom.domains)
    && custom.domains.every(domain => isRecord(domain) && domain.enabled === false);
}
export function safeDownloadName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "download";
}
