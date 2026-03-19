import { Router } from "express";
import { db } from "@workspace/db";
import { scopeDocumentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();
const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const docs = await db.select().from(scopeDocumentsTable).where(eq(scopeDocumentsTable.projectId, projectId));
  res.json(docs);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const { objectPath, fileName, fileSize, description } = req.body;
  if (!objectPath || !fileName) {
    res.status(400).json({ error: "objectPath and fileName are required" });
    return;
  }
  const [doc] = await db
    .insert(scopeDocumentsTable)
    .values({ projectId, objectPath, fileName, fileSize: fileSize ?? null, description: description ?? null })
    .returning();
  res.status(201).json(doc);
});

router.delete("/:docId", requireAuth, requireGC, async (req, res) => {
  const { projectId, docId } = req.params as any;
  const [doc] = await db
    .select()
    .from(scopeDocumentsTable)
    .where(and(eq(scopeDocumentsTable.id, docId), eq(scopeDocumentsTable.projectId, projectId)));

  if (!doc) {
    res.status(404).json({ error: "Scope document not found" });
    return;
  }

  if (doc.objectPath) {
    try {
      const file = await objectStorageService.getObjectEntityFile(doc.objectPath);
      await file.delete();
    } catch { }
  }

  await db
    .delete(scopeDocumentsTable)
    .where(and(eq(scopeDocumentsTable.id, docId), eq(scopeDocumentsTable.projectId, projectId)));

  res.status(204).send();
});

export default router;
