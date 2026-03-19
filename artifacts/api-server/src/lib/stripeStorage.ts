import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { projectsTable } from "@workspace/db/schema";
import { getUncachableStripeClient } from "./stripeClient.js";

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = [
  { name: "SubTracker Starter", limit: 5,  monthlyUsd: 39900, label: "Starter" },
  { name: "SubTracker Growth",  limit: 15, monthlyUsd: 79900, label: "Growth"  },
  { name: "SubTracker Scale",   limit: 40, monthlyUsd: 149900, label: "Scale"  },
] as const;

export type PlanName = (typeof PLANS)[number]["name"];

export function getPlanByName(name: string) {
  return PLANS.find(p => p.name === name) ?? null;
}

export function getNextPlan(currentName: string) {
  const idx = PLANS.findIndex(p => p.name === currentName);
  if (idx === -1 || idx === PLANS.length - 1) return null;
  return PLANS[idx + 1];
}

// ── Stripe product/price helpers ──────────────────────────────────────────────

export async function getOrCreatePlanPrice(planName: PlanName): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const plan = getPlanByName(planName)!;

  // Try the synced DB first, but verify the price is valid in the current Stripe environment
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = ${planName} AND pr.active = true AND p.active = true
      LIMIT 1
    `
  );
  if (result.rows[0]) {
    const priceId = (result.rows[0] as any).price_id as string;
    try {
      await stripe.prices.retrieve(priceId);
      return priceId; // Price exists and is valid in the current environment
    } catch {
      // Price is stale (e.g. from a different Stripe mode) — fall through to find/create
    }
  }

  // Search Stripe directly for an existing active product+price with this name
  const products = await stripe.products.search({ query: `name:"${planName}" AND active:"true"` });
  if (products.data.length > 0) {
    const existingProduct = products.data[0];
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, recurring: { interval: "month" } as any, limit: 1 });
    if (prices.data.length > 0) return prices.data[0].id;
    // Product exists but no active price — create a price on the existing product
    const price = await stripe.prices.create({
      product: existingProduct.id,
      unit_amount: plan.monthlyUsd,
      currency: "usd",
      recurring: { interval: "month" },
    });
    return price.id;
  }

  // Nothing found — create a new product and price in Stripe
  const product = await stripe.products.create({ name: planName });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.monthlyUsd,
    currency: "usd",
    recurring: { interval: "month" },
  });
  return price.id;
}

export async function getAllPlanPrices(): Promise<Array<{ planName: string; priceId: string; unitAmount: number }>> {
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id, pr.unit_amount, p.name as product_name
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name IN ('SubTracker Starter', 'SubTracker Growth', 'SubTracker Scale')
        AND pr.active = true AND p.active = true
    `
  );
  return (result.rows as any[]).map(r => ({
    planName: r.product_name,
    priceId: r.price_id,
    unitAmount: r.unit_amount ?? 0,
  }));
}

// ── Subscription helpers ──────────────────────────────────────────────────────

export async function getSubscriptionForUser(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.stripeSubscriptionId) return null;
  return getSubscriptionById(user.stripeSubscriptionId);
}

export async function getSubscriptionById(subscriptionId: string) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId} LIMIT 1`
  );
  return (result.rows[0] as any) ?? null;
}

export async function getCustomerById(customerId: string) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.customers WHERE id = ${customerId} LIMIT 1`
  );
  return (result.rows[0] as any) ?? null;
}

export async function getInvoicesForCustomer(customerId: string, limit = 12) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.invoices WHERE customer = ${customerId} ORDER BY created DESC LIMIT ${limit}`
  );
  return result.rows as any[];
}

/** Returns the product name for a subscription, or null if not found. */
export async function getSubscriptionPlanName(subscriptionId: string): Promise<string | null> {
  const result = await db.execute(
    sql`
      SELECT p.name as product_name
      FROM stripe.subscription_items si
      JOIN stripe.prices pr ON pr.id = si.price
      JOIN stripe.products p ON p.id = pr.product
      WHERE si.subscription = ${subscriptionId}
      LIMIT 1
    `
  );
  return (result.rows[0] as any)?.product_name ?? null;
}

export async function updateUserStripeInfo(userId: string, info: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
}) {
  const [user] = await db
    .update(usersTable)
    .set({ ...info, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  return user;
}

// ── Plan limit helpers ────────────────────────────────────────────────────────

/** Count BIDDING or ACTIVE projects for a GC (these consume a plan slot). */
export async function getActiveProjectCount(gcId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM projects WHERE gc_id = ${gcId} AND status IN ('BIDDING', 'ACTIVE')`
  );
  return parseInt((result.rows[0] as any)?.count ?? "0", 10);
}

/** Total project count regardless of status (kept for backward compat). */
export async function getGCProjectCount(gcId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM projects WHERE gc_id = ${gcId}`
  );
  return parseInt((result.rows[0] as any)?.count ?? "0", 10);
}

const TRIAL_DAYS = 14;

export interface GCPlanInfo {
  subscribed: boolean;
  planName: string | null;
  planLabel: string | null;
  limit: number | null;
  activeCount: number;
  nextPlan: (typeof PLANS)[number] | null;
  isPastDue: boolean;
  isInGrace: boolean;
  // Trial fields
  trialActive: boolean;
  trialExpired: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
}

export async function getGCPlanInfo(userId: string): Promise<GCPlanInfo> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const activeCount = await getActiveProjectCount(userId);

  // ── Trial calculation ──────────────────────────────────────────────────────
  const trialStart = user?.trialStartedAt ?? user?.createdAt ?? new Date();
  const trialEndsAt = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msLeft = trialEndsAt.getTime() - now.getTime();
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const trialActive = now < trialEndsAt;
  const trialExpired = !trialActive;

  // No subscription — access determined by trial status
  if (!user?.stripeSubscriptionId) {
    return {
      subscribed: trialActive, // during trial, unlimited full access
      planName: null,
      planLabel: null,
      limit: null, // unlimited during trial
      activeCount,
      nextPlan: PLANS[0],
      isPastDue: false,
      isInGrace: false,
      trialActive,
      trialExpired,
      trialDaysLeft,
      trialEndsAt,
    };
  }

  const sub = await getSubscriptionById(user.stripeSubscriptionId);
  if (!sub) {
    return {
      subscribed: trialActive,
      planName: null,
      planLabel: null,
      limit: null,
      activeCount,
      nextPlan: PLANS[0],
      isPastDue: false,
      isInGrace: false,
      trialActive,
      trialExpired,
      trialDaysLeft,
      trialEndsAt,
    };
  }

  const isPastDue = sub.status === "past_due";
  let isInGrace = false;
  if (isPastDue) {
    const nowSec = Math.floor(Date.now() / 1000);
    const gracePeriodEnd = (sub.current_period_end ?? 0) + 3 * 24 * 60 * 60;
    isInGrace = nowSec <= gracePeriodEnd;
  }

  const subscribed = sub.status === "active" || sub.status === "trialing" || (isPastDue && isInGrace);

  const planName = await getSubscriptionPlanName(user.stripeSubscriptionId);
  const plan = planName ? getPlanByName(planName) : null;
  const nextPlan = planName ? getNextPlan(planName) : PLANS[0];

  return {
    subscribed,
    planName: planName ?? null,
    planLabel: plan?.label ?? null,
    limit: plan?.limit ?? null,
    activeCount,
    nextPlan: nextPlan ?? null,
    isPastDue,
    isInGrace,
    trialActive: false, // has paid sub — trial info not relevant
    trialExpired: false,
    trialDaysLeft: 0,
    trialEndsAt: null,
  };
}

export async function isGCSubscribed(userId: string): Promise<boolean> {
  const info = await getGCPlanInfo(userId);
  return info.subscribed;
}

// Kept for backward compat — prefer getOrCreatePlanPrice
export async function getProPlanPrice() {
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring,
             p.id as product_id, p.name as product_name
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = 'SubTracker Pro' AND pr.active = true AND p.active = true
      LIMIT 1
    `
  );
  return (result.rows[0] as any) ?? null;
}
