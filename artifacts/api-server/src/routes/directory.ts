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

function percentage(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function signalStatus(value: number, goodMax: number, watchMax: number): "GOOD" | "WATCH" | "RISK" {
  if (value <= goodMax) return "GOOD";
  if (value <= watchMax) return "WATCH";
  return "RISK";
}

router.get("/subcontractors", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const q = normalize(req.query.q);
  const trade = normalize(req.query.trade);
  const state = normalize(req.query.state).toUpperCase();
  const city = normalize(req.query.city);
  const preferredOnly = normalize(req.query.preferredOnly) === "true";

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

  const subUsers = await db
    .select({
      subId: usersTable.id,
      companyName: usersTable.companyName,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "SUB"))
    .limit(500);

  const profiles = await db.select().from(subProfilesTable);
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

  const mapped = subUsers
    .map((sub) => {
      const profile = profileByUserId.get(sub.subId) ?? null;
      return {
        subId: sub.subId,
        companyName: sub.companyName ?? "Subcontractor",
        email: sub.email,
        trade: profile?.trade ?? "General",
        phone: profile?.phone ?? null,
        businessAddress: profile?.businessAddress ?? null,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        serviceArea: profile?.serviceArea ?? null,
        licenseNumber: profile?.licenseNumber ?? null,
        savedToContacts: contactIds.has(sub.subId),
        preferred: preferredIds.has(sub.subId),
        profileComplete: Boolean(profile),
      };
    })
    .filter((row) => {
      if (preferredOnly && !row.preferred) return false;
      if (trade && !row.trade.toLowerCase().includes(trade.toLowerCase())) return false;
      if (state && row.state?.toUpperCase() !== state) return false;
      if (city && !row.city?.toLowerCase().includes(city.toLowerCase())) return false;
      if (!q) return true;
      const haystack = [
        row.companyName,
        row.email,
        row.trade,
        row.phone,
        row.businessAddress,
        row.city,
        row.state,
        row.serviceArea,
        row.licenseNumber,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q.toLowerCase());
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.companyName.localeCompare(b.companyName))
    .slice(0, 250);

  res.json(mapped);
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

  const totalInvoiceCount = sum(projectHistory.map((p) => p.invoiceCount));
  const flaggedInvoiceCount = sum(projectHistory.map((p) => p.flaggedInvoiceCount));
  const disputedInvoiceCount = sum(projectHistory.map((p) => p.disputedInvoiceCount));
  const rejectedInvoiceCount = sum(projectHistory.map((p) => p.rejectedInvoiceCount));
  const completedProjects = projectHistory.filter((p) => p.projectStatus === "COMPLETE").length;
  const awardedProjects = subcontracts.length;
  const projectsInvited = memberships.length;
  const repeatProjectCount = Math.max(0, awardedProjects - 1);
  const flaggedInvoiceRate = percentage(flaggedInvoiceCount, totalInvoiceCount);
  const disputeRate = percentage(disputedInvoiceCount, totalInvoiceCount);
  const rejectionRate = percentage(rejectedInvoiceCount, totalInvoiceCount);
  const awardRate = percentage(awardedProjects, projectsInvited);
  const completionRate = percentage(completedProjects, awardedProjects);

  const trustSignals = {
    billingAccuracy: {
      status: signalStatus(flaggedInvoiceRate + disputeRate + rejectionRate, 5, 15),
      label: "Billing accuracy",
      flaggedInvoiceRate,
      flaggedInvoiceCount,
      disputedInvoiceCount,
      rejectedInvoiceCount,
      invoiceCount: totalInvoiceCount,
      explanation: `${flaggedInvoiceCount} flagged, ${disputedInvoiceCount} disputed, ${rejectedInvoiceCount} rejected out of ${totalInvoiceCount} invoices.`,
    },
    relationshipStability: {
      status: completedProjects >= 3 || repeatProjectCount >= 2 ? "GOOD" : awardedProjects > 0 ? "WATCH" : "RISK",
      label: "Relationship history",
      projectsInvited,
      projectsAwarded: awardedProjects,
      completedProjects,
      repeatProjectCount,
      awardRate,
      completionRate,
      explanation: `${awardedProjects} awarded project${awardedProjects === 1 ? "" : "s"}, ${completedProjects} completed, ${repeatProjectCount} repeat relationship${repeatProjectCount === 1 ? "" : "s"}.`,
    },
    financialReliability: {
      status: disputedInvoiceCount === 0 && rejectedInvoiceCount === 0 ? "GOOD" : disputedInvoiceCount + rejectedInvoiceCount <= 2 ? "WATCH" : "RISK",
      label: "Financial reliability",
      totalBilled: sum(projectHistory.map((p) => p.totalBilled)),
      totalPaid: sum(projectHistory.map((p) => p.totalPaid)),
      totalRetainageHeld: sum(projectHistory.map((p) => p.totalRetainageHeld)),
      disputeRate,
      rejectionRate,
      explanation: `${disputeRate}% dispute rate and ${rejectionRate}% rejection rate across paid/billed history.`,
    },
    dataDepth: {
      status: awardedProjects >= 3 || totalInvoiceCount >= 5 ? "GOOD" : projectsInvited > 0 ? "WATCH" : "RISK",
      label: "Data depth",
      invoiceCount: totalInvoiceCount,
      projectsInvited,
      projectsAwarded: awardedProjects,
      explanation: awardedProjects > 0 || totalInvoiceCount > 0
        ? `Based on ${projectsInvited} invite${projectsInvited === 1 ? "" : "s"}, ${awardedProjects} award${awardedProjects === 1 ? "" : "s"}, and ${totalInvoiceCount} invoice${totalInvoiceCount === 1 ? "" : "s"}.`
        : "Not enough SubDraw history yet. Treat this as unknown, not bad.",
    },
  };

  const summary = {
    projectsInvited,
    projectsAwarded: awardedProjects,
    activeProjects: projectHistory.filter((p) => p.projectStatus === "BIDDING" || p.projectStatus === "CONSTRUCTION").length,
    completedProjects,
    totalContracted: sum(subcontracts.map((sc) => sc.baseContractAmount)),
    totalBilled: sum(projectHistory.map((p) => p.totalBilled)),
    totalPaid: sum(projectHistory.map((p) => p.totalPaid)),
    totalRetainageHeld: sum(projectHistory.map((p) => p.totalRetainageHeld)),
    flaggedInvoiceCount,
    disputedInvoiceCount,
    rejectedInvoiceCount,
    invoiceCount: totalInvoiceCount,
    flaggedInvoiceRate,
    disputeRate,
    rejectionRate,
    awardRate,
    completionRate,
  };

  res.json({ sub, summary, trustSignals, projects: projectHistory });
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
