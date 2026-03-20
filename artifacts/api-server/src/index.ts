import app from "./app.js";
import { runMigrations, getStripeSync } from "./lib/stripeClient.js";
import { startInsuranceNotifier } from "./lib/insuranceNotifier.js";
import { startLicenseNotifier } from "./lib/licenseNotifier.js";
import { startGCCredentialNotifier } from "./lib/gcCredentialNotifier.js";
import { startDemoSeeder } from "./lib/demoSeeder.js";

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
    await runMigrations({ databaseUrl, schema: "stripe" });
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

(async () => {
  await initStripe();

  const appBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  startInsuranceNotifier(appBaseUrl);
  startLicenseNotifier(appBaseUrl);
  startGCCredentialNotifier(appBaseUrl);
  startDemoSeeder();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
})();
