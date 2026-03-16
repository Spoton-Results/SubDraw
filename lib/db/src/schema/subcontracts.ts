import { pgTable, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const subcontractsTable = pgTable("subcontracts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  subId: text("sub_id").notNull().references(() => usersTable.id),
  baseContractAmount: doublePrecision("base_contract_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const changeOrdersTable = pgTable("change_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("PENDING_SUB"), // PENDING_SUB | PENDING_GC | APPROVED | REJECTED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  invoiceNumber: text("invoice_number").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | FLAGGED
  flaggedOverAmount: doublePrecision("flagged_over_amount").notNull().default(0),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubcontractSchema = createInsertSchema(subcontractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubcontract = z.infer<typeof insertSubcontractSchema>;
export type Subcontract = typeof subcontractsTable.$inferSelect;

export const insertChangeOrderSchema = createInsertSchema(changeOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChangeOrder = z.infer<typeof insertChangeOrderSchema>;
export type ChangeOrder = typeof changeOrdersTable.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
