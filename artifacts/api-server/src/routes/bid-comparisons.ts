import { Router } from "express";
import { db } from "@workspace/db";
import {
  bidComparisonsTable, bidsTable, usersTable, planFilesTable, planFileViewsTable,
  complianceChecklistItemsTable, complianceCompletionsTable, gcContactsTable,
  subcontractsTable, projectsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getEffectiveGcId } from "../lib/auth.js";

const router = Router({ mergeParams: true });

async function assertGCOwnsProject(gcUser: any, projectId: string) {
  const effectiveGcId = getEffectiveGcId(gcUser);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== effectiveGcId) return null;
  return project;
}

// GET /api/projects/:projectId/bid-comparison
router.get("/", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const { projectId } = req.params as any;

  const project = await assertGCOwnsProject(gcUser, projectId);
  if (!project) { res.status(403).json({ error: "Forbidden" }); return; }

  // 1. All bids for this project
  const bids = await db.select().from(bidsTable).where(eq(bidsTable.projectId, projectId));
  if (bids.length === 0) { res.json({ comparison: null, bids: [], planFileCount: 0 }); return; }

  const subIds = [...new Set(bids.map(b => b.subId))];

  // 2. Sub user info
  const subUsers = await db.select({ id: usersTable.id, companyName: usersTable.companyName, email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.id, subIds));
  const subUserMap = Object.fromEntries(subUsers.map(u => [u.id, u]));

  // 3. Plan files + views
  const planFiles = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
  const planFileViews = planFiles.length > 0
    ? await db.select().from(planFileViewsTable)
        .where(inArray(planFileViewsTable.planFileId, planFiles.map(f => f.id)))
    : [];

  // 4. Compliance: check if each sub has a subcontract, and if so get compliance status
  const subcontracts = subIds.length > 0
    ? await db.select().from(subcontractsTable).where(and(eq(subcontractsTable.projectId, projectId), inArray(subcontractsTable.subId, subIds)))
    : [];
  const scIds = subcontracts.map(sc => sc.id);

  let complianceStatusMap: Record<string, "COMPLIANT" | "INCOMPLETE" | "BLOCKED" | "NA"> = {};
  if (scIds.length > 0) {
    const checklistItems = await db.select().from(complianceChecklistItemsTable).where(eq(complianceChecklistItemsTable.projectId, projectId));
    const completions = await db.select().from(complianceCompletionsTable).where(inArray(complianceCompletionsTable.subcontractId, scIds));
    const requiredItems = checklistItems.filter(i => i.isRequired);
    for (const sc of subcontracts) {
      if (requiredItems.length === 0) { complianceStatusMap[sc.subId] = "COMPLIANT"; continue; }
      const scCompletions = completions.filter(c => c.subcontractId === sc.id);
      const completedIds = new Set(scCompletions.map(c => c.checklistItemId));
      const completedCount = requiredItems.filter(i => completedIds.has(i.id)).length;
      if (completedCount === requiredItems.length) complianceStatusMap[sc.subId] = "COMPLIANT";
      else if (completedCount > 0) complianceStatusMap[sc.subId] = "INCOMPLETE";
      else complianceStatusMap[sc.subId] = "BLOCKED";
    }
  }
  for (const subId of subIds) {
    if (!complianceStatusMap[subId]) complianceStatusMap[subId] = "NA";
  }

  // 5. Contact notes from GC's contact book
  const effectiveGcId = getEffectiveGcId(gcUser);
  const contacts = subIds.length > 0
    ? await db.select({ subId: gcContactsTable.subId, note: gcContactsTable.note })
        .from(gcContactsTable)
        .where(and(eq(gcContactsTable.gcId, effectiveGcId), inArray(gcContactsTable.subId, subIds)))
    : [];
  const contactNoteMap = Object.fromEntries(contacts.map(c => [c.subId, c.note ?? ""]));

  // 6. Trade category from any existing subcontract
  const tradeCategoryMap: Record<string, string | null> = {};
  for (const sc of subcontracts) {
    tradeCategoryMap[sc.subId] = sc.tradeCategory ?? null;
  }

  // 7. Saved comparison data
  const [saved] = await db.select().from(bidComparisonsTable).where(eq(bidComparisonsTable.projectId, projectId)).limit(1);

  // Assemble enriched bids
  const enrichedBids = bids.map(bid => {
    const subViews = planFileViews.filter(v => v.subId === bid.subId);
    const viewedFileIds = new Set(subViews.map(v => v.planFileId));
    const planFilesReviewed = subViews.length > 0 ? [...new Set(subViews.map(v => v.planFileId))].length : 0;
    return {
      ...bid,
      sub: subUserMap[bid.subId] ?? null,
      planFilesReviewed,
      totalPlanFiles: planFiles.length,
      allPlansReviewed: planFiles.length > 0 && planFiles.every(f => viewedFileIds.has(f.id)),
      complianceStatus: complianceStatusMap[bid.subId] ?? "NA",
      contactNote: contactNoteMap[bid.subId] ?? "",
      tradeCategory: tradeCategoryMap[bid.subId] ?? null,
    };
  });

  const comparison = saved
    ? {
        levelingNotes: saved.levelingNotes ?? "",
        criteria: JSON.parse(saved.criteriaJson || "[]"),
        scores: JSON.parse(saved.scoresJson || "{}"),
      }
    : { levelingNotes: "", criteria: [], scores: {} };

  res.json({ comparison, bids: enrichedBids, planFileCount: planFiles.length });
});

// PUT /api/projects/:projectId/bid-comparison
router.put("/", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const { projectId } = req.params as any;

  const project = await assertGCOwnsProject(gcUser, projectId);
  if (!project) { res.status(403).json({ error: "Forbidden" }); return; }

  const { levelingNotes, criteria, scores } = req.body;

  const [existing] = await db.select({ id: bidComparisonsTable.id }).from(bidComparisonsTable)
    .where(eq(bidComparisonsTable.projectId, projectId)).limit(1);

  if (existing) {
    await db.update(bidComparisonsTable).set({
      levelingNotes: levelingNotes ?? null,
      criteriaJson: JSON.stringify(criteria ?? []),
      scoresJson: JSON.stringify(scores ?? {}),
      updatedAt: new Date(),
    }).where(eq(bidComparisonsTable.id, existing.id));
  } else {
    await db.insert(bidComparisonsTable).values({
      projectId,
      levelingNotes: levelingNotes ?? null,
      criteriaJson: JSON.stringify(criteria ?? []),
      scoresJson: JSON.stringify(scores ?? {}),
    });
  }

  res.json({ ok: true });
});

export default router;
