import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, notificationPreferencesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = "mailto:support@subtracker.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushNotification(opts: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — skipping push");
    return;
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, opts.userId));

  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/dashboard",
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        console.log(`[push] Sent to ${opts.userId} → ${sub.endpoint.slice(-20)}`);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[push] Subscription gone — removing ${sub.endpoint.slice(-20)}`);
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        } else {
          console.error(`[push] Failed to send to ${sub.endpoint.slice(-20)}:`, err.message);
          throw err;
        }
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[push] ${failed}/${subscriptions.length} deliveries failed for user ${opts.userId}`);
  }
}

export async function getNotificationPrefs(userId: string) {
  const [prefs] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
  return prefs ?? null;
}

export async function ensureNotificationPrefs(userId: string) {
  const existing = await getNotificationPrefs(userId);
  if (existing) return existing;
  const [created] = await db
    .insert(notificationPreferencesTable)
    .values({ userId })
    .returning();
  return created;
}
