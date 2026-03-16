import { Router } from "express";
import { db } from "@workspace/db";
import { gcContactsTable, subProfilesTable, usersTable, projectMembersTable, projectsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { sendAddedToProjectEmail } from "../lib/email.js";

const router = Router();

async function buildContact(contact: any, gcId: string) {
  const [sub] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, companyName: usersTable.companyName, mustChangePassword: usersTable.mustChangePassword, createdAt: usersTable.createdAt })
    .from(usersTable).where(eq(usersTable.id, contact.subId)).limit(1);

  const [subProfile] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, contact.subId)).limit(1);

  const gcProjects = await db.select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, gcId));
  const gcProjectIds = gcProjects.map(m => m.projectId);

  let sharedProjects: { id: string; name: string }[] = [];
  if (gcProjectIds.length > 0) {
    const subMemberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.userId, contact.subId), inArray(projectMembersTable.projectId, gcProjectIds)));
    if (subMemberships.length > 0) {
      const projects = await db.select({ id: projectsTable.id, name: projectsTable.name })
        .from(projectsTable)
        .where(inArray(projectsTable.id, subMemberships.map(m => m.projectId)));
      sharedProjects = projects;
    }
  }

  return { ...contact, sub: { ...sub, subProfile: subProfile ?? null }, subProfile: subProfile ?? null, sharedProjects };
}

router.get("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const contacts = await db.select().from(gcContactsTable).where(eq(gcContactsTable.gcId, user.id));
  const enriched = await Promise.all(contacts.map(c => buildContact(c, user.id)));
  res.json(enriched);
});

router.patch("/:subId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { note } = req.body;
  const [contact] = await db.update(gcContactsTable)
    .set({ note: note ?? null, updatedAt: new Date() })
    .where(and(eq(gcContactsTable.gcId, user.id), eq(gcContactsTable.subId, req.params.subId)))
    .returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(await buildContact(contact, user.id));
});

router.delete("/:subId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  await db.delete(gcContactsTable)
    .where(and(eq(gcContactsTable.gcId, user.id), eq(gcContactsTable.subId, req.params.subId)));
  res.status(204).send();
});

router.post("/:subId/invite/:projectId", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subId, projectId } = req.params;

  const [contact] = await db.select().from(gcContactsTable)
    .where(and(eq(gcContactsTable.gcId, user.id), eq(gcContactsTable.subId, subId))).limit(1);
  if (!contact) { res.status(404).json({ error: "Contact not found in your contact book" }); return; }

  const [sub] = await db.select().from(usersTable).where(eq(usersTable.id, subId)).limit(1);
  if (!sub) { res.status(404).json({ error: "Subcontractor not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== user.id) { res.status(403).json({ error: "Not your project" }); return; }

  const existing = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, subId)));
  if (existing.length > 0) {
    res.status(400).json({ error: "This subcontractor is already on the project" });
    return;
  }

  await db.insert(projectMembersTable).values({ projectId, userId: subId, roleOnProject: "SUB" });

  const appUrl = `${req.protocol}://${req.get("host")}`;
  sendAddedToProjectEmail({
    toEmail: sub.email,
    subCompanyName: sub.companyName,
    projectName: project.name,
    appUrl,
  }).catch((err) => console.error("[email] sendAddedToProjectEmail failed:", err));

  res.json({ message: "Subcontractor added to project" });
});

export default router;
