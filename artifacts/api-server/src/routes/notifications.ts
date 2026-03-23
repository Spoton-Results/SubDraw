import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  res.json(notifications);
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const all = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.readAt)));
  res.json({ count: all.length });
});

router.post("/:id/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [notif] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, user.id)))
    .returning();
  if (!notif) { res.status(404).json({ error: "Not found" }); return; }
  res.json(notif);
});

router.post("/read-all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.readAt)));
  res.json({ ok: true });
});

export default router;

export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  await db.insert(notificationsTable).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    data: opts.data ? JSON.stringify(opts.data) : null,
  });
}
