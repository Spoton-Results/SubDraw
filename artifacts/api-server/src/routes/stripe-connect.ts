import { Router } from "express";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { db } from "@workspace/db";
import { usersTable, invoicesTable, subcontractsTable, notificationsTable, activityLogsTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql, desc } from "drizzle-orm";
import { createNotification } from "./notifications.js";
import { sendPaymentRecordedEmail } from "../lib/email.js";

const router = Router();

function getAppUrl(req: any): string {
  return process.env.APP_URL || `https://${(req.hostname as string).split(":")[0]}`;
}

// GET /api/stripe/connect/config — returns publishable key (public, no auth needed)
router.get("/config", async (_req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  res.json({ publishableKey });
});

// POST /api/stripe/connect/create-account — sub creates Stripe Express account
router.post("/create-account", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const appUrl = getAppUrl(req);

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

  const stripe = await getUncachableStripeClient();

  try {
    let accountId = dbUser.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: dbUser.email,
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      } as any);
      accountId = account.id;

      await db.update(usersTable)
        .set({ stripeConnectAccountId: accountId, paymentAccountStatus: "PENDING", updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/account/payment-setup`,
      return_url: `${appUrl}/account/payment-success`,
      type: "account_onboarding",
    } as any);

    res.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("[stripe-connect] create-account error:", err);
    res.status(500).json({ error: err.message || "Failed to create Stripe account" });
  }
});

// GET /api/stripe/connect/check-status — sub checks their own payment account status
router.get("/check-status", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

  if (!dbUser.stripeConnectAccountId) {
    return res.json({ status: "NOT_SETUP", onboardingComplete: false });
  }

  const stripe = await getUncachableStripeClient();
  try {
    const account = await stripe.accounts.retrieve(dbUser.stripeConnectAccountId);

    let newStatus = dbUser.paymentAccountStatus;
    if ((account as any).charges_enabled && (account as any).payouts_enabled) {
      newStatus = "ACTIVE";
      await db.update(usersTable)
        .set({ paymentAccountStatus: "ACTIVE", stripeOnboardingComplete: true, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    } else if ((account as any).requirements?.disabled_reason) {
      newStatus = "RESTRICTED";
      await db.update(usersTable)
        .set({ paymentAccountStatus: "RESTRICTED", updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    res.json({ status: newStatus, onboardingComplete: dbUser.stripeOnboardingComplete });
  } catch (err: any) {
    console.error("[stripe-connect] check-status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/connect/sub-payment-status/:subcontractId — GC checks sub's payment account status
router.get("/sub-payment-status/:subcontractId", requireAuth, requireGC, async (req, res) => {
  const { subcontractId } = req.params;

  const [subcontract] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId));
  if (!subcontract) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [subUser] = await db.select().from(usersTable).where(eq(usersTable.id, subcontract.subId));
  if (!subUser) { res.status(404).json({ error: "Sub user not found" }); return; }

  res.json({
    status: subUser.paymentAccountStatus || "NOT_SETUP",
    subCompanyName: subUser.companyName,
    stripeConnectAccountId: subUser.stripeConnectAccountId ?? null,
  });
});

// POST /api/stripe/connect/create-payment-intent — GC creates Direct Charge PaymentIntent on sub's account
router.post("/create-payment-intent", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { invoiceId } = req.body;

  if (!invoiceId) { res.status(400).json({ error: "invoiceId required" }); return; }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (invoice.status !== "APPROVED") { res.status(400).json({ error: "Invoice must be in APPROVED status" }); return; }

  const [subcontract] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, invoice.subcontractId));
  if (!subcontract) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [subUser] = await db.select().from(usersTable).where(eq(usersTable.id, subcontract.subId));
  if (!subUser?.stripeConnectAccountId) { res.status(400).json({ error: "Sub has not set up a payment account" }); return; }
  if (subUser.paymentAccountStatus !== "ACTIVE") { res.status(400).json({ error: "Sub payment account is not yet active" }); return; }

  const stripe = await getUncachableStripeClient();

  try {
    const amountInCents = Math.round(invoice.amount * 100);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          invoiceId: invoice.id,
          subcontractId: invoice.subcontractId,
          gcId: user.id,
          subId: subUser.id,
        },
      },
      { stripeAccount: subUser.stripeConnectAccountId }
    );

    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

    res.json({
      clientSecret: paymentIntent.client_secret,
      stripeConnectAccountId: subUser.stripeConnectAccountId,
      publishableKey,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error("[stripe-connect] create-payment-intent error:", err);
    res.status(500).json({ error: err.message || "Failed to create payment intent" });
  }
});

// POST /api/stripe/connect/record-payment — GC records confirmed Stripe payment after Stripe.js confirms
router.post("/record-payment", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { invoiceId, paymentIntentId, paymentMethod } = req.body;

  if (!invoiceId || !paymentIntentId) {
    res.status(400).json({ error: "invoiceId and paymentIntentId required" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const [subcontract] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, invoice.subcontractId));
  if (!subcontract) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [gcUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const [subUser] = await db.select().from(usersTable).where(eq(usersTable.id, subcontract.subId));

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const methodLabel = paymentMethod === "ACH" ? "ACH" : "CARD";
  const methodDisplay = paymentMethod === "ACH" ? "Stripe ACH Transfer" : "Stripe Card";

  await db.update(invoicesTable)
    .set({
      stripePaymentIntentId: paymentIntentId,
      stripePaymentMethod: methodLabel,
      stripePaymentInitiatedAt: now,
      status: "PAYMENT_UNCONFIRMED",
      paymentMethod: methodDisplay,
      paymentDate: todayStr,
      paymentReference: paymentIntentId,
      updatedAt: now,
    })
    .where(eq(invoicesTable.id, invoiceId));

  // Activity log
  await db.insert(activityLogsTable).values({
    subcontractId: invoice.subcontractId,
    type: "PAYMENT_RECORDED_STRIPE",
    description: `Payment of $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} initiated via ${methodDisplay} (PaymentIntent: ${paymentIntentId})`,
    actorName: gcUser?.companyName ?? "GC",
    actorRole: "GC",
  });

  // Notify sub in-app
  if (subUser) {
    createNotification({
      userId: subUser.id,
      type: "STRIPE_PAYMENT_INITIATED",
      title: "Your GC has initiated payment",
      body: `Funds of $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} will arrive in your bank account in 2 business days. Please confirm receipt when funds arrive.`,
      data: { subcontractId: invoice.subcontractId, invoiceId: invoice.id },
    }).catch(err => console.error("[stripe-connect] notification failed:", err));

    // Email sub
    sendPaymentRecordedEmail({
      toEmail: subUser.email,
      projectName: (subcontract as any).projectName ?? "your project",
      gcCompanyName: gcUser?.companyName ?? "Your GC",
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      paymentDate: todayStr,
      paymentMethod: methodDisplay,
      paymentReference: paymentIntentId,
      appUrl: getAppUrl(req),
    }).catch(err => console.error("[stripe-connect] email failed:", err));
  }

  res.json({ success: true });
});

// POST /api/stripe/connect/send-reminder/:subcontractId — GC sends setup reminder to sub
router.post("/send-reminder/:subcontractId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [subcontract] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId));
  if (!subcontract?.subId) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [gcUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  createNotification({
    userId: subcontract.subId,
    type: "STRIPE_SETUP_REMINDER",
    title: "Set up your payment account",
    body: `${gcUser?.companyName ?? "Your GC"} wants to pay you via SubDraw. Set up your bank account now to receive payments directly — it only takes 5 minutes.`,
    data: { subcontractId },
  }).catch(err => console.error("[stripe-connect] reminder notification failed:", err));

  res.json({ success: true });
});

// GET /api/stripe/connect/admin-stats — admin Stripe Connect stats
router.get("/admin-stats", requireAdmin, async (req, res) => {
  try {
    const allSubs = await db
      .select({
        id: usersTable.id,
        paymentAccountStatus: usersTable.paymentAccountStatus,
        stripeConnectAccountId: usersTable.stripeConnectAccountId,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "SUB"));

    const totalAccounts = allSubs.filter(s => s.stripeConnectAccountId).length;
    const activeAccounts = allSubs.filter(s => s.paymentAccountStatus === "ACTIVE").length;
    const pendingAccounts = allSubs.filter(s => s.paymentAccountStatus === "PENDING").length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stripePayments = await db
      .select({
        id: invoicesTable.id,
        amount: invoicesTable.amount,
        stripePaymentIntentId: invoicesTable.stripePaymentIntentId,
        stripePaymentMethod: invoicesTable.stripePaymentMethod,
        stripePaymentInitiatedAt: invoicesTable.stripePaymentInitiatedAt,
        invoiceNumber: invoicesTable.invoiceNumber,
        subcontractId: invoicesTable.subcontractId,
      })
      .from(invoicesTable)
      .where(isNotNull(invoicesTable.stripePaymentIntentId))
      .orderBy(desc(invoicesTable.stripePaymentInitiatedAt))
      .limit(100);

    const thisMonthPayments = stripePayments.filter(p =>
      p.stripePaymentInitiatedAt && new Date(p.stripePaymentInitiatedAt) >= startOfMonth
    );

    const totalVolumeThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const successfulTransactions = stripePayments.length;

    const last20 = stripePayments.slice(0, 20);

    const enriched = await Promise.all(last20.map(async (inv) => {
      const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, inv.subcontractId));
      let gcName = "";
      let subName = "";
      if (sc) {
        const [sub] = await db.select({ companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, sc.subId));
        subName = sub?.companyName ?? "";
      }
      return { ...inv, gcName, subName };
    }));

    res.json({
      totalAccounts,
      activeAccounts,
      pendingAccounts,
      totalVolumeThisMonth,
      successfulTransactions,
      failedTransactions: 0,
      last20Transactions: enriched,
    });
  } catch (err: any) {
    console.error("[admin-stats] error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
