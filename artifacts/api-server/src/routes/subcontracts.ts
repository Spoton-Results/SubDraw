import { Router } from "express";
import { db } from "@workspace/db";
import { subcontractsTable, changeOrdersTable, invoicesTable, projectsTable, usersTable, projectMembersTable, activityLogsTable, lienWaiversTable, subProfilesTable, subcontractInsurancesTable, contractorLicensesTable, gcProjectAssignmentsTable, subcontractCommentsTable, subcontractCommentReadsTable, complianceChecklistItemsTable, complianceCompletionsTable } from "@workspace/db/schema";
import { eq, inArray, desc, and, gt, count } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import { getEffectiveGcId, getActorName } from "../lib/auth.js";
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
  sendCommentNotificationEmail,
  sendContractReadyEmail,
  sendContractSignedEmail,
} from "../lib/email.js";
import { generateInvoicePDF, type InvoicePDFData } from "../lib/pdfInvoice.js";
import { generateLienWaiverPDF } from "../lib/pdfLienWaiver.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();

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

  // Latest percentage complete from the most recent non-retention-release, non-rejected invoice that has a percentageComplete
  const latestPctInv = sortedInvs.find(i => !i.isRetentionRelease && i.status !== "REJECTED" && i.status !== "CANCELLED" && i.percentageComplete != null);
  const latestPercentageComplete: number | null = latestPctInv?.percentageComplete ?? null;

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
    latestPercentageComplete,
  };
}

async function canAccessSubcontract(user: any, subcontractId: string): Promise<boolean> {
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) return false;
  if (user.role === "SUB") return sc.subId === user.id;
  if (user.role === "GC") {
    const effectiveGcId = getEffectiveGcId(user);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
    if (!project || project.gcId !== effectiveGcId) return false;
    // If PM, also check they are assigned to this project
    if (user.gcParentId) {
      const [assignment] = await db
        .select()
        .from(gcProjectAssignmentsTable)
        .where(and(
          eq(gcProjectAssignmentsTable.projectId, sc.projectId),
          eq(gcProjectAssignmentsTable.teamMemberUserId, user.id)
        ))
        .limit(1);
      return !!assignment;
    }
    return true;
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
  const [licRow] = await db.select().from(contractorLicensesTable).where(eq(contractorLicensesTable.subcontractId, sc.id)).limit(1);
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
      paymentTermsDays: sc.paymentTermsDays ?? 30,
      paymentDueDate: invoice.paymentDueDate ?? null,
      percentageComplete: invoice.percentageComplete ?? null,
    },
    subcontract: { id: sc.id, baseContractAmount: sc.baseContractAmount, tradeCategory: sc.tradeCategory ?? null, retentionPercentage: sc.retentionPercentage ?? 0 },
    project: {
      name: scWithRelations.project.name,
      address: (scWithRelations.project as any).address ?? null,
    },
    sub: { companyName: scWithRelations.sub.companyName, email: scWithRelations.sub.email, licenseNumber: licRow?.licenseNumber ?? null },
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

// GET /subcontracts/compliance-pending — pending compliance items for the current sub
router.get("/compliance-pending", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const scs = await db.select().from(subcontractsTable).where(eq(subcontractsTable.subId, user.id));
  if (scs.length === 0) { res.json([]); return; }

  const projectIds = [...new Set(scs.map(s => s.projectId))];
  const allItems = await db.select().from(complianceChecklistItemsTable)
    .where(and(inArray(complianceChecklistItemsTable.projectId, projectIds), eq(complianceChecklistItemsTable.required, true)));
  if (allItems.length === 0) { res.json([]); return; }

  const scIds = scs.map(s => s.id);
  const allCompletions = await db.select().from(complianceCompletionsTable)
    .where(inArray(complianceCompletionsTable.subcontractId, scIds));

  const projects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable)
    .where(inArray(projectsTable.id, projectIds));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  const completedSet = new Set(allCompletions.filter(c => c.isComplete).map(c => `${c.subcontractId}:${c.checklistItemId}`));

  const pending: { itemId: string; title: string; projectId: string; projectName: string; subcontractId: string }[] = [];
  for (const sc of scs) {
    const projectItems = allItems.filter(i => i.projectId === sc.projectId);
    for (const item of projectItems) {
      if (!completedSet.has(`${sc.id}:${item.id}`)) {
        pending.push({ itemId: item.id, title: item.title, projectId: sc.projectId, projectName: projectMap[sc.projectId] ?? "Unknown", subcontractId: sc.id });
      }
    }
  }

  res.json(pending);
});

router.get("/:subcontractId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (!await canAccessSubcontract(user, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const base = await getSubcontractWithRelations(sc);
  const changeOrders = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));
  const lienWaivers = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.subcontractId, subcontractId));
  const scoreboard = await computeScoreboard(subcontractId, sc.baseContractAmount, sc.retentionPercentage ?? 0);
  res.json({ ...base, changeOrders, invoices, lienWaivers, scoreboard });
});

// Sub signs their subcontract agreement (records timestamp)
router.patch("/:subcontractId/sign", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (sc.signedBySubAt) { res.status(400).json({ error: "Subcontract already signed" }); return; }
  const [updated] = await db.update(subcontractsTable)
    .set({ signedBySubAt: new Date(), updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();
  await logActivity(subcontractId, "SUBCONTRACT_SIGNED", `Subcontract signed electronically by ${user.companyName}`, user.companyName, "SUB");
  res.json(updated);
});

// ─── Subcontract Agreement Document Endpoints ────────────────────────────────

// POST /:subcontractId/contract-document — GC uploads their agreement
router.post("/:subcontractId/contract-document", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { objectPath, fileName } = req.body;
  if (!objectPath || !fileName) { res.status(400).json({ error: "objectPath and fileName are required" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  // Delete old doc from storage if replacing
  if (sc.contractDocPath) {
    try { const f = await objectStorageService.getObjectEntityFile(sc.contractDocPath); await f.delete(); } catch { }
  }

  const [updated] = await db.update(subcontractsTable)
    .set({ contractDocPath: objectPath, contractDocName: fileName, contractDocUploadedAt: new Date(), signedContractPath: null, signedContractName: null, signedContractUploadedAt: null, contractWaived: false, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_UPLOADED", `Subcontract agreement uploaded: ${fileName}`, getActorName(user), "GC");

  // Notify sub
  const [subUser] = await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
  if (subUser?.email) {
    sendContractReadyEmail({
      toEmail: subUser.email,
      subCompanyName: subUser.companyName ?? "Subcontractor",
      gcCompanyName: user.companyName ?? "General Contractor",
      projectName: project.name,
      fileName,
      appUrl: `${getAppUrl(req)}/subcontracts/${subcontractId}`,
    }).catch(err => console.error("[email] sendContractReadyEmail failed:", err));
  }

  res.json(updated);
});

// DELETE /:subcontractId/contract-document — GC removes their agreement
router.delete("/:subcontractId/contract-document", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  if (sc.contractDocPath) {
    try { const f = await objectStorageService.getObjectEntityFile(sc.contractDocPath); await f.delete(); } catch { }
  }
  if (sc.signedContractPath) {
    try { const f = await objectStorageService.getObjectEntityFile(sc.signedContractPath); await f.delete(); } catch { }
  }

  const [updated] = await db.update(subcontractsTable)
    .set({ contractDocPath: null, contractDocName: null, contractDocUploadedAt: null, signedContractPath: null, signedContractName: null, signedContractUploadedAt: null, contractWaived: false, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_REMOVED", "Subcontract agreement removed by GC", getActorName(user), "GC");
  res.json(updated);
});

// POST /:subcontractId/signed-contract — Sub uploads their signed copy
router.post("/:subcontractId/signed-contract", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { objectPath, fileName } = req.body;
  if (!objectPath || !fileName) { res.status(400).json({ error: "objectPath and fileName are required" }); return; }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!sc.contractDocPath) { res.status(400).json({ error: "GC has not uploaded a contract document yet" }); return; }

  // Delete old signed doc from storage if replacing
  if (sc.signedContractPath) {
    try { const f = await objectStorageService.getObjectEntityFile(sc.signedContractPath); await f.delete(); } catch { }
  }

  const [updated] = await db.update(subcontractsTable)
    .set({ signedContractPath: objectPath, signedContractName: fileName, signedContractUploadedAt: new Date(), updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_SIGNED", `Signed contract uploaded by ${user.companyName}: ${fileName}`, user.companyName, "SUB");

  // Notify GC
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  const [gcUser] = await db.select().from(usersTable).where(eq(usersTable.id, project?.gcId ?? "")).limit(1);
  if (gcUser?.email) {
    sendContractSignedEmail({
      toEmail: gcUser.email,
      gcCompanyName: gcUser.companyName ?? "General Contractor",
      subCompanyName: user.companyName ?? "Subcontractor",
      projectName: project?.name ?? "Project",
      fileName,
      appUrl: `${getAppUrl(req)}/subcontracts/${subcontractId}`,
    }).catch(err => console.error("[email] sendContractSignedEmail failed:", err));
  }

  res.json(updated);
});

// DELETE /:subcontractId/signed-contract — GC removes signed copy
router.delete("/:subcontractId/signed-contract", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  if (sc.signedContractPath) {
    try { const f = await objectStorageService.getObjectEntityFile(sc.signedContractPath); await f.delete(); } catch { }
  }

  const [updated] = await db.update(subcontractsTable)
    .set({ signedContractPath: null, signedContractName: null, signedContractUploadedAt: null, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_REMOVED", "Signed contract removed by GC", getActorName(user), "GC");
  res.json(updated);
});

// POST /:subcontractId/waive-contract — GC waives signature requirement
router.post("/:subcontractId/waive-contract", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const [updated] = await db.update(subcontractsTable)
    .set({ contractWaived: true, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_WAIVED", "Contract signature requirement waived by GC", getActorName(user), "GC");
  res.json(updated);
});

// DELETE /:subcontractId/waive-contract — GC un-waives (reinstates requirement)
router.delete("/:subcontractId/waive-contract", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const [updated] = await db.update(subcontractsTable)
    .set({ contractWaived: false, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(subcontractId, "CONTRACT_UNWAIVED", "Contract signature requirement reinstated by GC", getActorName(user), "GC");
  res.json(updated);
});

// GC: update payment terms (Net 15, 30, or 45)
router.patch("/:subcontractId/payment-terms", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { paymentTermsDays } = req.body;

  if (![15, 30, 45].includes(Number(paymentTermsDays))) {
    res.status(400).json({ error: "paymentTermsDays must be 15, 30, or 45" });
    return;
  }

  if (!await canAccessSubcontract(user, subcontractId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db.update(subcontractsTable)
    .set({ paymentTermsDays: Number(paymentTermsDays), updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId))
    .returning();

  await logActivity(
    subcontractId,
    "PAYMENT_TERMS_UPDATED",
    `Payment terms updated to Net ${paymentTermsDays}`,
    (user as any).companyName ?? "GC",
    "GC"
  );

  res.json(updated);
});

router.get("/:subcontractId/activity", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!await canAccessSubcontract(user, req.params.subcontractId)) {
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
  if (!await canAccessSubcontract(user, req.params.subcontractId)) {
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
  if (!await canAccessSubcontract(user, req.params.subcontractId)) {
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
    user.role === "GC" ? getActorName(user) : sc.sub.companyName,
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
  if (!await canAccessSubcontract(user, req.params.subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, req.params.subcontractId));
  res.json(invs);
});

router.get("/:subcontractId/invoices/:invoiceId/pdf", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId, invoiceId } = req.params;
  if (!await canAccessSubcontract(user, subcontractId)) {
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
  const { amount, invoiceNumber, description, percentageComplete } = req.body;
  if (!amount || isNaN(Number(amount))) {
    res.status(400).json({ error: "amount is required" });
    return;
  }
  if (!invoiceNumber || !String(invoiceNumber).trim()) {
    res.status(400).json({ error: "invoiceNumber is required" });
    return;
  }
  const pct = Number(percentageComplete);
  if (!percentageComplete || isNaN(pct) || !Number.isInteger(pct) || pct < 1 || pct > 100) {
    res.status(400).json({ error: "percentageComplete is required and must be an integer between 1 and 100" });
    return;
  }
  if (!await canAccessSubcontract(user, subcontractId)) {
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

  // Compliance gate: check all required checklist items are complete
  if (user.role === "SUB") {
    const checklistItems = await db.select().from(complianceChecklistItemsTable)
      .where(and(eq(complianceChecklistItemsTable.projectId, sc.projectId), eq(complianceChecklistItemsTable.required, true)));
    if (checklistItems.length > 0) {
      const completions = await db.select().from(complianceCompletionsTable)
        .where(eq(complianceCompletionsTable.subcontractId, subcontractId));
      const completionMap = new Set(completions.filter(c => c.isComplete).map(c => c.checklistItemId));
      const incompleteItems = checklistItems.filter(item => !completionMap.has(item.id));
      if (incompleteItems.length > 0) {
        res.status(400).json({
          error: `Invoice blocked: ${incompleteItems.length} required compliance item${incompleteItems.length > 1 ? "s" : ""} not yet completed: ${incompleteItems.map(i => i.title).join(", ")}`,
          code: "COMPLIANCE_INCOMPLETE",
        });
        return;
      }
    }
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
    percentageComplete: pct,
  }).returning();

  const scWithRelations = await getSubcontractWithRelations(sc);
  const appUrl = getAppUrl(req);

  const actorName = user.role === "GC" ? getActorName(user) : scWithRelations.sub.companyName;
  const flagNote = status === "FLAGGED" ? " (flagged — exceeds contract balance)" : "";
  await logActivity(
    subcontractId,
    status === "FLAGGED" ? "INVOICE_FLAGGED" : "INVOICE_SUBMITTED",
    `Invoice #${String(invoiceNumber).trim()} for $${invoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} submitted at ${pct}% scope complete${flagNote}`,
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
  const user = (req as any).user;
  const { subcontractId, invoiceId } = req.params;

  // Load invoice and subcontract first to compute retention
  const [existingInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];

  // Compute retention amount for this invoice (skip for retention-release invoices)
  const retPct = rawSc?.retentionPercentage ?? 0;
  const retentionAmt = (existingInv && !existingInv.isRetentionRelease && retPct > 0)
    ? Math.round(existingInv.amount * (retPct / 100) * 100) / 100
    : null;

  // Compute payment due date based on subcontract payment terms
  const paymentTermsDays = rawSc?.paymentTermsDays ?? 30;
  const approvedAt = new Date();
  const paymentDueDate = new Date(approvedAt.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);

  const [invoice] = await db.update(invoicesTable)
    .set({ status: "APPROVED", retentionAmount: retentionAmt, approvedAt, paymentDueDate, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount, rawSc.retentionPercentage ?? 0);

  await logActivity(
    subcontractId,
    "INVOICE_APPROVED",
    `Invoice #${invoice.invoiceNumber} for $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} approved`,
    getActorName(user),
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
  const user = (req as any).user;
  const { rejectionReason } = req.body ?? {};
  if (!rejectionReason || !String(rejectionReason).trim()) {
    res.status(400).json({ error: "A rejection reason is required — the subcontractor needs to know what to fix." });
    return;
  }
  const reason = String(rejectionReason).trim();

  const [invoice] = await db.update(invoicesTable)
    .set({ status: "REJECTED", rejectionReason: reason, updatedAt: new Date() })
    .where(eq(invoicesTable.id, req.params.invoiceId))
    .returning();

  const rawSc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, req.params.subcontractId)).limit(1))[0];
  const sc = await getSubcontractWithRelations(rawSc);

  await logActivity(
    req.params.subcontractId,
    "INVOICE_REJECTED",
    `Invoice #${invoice.invoiceNumber} for $${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} rejected — ${reason}`,
    getActorName(user),
    "GC"
  );

  sendInvoiceDecisionEmail({
    toEmail: sc.sub.email,
    projectName: sc.project.name,
    gcCompanyName: sc.project.gc.companyName,
    amount: invoice.amount,
    invoiceNumber: invoice.invoiceNumber,
    decision: "REJECTED",
    rejectionReason: reason,
    appUrl: getAppUrl(req),
  }).catch((err) => console.error("[email] sendInvoiceDecisionEmail failed:", err));

  res.json(invoice);
});

router.post("/:subcontractId/invoices/:invoiceId/override", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
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

  const overrideApprovedAt = new Date();
  const overridePaymentTermsDays = rawSc?.paymentTermsDays ?? 30;
  const overridePaymentDueDate = new Date(overrideApprovedAt.getTime() + overridePaymentTermsDays * 24 * 60 * 60 * 1000);

  const [invoice] = await db.update(invoicesTable)
    .set({ status: "APPROVED", overrideReason, retentionAmount: retentionAmt2, approvedAt: overrideApprovedAt, paymentDueDate: overridePaymentDueDate, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  const sc = await getSubcontractWithRelations(rawSc);
  const scoreboard = await computeScoreboard(subcontractId, rawSc.baseContractAmount, rawSc.retentionPercentage ?? 0);

  await logActivity(
    subcontractId,
    "INVOICE_OVERRIDDEN",
    `Invoice #${invoice.invoiceNumber} overridden and approved — ${overrideReason}`,
    getActorName(user),
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
  await logActivity(subcontractId, "INVOICE_PAYMENT_UNCONFIRMED", `Invoice #${invoice.invoiceNumber} marked as paid via ${paymentMethod} on ${paymentDate} — awaiting sub confirmation`, getActorName(gcUser), "GC");

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

  if (!await canAccessSubcontract(user, subcontractId)) {
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
    getActorName(user),
    "GC"
  );

  const status = calcInsuranceStatus(ins.expirationDate);
  res.json({ ...ins, status });
});

// ─── Contractor license endpoints ────────────────────────────────────────────

function calcLicenseStatus(expirationDate: string | null | undefined): "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_LICENSE" {
  if (!expirationDate) return "NO_LICENSE";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "VALID";
}

// GET /:subcontractId/license — GC or owning sub
router.get("/:subcontractId/license", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  const isGC = (user.role === "GC" && project?.gcId === user.id) || (user.role === "PM" && project?.gcId === user.managedByGcId);
  const isSub = user.role === "SUB" && sc.subId === user.id;
  if (!isGC && !isSub) { res.status(403).json({ error: "Forbidden" }); return; }

  const [lic] = await db.select().from(contractorLicensesTable).where(eq(contractorLicensesTable.subcontractId, subcontractId)).limit(1);
  const status = calcLicenseStatus(lic?.expirationDate);
  res.json(lic ? { ...lic, status } : { status: "NO_LICENSE" });
});

// PUT /:subcontractId/license — GC only (upsert)
router.put("/:subcontractId/license", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { licenseNumber, licenseType, issuingState, expirationDate } = req.body;

  const [existing] = await db.select().from(contractorLicensesTable).where(eq(contractorLicensesTable.subcontractId, subcontractId)).limit(1);

  let lic;
  const expDateChanged = existing?.expirationDate !== expirationDate;

  if (existing) {
    [lic] = await db.update(contractorLicensesTable).set({
      licenseNumber: licenseNumber ?? null,
      licenseType: licenseType ?? null,
      issuingState: issuingState ?? null,
      expirationDate: expirationDate ?? null,
      notifiedAt30: expDateChanged ? null : existing.notifiedAt30,
      notifiedAt7: expDateChanged ? null : existing.notifiedAt7,
      updatedAt: new Date(),
    }).where(eq(contractorLicensesTable.id, existing.id)).returning();
  } else {
    [lic] = await db.insert(contractorLicensesTable).values({
      subcontractId,
      licenseNumber: licenseNumber ?? null,
      licenseType: licenseType ?? null,
      issuingState: issuingState ?? null,
      expirationDate: expirationDate ?? null,
    }).returning();
  }

  await logActivity(
    subcontractId,
    "LICENSE_UPDATED",
    `Contractor license updated — ${licenseNumber ?? "N/A"} | Type: ${licenseType ?? "N/A"} | Expires: ${expirationDate ?? "N/A"}`,
    getActorName(user),
    "GC"
  );

  const status = calcLicenseStatus(lic.expirationDate);
  res.json({ ...lic, status });
});

router.post("/:subcontractId/release-retention", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  // Verify GC (or PM on behalf of GC) owns the project
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }

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
    getActorName(user),
    "GC"
  );

  res.status(201).json(invoice);
});

// ── COMMENTS ──────────────────────────────────────────────────────────────────

async function getUnreadCommentCount(subcontractId: string, userId: string): Promise<number> {
  const [readRow] = await db.select().from(subcontractCommentReadsTable)
    .where(and(eq(subcontractCommentReadsTable.subcontractId, subcontractId), eq(subcontractCommentReadsTable.userId, userId)))
    .limit(1);
  const comments = await db.select().from(subcontractCommentsTable)
    .where(eq(subcontractCommentsTable.subcontractId, subcontractId));
  return comments.filter(c =>
    c.userId !== userId && (!readRow || c.createdAt > readRow.lastReadAt)
  ).length;
}

router.get("/:subcontractId/comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  if (!await canAccessSubcontract(user, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const comments = await db.select().from(subcontractCommentsTable)
    .where(eq(subcontractCommentsTable.subcontractId, subcontractId))
    .orderBy(subcontractCommentsTable.createdAt);
  res.json(comments);
});

router.post("/:subcontractId/comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { message } = req.body;
  if (!message || !String(message).trim()) {
    res.status(400).json({ error: "Message is required" }); return;
  }
  if (String(message).trim().length > 2000) {
    res.status(400).json({ error: "Message must be 2000 characters or fewer" }); return;
  }
  if (!await canAccessSubcontract(user, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const scWithRelations = await getSubcontractWithRelations(sc);
  const companyName = user.role === "GC" ? scWithRelations.project.gc.companyName : scWithRelations.sub.companyName;

  const [comment] = await db.insert(subcontractCommentsTable).values({
    subcontractId,
    userId: user.id,
    companyName,
    role: user.role,
    message: String(message).trim(),
  }).returning();

  // Mark as read for sender immediately
  await db.insert(subcontractCommentReadsTable).values({
    subcontractId,
    userId: user.id,
    lastReadAt: new Date(),
  }).onConflictDoUpdate({
    target: [subcontractCommentReadsTable.subcontractId, subcontractCommentReadsTable.userId],
    set: { lastReadAt: new Date() },
  }).catch(() => {});

  // Send email to the other party asynchronously
  const appUrl = `${getAppUrl(req)}/subcontracts/${subcontractId}`;
  (async () => {
    try {
      const toEmail = user.role === "GC" ? scWithRelations.sub.email : scWithRelations.project.gc.email;
      await sendCommentNotificationEmail({
        toEmail,
        projectName: scWithRelations.project.name,
        senderCompanyName: companyName,
        senderRole: user.role,
        messagePreview: String(message).trim(),
        appUrl,
      });
    } catch (err) {
      console.error("[comment] Email notification failed:", err);
    }
  })();

  res.status(201).json(comment);
});

router.post("/:subcontractId/comments/mark-read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  if (!await canAccessSubcontract(user, subcontractId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.insert(subcontractCommentReadsTable).values({
    subcontractId,
    userId: user.id,
    lastReadAt: new Date(),
  }).onConflictDoUpdate({
    target: [subcontractCommentReadsTable.subcontractId, subcontractCommentReadsTable.userId],
    set: { lastReadAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
