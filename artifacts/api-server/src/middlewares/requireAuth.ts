import type { Request, Response, NextFunction } from "express";
import { getAuthUser, getAdminUser, clearAuthCookie, getGCTeamRole, isGCOwner } from "../lib/auth.js";
import { db } from "@workspace/db";
import { usersTable, adminImpersonationLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const decoded = getAuthUser(req);
  if (!decoded || typeof decoded.issuedAtMs !== "number") {
    res.status(401).json({ error: "Unauthorized. Please sign in again." }); return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.id)).limit(1);
    if (!user || !["GC", "SUB"].includes(user.role)) {
      clearAuthCookie(res); res.status(401).json({ error: "Account is no longer available" }); return;
    }
    if (user.passwordChangedAt && decoded.issuedAtMs < user.passwordChangedAt.getTime()) {
      clearAuthCookie(res); res.status(401).json({ error: "Session expired. Please sign in again." }); return;
    }
    let impersonating = false;
    if (decoded.impersonatedBy || decoded.impersonationLogId) {
      const admin = getAdminUser(req);
      if (!admin || decoded.impersonatedBy !== "admin" || !decoded.impersonationLogId) {
        res.status(401).json({ error: "Active administrator session required for impersonation" }); return;
      }
      const [log] = await db.select().from(adminImpersonationLogsTable).where(eq(adminImpersonationLogsTable.id, decoded.impersonationLogId)).limit(1);
      if (!log || log.endedAt || log.adminEmail !== admin.adminEmail || log.gcUserId !== user.id) {
        res.status(401).json({ error: "Impersonation session is no longer active" }); return;
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        res.status(403).json({ error: "Impersonation is read-only" }); return;
      }
      impersonating = true;
    }
    if (user.pausedAt && !impersonating) {
      res.status(403).json({ error: "Account paused. Please contact support." }); return;
    }
    const current = {
      ...decoded, id: user.id, email: user.email, role: user.role, companyName: user.companyName,
      displayName: user.displayName, gcParentId: user.gcParentId, gcTeamRole: user.gcTeamRole, isDemo: user.isDemo,
    };
    if (current.role === "GC" && !getGCTeamRole(current)) {
      res.status(403).json({ error: "Account role configuration requires review" }); return;
    }
    if (current.role === "GC" && current.gcParentId) {
      const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, current.gcParentId)).limit(1);
      if (!owner || !isGCOwner(owner) || (owner.pausedAt && !impersonating)) {
        res.status(403).json({ error: "Parent organization is unavailable" }); return;
      }
    }
    (req as any).user = current;
    next();
  } catch (error) {
    console.error("[auth] Account authorization unavailable", error instanceof Error ? error.message : "Unknown error");
    res.status(503).json({ error: "Unable to verify account authorization" });
  }
}
export function requireGC(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "GC") { res.status(403).json({ error: "Forbidden: GC only" }); return; }
  next();
}
export function requireGCOwner(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || !isGCOwner(user)) { res.status(403).json({ error: "Forbidden: account owner only" }); return; }
  next();
}
export function requireSub(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "SUB") { res.status(403).json({ error: "Forbidden: SUB only" }); return; }
  next();
}
