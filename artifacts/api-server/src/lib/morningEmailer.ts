import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { sendAdminDailySummaryEmail } from "./email.js";

const ADMIN_EMAIL = "s.allen@spotonresults.com";
const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

let lastSentDate = "";

function getMountainHour(): number {
  // Mountain Time is UTC-7 (MDT) in summer, UTC-6 (MST) in winter
  // Approximate: use UTC-7 (close enough for both)
  const now = new Date();
  const utcOffset = -7;
  const mountain = new Date(now.getTime() + utcOffset * 60 * 60 * 1000);
  return mountain.getUTCHours();
}

function getMountainDateStr(): string {
  const now = new Date();
  const utcOffset = -7;
  const mountain = new Date(now.getTime() + utcOffset * 60 * 60 * 1000);
  return mountain.toISOString().split("T")[0];
}

async function sendMorningSummary() {
  const today = getMountainDateStr();
  if (lastSentDate === today) return; // Already sent today

  try {
    const gcOwners = await db.select().from(usersTable).where(
      and(eq(usersTable.role, "GC"), eq(usersTable.isDemo, false), isNull(usersTable.gcParentId))
    );
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let mrr = 0;
    let newTrialsYesterday = 0;
    let newPayingYesterday = 0;
    let failedPayments = 0;
    const trialsExpiring3d: Array<{ companyName: string; email: string; daysLeft: number }> = [];

    for (const user of gcOwners) {
      const trialEnd = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isOnTrial = now < trialEnd && !user.stripeSubscriptionId && !user.adminPlanOverride;

      if ((user.trialStartedAt ?? user.createdAt) >= oneDayAgo) newTrialsYesterday++;

      if (isOnTrial && daysLeft > 0 && daysLeft <= 3) {
        trialsExpiring3d.push({ companyName: user.companyName, email: user.email, daysLeft });
      }
    }

    const invoicesFlaggedResult = await db.execute(sql`SELECT COUNT(*) as c FROM subcontract_activity_logs WHERE type = 'INVOICE_FLAGGED' AND created_at >= ${oneDayAgo}`);
    const invoicesFlaggedYesterday = parseInt((invoicesFlaggedResult.rows[0] as any)?.c ?? "0", 10);

    const paymentsResult = await db.execute(sql`SELECT COUNT(*) as c FROM invoices WHERE payment_confirmed_at >= ${oneDayAgo}`);
    const paymentsYesterday = parseInt((paymentsResult.rows[0] as any)?.c ?? "0", 10);

    // Activated yesterday (got all 3 activation steps in last 24h - approximation: just check invoice creation date)
    const activatedYesterdayResult = await db.execute(sql`
      SELECT COUNT(*) as c FROM users u
      WHERE u.role = 'GC' AND u.is_demo = false AND u.gc_parent_id IS NULL AND u.created_at >= ${oneDayAgo}
        AND EXISTS (SELECT 1 FROM projects p WHERE p.gc_id = u.id)
        AND EXISTS (SELECT 1 FROM subcontracts s JOIN projects p2 ON p2.id = s.project_id WHERE p2.gc_id = u.id)
        AND EXISTS (SELECT 1 FROM invoices i JOIN subcontracts s2 ON s2.id = i.subcontract_id JOIN projects p3 ON p3.id = s2.project_id WHERE p3.gc_id = u.id)
    `);
    const activatedYesterday = parseInt((activatedYesterdayResult.rows[0] as any)?.c ?? "0", 10);

    const appBaseUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    const dateFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    await sendAdminDailySummaryEmail({
      toEmail: ADMIN_EMAIL,
      date: dateFormatted,
      mrr,
      newTrialsYesterday,
      trialsExpiring3d,
      activatedYesterday,
      newPayingYesterday,
      failedPayments,
      invoicesFlaggedYesterday,
      paymentsYesterday,
      adminDashboardUrl: `${appBaseUrl}/admin`,
    });

    lastSentDate = today;
    console.log(`[morning-email] Sent daily summary for ${today}`);
  } catch (err: any) {
    console.error("[morning-email] Failed to send:", err.message);
  }
}

export function startMorningEmailer() {
  console.log("[morning-email] Starting daily emailer — will send at 7 AM Mountain Time");

  const tick = () => {
    const hour = getMountainHour();
    if (hour === 7) {
      sendMorningSummary().catch(() => {});
    }
  };

  tick();
  setInterval(tick, 60 * 1000); // Check every minute
}
