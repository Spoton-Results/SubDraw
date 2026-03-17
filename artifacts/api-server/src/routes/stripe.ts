import { Router } from "express";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import {
  getSubscriptionForUser,
  getProPlanPrice,
  updateUserStripeInfo,
  getInvoicesForCustomer,
  getCustomerById,
  isGCSubscribed,
} from "../lib/stripeStorage.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

router.get("/billing", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  const subscription = await getSubscriptionForUser(user.id);

  let invoices: any[] = [];
  if (dbUser?.stripeCustomerId) {
    invoices = await getInvoicesForCustomer(dbUser.stripeCustomerId);
  }

  res.json({ subscription, invoices, stripeCustomerId: dbUser?.stripeCustomerId ?? null });
});

router.post("/checkout", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  const proPlanPrice = await getProPlanPrice();
  if (!proPlanPrice) {
    res.status(500).json({ error: "Subscription plan not found. Please contact support." });
    return;
  }

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
    line_items: [{ price: proPlanPrice.price_id, quantity: 1 }],
    mode: "subscription",
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?cancelled=1`,
  });

  res.json({ url: session.url });
});

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

router.get("/subscription-status", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "GC") {
    res.json({ subscribed: true, plan: "free" });
    return;
  }

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!dbUser?.stripeSubscriptionId) {
    res.json({ subscribed: false, plan: null, subscription: null });
    return;
  }

  const subscribed = await isGCSubscribed(user.id);
  const subscription = await getSubscriptionForUser(user.id);
  res.json({ subscribed, plan: "pro", subscription });
});

export default router;
