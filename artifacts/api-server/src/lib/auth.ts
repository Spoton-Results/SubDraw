import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";
import type { Request, Response } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-prod";
const COOKIE_NAME = "auth_token";

// Ten years in seconds — effectively permanent
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

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
  iat?: number;
}

/** Returns the GC owner ID: if the user is a PM, this is their gcParentId; otherwise their own ID. */
export function getEffectiveGcId(user: TokenPayload): string {
  return user.gcParentId ?? user.id;
}

/** Returns true if this GC user is a Project Manager (not the account owner). */
export function isProjectManager(user: TokenPayload): boolean {
  return user.role === "GC" && user.gcTeamRole === "project_manager";
}

/** Returns true if this GC user is the account Owner (or a legacy GC with no gcTeamRole). */
export function isGCOwner(user: TokenPayload): boolean {
  return user.role === "GC" && (user.gcTeamRole === "owner" || user.gcTeamRole == null);
}

/** Returns the display name for activity logs: personal name for PMs, company name for owners/subs. */
export function getActorName(user: TokenPayload): string {
  return user.displayName || user.companyName;
}

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
    },
    JWT_SECRET,
    { expiresIn: "100y" }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
  );
}

export function clearAuthCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" })
  );
}

export function getAuthUser(req: Request): TokenPayload | null {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}
