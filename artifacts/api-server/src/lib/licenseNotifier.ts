import { db } from "@workspace/db";
import { contractorLicensesTable, subcontractsTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { sendLicenseExpiryWarningEmail, sendLicenseUrgentExpiryEmail } from "./email.js";
import { createNotification } from "../routes/notifications.js";

function daysUntilExpiry(expirationDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runLicenseNotifications(appBaseUrl: string) {
  try {
    const allLicenses = await db
      .select()
      .from(contractorLicensesTable)
      .where(isNotNull(contractorLicensesTable.expirationDate));

    for (const lic of allLicenses) {
      if (!lic.expirationDate) continue;
      const days = daysUntilExpiry(lic.expirationDate);

      const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, lic.subcontractId)).limit(1);
      if (!sc) continue;

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
      if (!project) continue;

      const [gc] = await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
      if (!gc) continue;

      const [sub] = await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
      if (!sub) continue;

      const subName = sub.companyName ?? sub.email;
      const licenseType = lic.licenseType ?? "Contractor";
      const appUrl = `${appBaseUrl}/subcontracts/${sc.id}`;

      if (days <= 7 && days >= 0 && !lic.notifiedAt7) {
        await sendLicenseUrgentExpiryEmail({
          toEmail: gc.email,
          gcCompanyName: gc.companyName ?? gc.email,
          subCompanyName: subName,
          projectName: project.name,
          licenseType,
          expirationDate: lic.expirationDate,
          daysUntilExpiry: days,
          appUrl,
        }).catch(err => console.error("[license-notify] 7-day email failed:", err.message));

        createNotification({
          userId: gc.id,
          type: "LICENSE_EXPIRING",
          title: `License Expiring Soon — ${subName}`,
          body: `${subName}'s ${licenseType} license expires in ${days} day${days !== 1 ? "s" : ""} (${lic.expirationDate}) on ${project.name}.`,
          url: `/subcontracts/${sc.id}`,
        }).catch(err => console.error("[license-notify] 7-day push failed:", err.message));

        await db.update(contractorLicensesTable)
          .set({ notifiedAt7: new Date(), updatedAt: new Date() })
          .where(eq(contractorLicensesTable.id, lic.id));

        console.log(`[license-notify] Sent 7-day warning for subcontract ${sc.id}`);
      } else if (days <= 30 && days > 7 && !lic.notifiedAt30) {
        await sendLicenseExpiryWarningEmail({
          toEmail: gc.email,
          gcCompanyName: gc.companyName ?? gc.email,
          subCompanyName: subName,
          projectName: project.name,
          licenseType,
          expirationDate: lic.expirationDate,
          daysUntilExpiry: days,
          appUrl,
        }).catch(err => console.error("[license-notify] 30-day email failed:", err.message));

        createNotification({
          userId: gc.id,
          type: "LICENSE_EXPIRING",
          title: `License Expiring in ${days} Days — ${subName}`,
          body: `${subName}'s ${licenseType} license expires on ${lic.expirationDate}. Update required on ${project.name}.`,
          url: `/subcontracts/${sc.id}`,
        }).catch(err => console.error("[license-notify] 30-day push failed:", err.message));

        await db.update(contractorLicensesTable)
          .set({ notifiedAt30: new Date(), updatedAt: new Date() })
          .where(eq(contractorLicensesTable.id, lic.id));

        console.log(`[license-notify] Sent 30-day warning for subcontract ${sc.id}`);
      }
    }
  } catch (err: any) {
    console.error("[license-notify] Check failed:", err.message);
  }
}

export function startLicenseNotifier(appBaseUrl: string) {
  const INTERVAL_MS = 6 * 60 * 60 * 1000;

  console.log("[license-notify] Starting notifier — checking every 6 hours");

  runLicenseNotifications(appBaseUrl).catch(() => {});

  setInterval(() => {
    runLicenseNotifications(appBaseUrl).catch(() => {});
  }, INTERVAL_MS);
}
