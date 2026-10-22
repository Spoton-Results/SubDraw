import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { invoicesTable, subcontractsTable, projectsTable, usersTable, gcProjectAssignmentsTable, paymentAttemptsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { paymentAmounts, canRetryUnresolvedAttempt, attemptMatches } from "../lib/paymentAttemptPolicy.js";

const router = Router();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class PaymentHold extends Error {
  constructor(public code: string, message: string) { super(message); }
}
async function reserve(tx: Tx, invoiceId: string, actorId: string) {
  const [invoice] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1).for("update");
  if (!invoice) throw new PaymentHold("NOT_FOUND", "Invoice not available");
  const [actor] = await tx.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
  if (!actor || actor.role !== "GC" || actor.pausedAt || actor.isDemo) throw new PaymentHold("FORBIDDEN", "Payment access denied");
  const isOwner = !actor.gcParentId && (actor.gcTeamRole === null || actor.gcTeamRole === "owner");
  const isManager = !!actor.gcParentId && actor.gcTeamRole === "project_manager";
  if (!isOwner && !isManager) throw new PaymentHold("FORBIDDEN", "Payment access requires an owner or assigned project manager");
  const [sc] = await tx.select().from(subcontractsTable).where(eq(subcontractsTable.id, invoice.subcontractId)).limit(1);
  if (!sc) throw new PaymentHold("NOT_FOUND", "Subcontract not available");
  const [project] = await tx.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== (actor.gcParentId ?? actor.id)) throw new PaymentHold("NOT_FOUND", "Invoice not available");
  if (project.archivedAt) throw new PaymentHold("ARCHIVED", "Project is archived");
  if (isManager) {
    const [assignment] = await tx.select().from(gcProjectAssignmentsTable).where(and(eq(gcProjectAssignmentsTable.projectId, project.id), eq(gcProjectAssignmentsTable.teamMemberUserId, actor.id))).limit(1);
    const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
    if (!assignment || !owner || owner.role !== "GC" || owner.pausedAt || owner.isDemo) throw new PaymentHold("FORBIDDEN", "Project payment access denied");
  }
  const [sub] = await tx.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
  if (!sub || sub.role !== "SUB" || !sub.stripeConnectAccountId || sub.paymentAccountStatus !== "ACTIVE") throw new PaymentHold("ACCOUNT_NOT_READY", "Subcontractor payment account is not active");
  let amounts;
  try { amounts = paymentAmounts(invoice.amount, invoice.retentionAmount ?? 0); }
  catch (error) { throw new PaymentHold("AMOUNT_REVIEW", error instanceof Error ? error.message : "Invalid payment amount"); }
  const [existing] = await tx.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.invoiceId, invoice.id)).limit(1);
  if (existing) {
    if (!["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(invoice.status)) throw new PaymentHold("INVOICE_REVIEW", "Invoice requires review before retrying payment");
    if (existing.baseCents !== amounts.base || existing.feeCents !== amounts.fee || existing.subcontractId !== sc.id || existing.subId !== sub.id || existing.ownerId !== project.gcId || existing.stripeAccountId !== sub.stripeConnectAccountId) throw new PaymentHold("SNAPSHOT_CHANGED", "Invoice or payment account changed; manual reconciliation required");
    if (invoice.stripePaymentIntentId && existing.stripePaymentIntentId && invoice.stripePaymentIntentId !== existing.stripePaymentIntentId) throw new PaymentHold("PAYMENT_MISMATCH", "Payment references require reconciliation");
    return { ...existing, stripePaymentIntentId: existing.stripePaymentIntentId ?? invoice.stripePaymentIntentId };
  }
  if (invoice.status !== "APPROVED" || invoice.stripePaymentIntentId) throw new PaymentHold("LEGACY_OR_UNAPPROVED", "Invoice is unapproved or has a legacy payment; review before proceeding");
  const [created] = await tx.insert(paymentAttemptsTable).values({
    invoiceId: invoice.id, idempotencyKey: `subdraw-payment:${randomUUID()}`,
    subcontractId: sc.id, subId: sub.id, ownerId: project.gcId, initiatorId: actor.id,
    stripeAccountId: sub.stripeConnectAccountId, baseCents: amounts.base, feeCents: amounts.fee,
  }).returning();
  return created;
}
router.post("/create-payment-intent", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const identity = (req as any).user;
  if (identity.impersonatedBy) { res.status(403).json({ error: "Impersonated sessions cannot initiate payments" }); return; }
  const invoiceId = req.body?.invoiceId;
  if (typeof invoiceId !== "string" || !invoiceId.trim()) { res.status(400).json({ error: "invoiceId required" }); return; }
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey?.startsWith("pk_")) { res.status(503).json({ error: "Stripe publishable key is not configured" }); return; }
  try {
    const attempt = await db.transaction(tx => reserve(tx, invoiceId, identity.id));
    const stripe = await getUncachableStripeClient();
    if (!attempt.stripePaymentIntentId && !canRetryUnresolvedAttempt(attempt.createdAt)) throw new PaymentHold("UNRESOLVED_ATTEMPT", "Old payment attempt has an unknown outcome. Manual Stripe reconciliation is required; no new payment was created.");
    const options = { stripeAccount: attempt.stripeAccountId };
    const pi = attempt.stripePaymentIntentId
      ? await stripe.paymentIntents.retrieve(attempt.stripePaymentIntentId, {}, options)
      : await stripe.paymentIntents.create({
        amount: attempt.baseCents + attempt.feeCents, currency: "usd",
        application_fee_amount: attempt.feeCents, automatic_payment_methods: { enabled: true },
        metadata: {
          invoiceId: attempt.invoiceId, subcontractId: attempt.subcontractId,
          gcId: attempt.initiatorId, subId: attempt.subId, attemptKey: attempt.idempotencyKey,
          baseInvoiceAmount: String(attempt.baseCents), processingComplianceFee: String(attempt.feeCents), totalCharged: String(attempt.baseCents + attempt.feeCents),
        },
      }, { ...options, idempotencyKey: attempt.idempotencyKey });
    if (!attemptMatches(attempt, pi)) throw new PaymentHold("PAYMENT_MISMATCH", "Stripe payment does not match the reserved attempt");
    await db.transaction(async tx => {
      const current = await reserve(tx, invoiceId, identity.id);
      if (current.idempotencyKey !== attempt.idempotencyKey || !attemptMatches(current, pi)) throw new PaymentHold("PAYMENT_MISMATCH", "Payment attempt changed; manual reconciliation required");
      await tx.update(paymentAttemptsTable).set({ stripePaymentIntentId: pi.id }).where(eq(paymentAttemptsTable.invoiceId, invoiceId));
      await tx.update(invoicesTable).set({ stripePaymentIntentId: pi.id, updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId));
    });
    if (pi.status === "succeeded" || pi.status === "processing") throw new PaymentHold("PAYMENT_ALREADY_IN_PROGRESS", "Payment has already succeeded or is processing. Do not create another payment; wait for reconciliation.");
    if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status) || !pi.client_secret) throw new PaymentHold("PAYMENT_REVIEW", "Existing payment cannot be retried automatically. Manual review is required.");
    res.json({ clientSecret: pi.client_secret, stripeConnectAccountId: attempt.stripeAccountId, publishableKey, paymentIntentId: pi.id, paymentIntentStatus: pi.status });
  } catch (error) {
    if (error instanceof PaymentHold) {
      res.status(error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409).json({ error: error.message, code: error.code });
      return;
    }
    console.error("[payment-attempt] Operation incomplete", error instanceof Error ? error.message : "Unknown error");
    res.status(503).json({ error: "Payment setup is incomplete. Retry this invoice; do not create another invoice to bypass the payment hold." });
  }
});
export default router;
