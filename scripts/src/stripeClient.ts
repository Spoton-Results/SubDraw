import { ReplitConnectors } from "@replit/connectors-sdk";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-02-25.clover";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const fromEnv = process.env.STRIPE_SECRET_KEY;
  if (fromEnv && fromEnv.startsWith("sk_")) {
    return new Stripe(fromEnv, { apiVersion: STRIPE_API_VERSION });
  }

  const connectors = new ReplitConnectors();
  const proxyFetch = connectors.createProxyFetch("stripe");

  const stripe = new Stripe("sk_placeholder", {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(proxyFetch as typeof fetch),
    host: connectors.getProxyUrl().replace("https://", "").replace(/\/$/, "") + "/stripe",
    port: 443,
    protocol: "https",
    basePath: "",
  });

  return stripe;
}
