import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, projectsTable, subcontractsTable, invoicesTable, gcProjectAssignmentsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "./requireAuth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router = Router();

type Resource = "invoice" | "subcontract";

function guard(resource: Resource, operation: "read" | "create" | "record" | "remind") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = (req as any).user;
      const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, identity.id)).limit(1);
      if (!actor || actor.role !== "GC" || actor.pausedAt || actor.isDemo || identity.impersonatedBy) {
        res.status(403).json({ error: "Payment access denied" });
        return;
      }
      const isOwner = !actor.gcParentId && (actor.gcTeamRole === null || actor.gcTeamRole === "owner");
      const isManager = !!actor.gcParentId && actor.gcTeamRole === "project_manager";
      if (!isOwner && !isManager) {
        res.status(403).json({ error: "Payment access requires an owner or assigned project manager" });
        return;
      }
      const rawId = resource === "invoice" ? req.body?.invoiceId : req.params.subcontractId;
      if (typeof rawId !== "string" || !rawId.trim()) {
        res.status(400).json({ error: "A valid resource ID is required" });
        return;
      }
      let invoice: typeof invoicesTable.$inferSelect | undefined;
      let subcontractId = rawId;
      if (resource === "invoice") {
        [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, rawId)).limit(1);
        if (!invoice) {
          res.status(404).json({ error: "Resource not found" });
          return;
        }
        subcontractId = invoice.subcontractId;
      }
      const [subcontract] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
      if (!subcontract) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, subcontract.projectId)).limit(1);
      const gcId = actor.gcParentId ?? actor.id;
      if (!project || project.gcId !== gcId) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      if (isManager) {
        const [assignment] = await db.select().from(gcProjectAssignmentsTable).where(and(
          eq(gcProjectAssignmentsTable.projectId, project.id),
          eq(gcProjectAssignmentsTable.teamMemberUserId, actor.id),
        )).limit(1);
        const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, gcId)).limit(1);
        if (!assignment || !owner || owner.role !== "GC" || owner.pausedAt || owner.isDemo) {
          res.status(403).json({ error: "Project payment access denied" });
          return;
        }
      }
      if (operation === "create" || operation === "record") {
        if (project.archivedAt || !invoice) {
          res.status(409).json({ error: "Project is not available for payment" });
          return;
        }
        if (operation === "create") {
          if (invoice.status !== "APPROVED" || invoice.stripePaymentIntentId) {
            res.status(409).json({ error: "Invoice is not available for a new payment" });
            return;
          }
          // The legacy charge handler uses gross invoice amounts. Fail closed until retention-aware charging is implemented.
          if ((invoice.retentionAmount ?? 0) > 0) {
            res.status(409).json({ error: "Retained invoices require retention-aware payment processing" });
            return;
          }
        } else {
          const paymentIntentId = req.body?.paymentIntentId;
          if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_")) {
            res.status(400).json({ error: "A valid paymentIntentId is required" });
            return;
          }
          if (invoice.stripePaymentIntentId && invoice.stripePaymentIntentId !== paymentIntentId) {
            res.status(409).json({ error: "Invoice is already linked to another payment" });
            return;
          }
          if (!["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(invoice.status)) {
            res.status(409).json({ error: "Invoice is not available for payment recording" });
            return;
          }
          const [sub] = await db.select().from(usersTable).where(eq(usersTable.id, subcontract.subId)).limit(1);
          if (!sub?.stripeConnectAccountId) {
            res.status(409).json({ error: "Subcontractor payment account is unavailable" });
            return;
          }
          const base = Math.round(invoice.amount * 100);
          const fee = Math.round(invoice.amount * 0.01 * 100);
          if (!Number.isSafeInteger(base) || !Number.isSafeInteger(base + fee) || base <= 0) {
            res.status(409).json({ error: "Invalid invoice payment amount" });
            return;
          }
          const stripe = await getUncachableStripeClient();
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method"] }, { stripeAccount: sub.stripeConnectAccountId });
          if (pi.status !== "succeeded" || pi.currency !== "usd" || pi.amount !== base + fee || pi.amount_received !== base + fee || pi.application_fee_amount !== fee || pi.metadata.invoiceId !== invoice.id || pi.metadata.subcontractId !== subcontract.id || pi.metadata.subId !== sub.id || pi.metadata.gcId !== actor.id) {
            res.status(409).json({ error: "Stripe payment does not match this invoice or is not successful" });
            return;
          }
          const [existing] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.stripePaymentIntentId, paymentIntentId)).limit(1);
          if (existing && existing.id !== invoice.id) {
            res.status(409).json({ error: "Payment is already associated with another invoice" });
            return;
          }
          if (invoice.stripePaymentIntentId === paymentIntentId && ["PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(invoice.status)) {
            res.json({ success: true });
            return;
          }
          if (invoice.status !== "APPROVED") {
            res.status(409).json({ error: "Invoice is not approved for payment recording" });
            return;
          }
          const method = pi.payment_method;
          req.body.paymentMethod = method && typeof method !== "string" && method.type === "us_bank_account" ? "ACH" : "CARD";
        }
      }
      next();
    } catch (error) {
      console.error("[connect-payment-guard] Verification failed", error instanceof Error ? error.message : "Unknown error");
      res.status(503).json({ error: "Unable to verify payment access or payment status. No payment record was changed by this request." });
    }
  };
}

router.get("/sub-payment-status/:subcontractId", requireAuth, guard("subcontract", "read"));
router.post("/send-reminder/:subcontractId", requireAuth, guard("subcontract", "remind"));
router.post("/create-payment-intent", requireAuth, guard("invoice", "create"));
router.post("/record-payment", requireAuth, guard("invoice", "record"));

export default router;
