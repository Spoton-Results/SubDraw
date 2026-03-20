import { db } from "@workspace/db";
import { gcProjectCredentialsTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { sendGCCredentialExpiryWarningEmail, sendGCCredentialUrgentExpiryEmail } from "./email.js";

function daysUntilExpiry(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runGCCredentialNotifications(appBaseUrl: string) {
  try {
    const allCreds = await db.select().from(gcProjectCredentialsTable);

    for (const cred of allCreds) {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, cred.projectId)).limit(1);
      if (!project) continue;

      const [gc] = await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
      if (!gc) continue;

      const appUrl = `${appBaseUrl}/projects/${project.id}`;

      // Insurance certificate checks
      if (cred.insExpDate) {
        const days = daysUntilExpiry(cred.insExpDate);
        if (days <= 7 && days >= 0 && !cred.insNotifiedAt7) {
          await sendGCCredentialUrgentExpiryEmail({
            toEmail: gc.email,
            gcCompanyName: gc.companyName ?? gc.email,
            projectName: project.name,
            credentialType: "insurance",
            expirationDate: cred.insExpDate,
            daysUntilExpiry: days,
            appUrl,
          }).catch(err => console.error("[gc-cred-notify] Insurance 7-day email failed:", err.message));

          await db.update(gcProjectCredentialsTable)
            .set({ insNotifiedAt7: new Date(), updatedAt: new Date() })
            .where(eq(gcProjectCredentialsTable.id, cred.id));

          console.log(`[gc-cred-notify] Sent 7-day insurance warning for project ${project.id}`);
        } else if (days <= 30 && days > 7 && !cred.insNotifiedAt30) {
          await sendGCCredentialExpiryWarningEmail({
            toEmail: gc.email,
            gcCompanyName: gc.companyName ?? gc.email,
            projectName: project.name,
            credentialType: "insurance",
            expirationDate: cred.insExpDate,
            daysUntilExpiry: days,
            appUrl,
          }).catch(err => console.error("[gc-cred-notify] Insurance 30-day email failed:", err.message));

          await db.update(gcProjectCredentialsTable)
            .set({ insNotifiedAt30: new Date(), updatedAt: new Date() })
            .where(eq(gcProjectCredentialsTable.id, cred.id));

          console.log(`[gc-cred-notify] Sent 30-day insurance warning for project ${project.id}`);
        }
      }

      // License checks
      if (cred.licExpDate) {
        const days = daysUntilExpiry(cred.licExpDate);
        if (days <= 7 && days >= 0 && !cred.licNotifiedAt7) {
          await sendGCCredentialUrgentExpiryEmail({
            toEmail: gc.email,
            gcCompanyName: gc.companyName ?? gc.email,
            projectName: project.name,
            credentialType: "license",
            expirationDate: cred.licExpDate,
            daysUntilExpiry: days,
            appUrl,
          }).catch(err => console.error("[gc-cred-notify] License 7-day email failed:", err.message));

          await db.update(gcProjectCredentialsTable)
            .set({ licNotifiedAt7: new Date(), updatedAt: new Date() })
            .where(eq(gcProjectCredentialsTable.id, cred.id));

          console.log(`[gc-cred-notify] Sent 7-day license warning for project ${project.id}`);
        } else if (days <= 30 && days > 7 && !cred.licNotifiedAt30) {
          await sendGCCredentialExpiryWarningEmail({
            toEmail: gc.email,
            gcCompanyName: gc.companyName ?? gc.email,
            projectName: project.name,
            credentialType: "license",
            expirationDate: cred.licExpDate,
            daysUntilExpiry: days,
            appUrl,
          }).catch(err => console.error("[gc-cred-notify] License 30-day email failed:", err.message));

          await db.update(gcProjectCredentialsTable)
            .set({ licNotifiedAt30: new Date(), updatedAt: new Date() })
            .where(eq(gcProjectCredentialsTable.id, cred.id));

          console.log(`[gc-cred-notify] Sent 30-day license warning for project ${project.id}`);
        }
      }
    }
  } catch (err: any) {
    console.error("[gc-cred-notify] Check failed:", err.message);
  }
}

export function startGCCredentialNotifier(appBaseUrl: string) {
  const INTERVAL_MS = 6 * 60 * 60 * 1000;
  console.log("[gc-cred-notify] Starting notifier — checking every 6 hours");
  runGCCredentialNotifications(appBaseUrl).catch(() => {});
  setInterval(() => {
    runGCCredentialNotifications(appBaseUrl).catch(() => {});
  }, INTERVAL_MS);
}
