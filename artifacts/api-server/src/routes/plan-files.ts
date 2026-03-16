import { Router } from "express";
import { db } from "@workspace/db";
import { planFilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const plans = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
  res.json(plans);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const { fileUrl, description } = req.body;
  if (!fileUrl || !description) {
    res.status(400).json({ error: "fileUrl and description are required" });
    return;
  }
  const [plan] = await db.insert(planFilesTable).values({ projectId, fileUrl, description }).returning();
  res.status(201).json(plan);
});

export default router;
