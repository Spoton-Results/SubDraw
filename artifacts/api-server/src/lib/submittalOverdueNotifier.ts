import { db } from "@workspace/db";
import { submittalsTable, subcontractsTable, projectsTable, usersTable } from "@workspace/db/schema";
import { and, lt, isNull } from "drizzle-orm";
import { createNotification } from "../routes/notifications.js";

export async function runSubmittalOverdueNotifications() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Find pending submittals past their required response date
    const overdueSubmittals = await db
      .select()
      .from(submittalsTable)
      .where(
        and(
          isNull(submittalsTable.acknowledgedAt),
          lt(submittalsTable.requiredResponseDate, today),
          isNull(submittalsTable.overdueNotifiedAt)
        )
      );

    console.log(`[submittal-overdue] Checking ${overdueSubmittals.length} overdue submittals`);

    for (const submittal of overdueSubmittals) {
      const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, submittal.subcontractId)).limit(1);
      if (!sc) continue;

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
      if (!project) continue;

      const [gc] = await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
      if (!gc) continue;

      const [sub] = await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
      if (!sub) continue;

      // Notify GC that response is overdue from sub
      await createNotification({
        userId: gc.id,
        type: "SUBMITTAL_OVERDUE",
        title: `Submittal Overdue — ${sub.companyName ?? sub.email}`,
        body: `"${submittal.name}" on ${project.name} was due on ${submittal.requiredResponseDate} and has not been answered yet.`,
        url: `/submittals/${submittal.id}`,
        data: { submittalId: submittal.id, subcontractId: sc.id },
      }).catch(err => console.error("[submittal-overdue] GC notification failed:", err));

      // Mark as notified to avoid repeat notifications
      await db
        .update(submittalsTable)
        .set({ overdueNotifiedAt: new Date() })
        .where(eq(submittalsTable.id, submittal.id))
        .catch(err => console.error("[submittal-overdue] Failed to mark notified:", err));

      console.log(`[submittal-overdue] Notified GC ${gc.email} for submittal ${submittal.id}`);
    }
  } catch (err: any) {
    console.error("[submittal-overdue] Check failed:", err.message);
  }
}

export function startSubmittalOverdueNotifier() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

  console.log("[submittal-overdue] Starting notifier — checking daily");

  // Run once on startup
  runSubmittalOverdueNotifications().catch(() => {});

  // Schedule daily checks
  setInterval(() => {
    runSubmittalOverdueNotifications().catch(() => {});
  }, INTERVAL_MS);
}
