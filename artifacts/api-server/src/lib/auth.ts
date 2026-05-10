import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";
import type { Request, Response } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";
const COOKIE_NAME = "auth_token";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

function getCookieDomain(): string | undefined {
  const configured = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!configured) return undefined;
  return configured.startsWith(".") ? configured : `.${configured}`;
}

function authCookieOptions(maxAge: number) {
  const domain = getCookieDomain();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  companyName: string;
  displayName?: string | null;
  gcParentId?: string | null;
  gcTeamRole?: string | null;
  isDemo?: boolean;
  impersonatedBy?: string | null;
  impersonationLogId?: string | null;
  iat?: number;
}

// ── Role definitions ──────────────────────────────────────────────────────────

export const GC_TEAM_ROLES = [
  "owner",
  "vp_operations",
  "project_manager",
  "project_engineer",
  "superintendent",
  "estimator",
  "contract_administrator",
  "accountant",
] as const;

export type GCTeamRole = (typeof GC_TEAM_ROLES)[number];

export const GC_TEAM_ROLE_META: Record<GCTeamRole, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Full access to everything including billing, all projects, all financials, and team management.",
  },
  vp_operations: {
    label: "VP of Operations",
    description: "Read access to all projects and financials. Receives alerts for flagged invoices, disputes, and over-budget projects. Cannot edit billing or team settings.",
  },
  project_manager: {
    label: "Project Manager",
    description: "Full management of assigned projects. Can create change orders, approve invoices, and invite subs. No billing access.",
  },
  project_engineer: {
    label: "Project Engineer",
    description: "Assigned projects only. Can view, comment, and process change orders and submittals. Cannot approve invoices or access financials.",
  },
  superintendent: {
    label: "Superintendent",
    description: "Assigned projects only. Can view subcontract details and invoices, and confirm work completion percentage. Cannot approve or reject invoices financially.",
  },
  estimator: {
    label: "Estimator",
    description: "Bidding phase access only on assigned projects. Can view bids and perform bid leveling comparison. No access to construction phase financials.",
  },
  contract_administrator: {
    label: "Contract Administrator",
    description: "Access to all compliance documents, insurance certificates, lien waivers, and subcontract agreements across all projects. No financial approval access.",
  },
  accountant: {
    label: "Accountant",
    description: "Read-only access to all financial data across all projects. Can download all PDFs and CSV exports. Cannot create or approve anything.",
  },
};

// ── Identity helpers ──────────────────────────────────────────────────────────

/** Returns the GC owner ID: if user is a team member, returns their gcParentId; otherwise their own ID. */
export function getEffectiveGcId(user: TokenPayload): string {
  return user.gcParentId ?? user.id;
}

export function getGCTeamRole(user: TokenPayload): GCTeamRole {
  if (!user.gcTeamRole || user.gcTeamRole === "owner") return "owner";
  if (GC_TEAM_ROLES.includes(user.gcTeamRole as GCTeamRole)) return user.gcTeamRole as GCTeamRole;
  return "owner";
}

/** Returns true if this GC user is the account Owner (or a legacy GC with no gcTeamRole). */
export function isGCOwner(user: TokenPayload): boolean {
  return user.role === "GC" && (user.gcTeamRole === "owner" || user.gcTeamRole == null);
}

/** Returns true if this is a non-owner team member. */
export function isTeamMember(user: TokenPayload): boolean {
  return user.role === "GC" && !!user.gcParentId;
}

/** @deprecated Use getGCTeamRole() instead. Kept for backward compatibility. */
export function isProjectManager(user: TokenPayload): boolean {
  return user.role === "GC" && user.gcTeamRole === "project_manager";
}

/** Returns the display name for activity logs: personal name for team members, company name for owners/subs. */
export function getActorName(user: TokenPayload): string {
  return user.displayName || user.companyName;
}

/** Returns the human-readable role label for activity log entries (e.g. "Project Manager", "Superintendent"). */
export function getActorRoleLabel(user: TokenPayload): string {
  if (user.role !== "GC") return user.role;
  return GC_TEAM_ROLE_META[getGCTeamRole(user)].label;
}

// ── Permission helpers ────────────────────────────────────────────────────────

/** Sees ALL projects without needing project assignments (owner sees all by being the GC). */
export function canSeeAllProjects(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "vp_operations" || role === "contract_administrator" || role === "accountant";
}

/** Only sees projects in BIDDING status (estimator). */
export function isBiddingOnlyRole(user: TokenPayload): boolean {
  return getGCTeamRole(user) === "estimator";
}

/** Can approve or reject invoices. */
export function canApproveInvoices(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "project_manager";
}

/** Can create or submit change orders. */
export function canCreateChangeOrders(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "project_manager" || role === "project_engineer";
}

/** Can invite subcontractors to bid. */
export function canInviteSubs(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "project_manager";
}

/** Can access billing page and subscription management. */
export function canAccessBilling(user: TokenPayload): boolean {
  return isGCOwner(user);
}

/** Can manage team members (invite, edit, delete, assign). */
export function canManageTeam(user: TokenPayload): boolean {
  return isGCOwner(user);
}

/** Can confirm completion percentage on invoices (as a field, not financial approval). */
export function canConfirmCompletion(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "project_manager" || role === "superintendent";
}

/** Has access to financial data (invoice amounts, draw totals, budget). */
export function hasFinancialAccess(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "vp_operations" || role === "project_manager" || role === "accountant";
}

/** Can download PDFs and CSV exports. */
export function canDownloadFiles(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role !== "estimator";
}

/** Can access compliance documents, insurance, lien waivers across all projects. */
export function canAccessCompliance(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role !== "estimator";
}

/** Can view bid/leveling data. */
export function canViewBids(user: TokenPayload): boolean {
  const role = getGCTeamRole(user);
  return role === "owner" || role === "project_manager" || role === "estimator" || role === "vp_operations";
}

/** Can create projects (only owner — tied to subscription/plan). */
export function canCreateProjects(user: TokenPayload): boolean {
  return isGCOwner(user);
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function generateToken(user: TokenPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      displayName: user.displayName ?? null,
      gcParentId: user.gcParentId ?? null,
      gcTeamRole: user.gcTeamRole ?? null,
      isDemo: user.isDemo ?? false,
      impersonatedBy: user.impersonatedBy ?? null,
      impersonationLogId: user.impersonationLogId ?? null,
    },
    JWT_SECRET,
    { expiresIn: "100y" }
  );
}

// ── Admin token helpers ────────────────────────────────────────────────────────

const ADMIN_COOKIE_NAME = "admin_token";

export interface AdminTokenPayload {
  isAdmin: true;
  adminEmail: string;
  iat?: number;
}

export function generateAdminToken(adminEmail: string): string {
  return jwt.sign({ isAdmin: true, adminEmail }, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (!payload.isAdmin) return null;
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

export function setAdminCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    serialize(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
      ...(getCookieDomain() ? { domain: getCookieDomain() } : {}),
    })
  );
}

export function clearAdminCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    serialize(ADMIN_COOKIE_NAME, "", { ...authCookieOptions(0), maxAge: 0 })
  );
}

export function getAdminUser(req: Request): AdminTokenPayload | null {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return null;
  return verifyAdminToken(token);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, token, authCookieOptions(COOKIE_MAX_AGE)));
}

export function clearAuthCookie(res: Response): void {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, "", authCookieOptions(0)));
}

export function getAuthUser(req: Request): TokenPayload | null {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}
