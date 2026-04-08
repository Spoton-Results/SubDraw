import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, usersTable, notificationPreferencesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { ensureNotificationPrefs } from "../lib/push.js";

const router = Router();

router.post("/subscribe", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { endpoint, p256dh, auth, userAgent } = req.body;
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Missing subscription fields" });
    return;
  }
  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId: user.id, endpoint, p256dh, auth, userAgent: userAgent ?? null })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId: user.id, p256dh, auth, userAgent: userAgent ?? null, updatedAt: new Date() },
      });
    // Ensure notification preferences exist for this user
    await ensureNotificationPrefs(user.id);
    // Update push prompt timestamp so we don't show the prompt again immediately
    await db
      .update(usersTable)
      .set({ pushPromptLastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[push] subscribe error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.delete("/unsubscribe", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { endpoint } = req.body;
  try {
    if (endpoint) {
      await db
        .delete(pushSubscriptionsTable)
        .where(and(eq(pushSubscriptionsTable.userId, user.id), eq(pushSubscriptionsTable.endpoint, endpoint)));
    } else {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, user.id));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[push] unsubscribe error:", err);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

router.get("/preferences", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const prefs = await ensureNotificationPrefs(user.id);
  res.json(prefs);
});

router.patch("/preferences", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const allowed = [
    "invoiceSubmitted", "invoiceFlagged", "changeOrderApproved", "changeOrderRejected",
    "changeOrderRequest", "paymentConfirmed", "paymentDisputed", "insuranceExpiring",
    "licenseExpiring", "changeOrderCreated", "invoiceApproved", "invoiceRejected",
    "paymentStripe", "paymentManual", "submittalReceived", "submittalOverdue",
    "paymentSetupReminder", "stripeAccountActive",
  ];
  const updates: Record<string, boolean> = {};
  for (const key of allowed) {
    if (key in req.body && typeof req.body[key] === "boolean") {
      updates[key] = req.body[key];
    }
  }
  await db
    .update(notificationPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(notificationPreferencesTable.userId, user.id));
  const prefs = await ensureNotificationPrefs(user.id);
  res.json(prefs);
});

router.post("/dismiss-prompt", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db
    .update(usersTable)
    .set({ pushPromptLastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

router.post("/dismiss-home-screen", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db
    .update(usersTable)
    .set({ homeScreenBannerDismissedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
