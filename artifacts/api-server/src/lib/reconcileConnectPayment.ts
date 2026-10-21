import type Stripe from "stripe";
import { db } from "@workspace/db";
import { usersTable, projectsTable, subcontractsTable, invoicesTable, activityLogsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { paymentMatches, reconciledInvoiceStatus } from "./paymentReconciliation.js";

export async function reconcileConnectPayment(event: Stripe.Event, stripe: Stripe) {
  const object = event.data.object as Stripe.PaymentIntent;
  if (!object.metadata?.invoiceId) return null;
  if (!event.account || !object.id?.startsWith("pi_")) throw new Error("Missing connected payment account");
  const accountId = event.account;
  const pi = await stripe.paymentIntents.retrieve(object.id, { expand: ["payment_method"] }, { stripeAccount: accountId });
  const invoiceId = pi.metadata.invoiceId;
  if (!invoiceId) throw new Error("Payment invoice metadata missing");
  return db.transaction(async tx => {
    await tx.execute(sql`select id from invoices where id = ${invoiceId} for update`);
    const receiptId = `stripe-event:${event.id}`;
    const [receipt] = await tx.select({ id: activityLogsTable.id }).from(activityLogsTable).where(eq(activityLogsTable.id, receiptId)).limit(1);
    if (receipt) return null;
    const [invoice] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!invoice) throw new Error("Payment invoice not found");
    const [sc] = await tx.select().from(subcontractsTable).where(eq(subcontractsTable.id, invoice.subcontractId)).limit(1);
    if (!sc) throw new Error("Payment subcontract not found");
    const [project] = await tx.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
    const [sub] = await tx.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    const [issuer] = await tx.select().from(usersTable).where(eq(usersTable.id, pi.metadata.gcId ?? "")).limit(1);
    if (!project || !sub?.stripeConnectAccountId || !issuer || issuer.role !== "GC" || (issuer.gcParentId ?? issuer.id) !== project.gcId) throw new Error("Payment organization mismatch");
    if (!paymentMatches({ invoiceId, subcontractId: sc.id, subId: sub.id, accountId: sub.stripeConnectAccountId, amount: invoice.amount, intentId: invoice.stripePaymentIntentId }, pi, accountId)) throw new Error("Payment account, amount, fee, or invoice mismatch");
    const nextStatus = reconciledInvoiceStatus(invoice.status, pi.status);
    if (pi.status === "succeeded" && !["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED", "PAYMENT_DISPUTED"].includes(invoice.status)) throw new Error("Successful payment requires manual invoice review");
    await tx.insert(activityLogsTable).values({
      id: receiptId, subcontractId: sc.id, type: "STRIPE_EVENT_RECONCILED",
      description: `${event.type}: ${pi.id}; current Stripe status ${pi.status}; invoice ${invoice.status} -> ${nextStatus}`,
      actorName: "Stripe webhook", actorRole: "SYSTEM",
    });
    if (pi.status === "succeeded") {
      const method = pi.payment_method;
      const ach = !!method && typeof method !== "string" && method.type === "us_bank_account";
      const now = new Date();
      await tx.update(invoicesTable).set({
        stripePaymentIntentId: pi.id,
        stripePaymentMethod: ach ? "ACH" : "CARD",
        stripePaymentInitiatedAt: invoice.stripePaymentInitiatedAt ?? new Date(pi.created * 1000),
        paymentReference: pi.id,
        paymentMethod: ach ? "Stripe ACH Transfer" : "Stripe Card",
        paymentDate: invoice.paymentDate ?? now.toISOString().slice(0, 10),
        status: nextStatus, updatedAt: now,
      }).where(eq(invoicesTable.id, invoice.id));
    }
    return {
      invoiceId, subId: sub.id, gcId: project.gcId,
      notifySuccess: invoice.status === "APPROVED" && nextStatus === "PAYMENT_UNCONFIRMED",
      notifyFailure: event.type === "payment_intent.payment_failed" && pi.status === "requires_payment_method",
    };
  });
}
