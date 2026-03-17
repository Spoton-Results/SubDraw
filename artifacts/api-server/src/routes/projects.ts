import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, usersTable, bidsTable, subcontractsTable, changeOrdersTable, invoicesTable, gcContactsTable, activityLogsTable, lienWaiversTable } from "@workspace/db/schema";
import { eq, or, inArray, and, isNull, isNotNull } from "drizzle-orm";
import archiver from "archiver";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { hashPassword } from "../lib/auth.js";
import { sendInviteEmail, sendSubRemovedEmail, sendChangeOrderCreatedEmail } from "../lib/email.js";
import { getGCPlanInfo, getActiveProjectCount } from "../lib/stripeStorage.js";
import { generateLienWaiverPDF } from "../lib/pdfLienWaiver.js";

const router = Router();

function generateTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function computeSubcontractScoreboard(subcontractId: string, baseContractAmount: number) {
  const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, subcontractId));
  const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, subcontractId));

  const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
  const currentApprovedTotal = baseContractAmount + coTotal;
  const invoicedTotal = invs.filter(i => i.status === "APPROVED").reduce((s, i) => s + i.amount, 0);
  const remaining = currentApprovedTotal - invoicedTotal;
  const hasFlaggedInvoices = invs.some(i => i.status === "FLAGGED" || i.status === "PAYMENT_DISPUTED");

  const sortedInvs = [...invs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastInvoice = sortedInvs[0] ?? null;

  return { base: baseContractAmount, coTotal, currentApprovedTotal, invoicedTotal, remaining, hasFlaggedInvoices, lastInvoice };
}

async function computeArchivedSummary(projectId: string) {
  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  if (subcontracts.length === 0) return { totalContractValue: 0, totalPaid: 0, subcontractCount: 0 };

  let totalContractValue = 0;
  let totalPaid = 0;

  await Promise.all(subcontracts.map(async (sc) => {
    const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, sc.id));
    const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
    totalContractValue += sc.baseContractAmount + coTotal;

    const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, sc.id));
    totalPaid += invs.filter(i => i.status === "PAYMENT_CONFIRMED").reduce((s, i) => s + i.amount, 0);
  }));

  return { totalContractValue, totalPaid, subcontractCount: subcontracts.length };
}

async function getProjectFinancialSummary(projectId: string) {
  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  if (subcontracts.length === 0) {
    return { subcontractCount: 0, totalApprovedAmount: 0, totalInvoiced: 0, hasFlaggedInvoices: false, totalCOApproved: 0, disputedCount: 0 };
  }

  const scoreboards = await Promise.all(
    subcontracts.map(sc => computeSubcontractScoreboard(sc.id, sc.baseContractAmount))
  );

  const allInvs = await Promise.all(
    subcontracts.map(sc => db.select().from(invoicesTable).where(eq(invoicesTable.subcontractId, sc.id)))
  );
  const disputedCount = allInvs.flat().filter(i => i.status === "PAYMENT_DISPUTED").length;

  return {
    subcontractCount: subcontracts.length,
    totalApprovedAmount: scoreboards.reduce((s, sb) => s + sb.currentApprovedTotal, 0),
    totalInvoiced: scoreboards.reduce((s, sb) => s + sb.invoicedTotal, 0),
    hasFlaggedInvoices: scoreboards.some(sb => sb.hasFlaggedInvoices),
    totalCOApproved: scoreboards.reduce((s, sb) => s + sb.coTotal, 0),
    disputedCount,
  };
}

async function getProjectWithDetails(projectId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;

  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);

  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
  const membersWithUsers = await Promise.all(members.map(async (m) => {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    return { ...m, user };
  }));

  const bids = await db.select().from(bidsTable).where(eq(bidsTable.projectId, projectId));
  const bidsWithSubs = await Promise.all(bids.map(async (b) => {
    const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, b.subId)).limit(1);
    return { ...b, sub };
  }));

  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  const subcontractsWithDetails = await Promise.all(subcontracts.map(async (sc) => {
    const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    const scoreboard = await computeSubcontractScoreboard(sc.id, sc.baseContractAmount);
    return { ...sc, project: { ...project, gc }, sub, scoreboard };
  }));

  return { ...project, gc, members: membersWithUsers, bids: bidsWithSubs, subcontracts: subcontractsWithDetails };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let projects: any[];

  if (user.role === "GC") {
    // Exclude archived projects from the main list
    const gcProjects = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.gcId, user.id), isNull(projectsTable.archivedAt)));
    projects = await Promise.all(gcProjects.map(async (p) => {
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
      const financialSummary = await getProjectFinancialSummary(p.id);
      return { ...p, gc, financialSummary };
    }));
  } else {
    const memberships = await db.select({ projectId: projectMembersTable.projectId }).from(projectMembersTable).where(eq(projectMembersTable.userId, user.id));
    const projectIds = memberships.map(m => m.projectId);
    if (projectIds.length === 0) {
      res.json([]);
      return;
    }
    // Subs see non-archived projects
    const subProjects = await db.select().from(projectsTable)
      .where(and(inArray(projectsTable.id, projectIds), isNull(projectsTable.archivedAt)));
    projects = await Promise.all(subProjects.map(async (p) => {
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
      return { ...p, gc };
    }));
  }

  res.json(projects);
});

// GC: get archived projects with optional search
router.get("/archived", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const search = (req.query.search as string | undefined)?.trim() ?? "";

  let query = db.select().from(projectsTable)
    .where(and(eq(projectsTable.gcId, user.id), isNotNull(projectsTable.archivedAt)));

  const archivedProjects = await query;

  // Filter by name or address (case-insensitive in JS for simplicity)
  const filtered = search
    ? archivedProjects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.address ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : archivedProjects;

  // Sort newest archived first
  filtered.sort((a, b) => new Date(b.archivedAt!).getTime() - new Date(a.archivedAt!).getTime());

  const result = await Promise.all(filtered.map(async (p) => {
    const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
    const archivedSummary = await computeArchivedSummary(p.id);
    return { ...p, gc, archivedSummary };
  }));

  res.json(result);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { name, address, description, estimatedStartDate } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const planInfo = await getGCPlanInfo(user.id);
  // First project is always free
  if (planInfo.activeCount >= 1) {
    if (!planInfo.subscribed) {
      res.status(402).json({
        error: "SUBSCRIPTION_REQUIRED",
        message: "Choose a plan to manage more than one project.",
        activeCount: planInfo.activeCount,
      });
      return;
    }
    if (planInfo.limit !== null && planInfo.activeCount >= planInfo.limit) {
      res.status(402).json({
        error: "PLAN_LIMIT_REACHED",
        message: `You have reached your plan limit of ${planInfo.limit} active projects. Upgrade your plan to add more projects or mark an existing project as Complete to free up a slot.`,
        activeCount: planInfo.activeCount,
        limit: planInfo.limit,
        planName: planInfo.planName,
        nextPlan: planInfo.nextPlan,
      });
      return;
    }
  }

  const [project] = await db.insert(projectsTable).values({
    name,
    gcId: user.id,
    address: address || null,
    description: description || null,
    estimatedStartDate: estimatedStartDate || null,
  }).returning();
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  res.status(201).json({ ...project, gc });
});

router.get("/gc/disputed-invoices", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const gcProjects = await db.select().from(projectsTable).where(eq(projectsTable.gcId, gcUser.id));
  if (gcProjects.length === 0) { res.json([]); return; }

  const projectIds = gcProjects.map(p => p.id);
  const subcontracts = await db.select().from(subcontractsTable).where(inArray(subcontractsTable.projectId, projectIds));
  if (subcontracts.length === 0) { res.json([]); return; }

  const scIds = subcontracts.map(sc => sc.id);
  const disputedInvoices = await db.select().from(invoicesTable)
    .where(and(inArray(invoicesTable.subcontractId, scIds), eq(invoicesTable.status, "PAYMENT_DISPUTED")));

  const result = await Promise.all(disputedInvoices.map(async (inv) => {
    const sc = subcontracts.find(s => s.id === inv.subcontractId)!;
    const project = gcProjects.find(p => p.id === sc.projectId)!;
    const [subUser] = await db.select({ companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      disputeReason: inv.disputeReason ?? null,
      updatedAt: inv.updatedAt.toISOString(),
      projectId: project.id,
      projectName: project.name,
      subcontractId: sc.id,
      subCompanyName: subUser?.companyName ?? "Unknown",
    };
  }));

  res.json(result);
});

router.get("/:projectId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const detail = await getProjectWithDetails(req.params.projectId);
  if (!detail) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  // Strip notes for non-GC users
  if (user.role !== "GC" || user.id !== detail.gcId) {
    const { notes: _notes, ...rest } = detail as any;
    res.json(rest);
    return;
  }
  res.json(detail);
});

// GC: archive a CLOSED project
router.post("/:projectId/archive", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (project.status !== "CLOSED") {
    res.status(400).json({ error: "Only closed projects can be archived. Change the project status to Closed first." });
    return;
  }
  if (project.archivedAt) {
    res.status(400).json({ error: "Project is already archived" });
    return;
  }
  const [updated] = await db.update(projectsTable)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(projectsTable.id, req.params.projectId))
    .returning();
  res.json(updated);
});

// GC: unarchive a project — moves it back to CLOSED
router.post("/:projectId/unarchive", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!project.archivedAt) {
    res.status(400).json({ error: "Project is not archived" });
    return;
  }
  const [updated] = await db.update(projectsTable)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(projectsTable.id, req.params.projectId))
    .returning();
  res.json(updated);
});

router.patch("/:projectId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.gcId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (project.archivedAt) {
    res.status(400).json({ error: "Archived projects cannot be edited. Unarchive the project first." });
    return;
  }
  const { name, address, description, estimatedStartDate, notes } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address || null;
  if (description !== undefined) updates.description = description || null;
  if (estimatedStartDate !== undefined) updates.estimatedStartDate = estimatedStartDate || null;
  if (notes !== undefined) updates.notes = notes || null;

  await db.update(projectsTable).set(updates).where(eq(projectsTable.id, req.params.projectId));
  const detail = await getProjectWithDetails(req.params.projectId);
  res.json(detail);
});

router.post("/:projectId/invite", requireAuth, requireGC, async (req, res) => {
  const { email, companyName } = req.body;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let [invitedUser] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  let isNewUser = false;
  let temporaryPassword: string | undefined;

  if (!invitedUser) {
    if (!companyName) {
      res.status(400).json({ error: "companyName is required for new subcontractors" });
      return;
    }
    temporaryPassword = generateTempPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const [created] = await db.insert(usersTable).values({
      email,
      passwordHash,
      role: "SUB",
      companyName,
      mustChangePassword: true,
    }).returning();
    invitedUser = created;
    isNewUser = true;
  }

  if (invitedUser.role !== "SUB") {
    res.status(400).json({ error: "Can only invite subcontractors" });
    return;
  }

  const existing = await db.select().from(projectMembersTable)
    .where(eq(projectMembersTable.projectId, req.params.projectId))
    .then(rows => rows.find(r => r.userId === invitedUser.id));
  if (existing) {
    res.status(400).json({ error: "This subcontractor is already on the project" });
    return;
  }

  await db.insert(projectMembersTable).values({ projectId: req.params.projectId, userId: invitedUser.id, roleOnProject: "SUB" });

  const gcUser = (req as any).user;
  const existingContact = await db.select().from(gcContactsTable)
    .where(and(eq(gcContactsTable.gcId, gcUser.id), eq(gcContactsTable.subId, invitedUser.id))).limit(1);
  if (existingContact.length === 0) {
    await db.insert(gcContactsTable).values({ gcId: gcUser.id, subId: invitedUser.id }).onConflictDoNothing();
  }

  if (isNewUser && temporaryPassword) {
    const appUrl = process.env.APP_URL || `https://${req.hostname}`;
    sendInviteEmail({
      toEmail: email,
      temporaryPassword,
      projectName: project.name,
      appUrl,
    }).catch((err) => console.error("[email] Failed to send invite email:", err));
  }

  res.status(201).json({
    message: isNewUser ? "Subcontractor account created and invited" : "Subcontractor invited",
    isNewUser,
    ...(temporaryPassword ? { temporaryPassword } : {}),
  });
});

router.delete("/:projectId/members/:userId", requireAuth, requireGC, async (req, res) => {
  const { projectId, userId } = req.params;
  const gcUser = (req as any).user;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.gcId !== gcUser.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (project.status !== "BIDDING") {
    res.status(400).json({ error: "Subcontractors can only be removed while the project is in BIDDING status" });
    return;
  }

  // Check if sub has an awarded bid on this project
  const awardedBids = await db
    .select()
    .from(bidsTable)
    .where(and(
      eq(bidsTable.projectId, projectId),
      eq(bidsTable.subId, userId),
      eq(bidsTable.status, "AWARDED")
    ));
  if (awardedBids.length > 0) {
    res.status(400).json({ error: "This subcontractor has an awarded bid on this project and cannot be removed. Cancel the subcontract first." });
    return;
  }

  // Check if sub has an active subcontract on this project
  const activeSubcontracts = await db
    .select()
    .from(subcontractsTable)
    .where(and(
      eq(subcontractsTable.projectId, projectId),
      eq(subcontractsTable.subId, userId)
    ));
  if (activeSubcontracts.length > 0) {
    res.status(400).json({ error: "This subcontractor has an active subcontract on this project and cannot be removed." });
    return;
  }

  // Check membership exists
  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(
      eq(projectMembersTable.projectId, projectId),
      eq(projectMembersTable.userId, userId)
    ))
    .limit(1);
  if (!membership) {
    res.status(404).json({ error: "Subcontractor is not a member of this project" });
    return;
  }

  // Cancel any pending bids
  await db
    .update(bidsTable)
    .set({ status: "REJECTED" })
    .where(and(
      eq(bidsTable.projectId, projectId),
      eq(bidsTable.subId, userId),
      eq(bidsTable.status, "PENDING")
    ));

  // Remove from project
  await db
    .delete(projectMembersTable)
    .where(and(
      eq(projectMembersTable.projectId, projectId),
      eq(projectMembersTable.userId, userId)
    ));

  // Look up sub info for email
  const [sub] = await db
    .select({ email: usersTable.email, companyName: usersTable.companyName })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const [gc] = await db
    .select({ companyName: usersTable.companyName })
    .from(usersTable)
    .where(eq(usersTable.id, gcUser.id))
    .limit(1);

  if (sub) {
    const appUrl = process.env.APP_URL || `https://${req.hostname}`;
    sendSubRemovedEmail({
      toEmail: sub.email,
      subCompanyName: sub.companyName,
      gcCompanyName: gc?.companyName ?? "the GC",
      projectName: project.name,
      appUrl,
    }).catch(err => console.error("[email] sendSubRemovedEmail failed:", err));
  }

  res.status(204).send();
});

// GC: get all change orders across all subcontracts for a project
router.get("/:projectId/change-orders", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, req.params.projectId));
  if (subcontracts.length === 0) { res.json([]); return; }

  const scIds = subcontracts.map(sc => sc.id);
  const cos = await db.select().from(changeOrdersTable).where(inArray(changeOrdersTable.subcontractId, scIds));

  // Attach sub info to each CO
  const result = await Promise.all(cos.map(async (co) => {
    const sc = subcontracts.find(s => s.id === co.subcontractId)!;
    const [sub] = await db.select({ companyName: usersTable.companyName, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    return {
      ...co,
      subContractId: sc.id,
      tradeCategory: sc.tradeCategory ?? null,
      subCompanyName: sub?.companyName ?? "Unknown",
    };
  }));

  // Sort newest first
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(result);
});

// GC: create change orders for multiple subcontracts at once (bulk CO)
router.post("/:projectId/change-orders/bulk", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { description, scope, entries } = req.body;
  // entries: Array<{ subcontractId: string; amount: number }>
  if (!description || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "description and at least one entry are required" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (project.archivedAt) { res.status(400).json({ error: "Archived projects cannot accept new change orders." }); return; }

  // Validate all subcontracts belong to this project
  const scIds = entries.map((e: any) => e.subcontractId);
  const subcontracts = await db.select().from(subcontractsTable)
    .where(and(inArray(subcontractsTable.id, scIds), eq(subcontractsTable.projectId, req.params.projectId)));
  if (subcontracts.length !== scIds.length) {
    res.status(400).json({ error: "One or more subcontracts are invalid or don't belong to this project" });
    return;
  }

  const appUrl = process.env.APP_URL || `https://${req.hostname}`;
  const gcUser = (req as any).user;
  const [gcUserData] = await db.select({ companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, gcUser.id)).limit(1);

  const created = await Promise.all(entries.map(async (entry: { subcontractId: string; amount: number }) => {
    const amount = Number(entry.amount);
    if (!amount || amount <= 0) return null;

    const [co] = await db.insert(changeOrdersTable).values({
      subcontractId: entry.subcontractId,
      description: String(description).trim(),
      scope: scope ? String(scope).trim() : null,
      amount,
      status: "PENDING_GC",
    }).returning();

    // Log activity
    await db.insert(activityLogsTable).values({
      subcontractId: entry.subcontractId,
      type: "CO_CREATED",
      description: `Change order "${description}" for $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} created`,
      actorName: gcUserData?.companyName ?? "GC",
      actorRole: "GC",
    }).catch(() => {});

    // Send email to sub
    const sc = subcontracts.find(s => s.id === entry.subcontractId)!;
    const [subUser] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    if (subUser) {
      sendChangeOrderCreatedEmail({
        toEmail: subUser.email,
        projectName: project.name,
        description: String(description).trim(),
        amount,
        appUrl,
      }).catch((err) => console.error("[email] bulk CO sendChangeOrderCreatedEmail failed:", err));
    }

    return co;
  }));

  res.status(201).json(created.filter(Boolean));
});

// List all signed lien waivers for a project
router.get("/:projectId/lien-waivers", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  // GC sees all; SUB sees only their own
  if (user.role === "GC") {
    if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    const waivers = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.projectId, projectId));
    res.json(waivers);
  } else {
    // SUB: verify they are a member of this project
    const [member] = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id))).limit(1);
    if (!member) { res.status(403).json({ error: "Forbidden" }); return; }

    // Get their subcontract for this project
    const [sc] = await db.select().from(subcontractsTable)
      .where(and(eq(subcontractsTable.projectId, projectId), eq(subcontractsTable.subId, user.id))).limit(1);
    if (!sc) { res.json([]); return; }

    const waivers = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.subcontractId, sc.id));
    res.json(waivers);
  }
});

// Download all lien waivers for a project as a ZIP (GC only)
router.get("/:projectId/lien-waivers/zip", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const waivers = await db.select().from(lienWaiversTable).where(eq(lienWaiversTable.projectId, projectId));
  if (waivers.length === 0) {
    res.status(404).json({ error: "No signed lien waivers found for this project" });
    return;
  }

  const safeName = project.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="LienWaivers_${safeName}.zip"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err: Error) => { res.status(500).json({ error: err.message }); });
  archive.pipe(res);

  for (const waiver of waivers) {
    const pdfBuffer = await generateLienWaiverPDF({ waiver });
    const filename = `LienWaiver_${waiver.subCompanyName.replace(/[^a-z0-9]/gi, "_")}_Invoice_${waiver.invoiceNumber}.pdf`;
    archive.append(pdfBuffer, { name: filename });
  }

  await archive.finalize();
});

// GC dashboard: get unsigned lien waivers count (PAYMENT_UNCONFIRMED invoices without a signed waiver)
router.get("/gc/unsigned-lien-waivers", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;

  const gcProjects = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.gcId, user.id), isNull(projectsTable.archivedAt)));
  const projectIds = gcProjects.map(p => p.id);

  if (projectIds.length === 0) { res.json({ count: 0 }); return; }

  const scs = await db.select({ id: subcontractsTable.id }).from(subcontractsTable)
    .where(inArray(subcontractsTable.projectId, projectIds));
  const scIds = scs.map(s => s.id);

  if (scIds.length === 0) { res.json({ count: 0 }); return; }

  // Get all PAYMENT_UNCONFIRMED invoices across these subcontracts
  const unconfirmedInvs = await db.select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(and(inArray(invoicesTable.subcontractId, scIds), eq(invoicesTable.status, "PAYMENT_UNCONFIRMED")));

  if (unconfirmedInvs.length === 0) { res.json({ count: 0 }); return; }

  const invoiceIds = unconfirmedInvs.map(i => i.id);
  const signedWaivers = await db.select({ invoiceId: lienWaiversTable.invoiceId })
    .from(lienWaiversTable)
    .where(inArray(lienWaiversTable.invoiceId, invoiceIds));

  const signedInvoiceIds = new Set(signedWaivers.map(w => w.invoiceId));
  const unsigned = invoiceIds.filter(id => !signedInvoiceIds.has(id));

  res.json({ count: unsigned.length });
});

export default router;
