import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, gcProjectAssignmentsTable, projectsTable, magicLinkTokensTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth, requireGCOwner } from "../middlewares/requireAuth.js";
import { sendTeamMemberInviteEmail } from "../lib/email.js";
import { getEffectiveGcId, GC_TEAM_ROLES, GC_TEAM_ROLE_META } from "../lib/auth.js";

const router = Router();

// GET /team/roles — public list of all available roles and their metadata
router.get("/roles", (req, res) => {
  const roles = (Object.entries(GC_TEAM_ROLE_META) as [string, { label: string; description: string }][]).map(
    ([id, meta]) => ({ id, ...meta })
  );
  res.json(roles);
});

// GET /team — list all team members for this GC account (owner only)
router.get("/", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const ownerId = user.id;

  const members = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      companyName: usersTable.companyName,
      displayName: usersTable.displayName,
      gcTeamRole: usersTable.gcTeamRole,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.gcParentId, ownerId));

  // For each member, fetch their project assignments
  const membersWithProjects = await Promise.all(
    members.map(async (m) => {
      const assignments = await db
        .select({ projectId: gcProjectAssignmentsTable.projectId })
        .from(gcProjectAssignmentsTable)
        .where(eq(gcProjectAssignmentsTable.teamMemberUserId, m.id));

      const projectIds = assignments.map((a) => a.projectId);
      let projects: { id: string; name: string }[] = [];
      if (projectIds.length > 0) {
        projects = await Promise.all(
          projectIds.map(async (pid) => {
            const [p] = await db
              .select({ id: projectsTable.id, name: projectsTable.name })
              .from(projectsTable)
              .where(eq(projectsTable.id, pid))
              .limit(1);
            return p ?? { id: pid, name: "Unknown" };
          })
        );
      }

      return { ...m, assignedProjects: projects };
    })
  );

  // Also include the owner themselves in the list
  const ownerData = {
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    displayName: user.displayName ?? null,
    gcTeamRole: user.gcTeamRole ?? "owner",
    createdAt: null,
    assignedProjects: [],
    isCurrentUser: true,
  };

  res.json([ownerData, ...membersWithProjects]);
});

// POST /team/invite — invite a new team member
router.post("/invite", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { email, fullName, gcTeamRole } = req.body;

  if (!email || !fullName || !gcTeamRole) {
    res.status(400).json({ error: "email, fullName, and gcTeamRole are required" });
    return;
  }
  if (!GC_TEAM_ROLES.includes(gcTeamRole)) {
    res.status(400).json({ error: `gcTeamRole must be one of: ${GC_TEAM_ROLES.join(", ")}` });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "A user with this email already exists" });
    return;
  }

  // New team member uses a random non-bcrypt placeholder — they log in via magic link
  const passwordHash = crypto.randomBytes(32).toString("hex");

  const [newMember] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "GC",
      companyName: user.companyName,
      displayName: fullName.trim(),
      gcParentId: user.id,
      gcTeamRole,
      mustChangePassword: false,
    })
    .returning();

  const appUrl = process.env.APP_URL || "https://subtrackers.replit.app";

  // Generate a magic link for the new team member
  const magicToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await db.insert(magicLinkTokensTable).values({ userId: newMember.id, token: magicToken, expiresAt });
  const magicUrl = `${appUrl}/api/auth/magic-link/verify?token=${magicToken}`;

  sendTeamMemberInviteEmail({
    toEmail: newMember.email,
    fullName: fullName.trim(),
    companyName: user.companyName,
    magicUrl,
    appUrl,
  }).catch((err) => console.error("[email] Failed to send team invite email:", err));

  const { passwordHash: _, ...safeMember } = newMember;
  res.status(201).json({ ...safeMember, assignedProjects: [] });
});

// PATCH /team/:memberId — change a team member's role or name
router.patch("/:memberId", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { memberId } = req.params;
  const { gcTeamRole, fullName } = req.body;

  const [member] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, memberId), eq(usersTable.gcParentId, user.id)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (gcTeamRole && GC_TEAM_ROLES.includes(gcTeamRole)) {
    updates.gcTeamRole = gcTeamRole;
  }
  if (fullName) {
    updates.displayName = fullName.trim();
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, memberId))
    .returning();

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// DELETE /team/:memberId — remove a team member
router.delete("/:memberId", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { memberId } = req.params;

  const [member] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, memberId), eq(usersTable.gcParentId, user.id)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  // Remove all project assignments first
  await db
    .delete(gcProjectAssignmentsTable)
    .where(eq(gcProjectAssignmentsTable.teamMemberUserId, memberId));

  // Delete the user
  await db.delete(usersTable).where(eq(usersTable.id, memberId));

  res.status(204).send();
});

// GET /team/projects/:projectId/members — list PMs assigned to a project
router.get("/projects/:projectId/members", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.gcId, user.id)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const assignments = await db
    .select({
      id: gcProjectAssignmentsTable.id,
      teamMemberUserId: gcProjectAssignmentsTable.teamMemberUserId,
    })
    .from(gcProjectAssignmentsTable)
    .where(eq(gcProjectAssignmentsTable.projectId, projectId));

  const members = await Promise.all(
    assignments.map(async (a) => {
      const [u] = await db
        .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName, gcTeamRole: usersTable.gcTeamRole })
        .from(usersTable)
        .where(eq(usersTable.id, a.teamMemberUserId))
        .limit(1);
      return u ?? null;
    })
  );

  res.json(members.filter(Boolean));
});

// POST /team/projects/:projectId/assign — assign a PM to a project
router.post("/projects/:projectId/assign", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { teamMemberUserId } = req.body;

  if (!teamMemberUserId) {
    res.status(400).json({ error: "teamMemberUserId is required" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.gcId, user.id)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [member] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, teamMemberUserId), eq(usersTable.gcParentId, user.id)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  // Check if already assigned
  const existing = await db
    .select()
    .from(gcProjectAssignmentsTable)
    .where(
      and(
        eq(gcProjectAssignmentsTable.projectId, projectId),
        eq(gcProjectAssignmentsTable.teamMemberUserId, teamMemberUserId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "This team member is already assigned to this project" });
    return;
  }

  const [assignment] = await db
    .insert(gcProjectAssignmentsTable)
    .values({ projectId, teamMemberUserId })
    .returning();

  res.status(201).json(assignment);
});

// DELETE /team/projects/:projectId/assign/:teamMemberUserId — unassign a PM from a project
router.delete("/projects/:projectId/assign/:teamMemberUserId", requireAuth, requireGCOwner, async (req, res) => {
  const user = (req as any).user;
  const { projectId, teamMemberUserId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.gcId, user.id)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .delete(gcProjectAssignmentsTable)
    .where(
      and(
        eq(gcProjectAssignmentsTable.projectId, projectId),
        eq(gcProjectAssignmentsTable.teamMemberUserId, teamMemberUserId)
      )
    );

  res.status(204).send();
});

export default router;
