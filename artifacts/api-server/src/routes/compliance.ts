import { Router } from "express";
import { db } from "@workspace/db";
import { complianceChecklistItemsTable, complianceCompletionsTable, subcontractsTable, projectsTable, activityLogsTable, usersTable, projectMembersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { isR2Path, deleteFromR2 } from "../lib/r2.js";
import { getActorName, getActorRoleLabel } from "../lib/auth.js";
import {
  sendComplianceDocUploadedEmail,
  sendComplianceApprovedEmail,
  sendComplianceRevisionEmail,
} from "../lib/email.js";

const objectStorageService = new ObjectStorageService();
const router = Router({ mergeParams: true });

function getAppUrl(req: any) {
  return process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
}

async function getProjectAndAuth(projectId: string, user: any): Promise<{ project: any; isGC: boolean; isSub: boolean } | null> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;
  const effectiveGcId: string = user.gcParentId ?? user.id;
  const isGC = user.role === "GC" && project.gcId === effectiveGcId;
  const isSub = user.role === "SUB";
  return { project, isGC, isSub };
}

async function isItemEffectivelyApproved(c: any): Promise<boolean> {
  if (!c) return false;
  return c.status === "APPROVED" || (c.isComplete && !c.status);
}

// ─── Project-level checklist item management (GC only) ────────────────────────

// GET /projects/:projectId/compliance-items — all items for project
router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const user = (req as any).user;

  const [project] = await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  if (user.role === "GC") {
    const effectiveGcId: string = user.gcParentId ?? user.id;
    if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (user.role === "SUB") {
    const [member] = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id)))
      .limit(1);
    if (!member) { res.status(403).json({ error: "Forbidden" }); return; }
  } else {
    res.status(403).json({ error: "Forbidden" }); return;
  }

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

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

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

// PATCH /projects/:projectId/compliance-items/:itemId — GC updates a checklist item
router.patch("/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params as any;
  const { title, description, required, allowDocumentUpload, sortOrder } = req.body;

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

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

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

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

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Checklist item not found" }); return; }

  const completions = await db.select().from(complianceCompletionsTable).where(eq(complianceCompletionsTable.checklistItemId, itemId));
  for (const c of completions) {
    if (c.documentPath) {
      try {
        if (isR2Path(c.documentPath)) {
          await deleteFromR2(c.documentPath);
        } else {
          const f = await objectStorageService.getObjectEntityFile(c.documentPath);
          await f.delete();
        }
      } catch { }
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

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth) { res.status(404).json({ error: "Project not found" }); return; }

  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!auth.isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

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

  const itemsWithStatus = items.map(item => {
    const completion = completionMap[item.id] ?? null;
    const derivedStatus = completion
      ? (completion.status ?? (completion.isComplete ? "APPROVED" : "NOT_STARTED"))
      : "NOT_STARTED";
    return { ...item, completion: completion ? { ...completion, status: derivedStatus } : null };
  });

  res.json(itemsWithStatus);
});

// POST /projects/:projectId/compliance-items/:itemId/document/:subcontractId — sub uploads document → SUBMITTED
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

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth) { res.status(404).json({ error: "Project not found" }); return; }

  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!auth.isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorRole = auth.isGC ? getActorRoleLabel(user) : "SUB";
  const actorName = getActorName(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  if (existing?.documentPath) {
    try {
      if (isR2Path(existing.documentPath)) {
        await deleteFromR2(existing.documentPath);
      } else {
        const f = await objectStorageService.getObjectEntityFile(existing.documentPath);
        await f.delete();
      }
    } catch { }
  }

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      documentPath,
      documentName,
      documentUploadedAt: now,
      isComplete: false,
      status: "SUBMITTED",
      revisionNote: null,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: false,
      status: "SUBMITTED",
      documentPath,
      documentName,
      documentUploadedAt: now,
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

  // Notify GC when sub uploads
  if (isSub) {
    try {
      const [gcUser] = await db.select({ email: usersTable.email, companyName: usersTable.companyName })
        .from(usersTable).where(eq(usersTable.id, auth.project.gcId)).limit(1);
      const [subUser] = await db.select({ companyName: usersTable.companyName })
        .from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
      if (gcUser?.email) {
        sendComplianceDocUploadedEmail({
          toEmail: gcUser.email,
          gcCompanyName: gcUser.companyName ?? "GC",
          subCompanyName: subUser?.companyName ?? "Subcontractor",
          projectName: auth.project.name,
          itemTitle: item.title,
          documentName,
          appUrl: `${getAppUrl(req)}/subcontracts/${subcontractId}`,
        }).catch(() => {});
      }
    } catch { }
  }

  res.json({ ...completion, status: "SUBMITTED" });
});

// POST /projects/:projectId/compliance-items/:itemId/approve/:subcontractId — GC approves
router.post("/:itemId/approve/:subcontractId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Not found" }); return; }

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorName = getActorName(user);
  const actorRole = getActorRoleLabel(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      isComplete: true,
      status: "APPROVED",
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      revisionNote: null,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: true,
      status: "APPROVED",
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
    }).returning();
    completion = inserted;
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_APPROVED",
    description: `Compliance item "${item.title}" approved by ${actorName}`,
    actorName,
    actorRole,
  }).catch(() => {});

  // Notify sub
  try {
    const [gcUser] = await db.select({ companyName: usersTable.companyName })
      .from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const [subUser] = await db.select({ email: usersTable.email, companyName: usersTable.companyName })
      .from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    if (subUser?.email) {
      sendComplianceApprovedEmail({
        toEmail: subUser.email,
        gcCompanyName: gcUser?.companyName ?? "GC",
        subCompanyName: subUser.companyName ?? "Subcontractor",
        projectName: auth.project.name,
        itemTitle: item.title,
        appUrl: `${getAppUrl(req)}/subcontracts/${subcontractId}`,
      }).catch(() => {});
    }
  } catch { }

  res.json({ ...completion, status: "APPROVED" });
});

// POST /projects/:projectId/compliance-items/:itemId/revision/:subcontractId — GC requests revision
router.post("/:itemId/revision/:subcontractId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;
  const { revisionNote } = req.body;

  if (!revisionNote?.trim()) { res.status(400).json({ error: "revisionNote is required" }); return; }

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Not found" }); return; }

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorName = getActorName(user);
  const actorRole = getActorRoleLabel(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      isComplete: false,
      status: "REVISION_NEEDED",
      revisionNote: revisionNote.trim(),
      completedByRole: null,
      completedByName: null,
      completedAt: null,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: false,
      status: "REVISION_NEEDED",
      revisionNote: revisionNote.trim(),
    }).returning();
    completion = inserted;
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_REVISION_REQUESTED",
    description: `Revision requested on "${item.title}" by ${actorName}: ${revisionNote}`,
    actorName,
    actorRole,
  }).catch(() => {});

  // Notify sub
  try {
    const [gcUser] = await db.select({ companyName: usersTable.companyName })
      .from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const [subUser] = await db.select({ email: usersTable.email, companyName: usersTable.companyName })
      .from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    if (subUser?.email) {
      sendComplianceRevisionEmail({
        toEmail: subUser.email,
        gcCompanyName: gcUser?.companyName ?? "GC",
        subCompanyName: subUser.companyName ?? "Subcontractor",
        projectName: auth.project.name,
        itemTitle: item.title,
        revisionNote: revisionNote.trim(),
        appUrl: `${getAppUrl(req)}/subcontracts/${subcontractId}`,
      }).catch(() => {});
    }
  } catch { }

  res.json({ ...completion, status: "REVISION_NEEDED" });
});

// POST /projects/:projectId/compliance-items/:itemId/complete/:subcontractId — GC manual completion (no document)
router.post("/:itemId/complete/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;
  const { notes } = req.body;

  const [item] = await db.select().from(complianceChecklistItemsTable)
    .where(and(eq(complianceChecklistItemsTable.id, itemId), eq(complianceChecklistItemsTable.projectId, projectId))).limit(1);
  if (!item) { res.status(404).json({ error: "Checklist item not found" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth) { res.status(404).json({ error: "Project not found" }); return; }

  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!auth.isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const actorRole = auth.isGC ? getActorRoleLabel(user) : "SUB";
  const actorName = getActorName(user);
  const now = new Date();

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  let completion;
  if (existing) {
    const [updated] = await db.update(complianceCompletionsTable).set({
      isComplete: true,
      status: "APPROVED",
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      notes: notes ?? existing.notes,
      revisionNote: null,
      updatedAt: now,
    }).where(eq(complianceCompletionsTable.id, existing.id)).returning();
    completion = updated;
  } else {
    const [inserted] = await db.insert(complianceCompletionsTable).values({
      checklistItemId: itemId,
      subcontractId,
      isComplete: true,
      status: "APPROVED",
      completedByRole: actorRole,
      completedByName: actorName,
      completedAt: now,
      notes: notes ?? null,
    }).returning();
    completion = inserted;
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_COMPLETED",
    description: `Compliance item "${item.title}" manually marked complete by ${actorName}${notes ? `: ${notes}` : ""}`,
    actorName,
    actorRole,
  }).catch(() => {});

  res.json({ ...completion, status: "APPROVED" });
});

// DELETE /projects/:projectId/compliance-items/:itemId/complete/:subcontractId — reset to NOT_STARTED (GC only)
router.delete("/:itemId/complete/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId, subcontractId } = req.params as any;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

  const [existing] = await db.select().from(complianceCompletionsTable)
    .where(and(eq(complianceCompletionsTable.checklistItemId, itemId), eq(complianceCompletionsTable.subcontractId, subcontractId))).limit(1);

  if (existing) {
    if (existing.documentPath) {
      try {
        if (isR2Path(existing.documentPath)) {
          await deleteFromR2(existing.documentPath);
        } else {
          const f = await objectStorageService.getObjectEntityFile(existing.documentPath);
          await f.delete();
        }
      } catch { }
    }
    await db.update(complianceCompletionsTable).set({
      isComplete: false,
      status: "NOT_STARTED",
      completedByRole: null,
      completedByName: null,
      completedAt: null,
      documentPath: null,
      documentName: null,
      documentUploadedAt: null,
      notes: null,
      revisionNote: null,
      updatedAt: new Date(),
    }).where(eq(complianceCompletionsTable.id, existing.id));
  }

  await db.insert(activityLogsTable).values({
    subcontractId,
    type: "COMPLIANCE_RESET",
    description: `Compliance item reset by ${getActorName(user)}`,
    actorName: getActorName(user),
    actorRole: getActorRoleLabel(user),
  }).catch(() => {});

  res.status(204).send();
});

// GET /projects/:projectId/compliance-items/summary — per-subcontract compliance status (GC only)
router.get("/summary", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;

  const auth = await getProjectAndAuth(projectId, user);
  if (!auth?.isGC) { res.status(403).json({ error: "Forbidden" }); return; }

  const items = await db.select().from(complianceChecklistItemsTable)
    .where(eq(complianceChecklistItemsTable.projectId, projectId));
  const requiredItems = items.filter(i => i.required);

  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  if (subcontracts.length === 0) { res.json([]); return; }

  const scIds = subcontracts.map(s => s.id);
  const allCompletions = scIds.length > 0
    ? await db.select().from(complianceCompletionsTable).where(inArray(complianceCompletionsTable.subcontractId, scIds))
    : [];

  const subIds = [...new Set(subcontracts.map(s => s.subId))];
  const subUsers = subIds.length > 0 ? await db.select({ id: usersTable.id, companyName: usersTable.companyName }).from(usersTable).where(inArray(usersTable.id, subIds)) : [];
  const subNameMap = Object.fromEntries(subUsers.map(u => [u.id, u.companyName ?? "Unknown"]));

  const summary = subcontracts.map(sc => {
    const scCompletions = allCompletions.filter(c => c.subcontractId === sc.id);
    const approvedIds = new Set(
      scCompletions
        .filter(c => c.status === "APPROVED" || (c.isComplete && !c.status))
        .map(c => c.checklistItemId)
    );

    const totalRequired = requiredItems.length;
    const completedRequired = requiredItems.filter(i => approvedIds.has(i.id)).length;

    let status: "FULLY_COMPLIANT" | "INCOMPLETE" | "BLOCKED";
    if (totalRequired === 0 || completedRequired === totalRequired) {
      status = "FULLY_COMPLIANT";
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
