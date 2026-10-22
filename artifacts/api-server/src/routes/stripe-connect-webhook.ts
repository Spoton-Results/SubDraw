import express, { Router } from "express";
import type Stripe from "stripe";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createNotification } from "./notifications.js";
import { reconcileConnectPayment } from "../lib/reconcileConnectPayment.js";

const router = Router();
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) { res.status(400).json({ error: "Missing stripe-signature header" }); return; }
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(503).json({ error: "Webhook secret not configured" }); return; }
  let stripe: Stripe;
  try { stripe = await getUncachableStripeClient(); }
  catch { res.status(503).json({ error: "Stripe configuration unavailable" }); return; }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, Array.isArray(signature) ? signature[0] : signature, secret);
  } catch { res.status(400).json({ error: "Webhook signature verification failed" }); return; }
  try {
    if (event.type === "account.updated") {
      const incoming = event.data.object as Stripe.Account;
      if (event.account && event.account !== incoming.id) throw new Error("Account event mismatch");
      const account = await stripe.accounts.retrieve(incoming.id);
      const active = !!account.charges_enabled && !!account.payouts_enabled;
      const status = active ? "ACTIVE" : account.requirements?.disabled_reason ? "RESTRICTED" : "PENDING";
      await db.update(usersTable).set({
        paymentAccountStatus: status, stripeOnboardingComplete: active,
        stripeConnectPayoutsEnabled: !!account.payouts_enabled, updatedAt: new Date(),
      }).where(eq(usersTable.stripeConnectAccountId, account.id));
    } else if (["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type)) {
      const result = await reconcileConnectPayment(event, stripe);
      if (result?.notifySuccess) {
        await createNotification({ userId: result.subId, type: "STRIPE_PAYMENT_SENT",
          title: "Payment processed by Stripe",
          body: "Stripe reports this payment succeeded. Bank payout timing is separate; confirm receipt when funds arrive.",
          data: { invoiceId: result.invoiceId },
        }).catch(error => console.error("[connect-webhook] Notification delivery failed", error));
      }
      if (result?.notifyFailure) {
        await createNotification({ userId: result.gcId, type: "STRIPE_PAYMENT_FAILED",
          title: "Payment needs attention", body: "Stripe reports that this payment needs a new payment method. Review the payment before retrying.",
          data: { invoiceId: result.invoiceId },
        }).catch(error => console.error("[connect-webhook] Notification delivery failed", error));
      }
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[connect-webhook] Reconciliation failed", error instanceof Error ? error.message : "Unknown error");
    res.status(503).json({ error: "Webhook processing incomplete; retry required" });
  }
});
export default router;
