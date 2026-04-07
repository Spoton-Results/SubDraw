import express, { Router } from "express";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { db } from "@workspace/db";
import { usersTable, invoicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createNotification } from "./notifications.js";

const router = Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const webhookSecret =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[stripe-connect-webhook] No webhook secret configured");
      res.status(400).json({ error: "Webhook secret not configured" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    let event: any;
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-connect-webhook] Signature verification failed:", err.message);
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    try {
      await handleConnectEvent(event);
    } catch (err: any) {
      console.error("[stripe-connect-webhook] Handler error:", err.message);
    }

    res.status(200).json({ received: true });
  }
);

async function handleConnectEvent(event: any) {
  switch (event.type) {
    case "account.updated": {
      const account = event.data.object;
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.stripeConnectAccountId, account.id));

      if (!user) break;

      if (account.charges_enabled && account.payouts_enabled) {
        if (user.paymentAccountStatus !== "ACTIVE") {
          await db.update(usersTable)
            .set({ paymentAccountStatus: "ACTIVE", stripeOnboardingComplete: true, updatedAt: new Date() })
            .where(eq(usersTable.id, user.id));

          createNotification({
            userId: user.id,
            type: "STRIPE_ACCOUNT_ACTIVE",
            title: "Payment account is now active!",
            body: "Your payment account has been verified. GCs can now pay you directly to your bank account.",
          }).catch(err => console.error("[webhook] active notification failed:", err));
        }
      } else if (account.requirements?.disabled_reason) {
        await db.update(usersTable)
          .set({ paymentAccountStatus: "RESTRICTED", updatedAt: new Date() })
          .where(eq(usersTable.id, user.id));

        createNotification({
          userId: user.id,
          type: "STRIPE_ACCOUNT_RESTRICTED",
          title: "Action required on your payment account",
          body: "Stripe needs more information to verify your account. Please complete your verification to receive payments.",
        }).catch(err => console.error("[webhook] restricted notification failed:", err));
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const subId = pi.metadata?.subId;
      if (!subId) break;

      createNotification({
        userId: subId,
        type: "STRIPE_PAYMENT_SENT",
        title: "Payment has been sent",
        body: "Your GC's payment has been processed. Funds will arrive in your bank account in 2 business days.",
        data: { invoiceId: pi.metadata?.invoiceId ?? "" },
      }).catch(err => console.error("[webhook] payment_intent.succeeded notification failed:", err));
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const gcId = pi.metadata?.gcId;
      if (!gcId) break;

      const failureMessage = pi.last_payment_error?.message ?? "Payment could not be processed";

      createNotification({
        userId: gcId,
        type: "STRIPE_PAYMENT_FAILED",
        title: "Stripe payment failed",
        body: `Payment failed: ${failureMessage}. Please try a different payment method.`,
        data: { invoiceId: pi.metadata?.invoiceId ?? "" },
      }).catch(err => console.error("[webhook] payment_failed notification error:", err));
      break;
    }

    case "payout.paid": {
      break;
    }

    default:
      break;
  }
}

export default router;
