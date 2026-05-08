import { ReplitConnectors } from "@replit/connectors-sdk";
import { StripeSync, runMigrations } from "stripe-replit-sync";
import Stripe from "stripe";

let _stripeSyncInstance: StripeSync | null = null;

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (key && key.startsWith("sk_")) return key;
  return null;
}

function isRunningOnReplit() {
  return !!process.env.REPL_ID || !!process.env.REPLIT_DOMAINS;
}

async function buildStripeClient(): Promise<Stripe> {
  const fromEnv = getStripeSecretKey();
  if (fromEnv) {
    return new Stripe(fromEnv, { apiVersion: "2025-05-28.basil" });
  }

  if (!isRunningOnReplit()) {
    throw new Error("STRIPE_SECRET_KEY is missing or invalid. Add your live Stripe secret key to Railway variables. It must start with sk_live_ for live mode or sk_test_ for test mode.");
  }

  const connectors = new ReplitConnectors();
  const proxyFetch = connectors.createProxyFetch("stripe");

  const stripe = new Stripe("sk_placeholder", {
    apiVersion: "2025-05-28.basil",
    httpClient: Stripe.createFetchHttpClient(proxyFetch as typeof fetch),
  });

  return stripe;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return buildStripeClient();
}

export async function getStripeSync(): Promise<StripeSync> {
  if (_stripeSyncInstance) return _stripeSyncInstance;

  const fromEnv = getStripeSecretKey();
  const databaseUrl = process.env.DATABASE_URL!;

  if (fromEnv) {
    _stripeSyncInstance = new StripeSync({
      stripeSecretKey: fromEnv,
      poolConfig: { connectionString: databaseUrl, max: 5 },
    });
    return _stripeSyncInstance;
  }

  if (!isRunningOnReplit()) {
    throw new Error("STRIPE_SECRET_KEY is missing or invalid. Stripe sync cannot run on Railway without a real Stripe secret key.");
  }

  const connectors = new ReplitConnectors();
  const proxyFetch = connectors.createProxyFetch("stripe");
  const stripeViaProxy = new Stripe("sk_placeholder", {
    apiVersion: "2025-05-28.basil",
    httpClient: Stripe.createFetchHttpClient(proxyFetch as typeof fetch),
  });

  _stripeSyncInstance = new StripeSync({
    stripeSecretKey: "sk_placeholder",
    poolConfig: { connectionString: databaseUrl, max: 5 },
    stripe: stripeViaProxy,
  } as any);
  return _stripeSyncInstance;
}

export { runMigrations };
