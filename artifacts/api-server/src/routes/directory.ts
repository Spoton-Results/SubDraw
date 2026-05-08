import { Router } from "express";
import { db } from "@workspace/db";
import { gcContactsTable, preferredSubcontractorsTable, subProfilesTable, usersTable } from "@workspace/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";

const router = Router();

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

router.get("/subcontractors", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const q = normalize(req.query.q);
  const trade = normalize(req.query.trade);
  const state = normalize(req.query.state).toUpperCase();
  const city = normalize(req.query.city);
  const preferredOnly = normalize(req.query.preferredOnly) === "true";

  const filters = [
    eq(usersTable.role, "SUB"),
    eq(subProfilesTable.directoryVisible, true),
  ];

  if (trade) filters.push(ilike(subProfilesTable.trade, `%${trade}%`));
  if (state) filters.push(ilike(subProfilesTable.state, state));
  if (city) filters.push(ilike(subProfilesTable.city, `%${city}%`));

  if (q) {
    filters.push(
      or(
        ilike(usersTable.companyName, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(subProfilesTable.trade, `%${q}%`),
        ilike(subProfilesTable.city, `%${q}%`),
        ilike(subProfilesTable.state, `%${q}%`),
        ilike(subProfilesTable.serviceArea, `%${q}%`),
        ilike(subProfilesTable.licenseNumber, `%${q}%`)
      )!
    );
  }

  const rows = await db
    .select({
      subId: usersTable.id,
      companyName: usersTable.companyName,
      email: usersTable.email,
      profileId: subProfilesTable.id,
      trade: subProfilesTable.trade,
      phone: subProfilesTable.phone,
      businessAddress: subProfilesTable.businessAddress,
      city: subProfilesTable.city,
      state: subProfilesTable.state,
      serviceArea: subProfilesTable.serviceArea,
      licenseNumber: subProfilesTable.licenseNumber,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(subProfilesTable, eq(subProfilesTable.userId, usersTable.id))
    .where(and(...filters))
    .limit(100);

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

  const mapped = rows.map((row) => ({
    ...row,
    savedToContacts: contactIds.has(row.subId),
    preferred: preferredIds.has(row.subId),
  }));

  res.json(preferredOnly ? mapped.filter((row) => row.preferred) : mapped);
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
