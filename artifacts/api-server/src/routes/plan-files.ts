import { Router } from "express";
import { db } from "@workspace/db";
import { planFilesTable, planFileViewsTable, activityLogsTable, subcontractsTable, scopeDocumentsTable, projectsTable, projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { isR2Path, deleteFromR2 } from "../lib/r2.js";

const objectStorageService = new ObjectStorageService();

const router = Router({ mergeParams: true });

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

  const plans = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
  res.json(plans);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const { objectPath, fileName, fileSize, description } = req.body;
  if (!objectPath || !fileName) {
    res.status(400).json({ error: "objectPath and fileName are required" });
    return;
  }
  const [plan] = await db
    .insert(planFilesTable)
    .values({ projectId, objectPath, fileName, fileSize: fileSize ?? null, description: description ?? fileName })
    .returning();
  res.status(201).json(plan);
});

router.delete("/:planFileId", requireAuth, requireGC, async (req, res) => {
  const { projectId, planFileId } = req.params as any;
  const [plan] = await db
    .select()
    .from(planFilesTable)
    .where(and(eq(planFilesTable.id, planFileId), eq(planFilesTable.projectId, projectId)));

  if (!plan) {
    res.status(404).json({ error: "Plan file not found" });
    return;
  }

  if (plan.objectPath) {
    try {
      if (isR2Path(plan.objectPath)) {
        await deleteFromR2(plan.objectPath);
      } else {
        const file = await objectStorageService.getObjectEntityFile(plan.objectPath);
        await file.delete();
      }
    } catch {
    }
  }

  await db
    .delete(planFilesTable)
    .where(and(eq(planFilesTable.id, planFileId), eq(planFilesTable.projectId, projectId)));

  res.status(204).send();
});

// POST /:planFileId/view — sub records a view/download (idempotent: one record per sub per file)
router.post("/:planFileId/view", requireAuth, requireSub, async (req, res) => {
  const { projectId, planFileId } = req.params as any;
  const user = (req as any).user;

  const [plan] = await db
    .select()
    .from(planFilesTable)
    .where(and(eq(planFilesTable.id, planFileId), eq(planFilesTable.projectId, projectId)));

  if (!plan) {
    res.status(404).json({ error: "Plan file not found" });
    return;
  }

  const existing = await db
    .select()
    .from(planFileViewsTable)
    .where(and(eq(planFileViewsTable.planFileId, planFileId), eq(planFileViewsTable.subId, user.id)));

  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  const subName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  const companyName = user.companyName ?? "Unknown";

  const [view] = await db
    .insert(planFileViewsTable)
    .values({ planFileId, subId: user.id, subName, companyName })
    .returning();

  const subs = await db
    .select()
    .from(subcontractsTable)
    .where(and(eq(subcontractsTable.projectId, projectId), eq(subcontractsTable.subId, user.id)));

  if (subs.length > 0) {
    await db.insert(activityLogsTable).values({
      subcontractId: subs[0].id,
      type: "PLAN_FILE_VIEWED",
      description: `Downloaded plan file: "${plan.description}"`,
      actorName: subName,
      actorRole: "SUB",
    }).catch(() => {});
  }

  res.status(201).json(view);
});

// GET /my-views — sub gets their own views for this project
router.get("/my-views", requireAuth, requireSub, async (req, res) => {
  const { projectId } = req.params as any;
  const user = (req as any).user;

  const rows = await db
    .select({ view: planFileViewsTable })
    .from(planFileViewsTable)
    .innerJoin(planFilesTable, eq(planFileViewsTable.planFileId, planFilesTable.id))
    .where(and(eq(planFilesTable.projectId, projectId), eq(planFileViewsTable.subId, user.id)));

  res.json(rows.map(r => r.view));
});

// GET /all-views — GC gets all views for all plan files in this project
router.get("/all-views", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;

  const rows = await db
    .select({ view: planFileViewsTable })
    .from(planFileViewsTable)
    .innerJoin(planFilesTable, eq(planFileViewsTable.planFileId, planFilesTable.id))
    .where(eq(planFilesTable.projectId, projectId));

  res.json(rows.map(r => r.view));
});

// GET /:planFileId/views — GC gets views for a specific plan file
router.get("/:planFileId/views", requireAuth, requireGC, async (req, res) => {
  const { planFileId } = req.params as any;
  const views = await db
    .select()
    .from(planFileViewsTable)
    .where(eq(planFileViewsTable.planFileId, planFileId));
  res.json(views);
});

export default router;
