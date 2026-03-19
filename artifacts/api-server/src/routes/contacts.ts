import { Router } from "express";
import { db } from "@workspace/db";
import { gcContactsTable, subProfilesTable, usersTable, projectMembersTable, projectsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { sendAddedToProjectEmail } from "../lib/email.js";
import crypto from "crypto";

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

async function findOrCreateSub(email: string, companyName: string) {
  let [found] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (!found) {
    const passwordHash = crypto.randomBytes(32).toString("hex");
    [found] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "SUB",
      companyName: companyName.trim(),
      mustChangePassword: false,
    }).returning();
  }
  return found;
}

async function upsertSubProfile(userId: string, opts: { trade?: string; phone?: string; licenseNumber?: string }) {
  const [existing] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, userId)).limit(1);
  if (existing) {
    const updates: any = { updatedAt: new Date() };
    if (opts.trade && !existing.trade) updates.trade = opts.trade;
    if (opts.phone && !existing.phone) updates.phone = opts.phone;
    if (opts.licenseNumber && !existing.licenseNumber) updates.licenseNumber = opts.licenseNumber;
    if (Object.keys(updates).length > 1) {
      await db.update(subProfilesTable).set(updates).where(eq(subProfilesTable.userId, userId));
    }
  } else if (opts.trade) {
    await db.insert(subProfilesTable).values({
      userId,
      trade: opts.trade,
      phone: opts.phone ?? null,
      licenseNumber: opts.licenseNumber ?? null,
    }).onConflictDoNothing();
  }
}

// POST / — add a single contact to the GC's contact book
router.post("/", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { companyName, email, contactName, phone, tradeSpecialty, licenseNumber } = req.body;

  if (!email?.trim() || !companyName?.trim()) {
    res.status(400).json({ error: "Company name and email are required" });
    return;
  }

  const sub = await findOrCreateSub(email, companyName);
  if (sub.role !== "SUB") {
    res.status(400).json({ error: "That email belongs to a non-subcontractor account" });
    return;
  }

  await upsertSubProfile(sub.id, { trade: tradeSpecialty, phone, licenseNumber });

  const [contact] = await db.insert(gcContactsTable)
    .values({ gcId: user.id, subId: sub.id, contactName: contactName?.trim() || null })
    .onConflictDoNothing()
    .returning();

  if (!contact) {
    res.status(409).json({ error: "This contact is already in your contact book" });
    return;
  }

  res.status(201).json(await buildContact(contact, user.id));
});

// POST /import — bulk import contacts from CSV rows
router.post("/import", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { contacts } = req.body as { contacts: Array<{ companyName: string; contactName?: string; email: string; phone?: string; tradeSpecialty?: string; licenseNumber?: string }> };

  if (!Array.isArray(contacts) || contacts.length === 0) {
    res.status(400).json({ error: "No contacts provided" });
    return;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of contacts) {
    if (!row.email?.trim() || !row.companyName?.trim()) {
      errors.push(`Row missing email or company name — skipped`);
      skipped++;
      continue;
    }

    try {
      const sub = await findOrCreateSub(row.email, row.companyName);
      if (sub.role !== "SUB") { skipped++; continue; }

      await upsertSubProfile(sub.id, { trade: row.tradeSpecialty, phone: row.phone, licenseNumber: row.licenseNumber });

      const [contact] = await db.insert(gcContactsTable)
        .values({ gcId: user.id, subId: sub.id, contactName: row.contactName?.trim() || null })
        .onConflictDoNothing()
        .returning();

      if (contact) { imported++; } else { skipped++; }
    } catch (err: any) {
      errors.push(`${row.email}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ imported, skipped, errors });
});

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
