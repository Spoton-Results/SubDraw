import { ReplitConnectors } from "@replit/connectors-sdk";
import Stripe from "stripe";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const fromEnv = process.env.STRIPE_SECRET_KEY;
  if (fromEnv && fromEnv.startsWith("sk_")) {
    return new Stripe(fromEnv, { apiVersion: "2025-05-28.basil" });
  }

  const connectors = new ReplitConnectors();
  const proxyFetch = connectors.createProxyFetch("stripe");

  const stripe = new Stripe("sk_placeholder", {
    apiVersion: "2025-05-28.basil",
    httpClient: Stripe.createFetchHttpClient(proxyFetch as typeof fetch),
    host: connectors.getProxyUrl().replace("https://", "").replace(/\/$/, "") + "/stripe",
    port: 443,
    protocol: "https",
    basePath: "",
  });

  return stripe;
}
