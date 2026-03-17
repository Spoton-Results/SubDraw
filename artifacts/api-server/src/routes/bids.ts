import { Router } from "express";
import { db } from "@workspace/db";
import { bidsTable, subcontractsTable, projectsTable, usersTable, activityLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { sendBidAwardedEmail } from "../lib/email.js";

const router = Router({ mergeParams: true });

async function getBidWithSub(bid: any) {
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, bid.subId)).limit(1);
  return { ...bid, sub };
}

router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const bids = await db.select().from(bidsTable).where(eq(bidsTable.projectId, projectId));
  const bidsWithSubs = await Promise.all(bids.map(getBidWithSub));
  res.json(bidsWithSubs);
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;
  const { amount, notes } = req.body;
  if (!amount || isNaN(Number(amount))) {
    res.status(400).json({ error: "amount is required" });
    return;
  }
  const [bid] = await db.insert(bidsTable).values({
    projectId,
    subId: user.id,
    amount: Number(amount),
    notes: notes?.trim() || null,
  }).returning();
  const bidWithSub = await getBidWithSub(bid);
  res.status(201).json(bidWithSub);
});

router.post("/:bidId/award", requireAuth, requireGC, async (req, res) => {
  const { bidId } = req.params;
  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.id, bidId)).limit(1);
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }
  await db.update(bidsTable).set({ status: "AWARDED", updatedAt: new Date() }).where(eq(bidsTable.id, bidId));
  await db.update(projectsTable).set({ status: "ACTIVE", updatedAt: new Date() }).where(eq(projectsTable.id, bid.projectId));

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, bid.projectId)).limit(1);
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, bid.subId)).limit(1);

  const { tradeCategory, retentionPercentage } = req.body ?? {};
  const retPct = Math.min(15, Math.max(0, Number(retentionPercentage ?? 10)));

  const [subcontract] = await db.insert(subcontractsTable).values({
    projectId: bid.projectId,
    subId: bid.subId,
    baseContractAmount: bid.amount,
    tradeCategory: tradeCategory ?? null,
    retentionPercentage: retPct,
  }).returning();

  await db.insert(activityLogsTable).values({
    subcontractId: subcontract.id,
    type: "SUBCONTRACT_CREATED",
    description: `Subcontract awarded to ${sub.companyName} for $${bid.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    actorName: gc.companyName,
    actorRole: "GC",
  }).catch(err => console.error("[activity] Failed to log subcontract creation:", err));

  const appUrl = process.env.APP_URL || `https://${req.hostname}`;
  sendBidAwardedEmail({
    toEmail: sub.email,
    subCompanyName: sub.companyName,
    projectName: project.name,
    bidAmount: bid.amount,
    appUrl,
  }).catch((err) => console.error("[email] sendBidAwardedEmail failed:", err));

  res.status(201).json({ ...subcontract, project: { ...project, gc }, sub });
});

export default router;
