import { Router } from "express";
import { db } from "@workspace/db";
import { subcontractsTable, changeOrdersTable, invoicesTable, projectsTable, usersTable, projectMembersTable, activityLogsTable, lienWaiversTable, subProfilesTable, subcontractInsurancesTable } from "@workspace/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import {
  sendChangeOrderCreatedEmail,
  sendChangeOrderSubmittedBySubEmail,
  sendChangeOrderDecisionEmail,
  sendInvoiceSubmittedEmail,
  sendInvoiceFlaggedEmail,
  sendInvoiceDecisionEmail,
  sendPaymentRecordedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentDisputedEmail,
} from "../lib/email.js";
import { generateInvoicePDF, type InvoicePDFData } from "../lib/pdfInvoice.js";
import { generateLienWaiverPDF } from "../lib/pdfLienWaiver.js";

const router = Router();

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

async function logActivity(subcontractId: string, type: string, description: string, actorName: string, actorRole: string) {
  await db.insert(activityLogsTable).values({ subcontractId, type, description, actorName, actorRole }).catch(err =>
    console.error("[activity] Failed to log:", err)
  );
}

async function computeScoreboard(subcontractId: string, baseContractAmount: number, retentionPercentage: number = 0) {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));

  const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
  const currentApprovedTotal = baseContractAmount + coTotal;

  // Approved non-retention invoices (GC approved, not released retention)
  const approvedTotal = invs.filter(i => i.status === "APPROVED").reduce((s, i) => s + i.amount, 0);
  // Confirmed paid by sub
  const paidTotal = invs.filter(i => i.status === "PAYMENT_CONFIRMED").reduce((s, i) => s + i.amount, 0);
  // Gross invoiced: all approved/payment-state invoices (total billed by sub before retention)
  const grossInvoiced = invs.filter(i =>
    ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(i.status)
  ).reduce((s, i) => s + i.amount, 0);
  // invoicedTotal is the same as grossInvoiced (kept for compat)
  const invoicedTotal = grossInvoiced;

  // Retention calculations (only for non-retention-release invoices that have been approved/paid)
  const totalRetentionHeld = invs
    .filter(i =>
      !i.isRetentionRelease &&
      ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(i.status) &&
      i.retentionAmount != null
    )
    .reduce((s, i) => s + (i.retentionAmount ?? 0), 0);

  // Net paid = gross invoiced minus retention held (actual economic value paid to sub)
  const netPaid = grossInvoiced - totalRetentionHeld;

  // Retention released = any approved/payment retention-release invoices
  const retentionReleased = invs
    .filter(i => i.isRetentionRelease && ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(i.status))
    .reduce((s, i) => s + i.amount, 0);
  const retentionBalance = Math.max(0, totalRetentionHeld - retentionReleased);

  // remaining: approved total minus net paid (requirement: approved total minus net paid, not gross invoiced)
  const remaining = currentApprovedTotal - netPaid;

  const hasFlaggedInvoices = invs.some(i => i.status === "FLAGGED" || i.status === "PAYMENT_DISPUTED");
  const sortedInvs = [...invs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastInvoice = sortedInvs[0] ?? null;

  return {
    base: baseContractAmount,
    coTotal,
    currentApprovedTotal,
    approvedTotal,
    paidTotal,
    invoicedTotal,
    grossInvoiced,
    totalRetentionHeld,
    netPaid,
    retentionBalance,
    remaining,
    hasFlaggedInvoices,
    lastInvoice,
    retentionPercentage,
  };
}

async function canAccessSubcontract(userId: string, userRole: string, subcontractId: string): Promise<boolean> {
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) return false;
  if (userRole === "SUB") return sc.subId === userId;
  if (userRole === "GC") {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
    return project?.gcId === userId;
  }
  return false;
}

async function isSubcontractProjectArchived(subcontractId: string): Promise<boolean> {
  const [sc] = await db.select({ projectId: subcontractsTable.projectId }).from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) return false;
  const [project] = await db.select({ archivedAt: projectsTable.archivedAt }).from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  return !!project?.archivedAt;
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
      paymentDate: invoice.paymentDate ?? null,
      paymentMethod: invoice.paymentMethod ?? null,
      paymentReference: invoice.paymentReference ?? null,
      paymentNotes: invoice.paymentNotes ?? null,
      paymentConfirmedAt: invoice.paymentConfirmedAt ?? null,
      disputeReason: invoice.disputeReason ?? null,
      retentionAmount: invoice.retentionAmount ?? null,
      isRetentionRelease: invoice.isRetentionRelease ?? false,
    },
    subcontract: { id: sc.id, baseContractAmount: sc.baseContractAmount, tradeCategory: sc.tradeCategory ?? null, retentionPercentage: sc.retentionPercentage ?? 0 },
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
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (!await canAccessSubcontract(user.id, user.role, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const base = await getSubcontractWithRelations(sc);
  const changeOrders = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));
  const lienWaivers = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.subcontractId, subcontractId));
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount, sc.retentionPercentage ?? 0);
  res.json({ ...base, changeOrders, invoices, lienWaivers, scoreboard });
});

router.get("/:subcontractId/activity", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!await canAccessSubcontract(user.id, user.role, req.params.subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.subcontractId, req.params.subcontractId))
    .orderBy(desc(activityLogsTable.createdAt));
  res.json(logs);
});

router.get("/:subcontractId/change-orders", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!await canAccessSubcontract(user.id, user.role, req.params.subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
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
  if (!await canAccessSubcontract(user.id, user.role, req.params.subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (await isSubcontractProjectArchived(req.params.subcontractId)) {
    res.status(400).json({ error: "This project is archived and cannot accept new change orders." }); return;
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

  const appUrl = getAppUrl(req);
  if (user.role === "GC") {
    // GC created the CO — notify sub
    sendChangeOrderCreatedEmail({
      toEmail: sc.sub.email,
      projectName: sc.project.name,
      description,
      amount: Number(amount),
      appUrl,
    }).catch((err) => console.error("[email] sendChangeOrderCreatedEmail failed:", err));
  } else {
    // Sub created the CO — notify GC
    sendChangeOrderSubmittedBySubEmail({
      toEmail: sc.project.gc.email,
      projectName: sc.project.name,
      subCompanyName: sc.sub.companyName,
      description,
      amount: Number(amount),
      appUrl,
    }).catch((err) => console.error("[email] sendChangeOrderSubmittedBySubEmail failed:", err));
  }

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
  const user = (req as any).user;
  if (!await canAccessSubcontract(user.id, user.role, req.params.subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, req.params.subcontractId));
  res.json(invs);
});

router.get("/:subcontractId/invoices/:invoiceId/pdf", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId, invoiceId } = req.params;
  if (!await canAccessSubcontract(user.id, user.role, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const scWithRelations = await getSubcontractWithRelations(sc);
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount, sc.retentionPercentage ?? 0);
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
  if (!await canAccessSubcontract(user.id, user.role, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (await isSubcontractProjectArchived(subcontractId)) {
    res.status(400).json({ error: "This project is archived and cannot accept new invoices." }); return;
  }
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) {
    res.status(404).json({ error: "Subcontract not found" });
    return;
  }
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount, sc.retentionPercentage ?? 0);
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

  // Load invoice and subcontract first to compute retention
  const [existingInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];

  // Compute retention amount for this invoice (skip for retention-release invoices)
  const retPct = rawSc?.retentionPercentage ?? 0;
  const retentionAmt = (existingInv && !existingInv.isRetentionRelease && retPct > 0)
    ? Math.round(existingInv.amount * (retPct / 100) * 100) / 100
    : null;

  const [invoice] = await db.update(invoicesTable)
    .set({ status: "APPROVED", retentionAmount: retentionAmt, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount, rawSc.retentionPercentage ?? 0);

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

  const [existingInv2] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  const retPct2 = rawSc?.retentionPercentage ?? 0;
  const retentionAmt2 = (existingInv2 && !existingInv2.isRetentionRelease && retPct2 > 0)
    ? Math.round(existingInv2.amount * (retPct2 / 100) * 100) / 100
    : null;

  const [invoice] = await db.update(invoicesTable)
    .set({ status: "APPROVED", overrideReason, retentionAmount: retentionAmt2, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount, rawSc.retentionPercentage ?? 0);

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

  sendPaymentRecordedEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    gcCompanyName: sc.project.gc.companyName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    paymentDate,
    paymentMethod,
    paymentReference: paymentReference ?? undefined,
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendPaymentRecordedEmail failed:", err));

  res.json(invoice);
});

// Sub signs the lien waiver before confirming payment
router.post("/:subcontractId/invoices/:invoiceId/sign-lien-waiver", requireAuth, requireSub, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const subUser = (req as any).user;
  const { signedByName } = req.body ?? {};

  if (!signedByName?.trim()) {
    res.status(400).json({ error: "signedByName is required — type your full legal name as your electronic signature" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (invoice.status !== "PAYMENT_UNCONFIRMED") {
    res.status(400).json({ error: "Lien waiver can only be signed on invoices marked as paid (PAYMENT_UNCONFIRMED status)" });
    return;
  }

  // Check if waiver already signed for this invoice
  const [existing] = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.invoiceId, invoiceId)).limit(1);
  if (existing) {
    res.status(400).json({ error: "A lien waiver has already been signed for this invoice" });
    return;
  }

  const sc = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).then(r => r[0]);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const scWithRel = await getSubcontractWithRelations(sc);

  // Get sub's license number from profile
  const [subProfile] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, subUser.id)).limit(1);

  const [waiver] = await db.insert(lienWaiversTable).values({
    subcontractId,
    invoiceId,
    projectId: sc.projectId,
    signedByName: signedByName.trim(),
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    paymentDate: invoice.paymentDate ?? null,
    paymentMethod: invoice.paymentMethod ?? null,
    projectName: scWithRel.project.name,
    projectAddress: (scWithRel.project as any).address ?? null,
    gcCompanyName: scWithRel.project.gc.companyName,
    subCompanyName: scWithRel.sub.companyName,
    subLicenseNumber: subProfile?.licenseNumber ?? null,
  }).returning();

  await logActivity(subcontractId, "LIEN_WAIVER_SIGNED", `Lien waiver signed by ${signedByName.trim()} for Invoice #${invoice.invoiceNumber}`, scWithRel.sub.companyName, "SUB");

  res.status(201).json(waiver);
});

// Download the lien waiver PDF for an invoice (GC or owning sub)
router.get("/:subcontractId/invoices/:invoiceId/lien-waiver/pdf", requireAuth, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const user = (req as any).user;

  if (!await canAccessSubcontract(user.id, user.role, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [waiver] = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.invoiceId, invoiceId)).limit(1);
  if (!waiver) { res.status(404).json({ error: "No signed lien waiver found for this invoice" }); return; }

  const pdfBuffer = await generateLienWaiverPDF({ waiver });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="LienWaiver-${waiver.invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(pdfBuffer);
});

// Sub confirms they received payment — REQUIRES signed lien waiver first
router.post("/:subcontractId/invoices/:invoiceId/confirm-payment", requireAuth, requireSub, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const subUser = (req as any).user;

  const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PAYMENT_UNCONFIRMED") {
    res.status(400).json({ error: "Only invoices with PAYMENT_UNCONFIRMED status can be confirmed" });
    return;
  }

  // Require signed lien waiver
  const [signedWaiver] = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.invoiceId, invoiceId)).limit(1);
  if (!signedWaiver) {
    res.status(400).json({ error: "You must sign the lien waiver before confirming payment. Please sign the lien waiver first." });
    return;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set({ status: "PAYMENT_CONFIRMED", paymentConfirmedAt: new Date().toISOString(), updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  await logActivity(subcontractId, "INVOICE_PAYMENT_CONFIRMED", `Invoice #${invoice.invoiceNumber} payment confirmed by ${subUser.companyName}`, subUser.companyName, "SUB");

  const rawSc2 = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).then(r => r[0]);
  const sc2 = await getSubcontractWithRelations(rawSc2);
  sendPaymentConfirmedEmail({
    toEmail: sc2.project.gc.email,
    projectName: sc2.project.name,
    subCompanyName: sc2.sub.companyName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendPaymentConfirmedEmail failed:", err));

  res.json(invoice);
});

// Sub disputes that payment was received — sets status to PAYMENT_DISPUTED
router.post("/:subcontractId/invoices/:invoiceId/dispute-payment", requireAuth, requireSub, async (req, res) => {
  const { subcontractId, invoiceId } = req.params;
  const subUser = (req as any).user;
  const { disputeReason } = req.body ?? {};

  const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.subcontractId, subcontractId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (existing.status !== "PAYMENT_UNCONFIRMED") {
    res.status(400).json({ error: "Only invoices with PAYMENT_UNCONFIRMED status can be disputed" });
    return;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set({ status: "PAYMENT_DISPUTED", disputeReason: disputeReason ?? null, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  await logActivity(subcontractId, "INVOICE_PAYMENT_DISPUTED", `Invoice #${invoice.invoiceNumber} payment disputed by ${subUser.companyName}${disputeReason ? `: ${disputeReason}` : ""}`, subUser.companyName, "SUB");

  const rawSc3 = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).then(r => r[0]);
  const sc3 = await getSubcontractWithRelations(rawSc3);
  sendPaymentDisputedEmail({
    toEmail: sc3.project.gc.email,
    projectName: sc3.project.name,
    subCompanyName: sc3.sub.companyName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    disputeReason: disputeReason ?? undefined,
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendPaymentDisputedEmail failed:", err));

  res.json(invoice);
});

// ─── Insurance certificate endpoints ─────────────────────────────────────────

function calcInsuranceStatus(expirationDate: string | null | undefined): "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_INSURANCE" {
  if (!expirationDate) return "NO_INSURANCE";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "VALID";
}

// GET /:subcontractId/insurance — GC or owning sub
router.get("/:subcontractId/insurance", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  const isGC = user.role === "GC" && project?.gcId === user.id;
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const [ins] = await db.select().from(subcontractInsurancesTable).where(eq(subcontractInsurancesTable.subcontractId, subcontractId)).limit(1);
  const status = calcInsuranceStatus(ins?.expirationDate);
  res.json(ins ? { ...ins, status } : { status: "NO_INSURANCE" });
});

// PUT /:subcontractId/insurance — GC only (upsert)
router.put("/:subcontractId/insurance", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const { insuranceCompany, policyNumber, generalLiabilityCoverage, workersCompCoverage, expirationDate, certificateObjectPath } = req.body;

  const [existing] = await db.select().from(subcontractInsurancesTable).where(eq(subcontractInsurancesTable.subcontractId, subcontractId)).limit(1);

  let ins;
  const expDateChanged = existing?.expirationDate !== expirationDate;

  if (existing) {
    [ins] = await db.update(subcontractInsurancesTable).set({
      insuranceCompany: insuranceCompany ?? null,
      policyNumber: policyNumber ?? null,
      generalLiabilityCoverage: generalLiabilityCoverage ?? null,
      workersCompCoverage: workersCompCoverage ?? null,
      expirationDate: expirationDate ?? null,
      certificateObjectPath: certificateObjectPath ?? existing.certificateObjectPath,
      notifiedAt30: expDateChanged ? null : existing.notifiedAt30,
      notifiedAt7: expDateChanged ? null : existing.notifiedAt7,
      updatedAt: new Date(),
    }).where(eq(subcontractInsurancesTable.id, existing.id)).returning();
  } else {
    [ins] = await db.insert(subcontractInsurancesTable).values({
      subcontractId,
      insuranceCompany: insuranceCompany ?? null,
      policyNumber: policyNumber ?? null,
      generalLiabilityCoverage: generalLiabilityCoverage ?? null,
      workersCompCoverage: workersCompCoverage ?? null,
      expirationDate: expirationDate ?? null,
      certificateObjectPath: certificateObjectPath ?? null,
    }).returning();
  }

  const scWithRelations = await getSubcontractWithRelations(sc);
  await logActivity(
    subcontractId,
    "INSURANCE_UPDATED",
    `Insurance certificate updated — ${insuranceCompany ?? "N/A"} | Expires: ${expirationDate ?? "N/A"}`,
    scWithRelations.project.gc.companyName,
    "GC"
  );

  const status = calcInsuranceStatus(ins.expirationDate);
  res.json({ ...ins, status });
});

router.post("/:subcontractId/release-retention", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  // Verify GC owns the project
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  if (project.status !== "CLOSED") {
    res.status(400).json({ error: "Retention can only be released when the project is CLOSED." });
    return;
  }

  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount, sc.retentionPercentage ?? 0);

  if (scoreboard.retentionBalance <= 0) {
    res.status(400).json({ error: "No retention balance remaining to release." });
    return;
  }

  // Check if a retention release invoice already exists and is not rejected
  const existingInvs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));
  const alreadyReleased = existingInvs.some(i => i.isRetentionRelease && i.status !== "REJECTED");
  if (alreadyReleased) {
    res.status(400).json({ error: "A retention release invoice has already been created for this subcontract." });
    return;
  }

  // Generate a unique invoice number
  const invCount = existingInvs.length + 1;
  const invoiceNumber = `RET-${String(invCount).padStart(3, "0")}`;

  const [invoice] = await db.insert(invoicesTable).values({
    subcontractId,
    invoiceNumber,
    amount: scoreboard.retentionBalance,
    description: `Retention release — ${sc.retentionPercentage ?? 0}% held balance for project ${project.name}`,
    status: "PENDING",
    flaggedOverAmount: 0,
    isRetentionRelease: true,
  }).returning();

  const scWithRelations = await getSubcontractWithRelations(sc);
  await logActivity(
    subcontractId,
    "RETENTION_RELEASED",
    `Retention balance of $${scoreboard.retentionBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} released — Invoice #${invoiceNumber} created`,
    scWithRelations.project.gc.companyName,
    "GC"
  );

  res.status(201).json(invoice);
});

export default router;
