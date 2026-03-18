import type { Request, Response, NextFunction } from "express";
import { getAuthUser, isGCOwner } from "../lib/auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const decoded = getAuthUser(req);
  if (!decoded) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if the session was issued before a password change (invalidates old sessions)
  if (decoded.iat !== undefined) {
    const [user] = await db
      .select({ passwordChangedAt: usersTable.passwordChangedAt })
      .from(usersTable)
      .where(eq(usersTable.id, decoded.id))
      .limit(1);

    if (user?.passwordChangedAt) {
      const tokenIssuedMs = decoded.iat * 1000;
      if (user.passwordChangedAt.getTime() > tokenIssuedMs) {
        res.status(401).json({ error: "Session expired. Please log in again." });
        return;
      }
    }
  }

  (req as any).user = decoded;
  next();
}

export function requireGC(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "GC") {
    res.status(403).json({ error: "Forbidden: GC only" });
    return;
  }
  next();
}

/** Only the GC account owner (not Project Managers) may pass this middleware. */
export function requireGCOwner(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "GC") {
    res.status(403).json({ error: "Forbidden: GC only" });
    return;
  }
  if (!isGCOwner(user)) {
    res.status(403).json({ error: "Forbidden: only the account owner can perform this action" });
    return;
  }
  next();
}

export function requireSub(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "SUB") {
    res.status(403).json({ error: "Forbidden: SUB only" });
    return;
  }
  next();
}
