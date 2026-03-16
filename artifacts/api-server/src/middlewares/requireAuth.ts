import type { Request, Response, NextFunction } from "express";
import { getAuthUser } from "../lib/auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).user = user;
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

export function requireSub(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "SUB") {
    res.status(403).json({ error: "Forbidden: SUB only" });
    return;
  }
  next();
}
