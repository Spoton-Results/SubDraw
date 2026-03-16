import { Router } from "express";
import { db } from "@workspace/db";
import { subProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireSub } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, user.id)).limit(1);
  res.json(profile ?? null);
});

router.put("/me", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const { trade, phone, businessAddress, licenseNumber } = req.body;
  if (!trade?.trim()) { res.status(400).json({ error: "trade is required" }); return; }

  const existing = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, user.id)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(subProfilesTable)
      .set({ trade: trade.trim(), phone: phone?.trim() || null, businessAddress: businessAddress?.trim() || null, licenseNumber: licenseNumber?.trim() || null, updatedAt: new Date() })
      .where(eq(subProfilesTable.userId, user.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(subProfilesTable).values({
      userId: user.id,
      trade: trade.trim(),
      phone: phone?.trim() || null,
      businessAddress: businessAddress?.trim() || null,
      licenseNumber: licenseNumber?.trim() || null,
    }).returning();
    res.json(created);
  }
});

export default router;
