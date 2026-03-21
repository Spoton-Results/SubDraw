import { Router } from "express";
import { db } from "@workspace/db";
import { bidsTable, subcontractsTable, projectsTable, usersTable, activityLogsTable, projectMembersTable, tradeScopesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getActorRoleLabel } from "../lib/auth.js";
import { sendBidAwardedEmail, sendNewBidEmail } from "../lib/email.js";

const router = Router({ mergeParams: true });

async function getBidWithSub(bid: any) {
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, bid.subId)).limit(1);
  return { ...bid, sub };
}

router.get("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const bids = await db.select().from(bidsTable).where(eq(bidsTable.projectId, projectId));
  const bidsWithSubs = await Promise.all(bids.map(getBidWithSub));
  res.json(bidsWithSubs);
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;
  const { amount, notes, scopeOfWorkObjectPath, scopeAcknowledged } = req.body;
  if (!amount || isNaN(Number(amount))) {
    res.status(400).json({ error: "amount is required" });
    return;
  }
  const acknowledged = scopeAcknowledged === true || scopeAcknowledged === "true";
  const now = new Date();
  const [bid] = await db.insert(bidsTable).values({
    projectId,
    subId: user.id,
    amount: Number(amount),
    notes: notes?.trim() || null,
    scopeOfWorkObjectPath: scopeOfWorkObjectPath?.trim() || null,
    scopeAcknowledged: acknowledged,
    scopeAcknowledgedAt: acknowledged ? now : null,
  }).returning();

  // Log scope acknowledgment to activity log (we don't have a subcontract yet so use a project-level note)
  if (acknowledged) {
    // Find which trade scope this sub is acknowledging
    const [member] = await db.select().from(projectMembersTable).where(
      and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id))
    ).limit(1);
    if (member?.tradeCategory) {
      const [scope] = await db.select().from(tradeScopesTable).where(
        and(eq(tradeScopesTable.projectId, projectId), eq(tradeScopesTable.tradeCategory, member.tradeCategory))
      ).limit(1);
      if (scope) {
        // Record on activityLogsTable once the subcontract exists (at award time)
        // For now, store the acknowledgment on the bid itself (already done above)
        console.log(`[scope-ack] ${user.companyName} acknowledged ${member.tradeCategory} scope at ${now.toISOString()}`);
      }
    }
  }

  const bidWithSub = await getBidWithSub(bid);
  res.status(201).json(bidWithSub);

  // Notify GC of new bid (after responding to the sub)
  setImmediate(async () => {
    try {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (!project) return;
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
      if (!gc) return;

      // Find trade category for this sub on this project
      const [member] = await db.select().from(projectMembersTable).where(
        and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id))
      ).limit(1);
      const tradeCategory = member?.tradeCategory ?? null;

      // Look up AI estimate range for this trade
      let aiLow: number | null = null;
      let aiHigh: number | null = null;
      const aiAnalysis = project.aiAnalysis as any[] | null;
      if (aiAnalysis && tradeCategory) {
        const tradeEstimate = aiAnalysis.find((t: any) =>
          t.trade?.toLowerCase() === tradeCategory.toLowerCase()
        );
        if (tradeEstimate) {
          aiLow = tradeEstimate.lowEstimate ?? null;
          aiHigh = tradeEstimate.highEstimate ?? null;
        }
      }

      const appUrl = process.env.APP_URL || "https://subtracker.app";
      await sendNewBidEmail({
        toEmail: gc.email,
        gcCompanyName: gc.companyName,
        projectName: project.name,
        subCompanyName: user.companyName,
        bidAmount: Number(amount),
        tradeCategory,
        aiLow,
        aiHigh,
        appUrl: `${appUrl}/projects/${projectId}`,
      });
    } catch (err) {
      console.error("[email] sendNewBidEmail failed:", err);
    }
  });
});

router.post("/:bidId/award", requireAuth, requireGC, async (req, res) => {
  const gcActor = (req as any).user;
  const { bidId } = req.params;
  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.id, bidId)).limit(1);
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }
  await db.update(bidsTable).set({ status: "AWARDED", updatedAt: new Date() }).where(eq(bidsTable.id, bidId));
  await db.update(projectsTable).set({ status: "CONSTRUCTION", updatedAt: new Date() }).where(eq(projectsTable.id, bid.projectId));

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, bid.projectId)).limit(1);
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, bid.subId)).limit(1);

  const { tradeCategory, retentionPercentage } = req.body ?? {};
  const retPct = Math.min(15, Math.max(0, Number(retentionPercentage ?? 10)));

  // Look up the trade scope to freeze it on the subcontract
  const effectiveTrade = tradeCategory?.trim() || null;
  let contractedScope: string | null = null;
  if (effectiveTrade) {
    const [scope] = await db.select().from(tradeScopesTable).where(
      and(eq(tradeScopesTable.projectId, bid.projectId), eq(tradeScopesTable.tradeCategory, effectiveTrade))
    ).limit(1);
    contractedScope = scope?.description ?? null;
  }

  const [subcontract] = await db.insert(subcontractsTable).values({
    projectId: bid.projectId,
    subId: bid.subId,
    baseContractAmount: bid.amount,
    tradeCategory: effectiveTrade,
    retentionPercentage: retPct,
    contractedScope,
    contractedScopeTrade: contractedScope ? effectiveTrade : null,
    scopeAcknowledgedAt: bid.scopeAcknowledged ? bid.scopeAcknowledgedAt : null,
    scopeAcknowledgedByName: bid.scopeAcknowledged ? sub.companyName : null,
  }).returning();

  await db.insert(activityLogsTable).values({
    subcontractId: subcontract.id,
    type: "SUBCONTRACT_CREATED",
    description: `Subcontract awarded to ${sub.companyName} for $${bid.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    actorName: gc.companyName,
    actorRole: getActorRoleLabel(gcActor),
  }).catch(err => console.error("[activity] Failed to log subcontract creation:", err));

  // Log scope acknowledgment on the subcontract activity log
  if (bid.scopeAcknowledged && bid.scopeAcknowledgedAt && effectiveTrade) {
    const ackDate = new Date(bid.scopeAcknowledgedAt);
    await db.insert(activityLogsTable).values({
      subcontractId: subcontract.id,
      type: "SCOPE_ACKNOWLEDGED",
      description: `${sub.companyName} acknowledged and accepted the scope of work for ${effectiveTrade} on ${ackDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${ackDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
      actorName: sub.companyName,
      actorRole: "SUB",
    }).catch(err => console.error("[activity] Failed to log scope acknowledgment:", err));
  }

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
