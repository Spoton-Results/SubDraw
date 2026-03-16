import { Router } from "express";
import { db } from "@workspace/db";
import { subcontractsTable, changeOrdersTable, invoicesTable, projectsTable, usersTable, projectMembersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import {
  sendChangeOrderCreatedEmail,
  sendChangeOrderDecisionEmail,
  sendInvoiceSubmittedEmail,
  sendInvoiceFlaggedEmail,
  sendInvoiceDecisionEmail,
} from "../lib/email.js";

const router = Router();

function getAppUrl(req: any) {
  return process.env.APP_URL || `https://${req.hostname}`;
}

async function computeScoreboard(subcontractId: string, baseContractAmount: number) {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));

  const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
  const currentApprovedTotal = baseContractAmount + coTotal;
  const invoicedTotal = invs.filter(i => i.status === "APPROVED").reduce((s, i) => s + i.amount, 0);
  const remaining = currentApprovedTotal - invoicedTotal;
  const hasFlaggedInvoices = invs.some(i => i.status === "FLAGGED");
  const sortedInvs = [...invs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastInvoice = sortedInvs[0] ?? null;
  return { base: baseContractAmount, coTotal, currentApprovedTotal, invoicedTotal, remaining, hasFlaggedInvoices, lastInvoice };
}

async function getSubcontractWithRelations(sc: any) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
  const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
  return { ...sc, project: { ...project, gc }, sub };
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

router.get("/:subcontractId/change-orders", requireAuth, async (req, res) => {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, req.params.subcontractId));
  res.json(cos);
});

router.post("/:subcontractId/change-orders", requireAuth, async (req, res) => {
  const { description, amount } = req.body;
  if (!description || !amount) {
    res.status(400).json({ error: "description and amount are required" });
    return;
  }
  const [co] = await db.insert(changeOrdersTable).values({
    subcontractId: req.params.subcontractId,
    description,
    amount: Number(amount),
    status: "PENDING_GC",
  }).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
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
  const [co] = await db.update(changeOrdersTable).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(changeOrdersTable.id, req.params.changeOrderId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
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

router.post("/:subcontractId/invoices", requireAuth, async (req, res) => {
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

  if (status === "FLAGGED") {
    sendInvoiceFlaggedEmail({
      toEmail: scWithRelations.project.gc.email,
      projectName: scWithRelations.project.name,
      subCompanyName: scWithRelations.sub.companyName,
      invoiceAmount,
      approvedTotal: scoreboard.currentApprovedTotal,
      overAmount: flaggedOverAmount,
      appUrl,
    }).catch((err) => console.error("[email] sendInvoiceFlaggedEmail failed:", err));
  } else {
    sendInvoiceSubmittedEmail({
      toEmail: scWithRelations.project.gc.email,
      projectName: scWithRelations.project.name,
      subCompanyName: scWithRelations.sub.companyName,
      amount: invoiceAmount,
      appUrl,
    }).catch((err) => console.error("[email] sendInvoiceSubmittedEmail failed:", err));
  }

  res.status(201).json(invoice);
});

router.delete("/:subcontractId/invoices/:invoiceId", requireAuth, requireSub, async (req, res) => {
  const { invoiceId } = req.params;
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
  res.status(204).send();
});

router.post("/:subcontractId/invoices/:invoiceId/approve", requireAuth, requireGC, async (req, res) => {
  const [invoice] = await db.update(invoicesTable).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(invoicesTable.id, req.params.invoiceId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );
  sendInvoiceDecisionEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    gcCompanyName: sc.project.gc.companyName,
    amount: invoice.amount,
    decision: "APPROVED",
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendInvoiceDecisionEmail failed:", err));

  res.json(invoice);
});

router.post("/:subcontractId/invoices/:invoiceId/reject", requireAuth, requireGC, async (req, res) => {
  const [invoice] = await db.update(invoicesTable).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(invoicesTable.id, req.params.invoiceId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
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
  const { overrideReason } = req.body;
  if (!overrideReason) {
    res.status(400).json({ error: "overrideReason is required" });
    return;
  }
  const [invoice] = await db.update(invoicesTable).set({ status: "APPROVED", overrideReason, updatedAt: new Date() }).where(eq(invoicesTable.id, req.params.invoiceId)).returning();

  const sc = await getSubcontractWithRelations(
    (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0]
  );
  sendInvoiceDecisionEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    gcCompanyName: sc.project.gc.companyName,
    amount: invoice.amount,
    decision: "APPROVED",
    overrideReason,
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendInvoiceDecisionEmail (override) failed:", err));

  res.json(invoice);
});

export default router;
