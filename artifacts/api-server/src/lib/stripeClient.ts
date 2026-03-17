import { ReplitConnectors } from "@replit/connectors-sdk";
import { StripeSync, runMigrations } from "stripe-replit-sync";
import Stripe from "stripe";

let _stripeSyncInstance: StripeSync | null = null;
let _stripeClientInstance: Stripe | null = null;

async function buildStripeClient(): Promise<Stripe> {
  const fromEnv = process.env.STRIPE_SECRET_KEY;
  if (fromEnv && fromEnv.startsWith("sk_")) {
    return new Stripe(fromEnv, { apiVersion: "2025-05-28.basil" });
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

  const fromEnv = process.env.STRIPE_SECRET_KEY;
  const databaseUrl = process.env.DATABASE_URL!;

  if (fromEnv && fromEnv.startsWith("sk_")) {
    _stripeSyncInstance = new StripeSync({
      stripeSecretKey: fromEnv,
      poolConfig: { connectionString: databaseUrl, max: 5 },
    });
    return _stripeSyncInstance;
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
