import { Router } from "express";
import { db } from "@workspace/db";
import { planFilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const plans = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
  res.json(plans);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const { objectPath, fileName, description } = req.body;
  if (!objectPath || !fileName || !description) {
    res.status(400).json({ error: "objectPath, fileName, and description are required" });
    return;
  }
  const [plan] = await db
    .insert(planFilesTable)
    .values({ projectId, objectPath, fileName, description })
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
      const file = await objectStorageService.getObjectEntityFile(plan.objectPath);
      await file.delete();
    } catch {
    }
  }

  await db
    .delete(planFilesTable)
    .where(and(eq(planFilesTable.id, planFileId), eq(planFilesTable.projectId, projectId)));

  res.status(204).send();
});

export default router;
