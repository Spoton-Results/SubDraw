import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, usersTable, bidsTable, subcontractsTable, changeOrdersTable, invoicesTable, gcContactsTable, activityLogsTable, lienWaiversTable, subcontractInsurancesTable, contractorLicensesTable, gcProjectAssignmentsTable, magicLinkTokensTable, drawScheduleItemsTable, subcontractCommentsTable, subcontractCommentReadsTable, ownerCoNotificationsTable, projectCompletionDocumentsTable } from "@workspace/db/schema";
import { eq, or, inArray, and, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import archiver from "archiver";
import { requireAuth, requireGC, requireGCOwner } from "../middlewares/requireAuth.js";
import { getEffectiveGcId, isProjectManager, getActorName, getActorRoleLabel, canSeeAllProjects, isBiddingOnlyRole } from "../lib/auth.js";
import { sendInviteEmail, sendAddedToProjectEmail, sendSubRemovedEmail, sendChangeOrderCreatedEmail, sendOwnerCoNotificationEmail, buildOwnerReplyPage } from "../lib/email.js";
import { getGCPlanInfo, getActiveProjectCount } from "../lib/stripeStorage.js";
import { generateLienWaiverPDF } from "../lib/pdfLienWaiver.js";
import { generateDrawSchedulePDF } from "../lib/pdfDrawSchedule.js";

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

async function getProjectWithDetails(projectId: string, requestingUserId?: string) {
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
    const unreadCommentCount = requestingUserId ? await (async () => {
      const [readRow] = await db.select().from(subcontractCommentReadsTable)
        .where(and(eq(subcontractCommentReadsTable.subcontractId, sc.id), eq(subcontractCommentReadsTable.userId, requestingUserId)))
        .limit(1);
      const comments = await db.select().from(subcontractCommentsTable)
        .where(eq(subcontractCommentsTable.subcontractId, sc.id));
      return comments.filter(c => c.userId !== requestingUserId && (!readRow || c.createdAt > readRow.lastReadAt)).length;
    })() : 0;
    return { ...sc, project: { ...project, gc }, sub, scoreboard, unreadCommentCount };
  }));

  return { ...project, gc, members: membersWithUsers, bids: bidsWithSubs, subcontracts: subcontractsWithDetails };
}

// ── Owner CO notification helper ──────────────────────────────────────────────
export async function triggerOwnerCoNotification(opts: {
  projectId: string;
  changeOrderId: string;
  changeOrderDescription: string;
  changeOrderAmount: number;
  subcontractId: string;
  gcCompanyName: string;
  appUrl: string;
}) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, opts.projectId)).limit(1);
  if (!project || !project.ownerEmail || !project.ownerName) return;
  if (project.ownerCoThreshold !== null && project.ownerCoThreshold !== undefined && Math.abs(opts.changeOrderAmount) < project.ownerCoThreshold) return;

  // Compute total project budget before this CO
  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, opts.projectId));
  let previousBudget = 0;
  for (const sc of subcontracts) {
    const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, sc.id));
    const approvedCOs = cos.filter(c => c.status === "APPROVED" && c.id !== opts.changeOrderId);
    previousBudget += sc.baseContractAmount + approvedCOs.reduce((s, c) => s + c.amount, 0);
  }
  const newBudget = previousBudget + opts.changeOrderAmount;

  // Deduplicate: only notify once per CO per owner email
  const [existing] = await db.select().from(ownerCoNotificationsTable)
    .where(and(
      eq(ownerCoNotificationsTable.changeOrderId, opts.changeOrderId),
      eq(ownerCoNotificationsTable.ownerEmail, project.ownerEmail)
    )).limit(1);
  if (existing) return;

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(ownerCoNotificationsTable).values({
    projectId: opts.projectId,
    changeOrderId: opts.changeOrderId,
    notificationToken: token,
    ownerName: project.ownerName,
    ownerEmail: project.ownerEmail,
  });

  const baseUrl = opts.appUrl;
  const approveUrl = `${baseUrl}/api/projects/${opts.projectId}/owner-reply?token=${token}&action=approve`;
  const rejectUrl = `${baseUrl}/api/projects/${opts.projectId}/owner-reply?token=${token}&action=reject`;

  sendOwnerCoNotificationEmail({
    toEmail: project.ownerEmail,
    ownerName: project.ownerName,
    gcCompanyName: opts.gcCompanyName,
    projectName: project.name,
    projectAddress: project.address,
    coDescription: opts.changeOrderDescription,
    coAmount: opts.changeOrderAmount,
    previousBudget,
    newBudget,
    approveUrl,
    rejectUrl,
  }).catch(err => console.error("[email] sendOwnerCoNotificationEmail failed:", err));

  // Log to activity log
  await db.insert(activityLogsTable).values({
    subcontractId: opts.subcontractId,
    type: "OWNER_CO_NOTIFICATION_SENT",
    description: `Owner notification sent to ${project.ownerName} (${project.ownerEmail}) for change order "${opts.changeOrderDescription}"`,
    actorName: opts.gcCompanyName,
    actorRole: "GC",
  }).catch(() => {});
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let projects: any[];

  if (user.role === "GC") {
    const effectiveGcId = getEffectiveGcId(user);

    let gcProjectsList;
    if (canSeeAllProjects(user)) {
      // Owner, VP of Operations, Contract Administrator, Accountant — see all GC projects
      gcProjectsList = await db.select().from(projectsTable)
        .where(and(eq(projectsTable.gcId, effectiveGcId), isNull(projectsTable.archivedAt)));
    } else {
      // Project-assigned roles (PM, PE, Superintendent, Estimator) — only assigned projects
      const assignments = await db
        .select({ projectId: gcProjectAssignmentsTable.projectId })
        .from(gcProjectAssignmentsTable)
        .where(eq(gcProjectAssignmentsTable.teamMemberUserId, user.id));
      const assignedIds = assignments.map((a) => a.projectId);
      if (assignedIds.length === 0) {
        res.json([]);
        return;
      }
      if (isBiddingOnlyRole(user)) {
        // Estimators only see projects in the BIDDING phase
        gcProjectsList = await db.select().from(projectsTable)
          .where(and(inArray(projectsTable.id, assignedIds), isNull(projectsTable.archivedAt), eq(projectsTable.status, "BIDDING")));
      } else {
        gcProjectsList = await db.select().from(projectsTable)
          .where(and(inArray(projectsTable.id, assignedIds), isNull(projectsTable.archivedAt)));
      }
    }

    projects = await Promise.all(gcProjectsList.map(async (p) => {
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
  const effectiveGcId = getEffectiveGcId(user);
  const search = (req.query.search as string | undefined)?.trim() ?? "";

  let query = db.select().from(projectsTable)
    .where(and(eq(projectsTable.gcId, effectiveGcId), isNotNull(projectsTable.archivedAt)));

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

router.post("/", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const { name, address, description, estimatedStartDate } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  if (user.isDemo) {
    res.status(403).json({ error: "Demo accounts cannot create new projects. Sign up to create your own projects." });
    return;
  }
  const planInfo = await getGCPlanInfo(effectiveGcId);
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
    gcId: effectiveGcId,
    address: address || null,
    description: description || null,
    estimatedStartDate: estimatedStartDate || null,
  }).returning();
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, effectiveGcId)).limit(1);
  res.status(201).json({ ...project, gc });
});

// ── GC: Consolidated action-required items across all active projects ─────────
router.get("/gc/action-items", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const effectiveGcId = getEffectiveGcId(gcUser);

  // 1. All non-archived GC projects
  const gcProjects = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.gcId, effectiveGcId), isNull(projectsTable.archivedAt)));
  if (gcProjects.length === 0) { res.json([]); return; }

  const projectIds = gcProjects.map(p => p.id);
  const projectMap = Object.fromEntries(gcProjects.map(p => [p.id, p]));

  // 2. All subcontracts
  const subcontracts = await db.select().from(subcontractsTable)
    .where(inArray(subcontractsTable.projectId, projectIds));
  if (subcontracts.length === 0) { res.json([]); return; }

  const scIds = subcontracts.map(sc => sc.id);
  const scMap = Object.fromEntries(subcontracts.map(sc => [sc.id, sc]));

  // 3. Batch-fetch invoices, change orders, insurances, sub users
  const [allInvoices, allCOs, allInsurances, subUsers] = await Promise.all([
    db.select().from(invoicesTable).where(inArray(invoicesTable.subcontractId, scIds)),
    db.select().from(changeOrdersTable).where(inArray(changeOrdersTable.subcontractId, scIds)),
    db.select().from(subcontractInsurancesTable).where(inArray(subcontractInsurancesTable.subcontractId, scIds)),
    db.select({ id: usersTable.id, companyName: usersTable.companyName })
      .from(usersTable)
      .where(inArray(usersTable.id, [...new Set(subcontracts.map(sc => sc.subId))])),
  ]);

  const subUserMap = Object.fromEntries(subUsers.map(u => [u.id, u.companyName ?? "Unknown"]));

  // helpers
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  type ActionItem = {
    id: string;
    type: string;
    urgency: "URGENT" | "PENDING" | "UPCOMING";
    projectId: string;
    projectName: string;
    subcontractId: string;
    subCompanyName: string;
    description: string;
    amount?: number;
    overAmount?: number;
    expiresAt?: string;
    href: string;
  };

  const items: ActionItem[] = [];

  // Pre-compute per-subcontract scoreboard (for flagged invoice over-amount)
  const scScoreboard: Record<string, { approvedTotal: number; totalApproved: number }> = {};
  for (const sc of subcontracts) {
    const cos = allCOs.filter(c => c.subcontractId === sc.id && c.status === "APPROVED");
    const approvedInvs = allInvoices.filter(i => i.subcontractId === sc.id && i.status === "APPROVED");
    const coTotal = cos.reduce((s, c) => s + c.amount, 0);
    const approvedTotal = sc.contractAmount + coTotal;
    const totalApproved = approvedInvs.reduce((s, i) => s + i.amount, 0);
    scScoreboard[sc.id] = { approvedTotal, totalApproved };
  }

  for (const inv of allInvoices) {
    const sc = scMap[inv.subcontractId];
    if (!sc) continue;
    const project = projectMap[sc.projectId];
    if (!project) continue;
    const subName = subUserMap[sc.subId] ?? "Unknown";
    const href = `/subcontracts/${sc.id}`;

    // URGENT: Flagged invoices (over approved total)
    if (inv.status === "FLAGGED") {
      const { approvedTotal, totalApproved } = scScoreboard[sc.id];
      const remaining = approvedTotal - totalApproved;
      const overAmount = Math.max(0, inv.amount - remaining);
      items.push({
        id: `flagged-${inv.id}`,
        type: "FLAGGED_INVOICE",
        urgency: "URGENT",
        projectId: project.id,
        projectName: project.name,
        subcontractId: sc.id,
        subCompanyName: subName,
        description: `Invoice #${inv.invoiceNumber} for ${subName} exceeds the approved contract total`,
        amount: inv.amount,
        overAmount,
        href,
      });
    }

    // PENDING: Invoices waiting for GC approval
    if (inv.status === "PENDING") {
      items.push({
        id: `pending-${inv.id}`,
        type: "PENDING_INVOICE",
        urgency: "PENDING",
        projectId: project.id,
        projectName: project.name,
        subcontractId: sc.id,
        subCompanyName: subName,
        description: `Invoice #${inv.invoiceNumber} from ${subName} is awaiting your approval`,
        amount: inv.amount,
        href,
      });
    }

    // URGENT: Disputed payments
    if (inv.status === "PAYMENT_DISPUTED") {
      items.push({
        id: `disputed-${inv.id}`,
        type: "DISPUTED_PAYMENT",
        urgency: "URGENT",
        projectId: project.id,
        projectName: project.name,
        subcontractId: sc.id,
        subCompanyName: subName,
        description: `${subName} disputed the payment record for Invoice #${inv.invoiceNumber}`,
        amount: inv.amount,
        href,
      });
    }

    // URGENT: Approved invoices past their payment due date
    if (inv.status === "APPROVED") {
      const paymentDueDate = (inv as any).paymentDueDate
        ? new Date((inv as any).paymentDueDate)
        : null;
      if (paymentDueDate && paymentDueDate < now) {
        const sc2 = scMap[inv.subcontractId];
        const terms = sc2 ? ((sc2 as any).paymentTermsDays ?? 30) : 30;
        items.push({
          id: `pastdue-${inv.id}`,
          type: "PAST_DUE_INVOICE",
          urgency: "URGENT",
          projectId: project.id,
          projectName: project.name,
          subcontractId: sc.id,
          subCompanyName: subName,
          description: `Invoice #${inv.invoiceNumber} for ${subName} was approved but payment is overdue (Net ${terms})`,
          amount: inv.amount,
          href,
        });
      }
    }
  }

  // PENDING: Uploaded contracts awaiting sub's signed copy
  for (const sc of subcontracts) {
    const hasDoc = !!(sc as any).contractDocPath;
    const hasSigned = !!(sc as any).signedContractPath;
    const isWaived = !!(sc as any).contractWaived;
    if (hasDoc && !hasSigned && !isWaived) {
      const project = projectMap[sc.projectId];
      if (!project) continue;
      const subName = subUserMap[sc.subId] ?? "Unknown";
      items.push({
        id: `unsigned-${sc.id}`,
        type: "UNSIGNED_CONTRACT",
        urgency: "PENDING",
        projectId: project.id,
        projectName: project.name,
        subcontractId: sc.id,
        subCompanyName: subName,
        description: `${subName} has not yet uploaded their signed subcontract`,
        href: `/subcontracts/${sc.id}`,
      });
    }
  }

  // UPCOMING: Insurance expiring within 30 days
  for (const ins of allInsurances) {
    const sc = scMap[ins.subcontractId];
    if (!sc) continue;
    const project = projectMap[sc.projectId];
    if (!project) continue;
    if (!ins.expirationDate) continue;
    const expDate = new Date(ins.expirationDate);
    if (expDate > now && expDate <= in30Days) {
      const subName = subUserMap[sc.subId] ?? "Unknown";
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      items.push({
        id: `insurance-${ins.id}`,
        type: "INSURANCE_EXPIRING",
        urgency: "UPCOMING",
        projectId: project.id,
        projectName: project.name,
        subcontractId: sc.id,
        subCompanyName: subName,
        description: `${subName}'s insurance certificate expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        expiresAt: ins.expirationDate,
        href: `/subcontracts/${sc.id}`,
      });
    }
  }

  // UPCOMING: Projected overruns — subcontracts where billing pace projects exceeding approved total
  for (const sc of subcontracts) {
    const scInvs = allInvoices.filter(i => i.subcontractId === sc.id);
    const cos = allCOs.filter(c => c.subcontractId === sc.id && c.status === "APPROVED");
    const coTotal = cos.reduce((s, c) => s + c.amount, 0);
    const currentApprovedTotal = sc.baseContractAmount + coTotal;
    const grossInvoiced = scInvs
      .filter(i => ["APPROVED", "PAYMENT_UNCONFIRMED", "PAYMENT_CONFIRMED"].includes(i.status))
      .reduce((s, i) => s + i.amount, 0);
    const sortedScInvs = [...scInvs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestPctInv = sortedScInvs.find(i =>
      !i.isRetentionRelease && i.status !== "REJECTED" && i.status !== "CANCELLED" && i.percentageComplete != null
    );
    if (latestPctInv && latestPctInv.percentageComplete != null && latestPctInv.percentageComplete > 0 && grossInvoiced > 0) {
      const projectedFinalCost = (grossInvoiced / latestPctInv.percentageComplete) * 100;
      if (projectedFinalCost > currentApprovedTotal) {
        const overrunAmount = projectedFinalCost - currentApprovedTotal;
        const project = projectMap[sc.projectId];
        if (!project) continue;
        const subName = subUserMap[sc.subId] ?? "Unknown";
        items.push({
          id: `overrun-${sc.id}`,
          type: "PROJECTED_OVERRUN",
          urgency: "UPCOMING",
          projectId: project.id,
          projectName: project.name,
          subcontractId: sc.id,
          subCompanyName: subName,
          description: `${subName} is projected to exceed their approved contract at the current billing rate`,
          amount: Math.round(projectedFinalCost),
          overAmount: Math.round(overrunAmount),
          href: `/subcontracts/${sc.id}`,
        });
      }
    }
  }

  // Sort: URGENT first, PENDING second, UPCOMING third
  const urgencyOrder = { URGENT: 0, PENDING: 1, UPCOMING: 2 };
  items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  res.json(items);
});

router.get("/gc/disputed-invoices", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const effectiveGcId = getEffectiveGcId(gcUser);
  const gcProjects = await db.select().from(projectsTable).where(eq(projectsTable.gcId, effectiveGcId));
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

  // For subs: verify they are a project member before loading any project data
  if (user.role === "SUB") {
    const [membership] = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, req.params.projectId), eq(projectMembersTable.userId, user.id)))
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const detail = await getProjectWithDetails(req.params.projectId, user.id);
  if (!detail) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const effectiveGcId = getEffectiveGcId(user);
  const isGC = user.role === "GC" && effectiveGcId === (detail as any).gcId;

  if (!isGC) {
    if (user.role === "SUB") {
      // Subs only see their own bid and their own subcontract — never other subs' data
      const { notes: _notes, members: _members, bids, subcontracts, ...rest } = detail as any;
      res.json({
        ...rest,
        bids: (bids ?? []).filter((b: any) => b.subId === user.id),
        subcontracts: (subcontracts ?? []).filter((s: any) => s.subId === user.id),
      });
      return;
    }
    // GC team member (different GC account) — reject outright
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(detail);
});

// GC: mark a CONSTRUCTION project as COMPLETE
router.post("/:projectId/complete", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (project.status === "COMPLETE") { res.status(400).json({ error: "Project is already marked complete" }); return; }
  if (project.archivedAt) { res.status(400).json({ error: "Archived projects cannot be modified" }); return; }
  const { completionNote, retentionWaived } = req.body ?? {};
  const [updated] = await db.update(projectsTable)
    .set({
      status: "COMPLETE",
      completionNote: completionNote?.trim() || null,
      retentionWaived: retentionWaived === true,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, req.params.projectId))
    .returning();
  res.json(updated);
});

// GC: register a completion document (called after client uploads to object storage)
router.post("/:projectId/completion-documents", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { fileName, objectPath, fileSize, category, label } = req.body;
  if (!fileName || !objectPath) { res.status(400).json({ error: "fileName and objectPath are required" }); return; }
  const [doc] = await db.insert(projectCompletionDocumentsTable).values({
    projectId: req.params.projectId,
    fileName,
    objectPath,
    fileSize: fileSize ?? null,
    category: category ?? "document",
    label: label ?? null,
    uploadedBy: user.companyName ?? user.email ?? "GC",
  }).returning();
  res.status(201).json(doc);
});

// GC: list completion documents for a project
router.get("/:projectId/completion-documents", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  const docs = await db.select().from(projectCompletionDocumentsTable)
    .where(eq(projectCompletionDocumentsTable.projectId, req.params.projectId))
    .orderBy(projectCompletionDocumentsTable.createdAt);
  res.json(docs);
});

// GC: archive a COMPLETE project
router.post("/:projectId/archive", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (project.status !== "COMPLETE") {
    res.status(400).json({ error: "Only completed projects can be archived. Mark the project as complete first." });
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

// GC: unarchive a project — moves it back to COMPLETE
router.post("/:projectId/unarchive", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
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
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.gcId !== effectiveGcId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (project.archivedAt) {
    res.status(400).json({ error: "Archived projects cannot be edited. Unarchive the project first." });
    return;
  }
  const { name, address, description, estimatedStartDate, notes, ownerName, ownerEmail, ownerCoThreshold } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address || null;
  if (description !== undefined) updates.description = description || null;
  if (estimatedStartDate !== undefined) updates.estimatedStartDate = estimatedStartDate || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (ownerName !== undefined) updates.ownerName = ownerName || null;
  if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail || null;
  if (ownerCoThreshold !== undefined) updates.ownerCoThreshold = ownerCoThreshold != null && ownerCoThreshold !== "" ? Number(ownerCoThreshold) : null;

  await db.update(projectsTable).set(updates).where(eq(projectsTable.id, req.params.projectId));
  const detail = await getProjectWithDetails(req.params.projectId, user.id);
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

  if (!invitedUser) {
    if (!companyName) {
      res.status(400).json({ error: "companyName is required for new subcontractors" });
      return;
    }
    // New magic-link-only users get a random non-bcrypt placeholder — they can't log in with a password
    const passwordHash = crypto.randomBytes(32).toString("hex");
    const [created] = await db.insert(usersTable).values({
      email,
      passwordHash,
      role: "SUB",
      companyName,
      mustChangePassword: false,
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
  const effectiveGcId = getEffectiveGcId(gcUser);
  const existingContact = await db.select().from(gcContactsTable)
    .where(and(eq(gcContactsTable.gcId, effectiveGcId), eq(gcContactsTable.subId, invitedUser.id))).limit(1);
  if (existingContact.length === 0) {
    await db.insert(gcContactsTable).values({ gcId: effectiveGcId, subId: invitedUser.id }).onConflictDoNothing();
  }

  const appUrl = process.env.APP_URL || `https://${req.hostname}`;

  // Generate a magic link token for the invited user
  const magicToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await db.insert(magicLinkTokensTable).values({ userId: invitedUser.id, token: magicToken, expiresAt });
  const magicUrl = `${appUrl}/api/auth/magic-link/verify?token=${magicToken}`;

  if (isNewUser) {
    sendInviteEmail({
      toEmail: email,
      projectName: project.name,
      magicUrl,
      appUrl,
    }).catch((err) => console.error("[email] Failed to send invite email:", err));
  } else {
    sendAddedToProjectEmail({
      toEmail: invitedUser.email,
      subCompanyName: invitedUser.companyName,
      projectName: project.name,
      appUrl: magicUrl,
    }).catch((err) => console.error("[email] Failed to send added-to-project email:", err));
  }

  res.status(201).json({
    message: isNewUser ? "Subcontractor account created and invited" : "Subcontractor invited",
    isNewUser,
  });
});

// Direct subcontract creation (construction phase — no bid required)
router.post("/:projectId/subcontracts/direct", requireAuth, requireGC, async (req, res) => {
  const gcUser = (req as any).user;
  const effectiveGcId = getEffectiveGcId(gcUser);
  const { projectId } = req.params;
  const { subId, email, companyName, baseContractAmount, tradeCategory, retentionPercentage, drawScheduleItemId } = req.body;

  if (!baseContractAmount || isNaN(Number(baseContractAmount)) || Number(baseContractAmount) <= 0) {
    res.status(400).json({ error: "baseContractAmount is required and must be positive" });
    return;
  }
  if (!subId && !email) {
    res.status(400).json({ error: "subId or email is required" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== effectiveGcId) {
    res.status(project ? 403 : 404).json({ error: project ? "Forbidden" : "Project not found" });
    return;
  }

  // Find or create the sub
  let sub: any;
  if (subId) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.id, subId)).limit(1);
    if (!found || found.role !== "SUB") {
      res.status(404).json({ error: "Subcontractor not found" });
      return;
    }
    sub = found;
  } else {
    let [found] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!found) {
      if (!companyName) {
        res.status(400).json({ error: "companyName is required for new subcontractors" });
        return;
      }
      const passwordHash = crypto.randomBytes(32).toString("hex");
      const [created] = await db.insert(usersTable).values({
        email, passwordHash, role: "SUB", companyName, mustChangePassword: false,
      }).returning();
      found = created;
    }
    if (found.role !== "SUB") {
      res.status(400).json({ error: "Can only add subcontractors" });
      return;
    }
    sub = found;
  }

  // Add to project members if not already
  const existingMembers = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, sub.id)));
  if (existingMembers.length === 0) {
    await db.insert(projectMembersTable).values({ projectId, userId: sub.id, roleOnProject: "SUB" });
  }

  // Add to GC contact book if not already
  await db.insert(gcContactsTable).values({ gcId: effectiveGcId, subId: sub.id }).onConflictDoNothing();

  // Prevent duplicate subcontracts
  const existing = await db.select().from(subcontractsTable)
    .where(and(eq(subcontractsTable.projectId, projectId), eq(subcontractsTable.subId, sub.id)));
  if (existing.length > 0) {
    res.status(400).json({ error: "A subcontract already exists for this subcontractor on this project" });
    return;
  }

  const retPct = Math.min(15, Math.max(0, Number(retentionPercentage ?? 10)));
  const [subcontract] = await db.insert(subcontractsTable).values({
    projectId,
    subId: sub.id,
    baseContractAmount: Number(baseContractAmount),
    tradeCategory: tradeCategory?.trim() || null,
    retentionPercentage: retPct,
    drawScheduleItemId: drawScheduleItemId || null,
  }).returning();

  await db.insert(activityLogsTable).values({
    subcontractId: subcontract.id,
    type: "SUBCONTRACT_CREATED",
    description: `Subcontract created for ${sub.companyName} for $${Number(baseContractAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    actorName: getActorName(gcUser),
    actorRole: getActorRoleLabel(gcUser),
  }).catch(err => console.error("[activity] Failed to log direct subcontract creation:", err));

  // Send added-to-project email with magic link
  const appUrl = process.env.APP_URL || `https://${req.hostname}`;
  const magicToken = crypto.randomBytes(32).toString("hex");
  await db.insert(magicLinkTokensTable).values({
    userId: sub.id, token: magicToken, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  });
  const magicUrl = `${appUrl}/api/auth/magic-link/verify?token=${magicToken}`;
  sendAddedToProjectEmail({
    toEmail: sub.email,
    subCompanyName: sub.companyName,
    projectName: project.name,
    appUrl: magicUrl,
  }).catch((err) => console.error("[email] Failed to send added-to-project email:", err));

  res.status(201).json({ ...subcontract, sub, project });
});

router.delete("/:projectId/members/:userId", requireAuth, requireGC, async (req, res) => {
  const { projectId, userId } = req.params;
  const gcUser = (req as any).user;
  const effectiveGcId = getEffectiveGcId(gcUser);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.gcId !== effectiveGcId) {
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
      actorName: getActorName(gcUser),
      actorRole: getActorRoleLabel(gcUser),
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

    // Trigger owner notification if threshold is met
    triggerOwnerCoNotification({
      projectId: project.id,
      changeOrderId: co.id,
      changeOrderDescription: co.description,
      changeOrderAmount: co.amount,
      subcontractId: entry.subcontractId,
      gcCompanyName: gcUserData?.companyName ?? "GC",
      appUrl,
    }).catch(err => console.error("[owner-notify] bulk CO failed:", err));

    return co;
  }));

  res.status(201).json(created.filter(Boolean));
});

// Owner CO notification: list all (GC-only)
router.get("/:projectId/owner-notifications", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const effectiveGcId = getEffectiveGcId(user);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  const notifications = await db.select().from(ownerCoNotificationsTable)
    .where(eq(ownerCoNotificationsTable.projectId, req.params.projectId));
  const withCO = await Promise.all(notifications.map(async (n) => {
    const [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, n.changeOrderId)).limit(1);
    return { ...n, changeOrder: co ?? null };
  }));
  withCO.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(withCO);
});

// Owner CO reply — PUBLIC, no auth needed (token-based)
router.get("/:projectId/owner-reply", async (req, res) => {
  const { token, action } = req.query as { token?: string; action?: string };
  if (!token || !["approve", "reject"].includes(action ?? "")) {
    res.status(400).send("<h2>Invalid link. Please check the email and try again.</h2>"); return;
  }

  const [notification] = await db.select().from(ownerCoNotificationsTable)
    .where(eq(ownerCoNotificationsTable.notificationToken, token)).limit(1);
  if (!notification) {
    res.status(404).send("<h2>This link is invalid or has expired.</h2>"); return;
  }
  if (notification.ownerResponse) {
    const alreadyPage = buildOwnerReplyPage({
      ownerName: notification.ownerName,
      projectName: "the project",
      coDescription: "this change order",
      action: notification.ownerResponse as "APPROVED" | "REJECTED",
    });
    res.send(alreadyPage); return;
  }

  const response = action === "approve" ? "APPROVED" : "REJECTED";
  await db.update(ownerCoNotificationsTable).set({
    ownerResponse: response,
    ownerResponseAt: new Date(),
  }).where(eq(ownerCoNotificationsTable.id, notification.id));

  // Fetch CO and project for logging and activity
  const [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, notification.changeOrderId)).limit(1);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, notification.projectId)).limit(1);

  if (co && project) {
    // Log to activity on the subcontract
    await db.insert(activityLogsTable).values({
      subcontractId: co.subcontractId,
      type: "OWNER_CO_RESPONSE",
      description: `Project owner ${notification.ownerName} ${response === "APPROVED" ? "approved" : "rejected"} change order "${co.description}"`,
      actorName: notification.ownerName,
      actorRole: "OWNER",
    }).catch(() => {});
  }

  const html = buildOwnerReplyPage({
    ownerName: notification.ownerName,
    projectName: project?.name ?? "the project",
    coDescription: co?.description ?? "this change order",
    action: response,
  });
  res.send(html);
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

// ─── Insurance alerts ─────────────────────────────────────────────────────────

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

// GET /gc/insurance-alerts — summarize expired/expiring insurance counts for GC dashboard
// IMPORTANT: must be BEFORE /:projectId route
router.get("/gc/insurance-alerts", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;

  const gcProjects = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.gcId, user.id), isNull(projectsTable.archivedAt)));
  const projectIds = gcProjects.map(p => p.id);

  if (projectIds.length === 0) { res.json({ expired: 0, expiringSoon: 0 }); return; }

  const scs = await db.select({ id: subcontractsTable.id }).from(subcontractsTable)
    .where(inArray(subcontractsTable.projectId, projectIds));
  const scIds = scs.map(s => s.id);

  if (scIds.length === 0) { res.json({ expired: 0, expiringSoon: 0 }); return; }

  const insurances = await db.select().from(subcontractInsurancesTable)
    .where(inArray(subcontractInsurancesTable.subcontractId, scIds));

  let expired = 0;
  let expiringSoon = 0;
  for (const ins of insurances) {
    const status = calcInsuranceStatus(ins.expirationDate);
    if (status === "EXPIRED") expired++;
    else if (status === "EXPIRING_SOON") expiringSoon++;
  }

  res.json({ expired, expiringSoon });
});

// GET /:projectId/insurance-summary — insurance status for all subcontracts in a project (GC only)
router.get("/:projectId/insurance-summary", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const scs = await db.select({ id: subcontractsTable.id }).from(subcontractsTable)
    .where(eq(subcontractsTable.projectId, projectId));
  const scIds = scs.map(s => s.id);

  if (scIds.length === 0) { res.json([]); return; }

  const insurances = await db.select().from(subcontractInsurancesTable)
    .where(inArray(subcontractInsurancesTable.subcontractId, scIds));

  const insMap = new Map(insurances.map(i => [i.subcontractId, i]));

  const result = scIds.map(scId => {
    const ins = insMap.get(scId);
    return {
      subcontractId: scId,
      status: calcInsuranceStatus(ins?.expirationDate),
      expirationDate: ins?.expirationDate ?? null,
    };
  });

  res.json(result);
});

// GET /:projectId/license-summary — license status for all subcontracts in a project (GC only)
router.get("/:projectId/license-summary", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const scs = await db.select({ id: subcontractsTable.id }).from(subcontractsTable)
    .where(eq(subcontractsTable.projectId, projectId));
  const scIds = scs.map(s => s.id);

  if (scIds.length === 0) { res.json([]); return; }

  const licenses = await db.select().from(contractorLicensesTable)
    .where(inArray(contractorLicensesTable.subcontractId, scIds));

  const licMap = new Map(licenses.map(l => [l.subcontractId, l]));

  function calcLicStatus(exp: string | null | undefined): string {
    if (!exp) return "NO_LICENSE";
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const e = new Date(exp); e.setHours(0, 0, 0, 0);
    const days = Math.ceil((e.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "EXPIRED";
    if (days <= 30) return "EXPIRING_SOON";
    return "VALID";
  }

  const result = scIds.map(scId => {
    const lic = licMap.get(scId);
    return {
      subcontractId: scId,
      status: calcLicStatus(lic?.expirationDate),
      expirationDate: lic?.expirationDate ?? null,
    };
  });

  res.json(result);
});

// ── Draw Schedule ────────────────────────────────────────────────────────────

async function computeCommittedForItem(itemId: string) {
  const scs = await db.select().from(subcontractsTable).where(eq(subcontractsTable.drawScheduleItemId, itemId));
  let committed = 0;
  const linkedSubcontracts: { id: string; companyName: string; currentApprovedTotal: number }[] = [];
  for (const sc of scs) {
    const cos = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.subcontractId, sc.id));
    const coTotal = cos.filter(c => c.status === "APPROVED").reduce((s, c) => s + c.amount, 0);
    const approvedTotal = sc.baseContractAmount + coTotal;
    committed += approvedTotal;
    const [sub] = await db.select({ companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    linkedSubcontracts.push({ id: sc.id, companyName: sub?.companyName ?? "Unknown", currentApprovedTotal: approvedTotal });
  }
  return { committed, linkedSubcontracts };
}

function parseDrawScheduleText(text: string): { description: string; budgetAmount: number }[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const results: { description: string; budgetAmount: number }[] = [];
  for (const line of lines) {
    // Match a number (with optional $ and thousands commas) at the END of the line,
    // preceded by whitespace or a comma separator. This handles:
    //   "Framing, $85,000"  →  description=Framing,  amount=85000
    //   "HVAC $32,500"      →  description=HVAC,      amount=32500
    //   "Electrical,45000"  →  description=Electrical, amount=45000
    const m = line.match(/^(.*?)[\s,]+\$?([\d,]+(?:\.\d{1,2})?)\s*$/);
    if (!m) continue;
    const description = m[1].trim().replace(/,\s*$/, "").trim();
    const amountStr = m[2];
    const amount = parseFloat(amountStr.replace(/,/g, ""));
    if (description && !isNaN(amount) && amount > 0) {
      results.push({ description, budgetAmount: amount });
    }
  }
  return results;
}

router.get("/:projectId/draw-schedule", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const items = await db.select().from(drawScheduleItemsTable)
    .where(eq(drawScheduleItemsTable.projectId, projectId))
    .orderBy(drawScheduleItemsTable.sortOrder, drawScheduleItemsTable.createdAt);
  const result = await Promise.all(items.map(async (item) => {
    const { committed, linkedSubcontracts } = await computeCommittedForItem(item.id);
    return { ...item, committed, linkedSubcontracts };
  }));
  res.json(result);
});

router.post("/:projectId/draw-schedule", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { description, budgetAmount } = req.body;
  if (!description?.trim()) { res.status(400).json({ error: "description is required" }); return; }
  const amount = Number(budgetAmount);
  if (isNaN(amount) || amount <= 0) { res.status(400).json({ error: "budgetAmount must be a positive number" }); return; }
  const existing = await db.select({ sortOrder: drawScheduleItemsTable.sortOrder }).from(drawScheduleItemsTable)
    .where(eq(drawScheduleItemsTable.projectId, projectId));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.sortOrder)) : -1;
  const [item] = await db.insert(drawScheduleItemsTable).values({
    projectId, description: description.trim(), budgetAmount: amount, sortOrder: maxOrder + 1,
  }).returning();
  res.status(201).json({ ...item, committed: 0, linkedSubcontracts: [] });
});

router.post("/:projectId/draw-schedule/parse", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }
  const parsed = parseDrawScheduleText(text);
  res.json(parsed);
});

router.post("/:projectId/draw-schedule/import", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "items array is required" }); return; }
  const existing = await db.select({ sortOrder: drawScheduleItemsTable.sortOrder }).from(drawScheduleItemsTable)
    .where(eq(drawScheduleItemsTable.projectId, projectId));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.sortOrder)) : -1;
  const toInsert = items.map((item: any, idx: number) => ({
    projectId,
    description: String(item.description ?? "").trim(),
    budgetAmount: Number(item.budgetAmount ?? 0),
    sortOrder: maxOrder + 1 + idx,
  })).filter(i => i.description && i.budgetAmount > 0);
  if (toInsert.length === 0) { res.status(400).json({ error: "No valid items to import" }); return; }
  const created = await db.insert(drawScheduleItemsTable).values(toInsert).returning();
  res.status(201).json(created.map(i => ({ ...i, committed: 0, linkedSubcontracts: [] })));
});

router.patch("/:projectId/draw-schedule/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [item] = await db.select().from(drawScheduleItemsTable).where(eq(drawScheduleItemsTable.id, itemId)).limit(1);
  if (!item || item.projectId !== projectId) { res.status(404).json({ error: "Item not found" }); return; }
  const { description, budgetAmount } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (description !== undefined) updates.description = description.trim();
  if (budgetAmount !== undefined) {
    const amount = Number(budgetAmount);
    if (isNaN(amount) || amount <= 0) { res.status(400).json({ error: "budgetAmount must be a positive number" }); return; }
    updates.budgetAmount = amount;
  }
  const [updated] = await db.update(drawScheduleItemsTable).set(updates).where(eq(drawScheduleItemsTable.id, itemId)).returning();
  const { committed, linkedSubcontracts } = await computeCommittedForItem(itemId);
  res.json({ ...updated, committed, linkedSubcontracts });
});

router.delete("/:projectId/draw-schedule/:itemId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId, itemId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [item] = await db.select().from(drawScheduleItemsTable).where(eq(drawScheduleItemsTable.id, itemId)).limit(1);
  if (!item || item.projectId !== projectId) { res.status(404).json({ error: "Item not found" }); return; }
  await db.update(subcontractsTable).set({ drawScheduleItemId: null }).where(eq(subcontractsTable.drawScheduleItemId, itemId));
  await db.delete(drawScheduleItemsTable).where(eq(drawScheduleItemsTable.id, itemId));
  res.json({ success: true });
});

router.patch("/:projectId/draw-schedule/link-subcontract", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { subcontractId, drawScheduleItemId } = req.body;
  if (!subcontractId) { res.status(400).json({ error: "subcontractId is required" }); return; }
  const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1);
  if (!sc || sc.projectId !== projectId) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (drawScheduleItemId) {
    const [dsItem] = await db.select().from(drawScheduleItemsTable).where(eq(drawScheduleItemsTable.id, drawScheduleItemId)).limit(1);
    if (!dsItem || dsItem.projectId !== projectId) { res.status(404).json({ error: "Draw schedule item not found" }); return; }
  }
  await db.update(subcontractsTable).set({ drawScheduleItemId: drawScheduleItemId ?? null, updatedAt: new Date() })
    .where(eq(subcontractsTable.id, subcontractId));
  res.json({ success: true });
});

router.get("/:projectId/draw-schedule/pdf", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.gcId !== getEffectiveGcId(user)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [gc] = await db.select({ companyName: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);
  const items = await db.select().from(drawScheduleItemsTable)
    .where(eq(drawScheduleItemsTable.projectId, projectId))
    .orderBy(drawScheduleItemsTable.sortOrder, drawScheduleItemsTable.createdAt);
  const enriched = await Promise.all(items.map(async (item) => {
    const { committed, linkedSubcontracts } = await computeCommittedForItem(item.id);
    return { description: item.description, budgetAmount: item.budgetAmount, committed, linkedSubcontracts };
  }));
  const pdf = await generateDrawSchedulePDF({
    projectName: project.name,
    projectAddress: (project as any).address ?? null,
    gcCompanyName: gc?.companyName ?? "General Contractor",
    generatedAt: new Date(),
    items: enriched,
  });
  const safeName = project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="draw-schedule-${safeName}.pdf"`);
  res.send(pdf);
});

export default router;
