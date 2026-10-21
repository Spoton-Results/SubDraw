import app from "./app.js";
import { runMigrations, getStripeSync } from "./lib/stripeClient.js";
import { startInsuranceNotifier } from "./lib/insuranceNotifier.js";
import { startLicenseNotifier } from "./lib/licenseNotifier.js";
import { startGCCredentialNotifier } from "./lib/gcCredentialNotifier.js";
import { startDemoSeeder } from "./lib/demoSeeder.js";
import { startSubmittalOverdueNotifier } from "./lib/submittalOverdueNotifier.js";
import { startMorningEmailer } from "./lib/morningEmailer.js";
import { db } from "@workspace/db";
import { invoicesTable, subcontractsTable, projectsTable, usersTable, subProfilesTable, conditionalLienWaiversTable } from "@workspace/db/schema";
import { eq, inArray, notInArray } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[stripe] DATABASE_URL not set — skipping Stripe init");
    return;
  }
  try {
    console.log("[stripe] Running migrations...");
    await runMigrations({ databaseUrl });
    console.log("[stripe] Migrations done");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhookUrl = `${webhookBaseUrl}/api/stripe/webhook`;
    console.log("[stripe] Setting up managed webhook at", webhookUrl);
    await stripeSync.findOrCreateManagedWebhook(webhookUrl);
    console.log("[stripe] Webhook configured");

    stripeSync.syncBackfill().then(() => {
      console.log("[stripe] Backfill complete");
    }).catch((err) => {
      console.error("[stripe] Backfill error:", err.message);
    });
  } catch (err: any) {
    console.error("[stripe] Init error:", err.message);
  }
}

async function backfillConditionalLienWaivers() {
  try {
    const eligibleStatuses = ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"];
    const invoices = await db.select().from(invoicesTable)
      .where(inArray(invoicesTable.status, eligibleStatuses));
    if (invoices.length === 0) return;

    const existingWaivers = await db.select({ invoiceId: conditionalLienWaiversTable.invoiceId })
      .from(conditionalLienWaiversTable);
    const alreadyHaveWaiver = new Set(existingWaivers.map(w => w.invoiceId));

    const missing = invoices.filter(inv => !alreadyHaveWaiver.has(inv.id));
    if (missing.length === 0) return;

    const scIds = [...new Set(missing.map(i => i.subcontractId))];
    const scs = await db.select().from(subcontractsTable).where(inArray(subcontractsTable.id, scIds));
    const scMap = new Map(scs.map(s => [s.id, s]));

    const projectIds = [...new Set(scs.map(s => s.projectId))];
    const projects = await db.select().from(projectsTable).where(inArray(projectsTable.id, projectIds));
    const projMap = new Map(projects.map(p => [p.id, p]));

    const gcIds = [...new Set(projects.map(p => p.gcId))];
    const subIds = [...new Set(scs.map(s => s.subId))];
    const allUserIds = [...new Set([...gcIds, ...subIds])];
    const users = await db.select({ id: usersTable.id, companyName: usersTable.companyName }).from(usersTable)
      .where(inArray(usersTable.id, allUserIds));
    const userMap = new Map(users.map(u => [u.id, u]));

    const subProfiles = await db.select().from(subProfilesTable).where(inArray(subProfilesTable.userId, subIds));
    const subProfileMap = new Map(subProfiles.map(p => [p.userId, p]));

    const toInsert = missing.map(inv => {
      const sc = scMap.get(inv.subcontractId);
      if (!sc) return null;
      const project = projMap.get(sc.projectId);
      if (!project) return null;
      const gc = userMap.get(project.gcId);
      const sub = userMap.get(sc.subId);
      const subProfile = subProfileMap.get(sc.subId);
      return {
        subcontractId: inv.subcontractId,
        invoiceId: inv.id,
        projectId: sc.projectId,
        approvedAt: inv.approvedAt ?? inv.updatedAt ?? inv.createdAt,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        projectName: project.name,
        projectAddress: (project as any).address ?? null,
        gcCompanyName: gc?.companyName ?? "General Contractor",
        subCompanyName: sub?.companyName ?? "Subcontractor",
        subAddress: subProfile?.businessAddress ?? null,
      };
    }).filter(Boolean) as any[];

    if (toInsert.length > 0) {
      await db.insert(conditionalLienWaiversTable).values(toInsert);
      console.log(`[conditional-waiver-backfill] Created ${toInsert.length} conditional waiver record(s) for existing approved invoices`);
    }
  } catch (err: any) {
    console.error("[conditional-waiver-backfill] Error:", err.message);
  }
}

(async () => {
  await initStripe();

  const appBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  startInsuranceNotifier(appBaseUrl);
  startLicenseNotifier(appBaseUrl);
  startGCCredentialNotifier(appBaseUrl);
  startSubmittalOverdueNotifier();
  startMorningEmailer();
  startDemoSeeder();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  backfillConditionalLienWaivers().catch(err =>
    console.error("[conditional-waiver-backfill] Startup backfill failed:", err)
  );
})();
