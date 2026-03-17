import { Router } from "express";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import {
  getSubscriptionForUser,
  getSubscriptionPlanName,
  getOrCreatePlanPrice,
  updateUserStripeInfo,
  getInvoicesForCustomer,
  getCustomerById,
  getGCPlanInfo,
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

// ── GET /billing ─────────────────────────────────────────────────────────────

router.get("/billing", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;

  if (user.isDemo) {
    res.json({ subscription: null, invoices: [], stripeCustomerId: null, planName: "Demo", planLabel: "Demo Account", limit: null, activeCount: 0, nextPlan: null, isPastDue: false, isInGrace: false, trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndsAt: null });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  const subscription = await getSubscriptionForUser(user.id);
  const planInfo = await getGCPlanInfo(user.id);

  let invoices: any[] = [];
  if (dbUser?.stripeCustomerId) {
    invoices = await getInvoicesForCustomer(dbUser.stripeCustomerId);
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
    trialActive: planInfo.trialActive,
    trialExpired: planInfo.trialExpired,
    trialDaysLeft: planInfo.trialDaysLeft,
    trialEndsAt: planInfo.trialEndsAt?.toISOString() ?? null,
  });
});

// ── POST /checkout ────────────────────────────────────────────────────────────

router.post("/checkout", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { planName } = req.body;

  if (!planName || !getPlanByName(planName)) {
    res.status(400).json({ error: "Invalid plan name. Choose Starter, Growth, or Scale." });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const priceId = await getOrCreatePlanPrice(planName as PlanName);
  const stripe = await getUncachableStripeClient();
  const appUrl = getAppUrl(req);

  let customerId = dbUser?.stripeCustomerId;
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

  res.json({ url: session.url });
});

// ── POST /upgrade ─────────────────────────────────────────────────────────────

router.post("/upgrade", requireAuth, requireGC, async (req, res) => {
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
  const newPriceId = await getOrCreatePlanPrice(planName as PlanName);
  const existingItemId = subscription.items.data[0]?.id;

  if (!existingItemId) {
    res.status(400).json({ error: "Could not find subscription item to upgrade." });
    return;
  }

  await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
    items: [{ id: existingItemId, price: newPriceId }],
    proration_behavior: "always_invoice",
  });

  res.json({ success: true });
});

// ── POST /cancel-subscription ─────────────────────────────────────────────────

router.post("/cancel-subscription", requireAuth, requireGC, async (req, res) => {
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

router.post("/reactivate-subscription", requireAuth, requireGC, async (req, res) => {
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
    res.json({ subscribed: true, planName: null, planLabel: null, limit: null, activeCount: 0, nextPlan: null, isPastDue: false, subscription: null });
    return;
  }
  if (user.isDemo) {
    res.json({ subscribed: true, planName: "Demo", planLabel: "Demo Account", limit: null, activeCount: 0, nextPlan: null, isPastDue: false, isInGrace: false, trialActive: false, trialExpired: false, trialDaysLeft: 14, trialEndsAt: null, subscription: null });
    return;
  }

  const planInfo = await getGCPlanInfo(user.id);
  const subscription = await getSubscriptionForUser(user.id);

  res.json({
    subscribed: planInfo.subscribed,
    planName: planInfo.planName,
    planLabel: planInfo.planLabel,
    limit: planInfo.limit,
    activeCount: planInfo.activeCount,
    nextPlan: planInfo.nextPlan,
    isPastDue: planInfo.isPastDue,
    isInGrace: planInfo.isInGrace,
    trialActive: planInfo.trialActive,
    trialExpired: planInfo.trialExpired,
    trialDaysLeft: planInfo.trialDaysLeft,
    trialEndsAt: planInfo.trialEndsAt?.toISOString() ?? null,
    subscription,
  });
});

export default router;
