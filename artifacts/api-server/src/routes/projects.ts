import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, usersTable, bidsTable, subcontractsTable, changeOrdersTable, invoicesTable } from "@workspace/db/schema";
import { eq, or, inArray, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { hashPassword } from "../lib/auth.js";
import { sendInviteEmail, sendSubRemovedEmail } from "../lib/email.js";

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
  const hasFlaggedInvoices = invs.some(i => i.status === "FLAGGED");

  const sortedInvs = [...invs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastInvoice = sortedInvs[0] ?? null;

  return { base: baseContractAmount, coTotal, currentApprovedTotal, invoicedTotal, remaining, hasFlaggedInvoices, lastInvoice };
}

async function getProjectFinancialSummary(projectId: string) {
  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  if (subcontracts.length === 0) {
    return { subcontractCount: 0, totalApprovedAmount: 0, totalInvoiced: 0, hasFlaggedInvoices: false, totalCOApproved: 0 };
  }

  const scoreboards = await Promise.all(
    subcontracts.map(sc => computeSubcontractScoreboard(sc.id, sc.baseContractAmount))
  );

  return {
    subcontractCount: subcontracts.length,
    totalApprovedAmount: scoreboards.reduce((s, sb) => s + sb.currentApprovedTotal, 0),
    totalInvoiced: scoreboards.reduce((s, sb) => s + sb.invoicedTotal, 0),
    hasFlaggedInvoices: scoreboards.some(sb => sb.hasFlaggedInvoices),
    totalCOApproved: scoreboards.reduce((s, sb) => s + sb.coTotal, 0),
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
    const gcProjects = await db.select().from(projectsTable).where(eq(projectsTable.gcId, user.id));
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
    const subProjects = await db.select().from(projectsTable).where(inArray(projectsTable.id, projectIds));
    projects = await Promise.all(subProjects.map(async (p) => {
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
      return { ...p, gc };
    }));
  }

  res.json(projects);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { name, address, description, estimatedStartDate } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
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

export default router;
