import { Router } from "express";
import { requireAuth, requireGCOwner } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import {
  getSubscriptionForUser,
  getSubscriptionPlanName,
  getOrCreatePlanPrice,
  getOrCreateAnnualPlanPrice,
  updateUserStripeInfo,
  getInvoicesForCustomer,
  getCustomerById,
  getGCPlanInfo,
  getActiveProjectsWithSubcontractCounts,
  PLANS,
  getPlanByName,
  type PlanName,
} from "../lib/stripeStorage.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

function stripeErrorMessage(err: any, fallback = "Stripe checkout failed") {
  return err?.raw?.message || err?.message || err?.error?.message || fallback;
}

// ── GET /billing ─────────────────────────────────────────────────────────────

router.get("/billing", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;

  if (user.isDemo) {
    res.json({ subscription: null, invoices: [], stripeCustomerId: null, planName: "Demo", planLabel: "Demo Account", limit: null, activeCount: 0, nextPlan: null, isPastDue: false, isInGrace: false, trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndsAt: null, billingInterval: null, projectsBreakdown: [], nextChargeAmount: null, annualRenewsAt: null });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  const planInfo = await getGCPlanInfo(user.id);

  // Clear stale test-mode Stripe IDs
  if (dbUser?.stripeCustomerId) {
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.customers.retrieve(dbUser.stripeCustomerId);
    } catch {
      await db.update(usersTable).set({ stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      dbUser.stripeCustomerId = null as any;
      dbUser.stripeSubscriptionId = null as any;
    }
  }

  const subscription = await getSubscriptionForUser(user.id);

  let invoices: any[] = [];
  if (dbUser?.stripeCustomerId) {
    invoices = await getInvoicesForCustomer(dbUser.stripeCustomerId);
  }

  // Project breakdown for billing page
  const projectsBreakdown = await getActiveProjectsWithSubcontractCounts(user.id);

  // Next charge amount from upcoming invoice
  let nextChargeAmount: number | null = null;
  let annualRenewsAt: string | null = null;
  if (dbUser?.stripeCustomerId && subscription) {
    try {
      const stripe = await getUncachableStripeClient();
      const upcoming = await stripe.invoices.retrieveUpcoming({ customer: dbUser.stripeCustomerId });
      nextChargeAmount = upcoming.amount_due ?? null;
    } catch {
      // upcoming invoice not available
    }
    if (planInfo.billingInterval === "year" && subscription.current_period_end) {
      annualRenewsAt = new Date(subscription.current_period_end * 1000).toISOString();
    }
  }

  res.json({
    subscription,
    invoices,
    stripeCustomerId: dbUser?.stripeCustomerId ?? null,
    planName: planInfo.planName,
    planLabel: planInfo.planLabel,
    limit: planInfo.limit,
    activeCount: planInfo.activeCount,
    nextPlan: planInfo.nextPlan,
    isPastDue: planInfo.isPastDue,
    isInGrace: planInfo.isInGrace,
    billingInterval: planInfo.billingInterval,
    trialActive: planInfo.trialActive,
    trialExpired: planInfo.trialExpired,
    trialDaysLeft: planInfo.trialDaysLeft,
    trialEndsAt: planInfo.trialEndsAt?.toISOString() ?? null,
    projectsBreakdown,
    nextChargeAmount,
    annualRenewsAt,
  });
});

// ── POST /checkout (monthly) ──────────────────────────────────────────────────

router.post("/checkout", requireAuth, requireGCOwner, async (req, res) => {
  try {
    const user = (req as any).user;
    const { planName } = req.body;

    if (!planName || !getPlanByName(planName)) {
      res.status(400).json({ error: "Invalid plan name." });
      return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    if (!dbUser) {
      res.status(404).json({ error: "User record not found for checkout." });
      return;
    }

    const priceId = await getOrCreatePlanPrice(planName as PlanName);
    const stripe = await getUncachableStripeClient();
    const appUrl = getAppUrl(req);

    let customerId = dbUser.stripeCustomerId;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = null;
        await db.update(usersTable).set({ stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.companyName,
        metadata: { userId: user.id },
      });
      await updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancelled=1`,
    });

    if (!session.url) {
      res.status(500).json({ error: "Stripe did not return a checkout URL." });
      return;
    }

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe-checkout] Error:", err);
    res.status(500).json({ error: `Checkout setup failed: ${stripeErrorMessage(err)}` });
  }
});

// ── POST /annual-checkout ────────────────────────────────────────────────────

router.post("/annual-checkout", requireAuth, requireGCOwner, async (req, res) => {
  try {
    const user = (req as any).user;
    const { planName } = req.body;

    if (!planName || !getPlanByName(planName)) {
      res.status(400).json({ error: "Invalid plan name." });
      return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    if (!dbUser) {
      res.status(404).json({ error: "User record not found for checkout." });
      return;
    }

    const priceId = await getOrCreateAnnualPlanPrice(planName as PlanName);
    const stripe = await getUncachableStripeClient();
    const appUrl = getAppUrl(req);

    let customerId = dbUser.stripeCustomerId;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = null;
        await db.update(usersTable).set({ stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.companyName,
        metadata: { userId: user.id },
      });
      await updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancelled=1`,
    });

    if (!session.url) {
      res.status(500).json({ error: "Stripe did not return a checkout URL." });
      return;
    }

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe-annual-checkout] Error:", err);
    res.status(500).json({ error: `Annual checkout setup failed: ${stripeErrorMessage(err)}` });
  }
});

// ── POST /upgrade ─────────────────────────────────────────────────────────────

router.post("/upgrade", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { planName } = req.body;

  if (!planName || !getPlanByName(planName)) {
    res.status(400).json({ error: "Invalid plan name." });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!dbUser?.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription to upgrade." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const subscription = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
  const existingItemId = subscription.items.data[0]?.id;
  const existingInterval = subscription.items.data[0]?.price?.recurring?.interval ?? "month";

  if (!existingItemId) {
    res.status(400).json({ error: "Could not find subscription item to upgrade." });
    return;
  }

  // Keep the same billing interval when upgrading
  const newPriceId = existingInterval === "year"
    ? await getOrCreateAnnualPlanPrice(planName as PlanName)
    : await getOrCreatePlanPrice(planName as PlanName);

  await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    items: [{ id: existingItemId, price: newPriceId }],
    proration_behavior: "always_invoice",
  });

  res.json({ success: true });
});

// ── POST /switch-billing-interval ────────────────────────────────────────────

router.post("/switch-billing-interval", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { interval } = req.body; // "month" | "year"

  if (interval !== "month" && interval !== "year") {
    res.status(400).json({ error: "interval must be 'month' or 'year'" });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!dbUser?.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription found." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const subscription = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
  const existingItemId = subscription.items.data[0]?.id;
  const existingInterval = subscription.items.data[0]?.price?.recurring?.interval;

  if (!existingItemId) {
    res.status(400).json({ error: "Could not find subscription item." });
    return;
  }

  if (existingInterval === interval) {
    res.json({ success: true, message: "Already on that billing interval." });
    return;
  }

  // Determine the current plan name (strip " Annual" suffix)
  const rawPlanName = await getSubscriptionPlanName(dbUser.stripeSubscriptionId);
  const planName = rawPlanName?.replace(/ Annual$/, "") ?? null;
  if (!planName || !getPlanByName(planName)) {
    res.status(400).json({ error: "Could not determine current plan." });
    return;
  }

  const newPriceId = interval === "year"
    ? await getOrCreateAnnualPlanPrice(planName as PlanName)
    : await getOrCreatePlanPrice(planName as PlanName);

  await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    items: [{ id: existingItemId, price: newPriceId }],
    proration_behavior: "always_invoice",
    billing_cycle_anchor: "now" as any,
  });

  res.json({ success: true });
});

// ── POST /cancel-subscription ─────────────────────────────────────────────────

router.post("/cancel-subscription", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  if (!dbUser?.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription found." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  res.json({ success: true, message: "Subscription will be cancelled at end of billing period." });
});

// ── POST /reactivate-subscription ────────────────────────────────────────────

router.post("/reactivate-subscription", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  if (!dbUser?.stripeSubscriptionId) {
    res.status(400).json({ error: "No subscription found." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  res.json({ success: true });
});

// ── GET /subscription-status ──────────────────────────────────────────────────

router.get("/subscription-status", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "GC") {
    res.json({ subscribed: true, planName: null, planLabel: null, limit: null, activeCount: 0, nextPlan: null, isPastDue: false, billingInterval: null, subscription: null });
    return;
  }
  if (user.isDemo) {
    res.json({ subscribed: true, planName: "Demo", planLabel: "Demo Account", limit: null, activeCount: 0, nextPlan: null, isPastDue: false, isInGrace: false, billingInterval: null, trialActive: false, trialExpired: false, trialDaysLeft: 7, trialEndsAt: null, subscription: null, annualRenewsAt: null });
    return;
  }

  const planInfo = await getGCPlanInfo(user.id);
  const subscription = await getSubscriptionForUser(user.id);

  let annualRenewsAt: string | null = null;
  if (planInfo.billingInterval === "year" && subscription?.current_period_end) {
    annualRenewsAt = new Date(subscription.current_period_end * 1000).toISOString();
  }

  res.json({
    subscribed: planInfo.subscribed,
    planName: planInfo.planName,
    planLabel: planInfo.planLabel,
    limit: planInfo.limit,
    activeCount: planInfo.activeCount,
    nextPlan: planInfo.nextPlan,
    isPastDue: planInfo.isPastDue,
    isInGrace: planInfo.isInGrace,
    billingInterval: planInfo.billingInterval,
    trialActive: planInfo.trialActive,
    trialExpired: planInfo.trialExpired,
    trialDaysLeft: planInfo.trialDaysLeft,
    trialEndsAt: planInfo.trialEndsAt?.toISOString() ?? null,
    subscription,
    annualRenewsAt,
  });
});

export default router;
