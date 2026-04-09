import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, projectsTable, subcontractsTable, activityLogsTable,
  adminImpersonationLogsTable, featureFlagsTable,
  changeOrdersTable, invoicesTable, lienWaiversTable,
  subcontractCommentsTable, subcontractCommentReadsTable,
  contractorLicensesTable, subcontractInsurancesTable,
  bidsTable, drawScheduleItemsTable, gcProjectAssignmentsTable,
  ownerCoNotificationsTable, planFilesTable, projectMembersTable,
  tradeScopesTable, scopeTemplatesTable, gcContactsTable, subProfilesTable,
  demoClicksTable, pageViewsTable,
  submittalsTable, submittalMessagesTable,
  pushSubscriptionsTable, notificationPreferencesTable,
  adminCallLogsTable,
} from "@workspace/db/schema";
import { eq, and, isNull, isNotNull, sql, inArray, desc, or, gte, lte, lt } from "drizzle-orm";
import {
  generateAdminToken, setAdminCookie, clearAdminCookie, getAdminUser,
  generateToken, setAuthCookie, clearAuthCookie, verifyToken,
} from "../lib/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { PLANS, getPlanByName, getActiveSubcontractCount, getGCPlanInfo } from "../lib/stripeStorage.js";
import { sendAdminMessageEmail, sendAccountCancelledEmail } from "../lib/email.js";
import { forceResetDemoData } from "../lib/demoSeeder.js";
import { sendPushNotification } from "../lib/push.js";
import { parse } from "cookie";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TRIAL_DAYS = 14;

// ── Admin Auth ─────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin credentials not configured" });
    return;
  }
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }
  const token = generateAdminToken(email);
  setAdminCookie(res, token);
  res.json({ success: true, adminEmail: email });
});

router.post("/auth/logout", (req, res) => {
  clearAdminCookie(res);
  res.json({ success: true });
});

router.get("/me", (req, res) => {
  const admin = getAdminUser(req);
  if (!admin) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }
  res.json({ isAdmin: true, adminEmail: admin.adminEmail });
});

// ── Helper: get all GC owner accounts (non-demo, non-team-member) ─────────────

async function getGCOwners() {
  return db.select().from(usersTable).where(
    and(
      eq(usersTable.role, "GC"),
      eq(usersTable.isDemo, false),
      isNull(usersTable.gcParentId),
    )
  );
}

// ── Helper: get plan label from Stripe subscription ───────────────────────────

async function getStripeSubscriptionInfo(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  try {
    const result = await db.execute(
      sql`
        SELECT
          s.status,
          s.current_period_end,
          s.cancel_at_period_end,
          pr.unit_amount,
          pr.recurring->>'interval' as billing_interval,
          p.name as product_name
        FROM stripe.subscriptions s
        JOIN stripe.subscription_items si ON si.subscription = s.id
        JOIN stripe.prices pr ON pr.id = si.price
        JOIN stripe.products p ON p.id = pr.product
        WHERE s.id = ${subscriptionId}
        LIMIT 1
      `
    );
    return (result.rows[0] as any) ?? null;
  } catch {
    return null;
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

router.get("/metrics", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  let totalGCs = 0, activePaying = 0, onTrial = 0, churned = 0;
  let mrr = 0;

  for (const user of gcOwners) {
    totalGCs++;
    const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
    const isTrialActive = now < trialEndsAt && !user.stripeSubscriptionId;

    if (user.adminPlanOverride) {
      const overrideExpired = user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < now;
      if (!overrideExpired) {
        activePaying++;
        const plan = getPlanByName(user.adminPlanOverride);
        if (plan) mrr += plan.monthlyUsd / 100;
        continue;
      }
    }

    if (!user.stripeSubscriptionId) {
      if (isTrialActive) onTrial++;
      else churned++;
      continue;
    }

    const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
    if (!subInfo) { churned++; continue; }

    if (subInfo.status === "active" || subInfo.status === "trialing" || subInfo.status === "past_due") {
      activePaying++;
      const amount = subInfo.unit_amount ?? 0;
      const interval = subInfo.billing_interval ?? "month";
      mrr += interval === "year" ? amount / 100 / 12 : amount / 100;
    } else {
      churned++;
    }
  }

  const arr = mrr * 12;

  // Total subs
  const subCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE role = 'SUB' AND is_demo = false`);
  const totalSubs = parseInt((subCountResult.rows[0] as any)?.count ?? "0", 10);

  // Total projects
  const projCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM projects WHERE status != 'DELETED'`);
  const totalProjects = parseInt((projCountResult.rows[0] as any)?.count ?? "0", 10);

  // Total active subcontracts (all GCs combined)
  const activeSubcontractsResult = await db.execute(sql`
    SELECT COUNT(s.id) as count
    FROM subcontracts s
    JOIN projects p ON p.id = s.project_id
    WHERE p.status IN ('BIDDING', 'CONSTRUCTION')
  `);
  const totalActiveSubcontracts = parseInt((activeSubcontractsResult.rows[0] as any)?.count ?? "0", 10);

  // Total revenue from Stripe
  let totalRevenue = 0;
  try {
    const revenueResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount_paid), 0) as total
      FROM stripe.invoices
      WHERE status = 'paid'
    `);
    totalRevenue = parseInt((revenueResult.rows[0] as any)?.total ?? "0", 10) / 100;
  } catch { /* Stripe not synced */ }

  res.json({
    totalGCs, activePaying, onTrial, churned,
    totalSubs, totalActiveSubcontracts, totalProjects,
    mrr: Math.round(mrr), arr: Math.round(arr), totalRevenue: Math.round(totalRevenue),
  });
});

// ── GC Accounts List ──────────────────────────────────────────────────────────

router.get("/gc-accounts", requireAdmin, async (req, res) => {
  const { search, planFilter, billingFilter, sortBy = "newest" } = req.query as Record<string, string>;

  const gcOwners = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  const rows = await Promise.all(gcOwners.map(async (user) => {
    const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
    const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isTrialActive = now < trialEndsAt && !user.stripeSubscriptionId;

    const activeSubcontracts = await getActiveSubcontractCount(user.id);
    const projectCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM projects WHERE gc_id = ${user.id} AND status != 'DELETED'`
    );
    const projectCount = parseInt((projectCountResult.rows[0] as any)?.count ?? "0", 10);

    let planName: string | null = null;
    let planLabel: string | null = null;
    let billingInterval: string | null = null;
    let status: string = "trial";
    let monthlyRevenue = 0;
    let planLimit: number | null = null;

    if (user.pausedAt) {
      status = "paused";
    } else if (user.adminPlanOverride) {
      const overrideExpired = user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < now;
      if (!overrideExpired) {
        planName = user.adminPlanOverride;
        const plan = getPlanByName(user.adminPlanOverride);
        planLabel = plan?.label ?? null;
        planLimit = plan?.limit ?? null;
        billingInterval = "month";
        status = "active";
        monthlyRevenue = plan ? plan.monthlyUsd / 100 : 0;
      }
    }

    if (!planName && user.stripeSubscriptionId) {
      const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
      if (subInfo) {
        const rawName: string = subInfo.product_name ?? "";
        planName = rawName.replace(/ Annual$/, "");
        const plan = getPlanByName(planName);
        planLabel = plan?.label ?? null;
        planLimit = plan?.limit ?? null;
        billingInterval = subInfo.billing_interval ?? "month";
        const amount = subInfo.unit_amount ?? 0;
        monthlyRevenue = billingInterval === "year" ? amount / 100 / 12 : amount / 100;
        if (subInfo.status === "active" || subInfo.status === "trialing") status = "active";
        else if (subInfo.status === "past_due") status = "past_due";
        else status = "cancelled";
      }
    }

    if (!planName && isTrialActive) {
      status = "trial";
    } else if (!planName && !isTrialActive && !user.stripeSubscriptionId && !user.adminPlanOverride) {
      status = "cancelled";
    }

    return {
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      planName, planLabel, planLimit,
      billingInterval,
      activeSubcontracts,
      projectCount,
      trialDaysLeft: isTrialActive ? trialDaysLeft : null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      monthlyRevenue: Math.round(monthlyRevenue),
      status,
      pausedAt: user.pausedAt?.toISOString() ?? null,
      adminPlanOverride: user.adminPlanOverride ?? null,
      adminNotes: user.adminNotes ?? null,
    };
  }));

  // Filter
  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => r.companyName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }
  if (planFilter && planFilter !== "all") {
    if (planFilter === "paused") filtered = filtered.filter(r => r.status === "paused");
    else if (planFilter === "trial") filtered = filtered.filter(r => r.status === "trial");
    else if (planFilter === "cancelled") filtered = filtered.filter(r => r.status === "cancelled");
    else filtered = filtered.filter(r => r.planName?.toLowerCase().includes(planFilter.toLowerCase()));
  }
  if (billingFilter && billingFilter !== "all") {
    filtered = filtered.filter(r => r.billingInterval === billingFilter);
  }

  // Sort
  if (sortBy === "oldest") filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  else if (sortBy === "highest_revenue") filtered.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  else if (sortBy === "most_subcontracts") filtered.sort((a, b) => b.activeSubcontracts - a.activeSubcontracts);
  else if (sortBy === "last_login") filtered.sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""));
  else filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(filtered);
});

// ── View a single GC account ──────────────────────────────────────────────────

router.get("/gc/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "GC" || user.gcParentId) {
    res.status(404).json({ error: "GC not found" });
    return;
  }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.gcId, userId));
  const subcontracts = await db.select().from(subcontractsTable).where(
    inArray(subcontractsTable.projectId, projects.map(p => p.id))
  );

  const teamMembers = await db.select({
    id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName,
    gcTeamRole: usersTable.gcTeamRole, createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.gcParentId, userId));

  const planInfo = await getGCPlanInfo(userId);
  const { passwordHash: _, ...safeUser } = user;

  res.json({ user: safeUser, projects, subcontracts, teamMembers, planInfo });
});

// ── Pause Account ─────────────────────────────────────────────────────────────

router.post("/gc/:userId/pause", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  await db.update(usersTable).set({ pausedAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── Unpause Account ───────────────────────────────────────────────────────────

router.post("/gc/:userId/unpause", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  await db.update(usersTable).set({ pausedAt: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── Extend Trial ──────────────────────────────────────────────────────────────

router.post("/gc/:userId/extend-trial", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { days } = req.body;
  if (!days || isNaN(Number(days)) || Number(days) <= 0) {
    res.status(400).json({ error: "days must be a positive number" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const currentTrialStart = user.trialStartedAt ?? user.createdAt;
  const currentTrialEnd = new Date(currentTrialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const baseDate = currentTrialEnd > now ? currentTrialEnd : now;
  const extensionMs = Number(days) * 24 * 60 * 60 * 1000;
  const newTrialStart = new Date(baseDate.getTime() + extensionMs - TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db.update(usersTable).set({ trialStartedAt: newTrialStart, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── Edit Plan (manual override, bypasses Stripe) ──────────────────────────────

router.post("/gc/:userId/edit-plan", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { planName, expiresInDays } = req.body;

  if (!planName) {
    // Clear override
    await db.update(usersTable).set({ adminPlanOverride: null, adminPlanOverrideExpiresAt: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true, cleared: true });
    return;
  }

  if (!getPlanByName(planName)) {
    res.status(400).json({ error: "Invalid plan name" });
    return;
  }

  const expiresAt = expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000) : null;
  await db.update(usersTable).set({
    adminPlanOverride: planName,
    adminPlanOverrideExpiresAt: expiresAt,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── Update Admin Notes ─────────────────────────────────────────────────────────

router.post("/gc/:userId/notes", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { notes } = req.body;
  await db.update(usersTable).set({ adminNotes: notes ?? null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── Cancel Account ────────────────────────────────────────────────────────────

router.post("/gc/:userId/cancel", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.stripeSubscriptionId) {
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    } catch { /* ignore Stripe errors */ }
  }

  await sendAccountCancelledEmail({ toEmail: user.email, companyName: user.companyName }).catch(() => {});
  res.json({ success: true });
});

// ── Delete Account ────────────────────────────────────────────────────────────

router.delete("/gc/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const { confirmName } = req.body ?? {};
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (confirmName !== user.companyName) {
      res.status(400).json({ error: "Company name confirmation does not match" });
      return;
    }

    // Cancel Stripe subscription if active
    if (user.stripeSubscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch { /* ignore Stripe errors */ }
    }

    // Gather all user IDs (GC owner + team members)
    const teamMembers = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.gcParentId, userId));
    const allUserIds = [userId, ...teamMembers.map(m => m.id)];

    // Gather project IDs owned by this GC
    const projects = await db.select({ id: projectsTable.id }).from(projectsTable)
      .where(eq(projectsTable.gcId, userId));
    const projectIds = projects.map(p => p.id);

    // Gather subcontract IDs under those projects
    let subcontractIds: string[] = [];
    if (projectIds.length > 0) {
      const subs = await db.select({ id: subcontractsTable.id }).from(subcontractsTable)
        .where(inArray(subcontractsTable.projectId, projectIds));
      subcontractIds = subs.map(s => s.id);
    }

    // Step 1: Delete subcontract-level children (order matters — must delete FK dependents first)
    if (subcontractIds.length > 0) {
      // submittal_messages → submittals → subcontracts (must delete messages before submittals)
      const submittalRows = await db.select({ id: submittalsTable.id }).from(submittalsTable)
        .where(inArray(submittalsTable.subcontractId, subcontractIds));
      if (submittalRows.length > 0) {
        const submittalIds = submittalRows.map(s => s.id);
        await db.delete(submittalMessagesTable).where(inArray(submittalMessagesTable.submittalId, submittalIds));
      }
      await db.delete(submittalsTable).where(inArray(submittalsTable.subcontractId, subcontractIds));
      // lien_waivers.invoice_id → invoices.id (must delete lien waivers before invoices)
      await db.delete(lienWaiversTable).where(inArray(lienWaiversTable.subcontractId, subcontractIds));
      await db.delete(invoicesTable).where(inArray(invoicesTable.subcontractId, subcontractIds));
      await db.delete(changeOrdersTable).where(inArray(changeOrdersTable.subcontractId, subcontractIds));
      await db.delete(activityLogsTable).where(inArray(activityLogsTable.subcontractId, subcontractIds));
      await db.delete(subcontractCommentsTable).where(inArray(subcontractCommentsTable.subcontractId, subcontractIds));
      await db.delete(subcontractCommentReadsTable).where(inArray(subcontractCommentReadsTable.subcontractId, subcontractIds));
      await db.delete(subcontractInsurancesTable).where(inArray(subcontractInsurancesTable.subcontractId, subcontractIds));
      await db.delete(contractorLicensesTable).where(inArray(contractorLicensesTable.subcontractId, subcontractIds));
    }

    // Step 2: Delete subcontracts under GC's projects (compliance_completions CASCADEs)
    if (projectIds.length > 0) {
      await db.delete(subcontractsTable).where(inArray(subcontractsTable.projectId, projectIds));
    }

    // Step 3: Delete project-level children (all NO ACTION FK → projects)
    if (projectIds.length > 0) {
      await db.delete(bidsTable).where(inArray(bidsTable.projectId, projectIds));
      await db.delete(drawScheduleItemsTable).where(inArray(drawScheduleItemsTable.projectId, projectIds));
      await db.delete(gcProjectAssignmentsTable).where(inArray(gcProjectAssignmentsTable.projectId, projectIds));
      await db.delete(lienWaiversTable).where(inArray(lienWaiversTable.projectId, projectIds));
      await db.delete(ownerCoNotificationsTable).where(inArray(ownerCoNotificationsTable.projectId, projectIds));
      await db.delete(planFilesTable).where(inArray(planFilesTable.projectId, projectIds));
      await db.delete(projectMembersTable).where(inArray(projectMembersTable.projectId, projectIds));
      await db.delete(tradeScopesTable).where(inArray(tradeScopesTable.projectId, projectIds));
    }

    // Step 4: Delete projects (bid_comparisons, compliance_checklist_items,
    //          gc_project_credentials, project_completion_documents, scope_documents all CASCADE)
    await db.delete(projectsTable).where(eq(projectsTable.gcId, userId));

    // Step 5: Delete remaining user-level references
    await db.delete(gcContactsTable).where(
      or(eq(gcContactsTable.gcId, userId), inArray(gcContactsTable.subId, allUserIds))
    );
    await db.delete(scopeTemplatesTable).where(eq(scopeTemplatesTable.gcId, userId));
    await db.delete(subProfilesTable).where(inArray(subProfilesTable.userId, allUserIds));
    await db.delete(gcProjectAssignmentsTable).where(inArray(gcProjectAssignmentsTable.teamMemberUserId, allUserIds));
    await db.delete(projectMembersTable).where(inArray(projectMembersTable.userId, allUserIds));
    await db.delete(subcontractCommentReadsTable).where(inArray(subcontractCommentReadsTable.userId, allUserIds));
    await db.delete(subcontractCommentsTable).where(inArray(subcontractCommentsTable.userId, allUserIds));
    await db.delete(bidsTable).where(inArray(bidsTable.subId, allUserIds));
    await db.delete(subcontractsTable).where(inArray(subcontractsTable.subId, allUserIds));
    await db.delete(adminImpersonationLogsTable).where(eq(adminImpersonationLogsTable.gcUserId, userId));

    // Step 6: Delete all users (team members + GC owner; notifications CASCADE)
    await db.delete(usersTable).where(or(eq(usersTable.id, userId), eq(usersTable.gcParentId, userId)));

    res.json({ success: true });
  } catch (err: any) {
    console.error("Admin delete GC error:", err);
    res.status(500).json({ error: "Failed to delete account: " + (err?.message ?? "unknown error") });
  }
});

// ── Send Message ──────────────────────────────────────────────────────────────

router.post("/gc/:userId/send-message", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { subject, message } = req.body;
  if (!subject || !message) {
    res.status(400).json({ error: "subject and message are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await sendAdminMessageEmail({ toEmail: user.email, subject, message });
  res.json({ success: true });
});

// ── Impersonate GC ────────────────────────────────────────────────────────────

router.post("/gc/:userId/impersonate", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const admin = (req as any).adminUser;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "GC") { res.status(404).json({ error: "GC not found" }); return; }

  const ip = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || null;

  // Log impersonation
  const [log] = await db.insert(adminImpersonationLogsTable).values({
    adminEmail: admin.adminEmail,
    gcUserId: user.id,
    gcCompanyName: user.companyName,
    gcEmail: user.email,
    ipAddress: ip,
  }).returning();

  // Create impersonation JWT
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    displayName: user.displayName,
    gcParentId: user.gcParentId,
    gcTeamRole: user.gcTeamRole,
    isDemo: user.isDemo,
    impersonatedBy: "admin",
    impersonationLogId: log.id,
  });
  setAuthCookie(res, token);

  res.json({ success: true, logId: log.id });
});

// ── Exit Impersonation ────────────────────────────────────────────────────────

router.post("/impersonation/exit", async (req, res) => {
  const cookies = parse(req.headers.cookie || "");
  const authToken = cookies["auth_token"];
  if (authToken) {
    const payload = verifyToken(authToken);
    if (payload?.impersonationLogId) {
      await db.update(adminImpersonationLogsTable)
        .set({ endedAt: new Date() })
        .where(eq(adminImpersonationLogsTable.id, payload.impersonationLogId));
    }
  }
  clearAuthCookie(res);
  res.json({ success: true });
});

// ── Revenue ───────────────────────────────────────────────────────────────────

router.get("/revenue", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();

  // MRR by month (last 12 months from Stripe invoices)
  let monthlyChart: Array<{ month: string; mrr: number }> = [];
  try {
    const result = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', TO_TIMESTAMP(created)), 'YYYY-MM') as month,
        SUM(amount_paid) as total
      FROM stripe.invoices
      WHERE status = 'paid'
        AND created > EXTRACT(EPOCH FROM NOW() - INTERVAL '12 months')
      GROUP BY DATE_TRUNC('month', TO_TIMESTAMP(created))
      ORDER BY DATE_TRUNC('month', TO_TIMESTAMP(created)) ASC
    `);
    monthlyChart = (result.rows as any[]).map(r => ({
      month: r.month,
      mrr: Math.round(parseInt(r.total ?? "0", 10) / 100),
    }));
  } catch { /* Stripe not synced */ }

  // Current month stats
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newCustomers: Array<{ companyName: string; email: string; createdAt: string }> = [];
  let trialConversions = 0;
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  // Revenue by plan
  const revenueByPlan: Record<string, { count: number; mrr: number }> = {};
  PLANS.forEach(p => { revenueByPlan[p.label] = { count: 0, mrr: 0 }; });
  revenueByPlan["Trial"] = { count: 0, mrr: 0 };
  revenueByPlan["Cancelled"] = { count: 0, mrr: 0 };

  let totalMrr = 0;
  let activePaidCount = 0;

  for (const user of gcOwners) {
    if (user.createdAt >= startOfMonth) {
      newCustomers.push({ companyName: user.companyName, email: user.email, createdAt: user.createdAt.toISOString() });
    }

    const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
    const isTrialActive = now < trialEndsAt && !user.stripeSubscriptionId;

    if (!user.stripeSubscriptionId && !user.adminPlanOverride) {
      if (isTrialActive) revenueByPlan["Trial"].count++;
      else revenueByPlan["Cancelled"].count++;
      continue;
    }

    const subInfo = user.stripeSubscriptionId ? await getStripeSubscriptionInfo(user.stripeSubscriptionId) : null;
    if (!subInfo && !user.adminPlanOverride) {
      revenueByPlan["Cancelled"].count++;
      continue;
    }

    let planLabel = "Unknown";
    let monthlyRev = 0;

    if (user.adminPlanOverride) {
      const plan = getPlanByName(user.adminPlanOverride);
      planLabel = plan?.label ?? "Unknown";
      monthlyRev = plan ? plan.monthlyUsd / 100 : 0;
    } else if (subInfo) {
      const rawName: string = subInfo.product_name ?? "";
      const planName = rawName.replace(/ Annual$/, "");
      const plan = getPlanByName(planName);
      planLabel = plan?.label ?? "Unknown";
      const amount = subInfo.unit_amount ?? 0;
      const interval = subInfo.billing_interval ?? "month";
      monthlyRev = interval === "year" ? amount / 100 / 12 : amount / 100;

      if ((subInfo.status === "active" || subInfo.status === "trialing") && user.stripeSubscriptionId) {
        // Check if they converted from trial this month
        const stripeSubCreatedResult = await db.execute(sql`
          SELECT created FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId} LIMIT 1
        `).catch(() => ({ rows: [] }));
        const subCreated = (stripeSubCreatedResult.rows[0] as any)?.created;
        if (subCreated && new Date(subCreated * 1000) >= startOfMonth) trialConversions++;
      }
    }

    if (revenueByPlan[planLabel]) {
      revenueByPlan[planLabel].count++;
      revenueByPlan[planLabel].mrr += Math.round(monthlyRev);
    }
    totalMrr += monthlyRev;
    activePaidCount++;
  }

  const avgRevenue = activePaidCount > 0 ? Math.round(totalMrr / activePaidCount) : 0;
  const trialCount = revenueByPlan["Trial"].count;
  const trialConversionRate = trialCount > 0 ? Math.round((trialConversions / trialCount) * 100) : 0;

  res.json({
    monthlyChart,
    newCustomersThisMonth: newCustomers,
    trialConversionsThisMonth: trialConversions,
    trialConversionRate,
    avgRevenuePerGC: avgRevenue,
    revenueByPlan: Object.entries(revenueByPlan).map(([label, d]) => ({ label, count: d.count, mrr: d.mrr })),
  });
});

// ── Trials ────────────────────────────────────────────────────────────────────

router.get("/trials", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  const trials = await Promise.all(
    gcOwners
      .filter(user => {
        const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
        return !user.stripeSubscriptionId && now < trialEndsAt;
      })
      .map(async user => {
        const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
        const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        const projCount = await db.execute(sql`SELECT COUNT(*) as c FROM projects WHERE gc_id = ${user.id}`);
        const subCount = await db.execute(sql`SELECT COUNT(*) as c FROM subcontracts s JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${user.id}`);

        return {
          id: user.id,
          companyName: user.companyName,
          email: user.email,
          trialStartedAt: (user.trialStartedAt ?? user.createdAt).toISOString(),
          trialEndsAt: trialEndsAt.toISOString(),
          trialDaysLeft,
          projectCount: parseInt((projCount.rows[0] as any)?.c ?? "0", 10),
          subcontractCount: parseInt((subCount.rows[0] as any)?.c ?? "0", 10),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        };
      })
  );

  trials.sort((a, b) => a.trialDaysLeft - b.trialDaysLeft);
  res.json(trials);
});

// ── Activity Feed ─────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  BID_SUBMITTED: "Bid Submitted",
  BID_ACCEPTED: "Bid Accepted",
  BID_DECLINED: "Bid Declined",
  CONTRACT_UPLOADED: "Contract Uploaded",
  CONTRACT_SIGNED: "Contract Signed",
  INVOICE_SUBMITTED: "Invoice Submitted",
  INVOICE_APPROVED: "Invoice Approved",
  INVOICE_REJECTED: "Invoice Rejected",
  INVOICE_FLAGGED: "Invoice Flagged",
  CHANGE_ORDER_CREATED: "Change Order Created",
  CHANGE_ORDER_APPROVED: "Change Order Approved",
  CHANGE_ORDER_REJECTED: "Change Order Rejected",
  CHANGE_ORDER_REQUEST_SUBMITTED: "CO Request Submitted",
  CHANGE_ORDER_REQUEST_APPROVED: "CO Request Approved",
  CHANGE_ORDER_REQUEST_REJECTED: "CO Request Rejected",
  PAYMENT_RECORDED: "Payment Recorded",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  PAYMENT_DISPUTED: "Payment Disputed",
  LIEN_WAIVER_GENERATED: "Lien Waiver Generated",
  LIEN_WAIVER_SIGNED: "Lien Waiver Signed",
  PLAN_FILE_UPLOADED: "Plan File Uploaded",
  SCOPE_DOC_UPLOADED: "Scope Doc Uploaded",
  COMPLIANCE_COMPLETED: "Compliance Completed",
  COMPLIANCE_WAIVED: "Compliance Waived",
  COMPLIANCE_UNWAIVED: "Compliance Unwaived",
  SUBMITTAL_CREATED: "Submittal Created",
  SUBMITTAL_MESSAGE_SENT: "Submittal Message Sent",
  SUBMITTAL_ACKNOWLEDGED: "Submittal Acknowledged",
  SUBCONTRACT_CREATED: "Subcontract Created",
  SUBCONTRACT_SIGNED: "Subcontract Signed",
  PAYMENT_TERMS_UPDATED: "Payment Terms Updated",
  INSURANCE_UPDATED: "Insurance Updated",
  INVOICE_PAYMENT_CONFIRMED: "Payment Confirmed",
  INVOICE_PAYMENT_UNCONFIRMED: "Payment Unconfirmed",
  DRAW_ITEM_SUBMITTED: "Draw Item Submitted",
  DRAW_ITEM_APPROVED: "Draw Item Approved",
  DRAW_ITEM_REJECTED: "Draw Item Rejected",
  NOTICE_SENT: "Notice Sent",
  PROJECT_COMPLETED: "Project Completed",
  PROJECT_CREATED: "Project Created",
};

const FILTER_PREFIXES: Record<string, string[]> = {
  invoices: ["INVOICE"],
  changeorders: ["CHANGE_ORDER"],
  payments: ["PAYMENT"],
  lienWaivers: ["LIEN_WAIVER"],
  submittals: ["SUBMITTAL"],
  bids: ["BID"],
  contracts: ["CONTRACT", "PLAN_FILE", "SCOPE_DOC"],
  compliance: ["COMPLIANCE"],
};

router.get("/activity", requireAdmin, async (req, res) => {
  const { filter, page = "1" } = req.query as { filter?: string; page?: string };
  const pageSize = 25;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const logs = await db.select().from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(2000);

  let filtered = logs;
  if (filter && FILTER_PREFIXES[filter]) {
    const prefixes = FILTER_PREFIXES[filter];
    filtered = logs.filter(l => prefixes.some(p => l.type.startsWith(p)));
  }

  const total = filtered.length;
  const slice = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  const items = slice.map(l => ({
    id: l.id,
    action: ACTION_LABEL[l.type] ?? l.type.replace(/_/g, " "),
    entity: l.description,
    actor: l.actorName,
    actorRole: l.actorRole,
    createdAt: l.createdAt,
    type: l.type,
  }));

  res.json({ items, total, page: pageNum, pageSize });
});

// ── Impersonation Audit Log ───────────────────────────────────────────────────

router.get("/impersonation-logs", requireAdmin, async (req, res) => {
  const logs = await db.select().from(adminImpersonationLogsTable)
    .orderBy(desc(adminImpersonationLogsTable.startedAt))
    .limit(200);
  res.json(logs);
});

// ── Morning Summary ───────────────────────────────────────────────────────────

router.get("/morning-summary", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let mrr = 0, totalPaying = 0, activeTrials = 0, trialsExpiring7d = 0;
  let churnedThisMonth = 0, mrrLostToChurn = 0;
  let nearLimitCount = 0, churnRiskCount = 0, failedPaymentsCount = 0;

  for (const user of gcOwners) {
    const trialStart = user.trialStartedAt ?? user.createdAt;
    const trialEndsAt = new Date(trialStart.getTime() + TRIAL_MS);
    const isTrialActive = now < trialEndsAt && !user.stripeSubscriptionId;
    const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (isTrialActive) {
      activeTrials++;
      if (trialDaysLeft <= 7) trialsExpiring7d++;
    }

    // Churn this month: trial expired in current calendar month OR subscription cancelled this month
    if (!isTrialActive && !user.stripeSubscriptionId && !user.adminPlanOverride && trialEndsAt >= startOfMonth && trialEndsAt <= now) {
      churnedThisMonth++;
    }

    let monthlyRev = 0;
    if (user.adminPlanOverride) {
      const overrideExpired = user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < now;
      if (!overrideExpired) {
        const plan = getPlanByName(user.adminPlanOverride);
        monthlyRev = plan ? plan.monthlyUsd / 100 : 0;
        mrr += monthlyRev;
        totalPaying++;
      }
    } else if (user.stripeSubscriptionId) {
      const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
      if (subInfo && (subInfo.status === "active" || subInfo.status === "trialing" || subInfo.status === "past_due")) {
        const amount = subInfo.unit_amount ?? 0;
        const interval = subInfo.billing_interval ?? "month";
        monthlyRev = interval === "year" ? amount / 100 / 12 : amount / 100;
        mrr += monthlyRev;
        totalPaying++;
        if (subInfo.status === "past_due") failedPaymentsCount++;
      } else if (subInfo && (subInfo.status === "canceled" || subInfo.status === "cancelled")) {
        // Check if cancelled this month
        try {
          const endResult = await db.execute(sql`SELECT current_period_end FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId} LIMIT 1`).catch(() => ({ rows: [] }));
          const periodEnd = (endResult.rows[0] as any)?.current_period_end;
          if (periodEnd && new Date(periodEnd * 1000) >= startOfMonth) {
            churnedThisMonth++;
            const plan = getPlanByName(subInfo.product_name?.replace(/ Annual$/, "") ?? "");
            mrrLostToChurn += plan ? plan.monthlyUsd / 100 : (subInfo.unit_amount ?? 0) / 100;
          }
        } catch { /* ignore */ }
      }
    }

    // Near limit: 70%+ of subcontract limit
    if (monthlyRev > 0) {
      const activeCount = await getActiveSubcontractCount(user.id);
      const plan = user.adminPlanOverride ? getPlanByName(user.adminPlanOverride) : null;
      const limit = plan?.limit ?? null;
      if (limit && activeCount >= limit * 0.7) nearLimitCount++;

      // Churn risk: no login in 14 days
      if (!user.lastLoginAt || (now.getTime() - user.lastLoginAt.getTime()) > 14 * 24 * 60 * 60 * 1000) {
        churnRiskCount++;
      }
    }
  }

  // Add account counts
  const totalGCs = gcOwners.length;
  const totalSubsResult = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'SUB' AND is_demo = false`);
  const totalSubs = parseInt((totalSubsResult.rows[0] as any)?.c ?? "0", 10);
  const totalProjectsResult = await db.execute(sql`SELECT COUNT(*) as c FROM projects WHERE status != 'DELETED'`);
  const totalProjects = parseInt((totalProjectsResult.rows[0] as any)?.c ?? "0", 10);

  // New this week
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const newTrialsThisWeek = gcOwners.filter(u => (u.trialStartedAt ?? u.createdAt) >= oneWeekAgo).length;
  const newTrialsYesterday = gcOwners.filter(u => (u.trialStartedAt ?? u.createdAt) >= oneDayAgo).length;

  // Accounts activated this week (have at least 1 project, 1 subcontract, 1 invoice)
  let activatedThisWeek = 0;
  const activationResults = await db.execute(sql`
    SELECT u.id FROM users u
    WHERE u.role = 'GC' AND u.is_demo = false AND u.gc_parent_id IS NULL
      AND EXISTS (SELECT 1 FROM projects p WHERE p.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM subcontracts s JOIN projects p2 ON p2.id = s.project_id WHERE p2.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM invoices i JOIN subcontracts s2 ON s2.id = i.subcontract_id JOIN projects p3 ON p3.id = s2.project_id WHERE p3.gc_id = u.id)
  `);
  activatedThisWeek = (activationResults.rows as any[]).filter(r => {
    const gc = gcOwners.find(u => u.id === r.id);
    return gc && gc.createdAt >= oneWeekAgo;
  }).length;

  // Platform health this week
  const invoicesFlaggedResult = await db.execute(sql`
    SELECT COUNT(*) as c FROM subcontract_activity_logs WHERE type = 'INVOICE_FLAGGED' AND created_at >= ${oneWeekAgo}
  `);
  const invoicesFlaggedThisWeek = parseInt((invoicesFlaggedResult.rows[0] as any)?.c ?? "0", 10);

  const invoicesFlaggedYesterday = await db.execute(sql`
    SELECT COUNT(*) as c FROM subcontract_activity_logs WHERE type = 'INVOICE_FLAGGED' AND created_at >= ${oneDayAgo}
  `).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);

  const paymentsThisWeekResult = await db.execute(sql`
    SELECT COUNT(*) as c FROM invoices WHERE payment_confirmed_at >= ${oneWeekAgo}
  `);
  const paymentsThisWeek = parseInt((paymentsThisWeekResult.rows[0] as any)?.c ?? "0", 10);

  const paymentsYesterdayResult = await db.execute(sql`
    SELECT COUNT(*) as c FROM invoices WHERE payment_confirmed_at >= ${oneDayAgo}
  `).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);

  const lienWaiversThisWeekResult = await db.execute(sql`
    SELECT COUNT(*) as c FROM lien_waivers WHERE signed_at >= ${oneWeekAgo}
  `);
  const lienWaiversThisWeek = parseInt((lienWaiversThisWeekResult.rows[0] as any)?.c ?? "0", 10);

  const newSubStripeThisWeekResult = await db.execute(sql`
    SELECT COUNT(*) as c FROM users WHERE role = 'SUB' AND stripe_connect_account_id IS NOT NULL AND updated_at >= ${oneWeekAgo}
  `);
  const newSubStripeThisWeek = parseInt((newSubStripeThisWeekResult.rows[0] as any)?.c ?? "0", 10);

  // Demo performance this week
  const gcDemoClicks = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'GC_DEMO' AND created_at >= ${oneWeekAgo}`).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);
  const subDemoClicks = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'SUB_DEMO' AND created_at >= ${oneWeekAgo}`).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);

  // Trials expiring in 3 days (for morning email)
  const trialsExpiring3d: Array<{ companyName: string; email: string; userId: string; daysLeft: number }> = [];
  for (const user of gcOwners) {
    if (!user.stripeSubscriptionId && !user.adminPlanOverride) {
      const trialEnd = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 3) {
        trialsExpiring3d.push({ companyName: user.companyName, email: user.email, userId: user.id, daysLeft });
      }
    }
  }

  // Demo clicks last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const demoClicks30d = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE created_at >= ${thirtyDaysAgo}`).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);

  res.json({
    mrr: Math.round(mrr), totalPaying, activeTrials, trialsExpiring7d,
    churnedThisMonth, mrrLostToChurn: Math.round(mrrLostToChurn),
    nearLimitCount, churnRiskCount, failedPaymentsCount,
    totalGCs, totalSubs, totalProjects,
    newTrialsThisWeek, newTrialsYesterday, activatedThisWeek,
    invoicesFlaggedThisWeek, invoicesFlaggedYesterday, paymentsThisWeek, paymentsYesterdayResult: paymentsYesterdayResult,
    lienWaiversThisWeek, newSubStripeThisWeek, gcDemoClicks, subDemoClicks,
    trialsExpiring3d, demoClicks30d,
  });
});

// ── Churn Risk ────────────────────────────────────────────────────────────────

router.get("/churn-risk", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();
  const results = [];

  for (const user of gcOwners) {
    if (!user.stripeSubscriptionId && !user.adminPlanOverride) continue; // skip non-paying

    const overrideExpired = user.adminPlanOverride && user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < now;
    if (overrideExpired) continue;

    const reasons: string[] = [];
    let risk: "red" | "yellow" | "green" = "green";

    // Check last login
    const daysSinceLogin = user.lastLoginAt
      ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    if (daysSinceLogin === null || daysSinceLogin > 14) {
      risk = "red";
      reasons.push(daysSinceLogin === null ? "Never logged in" : `No login in ${daysSinceLogin} days`);
    }

    // Check payment status
    let planLabel = user.adminPlanOverride ? (getPlanByName(user.adminPlanOverride)?.label ?? "Override") : null;
    if (user.stripeSubscriptionId) {
      const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
      if (subInfo) {
        planLabel = planLabel ?? subInfo.product_name?.replace(/ Annual$/, "");
        if (subInfo.status === "past_due") {
          risk = "red";
          reasons.push("Payment failed / past due");
        }
      }
    }

    // Check subcontract activity in last 60 days
    const cutoff60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const recentSubResult = await db.execute(sql`
      SELECT COUNT(s.id) as c FROM subcontracts s
      JOIN projects p ON p.id = s.project_id
      WHERE p.gc_id = ${user.id} AND s.created_at > ${cutoff60d}
    `).catch(() => ({ rows: [{ c: "0" }] }));
    const recentSubs = parseInt((recentSubResult.rows[0] as any)?.c ?? "0", 10);
    if (recentSubs === 0 && risk === "green") {
      risk = "yellow";
      reasons.push("No new subcontracts in 60 days");
    }

    // Check if login frequency is dropping (compare last 30 vs prior 30 days via activity logs)
    const loginCountResult = await db.execute(sql`
      SELECT COUNT(*) as c FROM subcontract_activity_logs
      WHERE user_id = ${user.id} AND created_at > ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
    `).catch(() => ({ rows: [{ c: "0" }] }));
    const recentActivity = parseInt((loginCountResult.rows[0] as any)?.c ?? "0", 10);
    if (recentActivity < 5 && risk === "green") {
      risk = "yellow";
      reasons.push("Low platform activity in last 30 days");
    }

    results.push({
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      planLabel,
      risk,
      reasons,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      daysSinceLogin,
      createdAt: user.createdAt.toISOString(),
      adminNotes: user.adminNotes ?? null,
    });
  }

  results.sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return order[a.risk] - order[b.risk];
  });

  res.json(results);
});

// ── Upgrade Opportunities ────────────────────────────────────────────────────

router.get("/upgrade-opportunities", requireAdmin, async (req, res) => {
  const gcOwners = await getGCOwners();
  const now = new Date();
  const results = [];

  for (const user of gcOwners) {
    const planInfo = await getGCPlanInfo(user.id);
    if (!planInfo.subscribed || !planInfo.limit) continue; // skip trial/unsubscribed/unlimited

    const usagePercent = planInfo.activeCount / planInfo.limit;
    if (usagePercent < 0.7) continue;

    const nextPlan = planInfo.nextPlan;
    results.push({
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      planLabel: planInfo.planLabel,
      planName: planInfo.planName,
      activeCount: planInfo.activeCount,
      limit: planInfo.limit,
      usagePercent: Math.round(usagePercent * 100),
      nextPlanLabel: nextPlan?.label ?? null,
      nextPlanName: nextPlan?.name ?? null,
      nextPlanMonthlyUsd: nextPlan ? nextPlan.monthlyUsd / 100 : null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  }

  results.sort((a, b) => b.usagePercent - a.usagePercent);
  res.json(results);
});

// ── Product Usage ─────────────────────────────────────────────────────────────

router.get("/product-usage", requireAdmin, async (req, res) => {
  const totalGCsResult = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL`);
  const totalGCs = parseInt((totalGCsResult.rows[0] as any)?.c ?? "0", 10);

  const planFilesResult = await db.execute(sql`SELECT COUNT(DISTINCT p.gc_id) as c FROM plan_files pf JOIN projects p ON p.id = pf.project_id WHERE p.gc_id IN (SELECT id FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL)`);
  const gcsWithPlanFiles = parseInt((planFilesResult.rows[0] as any)?.c ?? "0", 10);

  const aiResult = await db.execute(sql`SELECT COUNT(DISTINCT gc_id) as c FROM projects WHERE ai_analysis IS NOT NULL AND gc_id IN (SELECT id FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL)`);
  const gcsWithAIAnalysis = parseInt((aiResult.rows[0] as any)?.c ?? "0", 10);

  const tradeScopeResult = await db.execute(sql`SELECT COUNT(DISTINCT p.gc_id) as c FROM trade_scopes ts JOIN projects p ON p.id = ts.project_id WHERE p.gc_id IN (SELECT id FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL)`);
  const gcsWithTradeScopes = parseInt((tradeScopeResult.rows[0] as any)?.c ?? "0", 10);

  const retentionResult = await db.execute(sql`SELECT COUNT(DISTINCT p.gc_id) as c FROM subcontracts s JOIN projects p ON p.id = s.project_id WHERE s.retention_percentage > 0 AND p.gc_id IN (SELECT id FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL)`);
  const gcsWithRetention = parseInt((retentionResult.rows[0] as any)?.c ?? "0", 10);

  const complianceResult = await db.execute(sql`SELECT COUNT(DISTINCT p.gc_id) as c FROM compliance_checklist_items cci JOIN projects p ON p.id = cci.project_id WHERE p.gc_id IN (SELECT id FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL)`);
  const gcsWithCompliance = parseInt((complianceResult.rows[0] as any)?.c ?? "0", 10);

  const totalSubsResult = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'SUB' AND is_demo = false`);
  const totalSubs = parseInt((totalSubsResult.rows[0] as any)?.c ?? "0", 10);

  const paymentConfirmedResult = await db.execute(sql`SELECT COUNT(DISTINCT u.id) as c FROM invoices i JOIN subcontracts sc ON sc.id = i.subcontract_id JOIN projects p ON p.id = sc.project_id JOIN users u ON u.id = p.gc_id WHERE i.payment_confirmed_at IS NOT NULL AND u.is_demo = false`);
  const subsWithPaymentConfirmed = parseInt((paymentConfirmedResult.rows[0] as any)?.c ?? "0", 10);

  const lienWaiverResult = await db.execute(sql`SELECT COUNT(*) as c FROM lien_waivers lw JOIN subcontracts sc ON sc.id = lw.subcontract_id JOIN projects p ON p.id = sc.project_id JOIN users u ON u.id = p.gc_id WHERE u.is_demo = false`);
  const lienWaiversSigned = parseInt((lienWaiverResult.rows[0] as any)?.c ?? "0", 10);

  const changeOrderResult = await db.execute(sql`SELECT COUNT(*) as c FROM change_orders co JOIN subcontracts sc ON sc.id = co.subcontract_id JOIN projects p ON p.id = sc.project_id JOIN users u ON u.id = p.gc_id WHERE u.is_demo = false`);
  const totalChangeOrders = parseInt((changeOrderResult.rows[0] as any)?.c ?? "0", 10);

  const invoiceResult = await db.execute(sql`SELECT COUNT(*) as c FROM invoices i JOIN subcontracts sc ON sc.id = i.subcontract_id JOIN projects p ON p.id = sc.project_id JOIN users u ON u.id = p.gc_id WHERE u.is_demo = false`);
  const totalInvoices = parseInt((invoiceResult.rows[0] as any)?.c ?? "0", 10);

  res.json({
    totalGCs, totalSubs,
    gcFeatures: {
      planFilesUploaded: { count: gcsWithPlanFiles, total: totalGCs, label: "Uploaded Plan Files" },
      aiAnalysisRun: { count: gcsWithAIAnalysis, total: totalGCs, label: "Run AI Analysis" },
      tradeScopes: { count: gcsWithTradeScopes, total: totalGCs, label: "Created Trade Scopes" },
      retention: { count: gcsWithRetention, total: totalGCs, label: "Enabled Retention" },
      compliance: { count: gcsWithCompliance, total: totalGCs, label: "Used Compliance Checklists" },
    },
    platformTotals: {
      changeOrders: totalChangeOrders,
      invoices: totalInvoices,
      lienWaiversSigned,
      subsWithPaymentConfirmed,
    },
  });
});

// ── Support Queue ─────────────────────────────────────────────────────────────

router.get("/support-queue", requireAdmin, async (req, res) => {
  // Failed payments (past_due subscriptions)
  const failedPaymentAccounts = [];
  const gcOwners = await getGCOwners();
  const now = new Date();
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const user of gcOwners) {
    if (!user.stripeSubscriptionId) continue;
    const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
    if (subInfo?.status === "past_due") {
      failedPaymentAccounts.push({
        id: user.id,
        companyName: user.companyName,
        email: user.email,
        planLabel: subInfo.product_name?.replace(/ Annual$/, "") ?? null,
        amount: subInfo.unit_amount ? subInfo.unit_amount / 100 : null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        issue: "payment_failed",
      });
    }
  }

  // Never logged in after signup (>3 days old, never logged in)
  const neverLoggedIn = gcOwners.filter(u => {
    const ageMs = now.getTime() - u.createdAt.getTime();
    return !u.lastLoginAt && ageMs > 3 * 24 * 60 * 60 * 1000 && !u.isDemo;
  }).map(u => ({
    id: u.id,
    companyName: u.companyName,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: null,
    issue: "never_logged_in",
  }));

  res.json({ failedPayments: failedPaymentAccounts, neverLoggedIn });
});

// ── Broadcast Email ───────────────────────────────────────────────────────────

router.post("/broadcast-email", requireAdmin, async (req, res) => {
  const { segment, subject, message } = req.body;
  if (!segment || !subject || !message) {
    res.status(400).json({ error: "segment, subject, and message are required" });
    return;
  }

  const gcOwners = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  let targets: typeof gcOwners = [];

  if (segment === "all_trials") {
    targets = gcOwners.filter(u => {
      const trialEndsAt = new Date((u.trialStartedAt ?? u.createdAt).getTime() + TRIAL_MS);
      return !u.stripeSubscriptionId && now < trialEndsAt;
    });
  } else if (segment === "all_paying") {
    targets = gcOwners.filter(u => u.stripeSubscriptionId || u.adminPlanOverride);
  } else if (segment === "all_churned") {
    targets = gcOwners.filter(u => {
      const trialEndsAt = new Date((u.trialStartedAt ?? u.createdAt).getTime() + TRIAL_MS);
      return !u.stripeSubscriptionId && !u.adminPlanOverride && now > trialEndsAt;
    });
  } else if (segment === "all_annual") {
    const annualAccounts: typeof gcOwners = [];
    for (const u of gcOwners) {
      if (!u.stripeSubscriptionId) continue;
      const subInfo = await getStripeSubscriptionInfo(u.stripeSubscriptionId);
      if (subInfo?.billing_interval === "year") annualAccounts.push(u);
    }
    targets = annualAccounts;
  } else if (segment === "all_users") {
    targets = gcOwners;
  } else {
    res.status(400).json({ error: "Invalid segment" });
    return;
  }

  let sent = 0;
  for (const user of targets) {
    await sendAdminMessageEmail({ toEmail: user.email, subject, message }).catch(() => {});
    sent++;
  }

  res.json({ success: true, sent, segment, recipientCount: targets.length });
});

// ── Trial Follow-Up Email ─────────────────────────────────────────────────────

router.post("/gc/:userId/send-followup", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { message } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const trialEndsAt = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const subject = `Following up on your SubTracker trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining`;
  const body = message || `Hi ${user.companyName},\n\nWe noticed you're in your SubTracker trial with ${trialDaysLeft} days remaining. We'd love to help you get the most out of the platform.\n\nIf you have any questions, just reply to this email.\n\nThe SubTracker Team`;

  await sendAdminMessageEmail({ toEmail: user.email, subject, message: body });
  res.json({ success: true });
});

// ── Upgrade Offer Email ───────────────────────────────────────────────────────

router.post("/gc/:userId/offer-upgrade", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { nextPlanName } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const plan = nextPlanName ? getPlanByName(nextPlanName) : null;
  const subject = `Upgrade your SubTracker plan${plan ? ` — ${plan.label} unlocks more capacity` : ""}`;
  const body = `Hi ${user.companyName},\n\nYou're approaching your subcontract limit on SubTracker. To keep growing without interruption, consider upgrading to ${plan?.label ?? "a higher plan"}.\n\nYou can upgrade instantly from your billing page: visit Settings → Billing in your dashboard.\n\nThe SubTracker Team`;

  await sendAdminMessageEmail({ toEmail: user.email, subject, message: body });
  res.json({ success: true });
});

// ── Demo Stats ────────────────────────────────────────────────────────────────

router.get("/demo/stats", requireAdmin, async (req, res) => {
  const [gcDemoUser] = await db.select().from(usersTable)
    .where(and(eq(usersTable.isDemo, true), eq(usersTable.role, "GC")))
    .limit(1);
  const [subDemoUser] = await db.select().from(usersTable)
    .where(and(eq(usersTable.isDemo, true), eq(usersTable.role, "SUB")))
    .limit(1);

  const now = new Date();
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Real signups (non-demo GC owners)
  const signups7dResult = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL AND created_at > ${cutoff7d}`);
  const signups7d = parseInt((signups7dResult.rows[0] as any)?.c ?? "0", 10);
  const signups30dResult = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL AND created_at > ${cutoff30d}`);
  const signups30d = parseInt((signups30dResult.rows[0] as any)?.c ?? "0", 10);

  // Demo click counts
  const gcClicks7dResult = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'GC_DEMO' AND created_at > ${cutoff7d}`);
  const gcClicks7d = parseInt((gcClicks7dResult.rows[0] as any)?.c ?? "0", 10);
  const gcClicks30dResult = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'GC_DEMO' AND created_at > ${cutoff30d}`);
  const gcClicks30d = parseInt((gcClicks30dResult.rows[0] as any)?.c ?? "0", 10);
  const subClicks7dResult = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'SUB_DEMO' AND created_at > ${cutoff7d}`);
  const subClicks7d = parseInt((subClicks7dResult.rows[0] as any)?.c ?? "0", 10);
  const subClicks30dResult = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE event_type = 'SUB_DEMO' AND created_at > ${cutoff30d}`);
  const subClicks30d = parseInt((subClicks30dResult.rows[0] as any)?.c ?? "0", 10);
  const totalClicks30d = gcClicks30d + subClicks30d;
  const conversionRate = totalClicks30d > 0 ? Math.round((signups30d / totalClicks30d) * 1000) / 10 : null;

  // Recent demo sessions (last 30)
  const recentSessionsResult = await db.execute(sql`SELECT id, event_type, ip_address, created_at FROM demo_clicks ORDER BY created_at DESC LIMIT 30`);
  const recentSessions = recentSessionsResult.rows.map((r: any) => ({
    id: r.id,
    eventType: r.event_type,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }));

  // Page view stats (last 7 days)
  const pageViews7dResult = await db.execute(sql`SELECT COUNT(*) as c FROM page_views WHERE created_at > ${cutoff7d}`);
  const pageViews7d = parseInt((pageViews7dResult.rows[0] as any)?.c ?? "0", 10);
  const uniqueIps7dResult = await db.execute(sql`SELECT COUNT(DISTINCT path) as c FROM page_views WHERE created_at > ${cutoff7d}`);
  const uniquePaths7d = parseInt((uniqueIps7dResult.rows[0] as any)?.c ?? "0", 10);
  const topPagesResult = await db.execute(sql`SELECT path, COUNT(*) as views FROM page_views WHERE created_at > ${cutoff7d} GROUP BY path ORDER BY views DESC LIMIT 10`);
  const topPages = topPagesResult.rows.map((r: any) => ({ path: r.path, views: parseInt(r.views, 10) }));

  res.json({
    gcDemoExists: !!gcDemoUser,
    subDemoExists: !!subDemoUser,
    signups7d,
    signups30d,
    gcClicks7d,
    gcClicks30d,
    subClicks7d,
    subClicks30d,
    conversionRate,
    recentSessions,
    pageViews7d,
    uniquePaths7d,
    topPages,
  });
});

router.post("/demo/reset", requireAdmin, async (req, res) => {
  try {
    await forceResetDemoData();
    res.json({ success: true, message: "Demo data has been wiped and reseeded." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Feature Flags ─────────────────────────────────────────────────────────────

router.get("/feature-flags", requireAdmin, async (req, res) => {
  const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.name);

  // If no flags exist, seed defaults
  if (flags.length === 0) {
    const defaults = [
      { name: "ai_bid_analysis",        description: "AI bid benchmarks using Claude on plan files", globalEnabled: true },
      { name: "compliance_checklists",  description: "GC compliance checklist feature", globalEnabled: true },
      { name: "lien_waivers",           description: "Subcontractor lien waiver signing", globalEnabled: true },
      { name: "owner_notifications",    description: "Project owner change order notification emails", globalEnabled: true },
      { name: "trade_scopes",           description: "Trade scope management and templates", globalEnabled: true },
      { name: "bid_comparison",         description: "GC bid comparison table view", globalEnabled: true },
      { name: "gc_credentials",         description: "GC insurance/license credential tracking", globalEnabled: true },
      { name: "demo_mode",              description: "Demo account login button on login page", globalEnabled: true },
      { name: "magic_link_login",       description: "Magic link email login option", globalEnabled: true },
      { name: "team_management",        description: "GC team member management", globalEnabled: true },
    ];
    await db.insert(featureFlagsTable).values(defaults.map(d => ({ ...d, perAccountOverrides: {} })));
    const seeded = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.name);
    res.json(seeded);
    return;
  }

  res.json(flags);
});

router.patch("/feature-flags/:flagId", requireAdmin, async (req, res) => {
  const { flagId } = req.params;
  const { globalEnabled, perAccountOverrides } = req.body;

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (typeof globalEnabled === "boolean") updates.globalEnabled = globalEnabled;
  if (perAccountOverrides !== undefined) updates.perAccountOverrides = perAccountOverrides;

  const [updated] = await db.update(featureFlagsTable)
    .set(updates)
    .where(eq(featureFlagsTable.id, flagId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Flag not found" }); return; }
  res.json(updated);
});

// ── Call List ─────────────────────────────────────────────────────────────────
// In-memory 24-hour dismissals
const callListDismissals = new Map<string, number>(); // userId -> timestamp

router.get("/call-list", requireAdmin, async (req, res) => {
  const now = Date.now();
  // Clean up expired dismissals
  for (const [uid, ts] of callListDismissals.entries()) {
    if (now - ts > 24 * 60 * 60 * 1000) callListDismissals.delete(uid);
  }

  const gcOwners = await getGCOwners();
  const nowDate = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  // Get recent call log for each user
  const callLogs = await db.select().from(adminCallLogsTable).where(gte(adminCallLogsTable.createdAt, new Date(now - 30 * 24 * 60 * 60 * 1000)));
  const lastCalledMap = new Map<string, Date>();
  for (const log of callLogs) {
    if (log.action === "called") {
      const existing = lastCalledMap.get(log.gcUserId);
      if (!existing || log.createdAt > existing) lastCalledMap.set(log.gcUserId, log.createdAt);
    }
  }

  // Activation check (batch query)
  const activatedIds = new Set<string>();
  const activationRes = await db.execute(sql`
    SELECT u.id FROM users u
    WHERE u.role = 'GC' AND u.is_demo = false AND u.gc_parent_id IS NULL
      AND EXISTS (SELECT 1 FROM projects p WHERE p.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM subcontracts s JOIN projects p2 ON p2.id = s.project_id WHERE p2.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM invoices i JOIN subcontracts s2 ON s2.id = i.subcontract_id JOIN projects p3 ON p3.id = s2.project_id WHERE p3.gc_id = u.id)
  `);
  for (const r of activationRes.rows as any[]) activatedIds.add(r.id);

  // Project count for each GC
  const projectsRes = await db.execute(sql`SELECT p.gc_id, COUNT(*) as c FROM projects p GROUP BY p.gc_id`);
  const projectCounts = new Map<string, number>();
  for (const r of projectsRes.rows as any[]) projectCounts.set(r.gc_id, parseInt(r.c, 10));

  const items: any[] = [];

  for (const user of gcOwners) {
    if (callListDismissals.has(user.id)) continue; // Dismissed

    const trialStart = user.trialStartedAt ?? user.createdAt;
    const trialEnd = new Date(trialStart.getTime() + TRIAL_MS);
    const daysLeft = Math.ceil((trialEnd.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOnTrial = nowDate < trialEnd && !user.stripeSubscriptionId && !user.adminPlanOverride;
    const isPaying = !!(user.stripeSubscriptionId || user.adminPlanOverride);
    const activated = activatedIds.has(user.id);
    const projects = projectCounts.get(user.id) ?? 0;
    const ageMs = nowDate.getTime() - user.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const daysSinceLogin = user.lastLoginAt ? (nowDate.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24) : 999;
    const lastCalled = lastCalledMap.get(user.id)?.toISOString() ?? null;

    let priority: "urgent" | "high" | "medium" | "low" | null = null;
    let reason = "";

    if (isOnTrial && daysLeft >= 1 && daysLeft <= 3) {
      priority = "urgent";
      reason = `Trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — hasn't upgraded`;
    } else if (!isPaying && activated) {
      priority = "high";
      reason = "Completed activation checklist but hasn't upgraded";
    } else if (isOnTrial && daysLeft >= 4 && daysLeft <= 7) {
      priority = "medium";
      reason = `Trial expires in ${daysLeft} days`;
    } else if (isOnTrial && ageDays > 5 && projects === 0) {
      priority = "medium";
      reason = `Signed up ${Math.floor(ageDays)} days ago but hasn't created a project`;
    } else if (isPaying && daysSinceLogin > 14) {
      priority = "low";
      reason = `Paying customer — no login in ${Math.floor(daysSinceLogin)} days`;
    } else if (isOnTrial && daysSinceLogin > 5) {
      priority = "low";
      reason = `Trial user — no activity in ${Math.floor(daysSinceLogin)} days`;
    }

    if (!priority) continue;

    items.push({
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      priority,
      reason,
      daysLeft: isOnTrial ? daysLeft : null,
      projects,
      activated,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      ageDays: Math.floor(ageDays),
      lastCalled,
    });
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);

  res.json({ items, total: items.length });
});

router.post("/call-list/dismiss/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  callListDismissals.set(userId, Date.now());
  res.json({ success: true });
});

router.post("/call-list/mark-called/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const admin = getAdminUser(req);
  await db.insert(adminCallLogsTable).values({
    gcUserId: userId,
    action: "called",
    reason: reason ?? null,
    adminEmail: admin?.adminEmail ?? "admin",
  });
  res.json({ success: true });
});

// ── Funnel ────────────────────────────────────────────────────────────────────

router.get("/funnel", requireAdmin, async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = end ? new Date(end) : now;

  const demoClicks = await db.execute(sql`SELECT COUNT(*) as c FROM demo_clicks WHERE created_at >= ${startDate} AND created_at <= ${endDate}`).then(r => parseInt((r.rows[0] as any)?.c ?? "0", 10)).catch(() => 0);

  const trialSignupsRes = await db.execute(sql`SELECT COUNT(*) as c FROM users WHERE role = 'GC' AND is_demo = false AND gc_parent_id IS NULL AND created_at >= ${startDate} AND created_at <= ${endDate}`);
  const trialSignups = parseInt((trialSignupsRes.rows[0] as any)?.c ?? "0", 10);

  const activatedRes = await db.execute(sql`
    SELECT COUNT(*) as c FROM users u
    WHERE u.role = 'GC' AND u.is_demo = false AND u.gc_parent_id IS NULL
      AND u.created_at >= ${startDate} AND u.created_at <= ${endDate}
      AND EXISTS (SELECT 1 FROM projects p WHERE p.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM subcontracts s JOIN projects p2 ON p2.id = s.project_id WHERE p2.gc_id = u.id)
      AND EXISTS (SELECT 1 FROM invoices i JOIN subcontracts s2 ON s2.id = i.subcontract_id JOIN projects p3 ON p3.id = s2.project_id WHERE p3.gc_id = u.id)
  `);
  const activationCompleted = parseInt((activatedRes.rows[0] as any)?.c ?? "0", 10);

  let upgradedToPaid = 0;
  try {
    const upgradedRes = await db.execute(sql`
      SELECT COUNT(*) as c FROM stripe.subscriptions s
      JOIN users u ON u.stripe_subscription_id = s.id
      WHERE u.role = 'GC' AND u.is_demo = false AND s.status IN ('active', 'trialing')
        AND TO_TIMESTAMP(s.created) >= ${startDate} AND TO_TIMESTAMP(s.created) <= ${endDate}
    `);
    upgradedToPaid = parseInt((upgradedRes.rows[0] as any)?.c ?? "0", 10);
  } catch {}

  let stillActive90d = 0;
  try {
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const active90Res = await db.execute(sql`
      SELECT COUNT(*) as c FROM stripe.subscriptions s
      JOIN users u ON u.stripe_subscription_id = s.id
      WHERE u.role = 'GC' AND u.is_demo = false AND s.status = 'active'
        AND TO_TIMESTAMP(s.created) <= ${ninetyDaysAgo}
    `);
    stillActive90d = parseInt((active90Res.rows[0] as any)?.c ?? "0", 10);
  } catch {}

  const stages = [
    { label: "Demo Clicks", count: demoClicks },
    { label: "Trial Signups", count: trialSignups },
    { label: "Activation Completed", count: activationCompleted },
    { label: "Upgraded to Paid", count: upgradedToPaid },
    { label: "Still Active @ 90d", count: stillActive90d },
  ];

  res.json({ stages });
});

// ── Account Detail ────────────────────────────────────────────────────────────

router.get("/accounts/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const trialEnd = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
  const trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isOnTrial = now < trialEnd && !user.stripeSubscriptionId && !user.adminPlanOverride;

  // Stripe plan info
  let planLabel: string | null = null;
  let planName: string | null = null;
  let status: string = isOnTrial ? "trial" : "cancelled";
  let monthlyRevenue = 0;
  let nextBillingDate: string | null = null;
  let billingInterval: string | null = null;
  let totalRevenuePaid = 0;

  if (user.adminPlanOverride) {
    const overrideExpired = user.adminPlanOverrideExpiresAt && user.adminPlanOverrideExpiresAt < now;
    if (!overrideExpired) {
      planName = user.adminPlanOverride;
      const plan = getPlanByName(user.adminPlanOverride);
      planLabel = plan?.label ?? null;
      monthlyRevenue = plan ? plan.monthlyUsd / 100 : 0;
      status = "active";
    }
  } else if (user.stripeSubscriptionId) {
    const subInfo = await getStripeSubscriptionInfo(user.stripeSubscriptionId);
    if (subInfo) {
      planName = subInfo.product_name?.replace(/ Annual$/, "") ?? null;
      const plan = getPlanByName(planName ?? "");
      planLabel = plan?.label ?? null;
      billingInterval = subInfo.billing_interval ?? "month";
      const amount = subInfo.unit_amount ?? 0;
      monthlyRevenue = billingInterval === "year" ? amount / 100 / 12 : amount / 100;
      if (subInfo.status === "active" || subInfo.status === "trialing") status = "active";
      else if (subInfo.status === "past_due") status = "past_due";
      else status = "cancelled";
      if (subInfo.current_period_end) {
        nextBillingDate = new Date(Number(subInfo.current_period_end) * 1000).toISOString();
      }
    }
    // Total revenue from Stripe invoices
    try {
      const revRes = await db.execute(sql`SELECT COALESCE(SUM(i.amount_paid), 0) as total FROM stripe.invoices i WHERE i.customer = ${user.stripeCustomerId} AND i.status = 'paid'`);
      totalRevenuePaid = parseInt((revRes.rows[0] as any)?.total ?? "0", 10) / 100;
    } catch {}
  }

  // Usage stats
  const projRes = await db.execute(sql`SELECT COUNT(*) as c FROM projects WHERE gc_id = ${userId}`);
  const totalProjects = parseInt((projRes.rows[0] as any)?.c ?? "0", 10);
  const scRes = await db.execute(sql`SELECT COUNT(*) as c FROM subcontracts s JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${userId}`);
  const totalSubcontracts = parseInt((scRes.rows[0] as any)?.c ?? "0", 10);
  const invRes = await db.execute(sql`SELECT COUNT(*) as c FROM invoices i JOIN subcontracts s ON s.id = i.subcontract_id JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${userId}`);
  const totalInvoices = parseInt((invRes.rows[0] as any)?.c ?? "0", 10);
  const invFlaggedRes = await db.execute(sql`SELECT COUNT(*) as c FROM invoices i JOIN subcontracts s ON s.id = i.subcontract_id JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${userId} AND i.flagged = true`);
  const totalInvoicesFlagged = parseInt((invFlaggedRes.rows[0] as any)?.c ?? "0", 10);
  const coRes = await db.execute(sql`SELECT COUNT(*) as c FROM change_orders co JOIN subcontracts s ON s.id = co.subcontract_id JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${userId}`);
  const totalChangeOrders = parseInt((coRes.rows[0] as any)?.c ?? "0", 10);
  const lwRes = await db.execute(sql`SELECT COUNT(*) as c FROM lien_waivers WHERE project_id IN (SELECT id FROM projects WHERE gc_id = ${userId})`);
  const totalLienWaivers = parseInt((lwRes.rows[0] as any)?.c ?? "0", 10);
  const stripeVolRes = await db.execute(sql`SELECT COALESCE(SUM(i.amount), 0) as total FROM invoices i JOIN subcontracts s ON s.id = i.subcontract_id JOIN projects p ON p.id = s.project_id WHERE p.gc_id = ${userId} AND i.stripe_payment_intent_id IS NOT NULL`);
  const stripePaymentVolume = parseFloat((stripeVolRes.rows[0] as any)?.total ?? "0");

  // Activation checklist
  const hasProject = totalProjects > 0;
  const hasSubcontract = totalSubcontracts > 0;
  const hasInvoice = totalInvoices > 0;
  const activationComplete = hasProject && hasSubcontract && hasInvoice;

  // Activity timeline (last 20 actions)
  const timeline = await db.execute(sql`
    SELECT sal.type, sal.description, sal.actor_name, sal.actor_role, sal.created_at
    FROM subcontract_activity_logs sal
    JOIN subcontracts sc ON sc.id = sal.subcontract_id
    JOIN projects p ON p.id = sc.project_id
    WHERE p.gc_id = ${userId}
    ORDER BY sal.created_at DESC
    LIMIT 20
  `);

  // Last call log
  const lastCall = await db.select().from(adminCallLogsTable).where(and(eq(adminCallLogsTable.gcUserId, userId), eq(adminCallLogsTable.action, "called"))).orderBy(desc(adminCallLogsTable.createdAt)).limit(1);

  res.json({
    id: user.id,
    companyName: user.companyName,
    email: user.email,
    role: user.role,
    planName,
    planLabel,
    billingInterval,
    status,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    trialDaysLeft: isOnTrial ? trialDaysLeft : null,
    trialEndsAt: trialEnd.toISOString(),
    adminNotes: user.adminNotes,
    adminPlanOverride: user.adminPlanOverride,
    // Revenue
    monthlyRevenue: Math.round(monthlyRevenue),
    totalRevenuePaid: Math.round(totalRevenuePaid),
    nextBillingDate,
    // Usage
    totalProjects, totalSubcontracts, totalInvoices, totalInvoicesFlagged,
    totalChangeOrders, totalLienWaivers, stripePaymentVolume,
    // Activation
    activationComplete,
    activationSteps: { hasProject, hasSubcontract, hasInvoice },
    // Timeline
    timeline: (timeline.rows as any[]).map(r => ({
      type: r.type,
      description: r.description,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      createdAt: r.created_at,
    })),
    lastCallAt: lastCall[0]?.createdAt?.toISOString() ?? null,
  });
});

router.patch("/accounts/:userId/notes", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { notes } = req.body;
  await db.update(usersTable).set({ adminNotes: notes, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── CSV Export: GC Accounts ───────────────────────────────────────────────────

router.get("/gc-accounts/export", requireAdmin, async (req, res) => {
  const accounts = await getGCOwners();
  const now = new Date();
  const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

  const rows = accounts.map(user => {
    const trialEnd = new Date((user.trialStartedAt ?? user.createdAt).getTime() + TRIAL_MS);
    const isOnTrial = now < trialEnd && !user.stripeSubscriptionId;
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return [
      user.companyName,
      user.email,
      isOnTrial ? "Trial" : user.stripeSubscriptionId ? "Active" : "Churned",
      user.adminPlanOverride ?? "",
      isOnTrial ? daysLeft : "",
      user.createdAt.toISOString(),
      user.lastLoginAt?.toISOString() ?? "",
    ];
  });

  const csv = [
    ["Company Name", "Email", "Status", "Plan Override", "Trial Days Left", "Signup Date", "Last Login"],
    ...rows,
  ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"gc-accounts.csv\"");
  res.send(csv);
});

// ── CSV Export: Activity Log ──────────────────────────────────────────────────

router.get("/activity/export", requireAdmin, async (req, res) => {
  const { start, end, filter } = req.query as { start?: string; end?: string; filter?: string };

  let logs = await db.select().from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(10000);

  if (start) logs = logs.filter(l => l.createdAt >= new Date(start));
  if (end) logs = logs.filter(l => l.createdAt <= new Date(end));
  if (filter && FILTER_PREFIXES[filter]) {
    const prefixes = FILTER_PREFIXES[filter];
    logs = logs.filter(l => prefixes.some(p => l.type.startsWith(p)));
  }

  const csv = [
    ["Date", "Action", "Description", "Actor", "Role"],
    ...logs.map(l => [
      l.createdAt.toISOString(),
      ACTION_LABEL[l.type] ?? l.type,
      l.description,
      l.actorName,
      l.actorRole,
    ]),
  ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"activity-log.csv\"");
  res.send(csv);
});

// ── CSV Export: Stripe Transactions ──────────────────────────────────────────

router.get("/transactions/export", requireAdmin, async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };

  let query = db
    .select({
      initiatedAt: invoicesTable.stripePaymentInitiatedAt,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      intentId: invoicesTable.stripePaymentIntentId,
      method: invoicesTable.stripePaymentMethod,
      subcontractId: invoicesTable.subcontractId,
    })
    .from(invoicesTable)
    .where(isNotNull(invoicesTable.stripePaymentIntentId))
    .orderBy(desc(invoicesTable.stripePaymentInitiatedAt));

  const all = await query;
  const filtered = all.filter(r => {
    if (!r.initiatedAt) return false;
    const d = new Date(r.initiatedAt);
    if (start && d < new Date(start)) return false;
    if (end && d > new Date(end)) return false;
    return true;
  });

  const enriched = await Promise.all(filtered.slice(0, 5000).map(async inv => {
    const [sc] = await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, inv.subcontractId));
    let gcName = "", subName = "";
    if (sc) {
      const [gcUser] = await db.select({ c: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, (await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0]?.gcId ?? ""));
      const [subUser] = await db.select({ c: usersTable.companyName }).from(usersTable).where(eq(usersTable.id, sc.subId));
      gcName = gcUser?.c ?? "";
      subName = subUser?.c ?? "";
    }
    return { ...inv, gcName, subName };
  }));

  const csv = [
    ["Date", "GC Company", "Sub Company", "Invoice #", "Amount", "PaymentIntent ID", "Method", "Status"],
    ...enriched.map(r => [
      r.initiatedAt?.toISOString() ?? "",
      r.gcName,
      r.subName,
      r.invoiceNumber,
      r.amount,
      r.intentId ?? "",
      r.method ?? "",
      "succeeded",
    ]),
  ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"stripe-transactions.csv\"");
  res.send(csv);
});

// ── Admin: Push Notification Stats ────────────────────────────────────────────
router.get("/push/stats", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      role: usersTable.role,
      count: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${pushSubscriptionsTable.userId})::int`,
    })
    .from(pushSubscriptionsTable)
    .innerJoin(usersTable, eq(pushSubscriptionsTable.userId, usersTable.id))
    .groupBy(usersTable.role);

  let totalSubscriptions = 0, gcSubscriptions = 0, subSubscriptions = 0, uniqueUsers = 0;
  for (const row of rows) {
    totalSubscriptions += row.count;
    uniqueUsers += row.uniqueUsers;
    if (row.role === "GC") gcSubscriptions += row.count;
    else if (row.role === "SUB") subSubscriptions += row.count;
  }
  res.json({ totalSubscriptions, gcSubscriptions, subSubscriptions, uniqueUsers });
});

// ── Admin: Broadcast Push Notification ────────────────────────────────────────
router.post("/push/broadcast", requireAdmin, async (req, res) => {
  const { title, body, url, target } = req.body as {
    title: string; body: string; url?: string; target: "all" | "gc" | "sub";
  };
  if (!title || !body) { res.status(400).json({ error: "title and body required" }); return; }

  // Get subscriptions filtered by role
  let query = db
    .select({
      endpoint: pushSubscriptionsTable.endpoint,
      p256dh: pushSubscriptionsTable.p256dh,
      auth: pushSubscriptionsTable.auth,
    })
    .from(pushSubscriptionsTable)
    .innerJoin(usersTable, eq(pushSubscriptionsTable.userId, usersTable.id));

  const subscriptions = target === "all"
    ? await query
    : await query.where(eq(usersTable.role, target === "gc" ? "GC" : "SUB"));

  let sent = 0, failed = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await sendPushNotification({
        subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        title,
        body,
        url: url ?? "/dashboard",
      });
      sent++;
    } catch {
      failed++;
    }
  }));

  res.json({ sent, failed, total: subscriptions.length });
});

// ── Admin: Demo Leads ─────────────────────────────────────────────────────────

router.get("/demo-leads", requireAdmin, async (req, res) => {
  const { getDemoLeads } = await import("./demo-leads.js");
  const leads = await getDemoLeads();
  res.json(leads);
});

router.get("/demo-leads/export", requireAdmin, async (req, res) => {
  const { getDemoLeads } = await import("./demo-leads.js");
  const leads = await getDemoLeads();

  const csv = [
    ["Date", "First Name", "Email", "Role", "Session ID", "Referrer"],
    ...leads.map(l => [
      l.capturedAt.toISOString(),
      l.firstName,
      l.email,
      l.role,
      l.sessionId ?? "",
      l.referrer ?? "",
    ]),
  ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"demo-leads.csv\"");
  res.send(csv);
});

export default router;
