import { db } from "@workspace/db";
import { subcontractInsurancesTable, subcontractsTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, isNull, or } from "drizzle-orm";
import { sendInsuranceExpiryWarningEmail, sendInsuranceUrgentExpiryEmail } from "./email.js";
import { createNotification } from "../routes/notifications.js";

function daysUntilExpiry(expirationDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runInsuranceNotifications(appBaseUrl: string) {
  try {
    const allInsurances = await db
      .select()
      .from(subcontractInsurancesTable)
      .where(isNotNull(subcontractInsurancesTable.expirationDate));

    for (const ins of allInsurances) {
      if (!ins.expirationDate) continue;
      const days = daysUntilExpiry(ins.expirationDate);

      const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, ins.subcontractId)).limit(1);
      if (!sc) continue;

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
      if (!project) continue;

      const [gc] = await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
      if (!gc) continue;

      const [sub] = await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
      if (!sub) continue;

      const subName = sub.companyName ?? sub.email;
      const appUrl = `${appBaseUrl}/subcontracts/${sc.id}`;

      if (days <= 7 && days >= 0 && !ins.notifiedAt7) {
        await sendInsuranceUrgentExpiryEmail({
          toEmail: gc.email,
          gcCompanyName: gc.companyName ?? gc.email,
          subCompanyName: subName,
          projectName: project.name,
          expirationDate: ins.expirationDate,
          daysUntilExpiry: days,
          appUrl,
        }).catch(err => console.error("[insurance-notify] 7-day email failed:", err.message));

        createNotification({
          userId: gc.id,
          type: "INSURANCE_EXPIRING",
          title: `Insurance Expiring Soon — ${subName}`,
          body: `${subName}'s insurance expires in ${days} day${days !== 1 ? "s" : ""} (${ins.expirationDate}) on ${project.name}.`,
          url: `/subcontracts/${sc.id}`,
        }).catch(err => console.error("[insurance-notify] 7-day push failed:", err.message));

        await db.update(subcontractInsurancesTable)
          .set({ notifiedAt7: new Date(), updatedAt: new Date() })
          .where(eq(subcontractInsurancesTable.id, ins.id));

        console.log(`[insurance-notify] Sent 7-day warning for subcontract ${sc.id}`);
      } else if (days <= 30 && days > 7 && !ins.notifiedAt30) {
        await sendInsuranceExpiryWarningEmail({
          toEmail: gc.email,
          gcCompanyName: gc.companyName ?? gc.email,
          subCompanyName: subName,
          projectName: project.name,
          expirationDate: ins.expirationDate,
          daysUntilExpiry: days,
          appUrl,
        }).catch(err => console.error("[insurance-notify] 30-day email failed:", err.message));

        createNotification({
          userId: gc.id,
          type: "INSURANCE_EXPIRING",
          title: `Insurance Expiring in ${days} Days — ${subName}`,
          body: `${subName}'s insurance expires on ${ins.expirationDate}. Update required on ${project.name}.`,
          url: `/subcontracts/${sc.id}`,
        }).catch(err => console.error("[insurance-notify] 30-day push failed:", err.message));

        await db.update(subcontractInsurancesTable)
          .set({ notifiedAt30: new Date(), updatedAt: new Date() })
          .where(eq(subcontractInsurancesTable.id, ins.id));

        console.log(`[insurance-notify] Sent 30-day warning for subcontract ${sc.id}`);
      }
    }
  } catch (err: any) {
    console.error("[insurance-notify] Check failed:", err.message);
  }
}

export function startInsuranceNotifier(appBaseUrl: string) {
  const INTERVAL_MS = 6 * 60 * 60 * 1000;

  console.log("[insurance-notify] Starting notifier — checking every 6 hours");

  runInsuranceNotifications(appBaseUrl).catch(() => {});

  setInterval(() => {
    runInsuranceNotifications(appBaseUrl).catch(() => {});
  }, INTERVAL_MS);
}
