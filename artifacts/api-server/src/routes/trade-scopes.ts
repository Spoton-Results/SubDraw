import { Router } from "express";
import { db } from "@workspace/db";
import { tradeScopesTable, bidsTable, projectsTable, projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getEffectiveGcId } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GC: list all scopes for project | Sub: get own trade's scope
router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);

  if (user.role === "GC" || effectiveGcId) {
    const scopes = await db.select().from(tradeScopesTable).where(eq(tradeScopesTable.projectId, projectId));
    // Also compute lock status per trade (locked if any PENDING bid exists for that trade)
    const bids = await db.select().from(bidsTable).where(
      and(eq(bidsTable.projectId, projectId))
    );
    // Get project members to know which trade each sub is invited for
    const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
    const tradesWithBids = new Set(
      members
        .filter(m => bids.some(b => b.subId === m.userId && b.status === "PENDING"))
        .map(m => m.tradeCategory)
        .filter(Boolean)
    );
    const result = scopes.map(s => ({ ...s, isLocked: tradesWithBids.has(s.tradeCategory) }));
    res.json(result);
    return;
  }

  // Sub: find their own trade category from project_members
  const [member] = await db.select().from(projectMembersTable).where(
    and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id))
  ).limit(1);

  if (!member?.tradeCategory) {
    res.json([]);
    return;
  }

  const [scope] = await db.select().from(tradeScopesTable).where(
    and(eq(tradeScopesTable.projectId, projectId), eq(tradeScopesTable.tradeCategory, member.tradeCategory))
  ).limit(1);

  res.json(scope ? [{ ...scope, isLocked: false }] : []);
});

// GC: upsert scope for a trade
router.put("/:trade", requireAuth, requireGC, async (req, res) => {
  const { projectId, trade } = req.params as any;
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const { description } = req.body;

  if (!description?.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  // Verify project belongs to this GC
  const [project] = await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== effectiveGcId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Check lock: any submitted (PENDING) bids for this trade's members
  const members = await db.select().from(projectMembersTable).where(
    and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.tradeCategory, trade))
  );
  if (members.length > 0) {
    const subIds = members.map(m => m.userId);
    const pendingBids = await db.select({ id: bidsTable.id }).from(bidsTable).where(eq(bidsTable.projectId, projectId));
    const hasPendingBids = pendingBids.some(b => subIds.includes(b.subId) && b.status === "PENDING");
    if (hasPendingBids) {
      res.status(409).json({ error: "This scope is locked because bids have been submitted. Create a change order to modify scope after contract award." });
      return;
    }
  }

  const [existing] = await db.select().from(tradeScopesTable).where(
    and(eq(tradeScopesTable.projectId, projectId), eq(tradeScopesTable.tradeCategory, trade))
  ).limit(1);

  let result;
  if (existing) {
    [result] = await db.update(tradeScopesTable).set({ description: description.trim(), updatedAt: new Date() }).where(eq(tradeScopesTable.id, existing.id)).returning();
  } else {
    [result] = await db.insert(tradeScopesTable).values({ projectId, tradeCategory: trade, description: description.trim() }).returning();
  }
  res.json(result);
});

// GC: delete scope for a trade
router.delete("/:trade", requireAuth, requireGC, async (req, res) => {
  const { projectId, trade } = req.params as any;
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);

  const [project] = await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== effectiveGcId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(tradeScopesTable).where(
    and(eq(tradeScopesTable.projectId, projectId), eq(tradeScopesTable.tradeCategory, trade))
  );
  res.json({ ok: true });
});

export default router;
