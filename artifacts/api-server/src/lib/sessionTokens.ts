import jwt from "jsonwebtoken";
import type { TokenPayload, AdminTokenPayload } from "./auth.js";

export const USER_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const ISSUER = "subdraw";
function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) throw new Error("JWT_SECRET must be configured with at least 32 bytes; no fallback is permitted");
  return value;
}
export function assertAuthConfiguration(): void { secret(); }
function validTimes(value: jwt.JwtPayload, maximum: number): boolean {
  return typeof value.iat === "number" && Number.isSafeInteger(value.iat)
    && typeof value.exp === "number" && Number.isSafeInteger(value.exp)
    && value.exp > value.iat && value.exp - value.iat <= maximum
    && typeof value.issuedAtMs === "number" && Number.isSafeInteger(value.issuedAtMs)
    && Math.floor(value.issuedAtMs / 1000) === value.iat
    && value.issuedAtMs <= Date.now() + 1000;
}
export function generateToken(user: TokenPayload): string {
  if (!user.id || !["GC", "SUB"].includes(user.role)) throw new Error("Invalid user token identity");
  const issuedAtMs = Date.now();
  return jwt.sign({
    tokenUse: "user", version: 2, issuedAtMs, iat: Math.floor(issuedAtMs / 1000),
    id: user.id, email: user.email, role: user.role, companyName: user.companyName,
    displayName: user.displayName ?? null, gcParentId: user.gcParentId ?? null,
    gcTeamRole: user.gcTeamRole ?? null, isDemo: user.isDemo ?? false,
    impersonatedBy: user.impersonatedBy ?? null, impersonationLogId: user.impersonationLogId ?? null,
  }, secret(), { algorithm: "HS256", issuer: ISSUER, audience: "subdraw:user", expiresIn: USER_SESSION_SECONDS });
}
export function verifyToken(token: string): TokenPayload | null {
  try {
    const value = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: ISSUER, audience: "subdraw:user", maxAge: USER_SESSION_SECONDS });
    if (typeof value === "string" || value.tokenUse !== "user" || value.version !== 2 || !validTimes(value, USER_SESSION_SECONDS)) return null;
    if (typeof value.id !== "string" || !value.id || typeof value.email !== "string" || typeof value.companyName !== "string" || !["GC", "SUB"].includes(value.role)) return null;
    for (const key of ["displayName", "gcParentId", "gcTeamRole", "impersonatedBy", "impersonationLogId"]) {
      if (value[key] != null && typeof value[key] !== "string") return null;
    }
    return {
      id: value.id, email: value.email, role: value.role, companyName: value.companyName,
      displayName: value.displayName ?? null, gcParentId: value.gcParentId ?? null,
      gcTeamRole: value.gcTeamRole ?? null, isDemo: value.isDemo === true,
      impersonatedBy: value.impersonatedBy ?? null, impersonationLogId: value.impersonationLogId ?? null,
      iat: value.iat, issuedAtMs: value.issuedAtMs,
    };
  } catch { return null; }
}
export function generateAdminToken(adminEmail: string): string {
  const issuedAtMs = Date.now();
  return jwt.sign({ tokenUse: "admin", version: 2, isAdmin: true, adminEmail, issuedAtMs, iat: Math.floor(issuedAtMs / 1000) }, secret(), {
    algorithm: "HS256", issuer: ISSUER, audience: "subdraw:admin", expiresIn: ADMIN_SESSION_SECONDS,
  });
}
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const value = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: ISSUER, audience: "subdraw:admin", maxAge: ADMIN_SESSION_SECONDS });
    if (typeof value === "string" || value.tokenUse !== "admin" || value.version !== 2 || value.isAdmin !== true || typeof value.adminEmail !== "string" || !validTimes(value, ADMIN_SESSION_SECONDS)) return null;
    if (!process.env.ADMIN_EMAIL || value.adminEmail !== process.env.ADMIN_EMAIL) return null;
    return { isAdmin: true, adminEmail: value.adminEmail, iat: value.iat };
  } catch { return null; }
}
