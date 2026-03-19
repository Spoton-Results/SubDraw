import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const gcContactsTable = pgTable("gc_contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gcId: text("gc_id").notNull().references(() => usersTable.id),
  subId: text("sub_id").notNull().references(() => usersTable.id),
  contactName: text("contact_name"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique("gc_contacts_gc_sub_unique").on(t.gcId, t.subId)]);

export const subProfilesTable = pgTable("sub_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  trade: text("trade").notNull(),
  phone: text("phone"),
  businessAddress: text("business_address"),
  licenseNumber: text("license_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
