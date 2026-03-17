import { Router } from "express";
import { db } from "@workspace/db";
import { subcontractsTable, changeOrdersTable, invoicesTable, projectsTable, usersTable, projectMembersTable, activityLogsTable } from "@workspace/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import {
  sendChangeOrderCreatedEmail,
  sendChangeOrderDecisionEmail,
  sendInvoiceSubmittedEmail,
  sendInvoiceFlaggedEmail,
  sendInvoiceDecisionEmail,
} from "../lib/email.js";
import { generateInvoicePDF, type InvoicePDFData } from "../lib/pdfInvoice.js";

const router = Router();

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

async function logActivity(subcontractId: string, type: string, description: string, actorName: string, actorRole: string) {
  await db.insert(activityLogsTable).values({ subcontractId, type, description, actorName, actorRole }).catch(err =>
    console.error("[activity] Failed to log:", err)
  );
}

async function computeScoreboard(subcontractId: string, baseContractAmount: number) {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));

  const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
  const currentApprovedTotal = baseContractAmount + coTotal;
  // approvedTotal: invoices GC has verified (APPROVED) but payment not yet confirmed
  const approvedTotal = invs.filter(i => i.status === "APPROVED").reduce((s, i) => s + i.amount, 0);
  // paidTotal: only invoices the sub has confirmed receiving payment
  const paidTotal = invs.filter(i => i.status === "PAYMENT_CONFIRMED").reduce((s, i) => s + i.amount, 0);
  // invoicedTotal: all invoices in any approved/payment state
  const invoicedTotal = invs.filter(i =>
    ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(i.status)
  ).reduce((s, i) => s + i.amount, 0);
  // remaining: current total minus only confirmed-paid invoices
  const remaining = currentApprovedTotal - paidTotal;
  const hasFlaggedInvoices = invs.some(i => i.status === "FLAGGED" || i.status === "PAYMENT_DISPUTED");
  const sortedInvs = [...invs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastInvoice = sortedInvs[0] ?? null;
  return { base: baseContractAmount, coTotal, currentApprovedTotal, approvedTotal, paidTotal, invoicedTotal, remaining, hasFlaggedInvoices, lastInvoice };
}

async function getSubcontractWithRelations(sc: any) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
  return { ...sc, project: { ...project, gc }, sub };
}

async function buildPdfData(invoice: any, sc: any, scWithRelations: any, scoreboard: any): Promise<InvoicePDFData> {
  return {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      description: invoice.description,
      status: invoice.status,
      flaggedOverAmount: invoice.flaggedOverAmount ?? 0,
      overrideReason: invoice.overrideReason ?? null,
      createdAt: invoice.createdAt,
    },
    subcontract: { id: sc.id, baseContractAmount: sc.baseContractAmount, tradeCategory: sc.tradeCategory ?? null },
    project: {
      name: scWithRelations.project.name,
      address: (scWithRelations.project as any).address ?? null,
    },
    sub: { companyName: scWithRelations.sub.companyName, email: scWithRelations.sub.email },
    gc: { companyName: scWithRelations.project.gc.companyName },
    scoreboard,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let subcontracts: any[];

  if (user.role === "GC") {
    const gcProjects = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.gcId, user.id));
    const projectIds = gcProjects.map(p => p.id);
    if (projectIds.length === 0) {
      res.json([]);
      return;
    }
    const scs = await db.select().from(subcontractsTable).where(inArray(subcontractsTable.projectId, projectIds));
    subcontracts = await Promise.all(scs.map(getSubcontractWithRelations));
  } else {
    const scs = await db.select().from(subcontractsTable).where(eq(subcontractsTable.subId, user.id));
    subcontracts = await Promise.all(scs.map(getSubcontractWithRelations));
  }

  res.json(subcontracts);
});

router.get("/:subcontractId", requireAuth, async (req, res) => {
  const { subcontractId } = req.params;
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) {
    res.status(404).json({ error: "Subcontract not found" });
    return;
  }
  const base = await getSubcontractWithRelations(sc);
  const changeOrders = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount);
  res.json({ ...base, changeOrders, invoices, scoreboard });
});

router.get("/:subcontractId/activity", requireAuth, async (req, res) => {
  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.subcontractId, req.params.subcontractId))
    .orderBy(desc(activityLogsTable.createdAt));
  res.json(logs);
});

router.get("/:subcontractId/change-orders", requireAuth, async (req, res) => {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, req.params.subcontractId));
  res.json(cos);
});

router.post("/:subcontractId/change-orders", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { description, scope, amount } = req.body;
  if (!description || !amount) {
    res.status(400).json({ error: "description and amount are required" });
    return;
  }
  const [co] = await db.insert(changeOrdersTable).values({
    subcontractId: req.params.subcontractId,
    description,
    scope: scope ? String(scope).trim() : null,
    amount: Number(amount),
    status: "PENDING_GC",
  }).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );

  await logActivity(
    req.params.subcontractId,
    "CO_CREATED",
    `Change order "${description}" for $${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} created`,
    user.role === "GC" ? sc.project.gc.companyName : sc.sub.companyName,
    user.role
  );

  sendChangeOrderCreatedEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    description,
    amount: Number(amount),
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendChangeOrderCreatedEmail failed:", err));

  res.status(201).json(co);
});

router.post("/:subcontractId/change-orders/:changeOrderId/approve", requireAuth, requireSub, async (req, res) => {
  const [co] = await db.update(changeOrdersTable).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(changeOrdersTable.id, req.params.changeOrderId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );

  await logActivity(
    req.params.subcontractId,
    "CO_APPROVED",
    `Change order "${co.description}" approved`,
    sc.sub.companyName,
    "SUB"
  );

  sendChangeOrderDecisionEmail({
    toEmail: sc.project.gc.email,
    projectName: sc.project.name,
    subCompanyName: sc.sub.companyName,
    description: co.description,
    amount: co.amount,
    decision: "APPROVED",
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendChangeOrderDecisionEmail failed:", err));

  res.json(co);
});

router.post("/:subcontractId/change-orders/:changeOrderId/reject", requireAuth, requireSub, async (req, res) => {
  const { rejectionReason } = req.body || {};
  const [co] = await db.update(changeOrdersTable).set({
    status: "REJECTED",
    rejectionReason: rejectionReason ? String(rejectionReason).trim() : null,
    updatedAt: new Date(),
  }).where(eq(changeOrdersTable.id, req.params.changeOrderId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );

  await logActivity(
    req.params.subcontractId,
    "CO_REJECTED",
    `Change order "${co.description}" rejected${rejectionReason ? ` — ${String(rejectionReason).trim()}` : ""}`,
    sc.sub.companyName,
    "SUB"
  );

  sendChangeOrderDecisionEmail({
    toEmail: sc.project.gc.email,
    projectName: sc.project.name,
    subCompanyName: sc.sub.companyName,
    description: co.description,
    amount: co.amount,
    decision: "REJECTED",
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendChangeOrderDecisionEmail failed:", err));

  res.json(co);
});

router.get("/:subcontractId/invoices", requireAuth, async (req, res) => {
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, req.params.subcontractId));
  res.json(invs);
});

router.get("/:subcontractId/invoices/:invoiceId/pdf", requireAuth, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const scWithRelations = await getSubcontractWithRelations(sc);
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount);
  const pdfData = await buildPdfData(invoice, sc, scWithRelations, scoreboard);
  const pdfBuffer = await generateInvoicePDF(pdfData);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(pdfBuffer);
});

router.post("/:subcontractId/invoices", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { amount, invoiceNumber, description } = req.body;
  if (!amount || isNaN(Number(amount))) {
    res.status(400).json({ error: "amount is required" });
    return;
  }
  if (!invoiceNumber || !String(invoiceNumber).trim()) {
    res.status(400).json({ error: "invoiceNumber is required" });
    return;
  }
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) {
    res.status(404).json({ error: "Subcontract not found" });
    return;
  }
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount);
  const invoiceAmount = Number(amount);
  let status = "PENDING";
  let flaggedOverAmount = 0;
  if (invoiceAmount > scoreboard.remaining) {
    status = "FLAGGED";
    flaggedOverAmount = invoiceAmount - scoreboard.remaining;
  }
  const [invoice] = await db.insert(invoicesTable).values({
    subcontractId,
    invoiceNumber: String(invoiceNumber).trim(),
    amount: invoiceAmount,
    description: description ? String(description).trim() : null,
    status,
    flaggedOverAmount,
  }).returning();

  const scWithRelations = await getSubcontractWithRelations(sc);
  const appUrl = getAppUrl(req);

  const actorName = user.role === "GC" ? scWithRelations.project.gc.companyName : scWithRelations.sub.companyName;
  const flagNote = status === "FLAGGED" ? " (flagged — exceeds contract balance)" : "";
  await logActivity(
    subcontractId,
    status === "FLAGGED" ? "INVOICE_FLAGGED" : "INVOICE_SUBMITTED",
    `Invoice #${String(invoiceNumber).trim()} for $${invoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} submitted${flagNote}`,
    actorName,
    user.role
  );

  // Generate PDF and email to GC asynchronously
  (async () => {
    try {
      const pdfData = await buildPdfData(invoice, sc, scWithRelations, scoreboard);
      const pdfBuffer = await generateInvoicePDF(pdfData);
      if (status === "FLAGGED") {
        await sendInvoiceFlaggedEmail({
          toEmail: scWithRelations.project.gc.email,
          projectName: scWithRelations.project.name,
          subCompanyName: scWithRelations.sub.companyName,
          invoiceAmount,
          approvedTotal: scoreboard.currentApprovedTotal,
          overAmount: flaggedOverAmount,
          invoiceNumber: String(invoiceNumber).trim(),
          appUrl,
          pdfBuffer,
        });
      } else {
        await sendInvoiceSubmittedEmail({
          toEmail: scWithRelations.project.gc.email,
          projectName: scWithRelations.project.name,
          subCompanyName: scWithRelations.sub.companyName,
          amount: invoiceAmount,
          invoiceNumber: String(invoiceNumber).trim(),
          appUrl,
          pdfBuffer,
        });
      }
    } catch (err) {
      console.error("[email+pdf] Invoice submission email failed:", err);
    }
  })();

  res.status(201).json(invoice);
});

router.delete("/:subcontractId/invoices/:invoiceId", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const { invoiceId, subcontractId } = req.params;
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (invoice.status !== "PENDING") {
    res.status(400).json({ error: "Only PENDING invoices can be cancelled" });
    return;
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, invoiceId));

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0]
  );
  await logActivity(
    subcontractId,
    "INVOICE_CANCELLED",
    `Invoice #${invoice.invoiceNumber} cancelled`,
    sc.sub.companyName,
    "SUB"
  );

  res.status(204).send();
});

router.post("/:subcontractId/invoices/:invoiceId/approve", requireAuth, requireGC, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const [invoice] = await db.update(invoicesTable).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId)).returning();

  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount);

  await logActivity(
    subcontractId,
    "INVOICE_APPROVED",
    `Invoice #${invoice.invoiceNumber} for $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} approved`,
    sc.project.gc.companyName,
    "GC"
  );

  const appUrl = getAppUrl(req);
  (async () => {
    try {
      const pdfData = await buildPdfData(invoice, rawSc, sc, scoreboard);
      const pdfBuffer = await generateInvoicePDF(pdfData);
      await sendInvoiceDecisionEmail({
        toEmail: sc.sub.email,
        projectName: sc.project.name,
        gcCompanyName: sc.project.gc.companyName,
        amount: invoice.amount,
        invoiceNumber: invoice.invoiceNumber,
        decision: "APPROVED",
        appUrl,
        pdfBuffer,
      });
    } catch (err) {
      console.error("[email+pdf] Invoice approval email failed:", err);
    }
  })();

  res.json(invoice);
});

router.post("/:subcontractId/invoices/:invoiceId/reject", requireAuth, requireGC, async (req, res) => {
  const [invoice] = await db.update(invoicesTable).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(invoicesTable.id, req.params.invoiceId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );

  await logActivity(
    req.params.subcontractId,
    "INVOICE_REJECTED",
    `Invoice #${invoice.invoiceNumber} for $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} rejected`,
    sc.project.gc.companyName,
    "GC"
  );

  sendInvoiceDecisionEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    gcCompanyName: sc.project.gc.companyName,
    amount: invoice.amount,
    decision: "REJECTED",
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendInvoiceDecisionEmail failed:", err));

  res.json(invoice);
});

router.post("/:subcontractId/invoices/:invoiceId/override", requireAuth, requireGC, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const { overrideReason } = req.body;
  if (!overrideReason) {
    res.status(400).json({ error: "overrideReason is required" });
    return;
  }
  const [invoice] = await db.update(invoicesTable).set({ status: "APPROVED", overrideReason, updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId)).returning();

  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount);

  await logActivity(
    subcontractId,
    "INVOICE_OVERRIDDEN",
    `Invoice #${invoice.invoiceNumber} overridden and approved — ${overrideReason}`,
    sc.project.gc.companyName,
    "GC"
  );

  const appUrl = getAppUrl(req);
  (async () => {
    try {
      const pdfData = await buildPdfData(invoice, rawSc, sc, scoreboard);
      const pdfBuffer = await generateInvoicePDF(pdfData);
      await sendInvoiceDecisionEmail({
        toEmail: sc.sub.email,
        projectName: sc.project.name,
        gcCompanyName: sc.project.gc.companyName,
        amount: invoice.amount,
        invoiceNumber: invoice.invoiceNumber,
        decision: "APPROVED",
        overrideReason,
        appUrl,
        pdfBuffer,
      });
    } catch (err) {
      console.error("[email+pdf] Invoice override email failed:", err);
    }
  })();

  res.json(invoice);
});

// Mark invoice as paid (GC only) — sets status to PAYMENT_UNCONFIRMED
router.post("/:subcontractId/invoices/:invoiceId/pay", requireAuth, requireGC, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const { paymentDate, paymentMethod, paymentReference, paymentNotes } = req.body;
  const gcUser = (req as any).user;

  if (!paymentDate || !paymentMethod) {
    res.status(400).json({ error: "paymentDate and paymentMethod are required" });
    return;
  }

  const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "APPROVED") {
    res.status(400).json({ error: "Only APPROVED invoices can be marked as paid" });
    return;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set({ status: "PAYMENT_UNCONFIRMED", paymentDate, paymentMethod, paymentReference: paymentReference ?? null, paymentNotes: paymentNotes ?? null, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  const rawSc = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).then(r => r[0]);
  const sc = await getSubcontractWithRelations(rawSc);
  await logActivity(subcontractId, "INVOICE_PAYMENT_UNCONFIRMED", `Invoice #${invoice.invoiceNumber} marked as paid via ${paymentMethod} on ${paymentDate} — awaiting sub confirmation`, gcUser.companyName, "GC");

  res.json(invoice);
});

// Sub confirms they received payment — sets status to PAYMENT_CONFIRMED
router.post("/:subcontractId/invoices/:invoiceId/confirm-payment", requireAuth, requireSub, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const subUser = (req as any).user;

  const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PAYMENT_UNCONFIRMED") {
    res.status(400).json({ error: "Only invoices with PAYMENT_UNCONFIRMED status can be confirmed" });
    return;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set({ status: "PAYMENT_CONFIRMED", updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  await logActivity(subcontractId, "INVOICE_PAYMENT_CONFIRMED", `Invoice #${invoice.invoiceNumber} payment confirmed by ${subUser.companyName}`, subUser.companyName, "SUB");
  res.json(invoice);
});

// Sub disputes that payment was received — sets status to PAYMENT_DISPUTED
router.post("/:subcontractId/invoices/:invoiceId/dispute-payment", requireAuth, requireSub, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const subUser = (req as any).user;

  const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PAYMENT_UNCONFIRMED") {
    res.status(400).json({ error: "Only invoices with PAYMENT_UNCONFIRMED status can be disputed" });
    return;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set({ status: "PAYMENT_DISPUTED", updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  await logActivity(subcontractId, "INVOICE_PAYMENT_DISPUTED", `Invoice #${invoice.invoiceNumber} payment disputed by ${subUser.companyName}`, subUser.companyName, "SUB");
  res.json(invoice);
});

export default router;
