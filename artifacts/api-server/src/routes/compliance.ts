import { Router } from "express";
import { db } from "@workspace/db";
import { complianceChecklistItemsTable, complianceCompletionsTable, subcontractsTable, projectsTable, activityLogsTable, usersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { getActorName, getActorRoleLabel } from "../lib/auth.js";

const objectStorageService = new ObjectStorageService();
const router = Router({ mergeParams: true });

async function getEffectiveGcIdForProject(projectId: string, userId: string): Promise<boolean> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  return project?.gcId === userId;
}

// ─── Project-level checklist item management (GC only) ────────────────────────

// GET /projects/:projectId/compliance-items — all items for project
router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const items = await db
    .select()
    .from(complianceChecklistItemsTable)
    .where(eq(complianceChecklistItemsTable.projectId, projectId))
    .orderBy(complianceChecklistItemsTable.sortOrder, complianceChecklistItemsTable.createdAt);
  res.json(items);
});

// POST /projects/:projectId/compliance-items — GC creates a checklist item
router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;
  const { title, description, required, allowDocumentUpload, sortOrder } = req.body;

  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (!await getEffectiveGcIdForProject(projectId, user.id)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [item] = await db.insert(complianceChecklistItemsTable).values({
    projectId,
    title: title.trim(),
    description: description?.trim() ?? null,
    required: required !== false,
    allowDocumentUpload: allowDocumentUpload === true,
    sortOrder: sortOrder ?? 0,
  }).returning();

  res.status(201).json(item);
});

// PATCH /projects/:projectId/compliance-items/:itemId — GC updates a checklist item (alias for PUT)
router.patch("/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params as any;
  const { title, description, required, allowDocumentUpload, sortOrder } = req.body;

  if (!await getEffectiveGcIdForProject(projectId, user.id)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [existing] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Checklist item not found" }); return; }

  const [updated] = await db.update(complianceChecklistItemsTable).set({
    title: title?.trim() ?? existing.title,
    description: description !== undefined ? (description?.trim() ?? null) : existing.description,
    required: required !== undefined ? required !== false : existing.required,
    allowDocumentUpload: allowDocumentUpload !== undefined ? allowDocumentUpload === true : existing.allowDocumentUpload,
    sortOrder: sortOrder ?? existing.sortOrder,
    updatedAt: new Date(),
  }).where(eq(complianceChecklistItemsTable.id, itemId)).returning();

  res.json(updated);
});

// PUT /projects/:projectId/compliance-items/:itemId — GC updates a checklist item
router.put("/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params as any;
  const { title, description, required, allowDocumentUpload, sortOrder } = req.body;

  if (!await getEffectiveGcIdForProject(projectId, user.id)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [existing] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Checklist item not found" }); return; }

  const [updated] = await db.update(complianceChecklistItemsTable).set({
    title: title?.trim() ?? existing.title,
    description: description !== undefined ? (description?.trim() ?? null) : existing.description,
    required: required !== undefined ? required !== false : existing.required,
    allowDocumentUpload: allowDocumentUpload !== undefined ? allowDocumentUpload === true : existing.allowDocumentUpload,
    sortOrder: sortOrder ?? existing.sortOrder,
    updatedAt: new Date(),
  }).where(eq(complianceChecklistItemsTable.id, itemId)).returning();

  res.json(updated);
});

// DELETE /projects/:projectId/compliance-items/:itemId — GC deletes a checklist item
router.delete("/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params as any;

  if (!await getEffectiveGcIdForProject(projectId, user.id)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Checklist item not found" }); return; }

  // Delete any uploaded documents from storage
  const completions = await db.select().from(complianceCompletionsTable).where(eq(complianceCompletionsTable.checklistItemId, itemId));
  for (const c of completions) {
    if (c.documentPath) {
      try { const f = await objectStorageService.getObjectEntityFile(c.documentPath); await f.delete(); } catch { }
    }
  }

  await db.delete(complianceChecklistItemsTable).where(eq(complianceChecklistItemsTable.id, itemId));
  res.status(204).send();
});

// ─── Subcontract compliance status (both GC and sub) ─────────────────────────

// GET /projects/:projectId/compliance-items/subcontract/:subcontractId — sub's completion status for all items
router.get("/subcontract/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, subcontractId } = req.params as any;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const isGC = user.role === "GC" && project?.gcId === user.id;
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const items = await db
    .select()
    .from(complianceChecklistItemsTable)
    .where(eq(complianceChecklistItemsTable.projectId, projectId))
    .orderBy(complianceChecklistItemsTable.sortOrder, complianceChecklistItemsTable.createdAt);

  const completions = await db
    .select()
    .from(complianceCompletionsTable)
    .where(eq(complianceCompletionsTable.subcontractId, subcontractId));

  const completionMap = Object.fromEntries(completions.map(c => [c.checklistItemId, c]));

  const itemsWithStatus = items.map(item => ({
    ...item,
    completion: completionMap[item.id] ?? null,
  }));

  res.json(itemsWithStatus);
});

// POST /projects/:projectId/compliance-items/:itemId/complete/:subcontractId — mark complete
router.post("/:itemId/complete/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;
  const { notes, documentPath, documentName } = req.body;

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Checklist item not found" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const isGC = user.role === "GC" && project?.gcId === user.id;
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorRole = isGC ? getActorRoleLabel(user) : "SUB";
  const actorName = getActorName(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      isComplete: true,
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      notes: notes ?? existing.notes,
      documentPath: documentPath ?? existing.documentPath,
      documentName: documentName ?? existing.documentName,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: true,
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      notes: notes ?? null,
      documentPath: documentPath ?? null,
      documentName: documentName ?? null,
    }).returning();
    completion = inserted;
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_COMPLETED",
    description: `Compliance item "${item.title}" marked complete by ${actorName}`,
    actorName,
    actorRole,
  }).catch(() => {});

  res.json(completion);
});

// DELETE /projects/:projectId/compliance-items/:itemId/complete/:subcontractId — mark incomplete (GC or sub themselves)
router.delete("/:itemId/complete/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const isGC = user.role === "GC" && project?.gcId === user.id;
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  if (existing) {
    if (existing.documentPath) {
      try { const f = await objectStorageService.getObjectEntityFile(existing.documentPath); await f.delete(); } catch { }
    }
    await db.update(complianceCompletionsTable).set({
      isComplete: false,
      completedByRole: null,
      completedByName: null,
      completedAt: null,
      documentPath: null,
      documentName: null,
      updatedAt: new Date(),
    }).where(eq(complianceCompletionsTable.id, existing.id));
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_RESET",
    description: `Compliance item marked incomplete by ${getActorName(user)}`,
    actorName: getActorName(user),
    actorRole: getActorRoleLabel(user),
  }).catch(() => {});

  res.status(204).send();
});

// POST /projects/:projectId/compliance-items/:itemId/document/:subcontractId — save uploaded document
router.post("/:itemId/document/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;
  const { documentPath, documentName } = req.body;

  if (!documentPath || !documentName) { res.status(400).json({ error: "documentPath and documentName required" }); return; }

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  const isGC = user.role === "GC" && project?.gcId === user.id;
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorRole = isGC ? getActorRoleLabel(user) : "SUB";
  const actorName = getActorName(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  // Delete old document from storage if replacing
  if (existing?.documentPath) {
    try { const f = await objectStorageService.getObjectEntityFile(existing.documentPath); await f.delete(); } catch { }
  }

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      documentPath,
      documentName,
      isComplete: true,
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: true,
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      documentPath,
      documentName,
    }).returning();
    completion = inserted;
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_DOCUMENT_UPLOADED",
    description: `Compliance document "${documentName}" uploaded for "${item.title}" by ${actorName}`,
    actorName,
    actorRole,
  }).catch(() => {});

  res.json(completion);
});

// GET /projects/:projectId/compliance-items/summary — per-subcontract compliance status (GC only)
router.get("/summary", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const items = await db.select().from(complianceChecklistItemsTable)
    .where(eq(complianceChecklistItemsTable.projectId, projectId));
  const requiredItems = items.filter(i => i.required);

  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  if (subcontracts.length === 0) { res.json([]); return; }

  const scIds = subcontracts.map(s => s.id);
  const allCompletions = scIds.length > 0
    ? await db.select().from(complianceCompletionsTable).where(inArray(complianceCompletionsTable.subcontractId, scIds))
    : [];

  // Get sub names
  const subIds = [...new Set(subcontracts.map(s => s.subId))];
  const subUsers = subIds.length > 0 ? await db.select({ id: usersTable.id, companyName: usersTable.companyName }).from(usersTable).where(inArray(usersTable.id, subIds)) : [];
  const subNameMap = Object.fromEntries(subUsers.map(u => [u.id, u.companyName ?? "Unknown"]));

  const summary = subcontracts.map(sc => {
    const scCompletions = allCompletions.filter(c => c.subcontractId === sc.id && c.isComplete);
    const completedIds = new Set(scCompletions.map(c => c.checklistItemId));

    const totalRequired = requiredItems.length;
    const completedRequired = requiredItems.filter(i => completedIds.has(i.id)).length;

    let status: "COMPLIANT" | "INCOMPLETE" | "BLOCKED";
    if (totalRequired === 0 || completedRequired === totalRequired) {
      status = "COMPLIANT";
    } else if (completedRequired === 0) {
      status = "BLOCKED";
    } else {
      status = "INCOMPLETE";
    }

    return {
      subcontractId: sc.id,
      subId: sc.subId,
      subCompanyName: subNameMap[sc.subId] ?? "Unknown",
      totalRequired,
      completedRequired,
      status,
    };
  });

  res.json(summary);
});

export default router;
