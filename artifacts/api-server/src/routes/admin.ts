import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, projectsTable, subcontractsTable, activityLogsTable, adminImpersonationLogsTable } from "@workspace/db/schema";
import { eq, and, isNull, sql, inArray, desc, or } from "drizzle-orm";
import {
  generateAdminToken, setAdminCookie, clearAdminCookie, getAdminUser,
  generateToken, setAuthCookie, clearAuthCookie, verifyToken,
} from "../lib/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";
import { PLANS, getPlanByName, getActiveSubcontractCount, getGCPlanInfo } from "../lib/stripeStorage.js";
import { sendAdminMessageEmail, sendAccountCancelledEmail } from "../lib/email.js";
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
  const { confirmName } = req.body;
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
    } catch { /* ignore */ }
  }

  // Delete user and cascade (team members, etc.)
  await db.delete(usersTable).where(or(eq(usersTable.id, userId), eq(usersTable.gcParentId, userId)));
  res.json({ success: true });
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

router.get("/activity", requireAdmin, async (req, res) => {
  const logs = await db.select().from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(500);
  res.json(logs);
});

// ── Impersonation Audit Log ───────────────────────────────────────────────────

router.get("/impersonation-logs", requireAdmin, async (req, res) => {
  const logs = await db.select().from(adminImpersonationLogsTable)
    .orderBy(desc(adminImpersonationLogsTable.startedAt))
    .limit(200);
  res.json(logs);
});

export default router;
