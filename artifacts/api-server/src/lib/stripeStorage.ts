import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { projectsTable, subcontractsTable } from "@workspace/db/schema";
import { getUncachableStripeClient } from "./stripeClient.js";

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = [
  { name: "SubDraw Starter",      limit: 10,   monthlyUsd: 14900,  annualUsd: 163900,  label: "Starter",      planLabel: "Perfect for Small GCs"        },
  { name: "SubDraw Professional", limit: 30,   monthlyUsd: 29900,  annualUsd: 328900,  label: "Professional", planLabel: "Most Popular"                  },
  { name: "SubDraw Scale",        limit: null, monthlyUsd: 59900,  annualUsd: 658900,  label: "Scale",        planLabel: "Unlimited Everything"          },
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

  // Try the synced DB first
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = ${planName} AND pr.active = true AND p.active = true
        AND pr.recurring->>'interval' = 'month'
      LIMIT 1
    `
  );
  if (result.rows[0]) {
    const priceId = (result.rows[0] as any).price_id as string;
    try {
      await stripe.prices.retrieve(priceId);
      return priceId;
    } catch {
      // stale — fall through
    }
  }

  // Search Stripe directly
  const products = await stripe.products.search({ query: `name:"${planName}" AND active:"true"` });
  if (products.data.length > 0) {
    const existingProduct = products.data[0];
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, recurring: { interval: "month" } as any, limit: 10 });
    const matchingPrice = prices.data.find(p => p.unit_amount === plan.monthlyUsd);
    if (matchingPrice) return matchingPrice.id;
    const price = await stripe.prices.create({
      product: existingProduct.id,
      unit_amount: plan.monthlyUsd,
      currency: "usd",
      recurring: { interval: "month" },
    });
    return price.id;
  }

  // Create new
  const product = await stripe.products.create({ name: planName });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.monthlyUsd,
    currency: "usd",
    recurring: { interval: "month" },
  });
  return price.id;
}

/** Annual variant — product name is e.g. "SubDraw Scale Annual" */
export async function getOrCreateAnnualPlanPrice(planName: PlanName): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const plan = getPlanByName(planName)!;
  const annualProductName = `${planName} Annual`;

  // Try synced DB
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = ${annualProductName} AND pr.active = true AND p.active = true
        AND pr.recurring->>'interval' = 'year'
      LIMIT 1
    `
  );
  if (result.rows[0]) {
    const priceId = (result.rows[0] as any).price_id as string;
    try {
      await stripe.prices.retrieve(priceId);
      return priceId;
    } catch {
      // stale — fall through
    }
  }

  // Search Stripe directly
  const products = await stripe.products.search({ query: `name:"${annualProductName}" AND active:"true"` });
  if (products.data.length > 0) {
    const existingProduct = products.data[0];
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, recurring: { interval: "year" } as any, limit: 10 });
    const matchingPrice = prices.data.find(p => p.unit_amount === plan.annualUsd);
    if (matchingPrice) return matchingPrice.id;
    const price = await stripe.prices.create({
      product: existingProduct.id,
      unit_amount: plan.annualUsd,
      currency: "usd",
      recurring: { interval: "year" },
    });
    return price.id;
  }

  // Create new
  const product = await stripe.products.create({ name: annualProductName, metadata: { planName, billing: "annual" } });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.annualUsd,
    currency: "usd",
    recurring: { interval: "year" },
  });
  return price.id;
}

export async function getAllPlanPrices(): Promise<Array<{ planName: string; priceId: string; unitAmount: number }>> {
  const planNames = PLANS.map(p => p.name);
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id, pr.unit_amount, p.name as product_name
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name IN (${sql.join(planNames.map(n => sql`${n}`), sql`, `)})
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

/** Returns the billing interval ('month' | 'year') for a subscription. */
export async function getSubscriptionInterval(subscriptionId: string): Promise<string | null> {
  const result = await db.execute(
    sql`
      SELECT pr.recurring->>'interval' as billing_interval
      FROM stripe.subscription_items si
      JOIN stripe.prices pr ON pr.id = si.price
      WHERE si.subscription = ${subscriptionId}
      LIMIT 1
    `
  );
  return (result.rows[0] as any)?.billing_interval ?? null;
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

/** Count active subcontracts for a GC: subcontracts on BIDDING or CONSTRUCTION projects. */
export async function getActiveSubcontractCount(gcId: string): Promise<number> {
  const result = await db.execute(
    sql`
      SELECT COUNT(s.id) as count
      FROM subcontracts s
      JOIN projects p ON p.id = s.project_id
      WHERE p.gc_id = ${gcId}
        AND p.status IN ('BIDDING', 'CONSTRUCTION')
    `
  );
  return parseInt((result.rows[0] as any)?.count ?? "0", 10);
}

/** Returns per-project subcontract breakdown for billing page. */
export async function getActiveProjectsWithSubcontractCounts(gcId: string): Promise<Array<{ projectId: string; projectName: string; subcontractCount: number; status: string }>> {
  const result = await db.execute(
    sql`
      SELECT p.id as project_id, p.name as project_name, p.status,
             COUNT(s.id) as subcontract_count
      FROM projects p
      LEFT JOIN subcontracts s ON s.project_id = p.id
      WHERE p.gc_id = ${gcId}
        AND p.status IN ('BIDDING', 'CONSTRUCTION')
      GROUP BY p.id, p.name, p.status
      ORDER BY subcontract_count DESC, p.name ASC
    `
  );
  return (result.rows as any[]).map(r => ({
    projectId: r.project_id,
    projectName: r.project_name,
    status: r.status,
    subcontractCount: parseInt(r.subcontract_count ?? "0", 10),
  }));
}

/** Total project count regardless of status (kept for backward compat). */
export async function getGCProjectCount(gcId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM projects WHERE gc_id = ${gcId}`
  );
  return parseInt((result.rows[0] as any)?.count ?? "0", 10);
}

/** Keep for backward compat — now an alias for getActiveSubcontractCount. */
export async function getActiveProjectCount(gcId: string): Promise<number> {
  return getActiveSubcontractCount(gcId);
}

const TRIAL_DAYS = 7;

export interface GCPlanInfo {
  subscribed: boolean;
  planName: string | null;
  planLabel: string | null;
  limit: number | null;
  activeCount: number;
  nextPlan: (typeof PLANS)[number] | null;
  isPastDue: boolean;
  isInGrace: boolean;
  billingInterval: string | null; // 'month' | 'year' | null
  // Trial fields
  trialActive: boolean;
  trialExpired: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
}

export async function getGCPlanInfo(userId: string): Promise<GCPlanInfo> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const activeCount = await getActiveSubcontractCount(userId);

  // ── Admin plan override ────────────────────────────────────────────────────
  if (user?.adminPlanOverride) {
    const overrideExpired = user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < new Date();
    if (!overrideExpired) {
      const plan = getPlanByName(user.adminPlanOverride);
      const nextPlan = plan ? getNextPlan(user.adminPlanOverride) : null;
      return {
        subscribed: true,
        planName: user.adminPlanOverride,
        planLabel: plan?.label ?? null,
        limit: plan?.limit ?? null,
        activeCount,
        nextPlan: nextPlan ?? null,
        isPastDue: false,
        isInGrace: false,
        billingInterval: "month",
        trialActive: false,
        trialExpired: false,
        trialDaysLeft: 0,
        trialEndsAt: null,
      };
    }
  }

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
      subscribed: trialActive,
      planName: null,
      planLabel: null,
      limit: null,
      activeCount,
      nextPlan: PLANS[0],
      isPastDue: false,
      isInGrace: false,
      billingInterval: null,
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
      billingInterval: null,
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

  // planName might be "SubDraw Scale Annual" for annual — strip " Annual" suffix for lookup
  const rawPlanName = await getSubscriptionPlanName(user.stripeSubscriptionId);
  const planName = rawPlanName?.replace(/ Annual$/, "") ?? null;
  const plan = planName ? getPlanByName(planName) : null;
  const nextPlan = planName ? getNextPlan(planName) : PLANS[0];
  const billingInterval = await getSubscriptionInterval(user.stripeSubscriptionId);

  return {
    subscribed,
    planName: planName ?? null,
    planLabel: plan?.label ?? null,
    limit: plan?.limit ?? null,
    activeCount,
    nextPlan: nextPlan ?? null,
    isPastDue,
    isInGrace,
    billingInterval: billingInterval ?? null,
    trialActive: false,
    trialExpired: false,
    trialDaysLeft: 0,
    trialEndsAt: null,
  };
}

export async function isGCSubscribed(userId: string): Promise<boolean> {
  const info = await getGCPlanInfo(userId);
  return info.subscribed;
}

// Kept for backward compat
export async function getProPlanPrice() {
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring,
             p.id as product_id, p.name as product_name
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = 'SubDraw Pro' AND pr.active = true AND p.active = true
      LIMIT 1
    `
  );
  return (result.rows[0] as any) ?? null;
}
