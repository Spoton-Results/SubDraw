import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, usersTable, bidsTable, subcontractsTable } from "@workspace/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";

const router = Router();

async function getProjectWithDetails(projectId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;

  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1);

  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
  const membersWithUsers = await Promise.all(members.map(async (m) => {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    return { ...m, user };
  }));

  const bids = await db.select().from(bidsTable).where(eq(bidsTable.projectId, projectId));
  const bidsWithSubs = await Promise.all(bids.map(async (b) => {
    const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, b.subId)).limit(1);
    return { ...b, sub };
  }));

  const subcontracts = await db.select().from(subcontractsTable).where(eq(subcontractsTable.projectId, projectId));
  const subcontractsWithDetails = await Promise.all(subcontracts.map(async (sc) => {
    const [sub] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1);
    return { ...sc, project: { ...project, gc }, sub };
  }));

  return { ...project, gc, members: membersWithUsers, bids: bidsWithSubs, subcontracts: subcontractsWithDetails };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let projects: any[];

  if (user.role === "GC") {
    const gcProjects = await db.select().from(projectsTable).where(eq(projectsTable.gcId, user.id));
    projects = await Promise.all(gcProjects.map(async (p) => {
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
      return { ...p, gc };
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
      const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, p.gcId)).limit(1);
      return { ...p, gc };
    }));
  }

  res.json(projects);
});

router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [project] = await db.insert(projectsTable).values({ name, gcId: user.id }).returning();
  const [gc] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  res.status(201).json({ ...project, gc });
});

router.get("/:projectId", requireAuth, async (req, res) => {
  const detail = await getProjectWithDetails(req.params.projectId);
  if (!detail) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(detail);
});

router.post("/:projectId/invite", requireAuth, requireGC, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const [invitedUser] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!invitedUser) {
    res.status(404).json({ error: "User not found with that email" });
    return;
  }
  if (invitedUser.role !== "SUB") {
    res.status(400).json({ error: "Can only invite subcontractors" });
    return;
  }
  const existing = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, req.params.projectId)).then(rows => rows.find(r => r.userId === invitedUser.id));
  if (existing) {
    res.status(400).json({ error: "User already a member" });
    return;
  }
  await db.insert(projectMembersTable).values({ projectId: req.params.projectId, userId: invitedUser.id, roleOnProject: "SUB" });
  res.status(201).json({ message: "Subcontractor invited" });
});

export default router;
