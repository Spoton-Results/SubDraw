import { Router } from "express";
import { db } from "@workspace/db";
import { scopeTemplatesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getEffectiveGcId } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GET /api/scope-templates — list GC's saved templates
router.get("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const gcId = getEffectiveGcId(user);
  const templates = await db.select().from(scopeTemplatesTable).where(eq(scopeTemplatesTable.gcId, gcId));
  res.json(templates);
});

// POST /api/scope-templates — save a new template
router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const gcId = getEffectiveGcId(user);
  const { tradeCategory, name, description } = req.body;

  if (!tradeCategory?.trim() || !name?.trim() || !description?.trim()) {
    res.status(400).json({ error: "tradeCategory, name, and description are required" });
    return;
  }

  const [template] = await db.insert(scopeTemplatesTable).values({
    gcId,
    tradeCategory: tradeCategory.trim(),
    name: name.trim(),
    description: description.trim(),
  }).returning();
  res.status(201).json(template);
});

// PUT /api/scope-templates/:id
router.put("/:id", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const gcId = getEffectiveGcId(user);
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name?.trim() || !description?.trim()) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }

  const [template] = await db.select().from(scopeTemplatesTable).where(
    and(eq(scopeTemplatesTable.id, id), eq(scopeTemplatesTable.gcId, gcId))
  ).limit(1);
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [updated] = await db.update(scopeTemplatesTable).set({ name: name.trim(), description: description.trim() }).where(eq(scopeTemplatesTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/scope-templates/:id
router.delete("/:id", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const gcId = getEffectiveGcId(user);
  const { id } = req.params;

  const [template] = await db.select().from(scopeTemplatesTable).where(
    and(eq(scopeTemplatesTable.id, id), eq(scopeTemplatesTable.gcId, gcId))
  ).limit(1);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await db.delete(scopeTemplatesTable).where(eq(scopeTemplatesTable.id, id));
  res.json({ ok: true });
});

export default router;
