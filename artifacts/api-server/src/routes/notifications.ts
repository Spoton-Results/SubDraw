import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, notificationPreferencesTable } from "@workspace/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendPushNotification } from "../lib/push.js";

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

// Pref key mapping from notification type to preference column
const PREF_MAP: Record<string, keyof typeof notificationPreferencesTable.$inferSelect> = {
  INVOICE_SUBMITTED: "invoiceSubmitted",
  INVOICE_FLAGGED: "invoiceFlagged",
  CO_APPROVED_BY_SUB: "changeOrderApproved",
  CO_REJECTED_BY_SUB: "changeOrderRejected",
  CO_SUBMITTED_BY_SUB: "changeOrderRequest",
  PAYMENT_CONFIRMED: "paymentConfirmed",
  PAYMENT_DISPUTED: "paymentDisputed",
  INSURANCE_EXPIRING: "insuranceExpiring",
  LICENSE_EXPIRING: "licenseExpiring",
  CO_CREATED: "changeOrderCreated",
  INVOICE_APPROVED: "invoiceApproved",
  INVOICE_REJECTED: "invoiceRejected",
  PAYMENT_STRIPE: "paymentStripe",
  PAYMENT_MANUAL: "paymentManual",
  SUBMITTAL_CREATED: "submittalReceived",
  SUBMITTAL_OVERDUE: "submittalOverdue",
  PAYMENT_SETUP_REMINDER: "paymentSetupReminder",
  STRIPE_ACCOUNT_ACTIVE: "stripeAccountActive",
};

export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}) {
  // Check user notification preferences before sending
  const prefKey = PREF_MAP[opts.type];
  if (prefKey) {
    const [prefs] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, opts.userId));
    if (prefs && prefs[prefKey] === false) return; // User disabled this notification type
  }

  const [notif] = await db.insert(notificationsTable).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    url: opts.url ?? null,
    data: opts.data ? JSON.stringify(opts.data) : null,
  }).returning();

  // Fire-and-forget push notification
  sendPushNotification({
    userId: opts.userId,
    title: opts.title,
    body: opts.body,
    url: opts.url,
  }).then(() => {
    if (notif) {
      db.update(notificationsTable)
        .set({ pushSent: true })
        .where(eq(notificationsTable.id, notif.id))
        .catch(() => {});
    }
  }).catch((err) => console.error("[push] sendPushNotification failed:", err));
}
