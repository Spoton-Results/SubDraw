import { Router } from "express";
import { db } from "@workspace/db";
import {
  gcContactsTable,
  invoicesTable,
  preferredSubcontractorsTable,
  projectMembersTable,
  projectsTable,
  subProfilesTable,
  subcontractsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";

const router = Router();

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

router.get("/subcontractors", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const q = normalize(req.query.q);
  const trade = normalize(req.query.trade);
  const state = normalize(req.query.state).toUpperCase();
  const city = normalize(req.query.city);
  const preferredOnly = normalize(req.query.preferredOnly) === "true";

  const filters = [
    eq(usersTable.role, "SUB"),
    eq(subProfilesTable.directoryVisible, true),
  ];

  if (trade) filters.push(ilike(subProfilesTable.trade, `%${trade}%`));
  if (state) filters.push(ilike(subProfilesTable.state, state));
  if (city) filters.push(ilike(subProfilesTable.city, `%${city}%`));

  if (q) {
    filters.push(
      or(
        ilike(usersTable.companyName, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(subProfilesTable.trade, `%${q}%`),
        ilike(subProfilesTable.city, `%${q}%`),
        ilike(subProfilesTable.state, `%${q}%`),
        ilike(subProfilesTable.serviceArea, `%${q}%`),
        ilike(subProfilesTable.licenseNumber, `%${q}%`)
      )!
    );
  }

  const rows = await db
    .select({
      subId: usersTable.id,
      companyName: usersTable.companyName,
      email: usersTable.email,
      profileId: subProfilesTable.id,
      trade: subProfilesTable.trade,
      phone: subProfilesTable.phone,
      businessAddress: subProfilesTable.businessAddress,
      city: subProfilesTable.city,
      state: subProfilesTable.state,
      serviceArea: subProfilesTable.serviceArea,
      licenseNumber: subProfilesTable.licenseNumber,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(subProfilesTable, eq(subProfilesTable.userId, usersTable.id))
    .where(and(...filters))
    .limit(100);

  const contacts = await db
    .select({ subId: gcContactsTable.subId })
    .from(gcContactsTable)
    .where(eq(gcContactsTable.gcId, user.id));
  const contactIds = new Set(contacts.map((c) => c.subId));

  const preferredRows = await db
    .select({ subId: preferredSubcontractorsTable.subId })
    .from(preferredSubcontractorsTable)
    .where(and(eq(preferredSubcontractorsTable.gcId, user.id), eq(preferredSubcontractorsTable.preferred, true)));
  const preferredIds = new Set(preferredRows.map((p) => p.subId));

  const mapped = rows.map((row) => ({
    ...row,
    savedToContacts: contactIds.has(row.subId),
    preferred: preferredIds.has(row.subId),
  }));

  res.json(preferredOnly ? mapped.filter((row) => row.preferred) : mapped);
});

router.get("/subcontractors/:subId/history", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subId } = req.params;

  const [sub] = await db
    .select({ id: usersTable.id, role: usersTable.role, companyName: usersTable.companyName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, subId))
    .limit(1);

  if (!sub || sub.role !== "SUB") {
    res.status(404).json({ error: "Subcontractor not found" });
    return;
  }

  const memberships = await db
    .select({
      projectId: projectMembersTable.projectId,
      tradeCategory: projectMembersTable.tradeCategory,
      invitedAt: projectMembersTable.createdAt,
      projectName: projectsTable.name,
      projectStatus: projectsTable.status,
      projectAddress: projectsTable.address,
      projectCreatedAt: projectsTable.createdAt,
    })
    .from(projectMembersTable)
    .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
    .where(and(eq(projectMembersTable.userId, subId), eq(projectsTable.gcId, user.id)));

  const subcontracts = await db
    .select({
      id: subcontractsTable.id,
      projectId: subcontractsTable.projectId,
      baseContractAmount: subcontractsTable.baseContractAmount,
      tradeCategory: subcontractsTable.tradeCategory,
      signedBySubAt: subcontractsTable.signedBySubAt,
      createdAt: subcontractsTable.createdAt,
    })
    .from(subcontractsTable)
    .innerJoin(projectsTable, eq(projectsTable.id, subcontractsTable.projectId))
    .where(and(eq(subcontractsTable.subId, subId), eq(projectsTable.gcId, user.id)));

  const subcontractIds = subcontracts.map((s) => s.id);
  const invoices = subcontractIds.length > 0
    ? await db
        .select({
          id: invoicesTable.id,
          subcontractId: invoicesTable.subcontractId,
          amount: invoicesTable.amount,
          status: invoicesTable.status,
          retentionAmount: invoicesTable.retentionAmount,
          isRetentionRelease: invoicesTable.isRetentionRelease,
          flaggedOverAmount: invoicesTable.flaggedOverAmount,
          createdAt: invoicesTable.createdAt,
        })
        .from(invoicesTable)
        .where(inArray(invoicesTable.subcontractId, subcontractIds))
    : [];

  const subcontractsByProject = new Map(subcontracts.map((sc) => [sc.projectId, sc]));
  const invoicesBySubcontract = new Map<string, typeof invoices>();
  for (const invoice of invoices) {
    const list = invoicesBySubcontract.get(invoice.subcontractId) ?? [];
    list.push(invoice);
    invoicesBySubcontract.set(invoice.subcontractId, list);
  }

  const projectHistory = memberships
    .map((membership) => {
      const subcontract = subcontractsByProject.get(membership.projectId);
      const projectInvoices = subcontract ? invoicesBySubcontract.get(subcontract.id) ?? [] : [];
      const totalBilled = sum(projectInvoices.map((invoice) => invoice.amount));
      const totalPaid = sum(projectInvoices.filter((invoice) => invoice.status === "PAYMENT_CONFIRMED").map((invoice) => invoice.amount));
      const totalRetainageHeld = sum(projectInvoices.map((invoice) => invoice.retentionAmount));
      const totalFlaggedOverAmount = sum(projectInvoices.map((invoice) => invoice.flaggedOverAmount));
      const invoiceCount = projectInvoices.length;
      const disputedInvoiceCount = projectInvoices.filter((invoice) => invoice.status === "PAYMENT_DISPUTED").length;
      const rejectedInvoiceCount = projectInvoices.filter((invoice) => invoice.status === "REJECTED").length;
      const flaggedInvoiceCount = projectInvoices.filter((invoice) => invoice.status === "FLAGGED" || (invoice.flaggedOverAmount ?? 0) > 0).length;

      return {
        projectId: membership.projectId,
        projectName: membership.projectName,
        projectStatus: membership.projectStatus,
        projectAddress: membership.projectAddress,
        tradeCategory: subcontract?.tradeCategory ?? membership.tradeCategory,
        invitedAt: membership.invitedAt,
        awardedAt: subcontract?.createdAt ?? null,
        signedBySubAt: subcontract?.signedBySubAt ?? null,
        baseContractAmount: subcontract?.baseContractAmount ?? 0,
        invoiceCount,
        totalBilled,
        totalPaid,
        totalRetainageHeld,
        totalFlaggedOverAmount,
        disputedInvoiceCount,
        rejectedInvoiceCount,
        flaggedInvoiceCount,
        stage: subcontract ? (membership.projectStatus === "COMPLETE" ? "COMPLETED" : "AWARDED") : "INVITED",
      };
    })
    .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());

  const summary = {
    projectsInvited: memberships.length,
    projectsAwarded: subcontracts.length,
    activeProjects: projectHistory.filter((p) => p.projectStatus === "BIDDING" || p.projectStatus === "CONSTRUCTION").length,
    completedProjects: projectHistory.filter((p) => p.projectStatus === "COMPLETE").length,
    totalContracted: sum(subcontracts.map((sc) => sc.baseContractAmount)),
    totalBilled: sum(projectHistory.map((p) => p.totalBilled)),
    totalPaid: sum(projectHistory.map((p) => p.totalPaid)),
    totalRetainageHeld: sum(projectHistory.map((p) => p.totalRetainageHeld)),
    flaggedInvoiceCount: sum(projectHistory.map((p) => p.flaggedInvoiceCount)),
    disputedInvoiceCount: sum(projectHistory.map((p) => p.disputedInvoiceCount)),
    rejectedInvoiceCount: sum(projectHistory.map((p) => p.rejectedInvoiceCount)),
  };

  res.json({ sub, summary, projects: projectHistory });
});

router.post("/subcontractors/:subId/save", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subId } = req.params;

  const [sub] = await db
    .select({ id: usersTable.id, role: usersTable.role, companyName: usersTable.companyName })
    .from(usersTable)
    .where(eq(usersTable.id, subId))
    .limit(1);

  if (!sub || sub.role !== "SUB") {
    res.status(404).json({ error: "Subcontractor not found" });
    return;
  }

  await db
    .insert(gcContactsTable)
    .values({ gcId: user.id, subId: sub.id, contactName: null })
    .onConflictDoNothing();

  res.status(201).json({ message: "Subcontractor saved to contact book", subId: sub.id });
});

router.post("/subcontractors/:subId/preferred", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subId } = req.params;

  const [sub] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, subId))
    .limit(1);

  if (!sub || sub.role !== "SUB") {
    res.status(404).json({ error: "Subcontractor not found" });
    return;
  }

  await db
    .insert(gcContactsTable)
    .values({ gcId: user.id, subId: sub.id, contactName: null })
    .onConflictDoNothing();

  await db
    .insert(preferredSubcontractorsTable)
    .values({ gcId: user.id, subId: sub.id, preferred: true })
    .onConflictDoUpdate({
      target: [preferredSubcontractorsTable.gcId, preferredSubcontractorsTable.subId],
      set: { preferred: true, updatedAt: new Date() },
    });

  res.status(201).json({ message: "Marked as preferred", subId: sub.id, preferred: true });
});

router.delete("/subcontractors/:subId/preferred", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subId } = req.params;

  await db
    .update(preferredSubcontractorsTable)
    .set({ preferred: false, updatedAt: new Date() })
    .where(and(eq(preferredSubcontractorsTable.gcId, user.id), eq(preferredSubcontractorsTable.subId, subId)));

  res.json({ message: "Removed from preferred", subId, preferred: false });
});

export default router;
