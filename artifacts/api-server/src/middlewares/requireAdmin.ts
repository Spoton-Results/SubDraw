import type { Request, Response, NextFunction } from "express";
import { getAdminUser } from "../lib/auth.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const admin = getAdminUser(req);
  if (!admin) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  (req as any).adminUser = admin;
  next();
}
