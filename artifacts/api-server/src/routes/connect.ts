import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { db } from "@workspace/db";
import { usersTable, subcontractsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function requireSub(req: any, res: any, next: any) {
  if (req.user?.role !== "SUB") {
    res.status(403).json({ error: "Subcontractors only" });
    return;
  }
  next();
}

function requireGC(req: any, res: any, next: any) {
  if (req.user?.role !== "GC") {
    res.status(403).json({ error: "GC only" });
    return;
  }
  next();
}

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

// ── POST /connect/onboard ─────────────────────────────────────────────────────
// Sub calls this to start (or resume) Stripe Express onboarding.
router.post("/onboard", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const stripe = await getUncachableStripeClient();

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }

  let accountId = dbUser.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: dbUser.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "company",
      company: {
        name: dbUser.companyName,
      },
      metadata: {
        subtrackerUserId: user.id,
      },
    });
    accountId = account.id;
    await db.update(usersTable)
      .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
  }

  const appUrl = getAppUrl(req);
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard?connect=refresh`,
    return_url: `${appUrl}/dashboard?connect=success`,
    type: "account_onboarding",
  });

  res.json({ url: accountLink.url });
});

// ── POST /connect/refresh-link ────────────────────────────────────────────────
// Sub calls this if their onboarding link expired (e.g., navigated away).
router.post("/refresh-link", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const stripe = await getUncachableStripeClient();

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser?.stripeConnectAccountId) {
    res.status(400).json({ error: "No Connect account found. Start onboarding first." });
    return;
  }

  const appUrl = getAppUrl(req);
  const accountLink = await stripe.accountLinks.create({
    account: dbUser.stripeConnectAccountId,
    refresh_url: `${appUrl}/dashboard?connect=refresh`,
    return_url: `${appUrl}/dashboard?connect=success`,
    type: "account_onboarding",
  });

  res.json({ url: accountLink.url });
});

// ── GET /connect/status ───────────────────────────────────────────────────────
// Returns the logged-in sub's Connect account status.
router.get("/status", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const stripe = await getUncachableStripeClient();

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser?.stripeConnectAccountId) {
    res.json({ connected: false, payoutsEnabled: false, accountId: null });
    return;
  }

  let payoutsEnabled = false;
  try {
    const account = await stripe.accounts.retrieve(dbUser.stripeConnectAccountId);
    payoutsEnabled = account.payouts_enabled ?? false;

    if (payoutsEnabled !== dbUser.stripeConnectPayoutsEnabled) {
      await db.update(usersTable)
        .set({ stripeConnectPayoutsEnabled: payoutsEnabled, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }
  } catch {
    // Account may have been deleted in Stripe
  }

  res.json({
    connected: true,
    payoutsEnabled,
    accountId: dbUser.stripeConnectAccountId,
  });
});

// ── GET /connect/by-subcontract/:subcontractId ────────────────────────────────
// GC checks whether the sub on a given subcontract has payouts enabled.
router.get("/by-subcontract/:subcontractId", requireAuth, requireGC, async (req, res) => {
  const { subcontractId } = req.params;
  const gcUser = (req as any).user;
  const stripe = await getUncachableStripeClient();

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const gcOwnerId = gcUser.gcParentId ?? gcUser.id;
  if (sc.gcId !== gcOwnerId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [subUser] = await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
  if (!subUser?.stripeConnectAccountId) {
    res.json({ connected: false, payoutsEnabled: false });
    return;
  }

  let payoutsEnabled = subUser.stripeConnectPayoutsEnabled;
  try {
    const account = await stripe.accounts.retrieve(subUser.stripeConnectAccountId);
    payoutsEnabled = account.payouts_enabled ?? false;
    if (payoutsEnabled !== subUser.stripeConnectPayoutsEnabled) {
      await db.update(usersTable)
        .set({ stripeConnectPayoutsEnabled: payoutsEnabled, updatedAt: new Date() })
        .where(eq(usersTable.id, subUser.id));
    }
  } catch {
    // Stripe account not found
  }

  res.json({
    connected: true,
    payoutsEnabled,
    accountId: subUser.stripeConnectAccountId,
    subCompanyName: subUser.companyName,
  });
});

export default router;
