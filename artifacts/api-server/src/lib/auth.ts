import bcrypt from "bcryptjs";
import { serialize, parse } from "cookie";
import type { Request, Response } from "express";
import { assertAuthConfiguration, USER_SESSION_SECONDS, ADMIN_SESSION_SECONDS, generateToken, verifyToken, generateAdminToken, verifyAdminToken } from "./sessionTokens.js";
export { generateToken, verifyToken, generateAdminToken, verifyAdminToken };
assertAuthConfiguration();
const COOKIE_NAME = "auth_token";
const ADMIN_COOKIE_NAME = "admin_token";
function getCookieDomain(): string | undefined {
  const configured = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return configured ? configured.startsWith(".") ? configured : `.${configured}` : undefined;
}
function authCookieOptions(maxAge: number, includeDomain = true) {
  const domain = includeDomain ? getCookieDomain() : undefined;
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path: "/", ...(domain ? { domain } : {}) };
}
function setCookieWithFallback(res: Response, name: string, value: string, maxAge: number) {
  const cookies = [serialize(name, value, authCookieOptions(maxAge, false))];
  if (getCookieDomain()) cookies.push(serialize(name, value, authCookieOptions(maxAge, true)));
  res.append("Set-Cookie", cookies);
}
export async function hashPassword(password: string): Promise<string> { return bcrypt.hash(password, 10); }
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try { return await bcrypt.compare(password, hash); } catch { return false; }
}
export interface TokenPayload {
  id: string; email: string; role: string; companyName: string;
  displayName?: string | null; gcParentId?: string | null; gcTeamRole?: string | null;
  isDemo?: boolean; impersonatedBy?: string | null; impersonationLogId?: string | null;
  iat?: number; issuedAtMs?: number;
}
export interface AdminTokenPayload { isAdmin: true; adminEmail: string; iat?: number; }
export const GC_TEAM_ROLES = ["owner", "vp_operations", "project_manager", "project_engineer", "superintendent", "estimator", "contract_administrator", "accountant"] as const;
export type GCTeamRole = (typeof GC_TEAM_ROLES)[number];
export const GC_TEAM_ROLE_META: Record<GCTeamRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access to everything including billing, all projects, all financials, and team management." },
  vp_operations: { label: "VP of Operations", description: "Read access to all projects and financials. Receives alerts for flagged invoices, disputes, and over-budget projects. Cannot edit billing or team settings." },
  project_manager: { label: "Project Manager", description: "Full management of assigned projects. Can create change orders, approve invoices, and invite subs. No billing access." },
  project_engineer: { label: "Project Engineer", description: "Assigned projects only. Can view, comment, and process change orders and submittals. Cannot approve invoices or access financials." },
  superintendent: { label: "Superintendent", description: "Assigned projects only. Can view subcontract details and invoices, and confirm work completion percentage. Cannot approve or reject invoices financially." },
  estimator: { label: "Estimator", description: "Bidding phase access only on assigned projects. Can view bids and perform bid leveling comparison. No access to construction phase financials." },
  contract_administrator: { label: "Contract Administrator", description: "Access to all compliance documents, insurance certificates, lien waivers, and subcontract agreements across all projects. No financial approval access." },
  accountant: { label: "Accountant", description: "Read-only access to all financial data across all projects. Can download all PDFs and CSV exports. Cannot create or approve anything." },
};
export function getEffectiveGcId(user: TokenPayload): string { return user.gcParentId ?? user.id; }
export function getGCTeamRole(user: TokenPayload): GCTeamRole | null {
  if (user.role !== "GC") return null;
  if (!user.gcParentId) return user.gcTeamRole == null || user.gcTeamRole === "owner" ? "owner" : null;
  if (!user.gcTeamRole || user.gcTeamRole === "owner") return null;
  return GC_TEAM_ROLES.includes(user.gcTeamRole as GCTeamRole) ? user.gcTeamRole as GCTeamRole : null;
}
export function isGCOwner(user: TokenPayload): boolean { return user.role === "GC" && !user.gcParentId && getGCTeamRole(user) === "owner"; }
export function isTeamMember(user: TokenPayload): boolean { return user.role === "GC" && !!user.gcParentId; }
export function isProjectManager(user: TokenPayload): boolean { return getGCTeamRole(user) === "project_manager"; }
export function getActorName(user: TokenPayload): string { return user.displayName || user.companyName; }
export function getActorRoleLabel(user: TokenPayload): string {
  if (user.role !== "GC") return user.role;
  const role = getGCTeamRole(user);
  return role ? GC_TEAM_ROLE_META[role].label : "Unknown";
}
export function canSeeAllProjects(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "vp_operations" || role === "contract_administrator" || role === "accountant";
}
export function isBiddingOnlyRole(user: TokenPayload): boolean { return getGCTeamRole(user) === "estimator"; }
export function canApproveInvoices(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "project_manager"; }
export function canCreateChangeOrders(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "project_manager" || role === "project_engineer"; }
export function canInviteSubs(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "project_manager"; }
export function canAccessBilling(user: TokenPayload): boolean { return isGCOwner(user); }
export function canManageTeam(user: TokenPayload): boolean { return isGCOwner(user); }
export function canConfirmCompletion(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "project_manager" || role === "superintendent"; }
export function hasFinancialAccess(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "vp_operations" || role === "project_manager" || role === "accountant"; }
export function canDownloadFiles(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role !== null && role !== "estimator"; }
export function canAccessCompliance(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role !== null && role !== "estimator"; }
export function canViewBids(user: TokenPayload): boolean { const role = getGCTeamRole(user); return role === "owner" || role === "project_manager" || role === "estimator" || role === "vp_operations"; }
export function canCreateProjects(user: TokenPayload): boolean { return isGCOwner(user); }
export function setAdminCookie(res: Response, token: string): void { setCookieWithFallback(res, ADMIN_COOKIE_NAME, token, ADMIN_SESSION_SECONDS); }
export function clearAdminCookie(res: Response): void { setCookieWithFallback(res, ADMIN_COOKIE_NAME, "", 0); }
export function getAdminUser(req: Request): AdminTokenPayload | null {
  const token = parse(req.headers.cookie || "")[ADMIN_COOKIE_NAME];
  return token ? verifyAdminToken(token) : null;
}
export function setAuthCookie(res: Response, token: string): void { setCookieWithFallback(res, COOKIE_NAME, token, USER_SESSION_SECONDS); }
export function clearAuthCookie(res: Response): void { setCookieWithFallback(res, COOKIE_NAME, "", 0); }
export function getAuthUser(req: Request): TokenPayload | null {
  const token = parse(req.headers.cookie || "")[COOKIE_NAME];
  return token ? verifyToken(token) : null;
}
