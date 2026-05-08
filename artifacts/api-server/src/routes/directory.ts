import { Router } from "express";
import { db } from "@workspace/db";
import { gcContactsTable, subProfilesTable, usersTable } from "@workspace/db/schema";
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

  res.json(
    rows.map((row) => ({
      ...row,
      savedToContacts: contactIds.has(row.subId),
    }))
  );
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

export default router;
