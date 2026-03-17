import { pgTable, text, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const subcontractsTable = pgTable("subcontracts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  subId: text("sub_id").notNull().references(() => usersTable.id),
  baseContractAmount: doublePrecision("base_contract_amount").notNull(),
  tradeCategory: text("trade_category"),
  retentionPercentage: doublePrecision("retention_percentage").default(10).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const changeOrdersTable = pgTable("change_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  description: text("description").notNull(),
  scope: text("scope"),
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("PENDING_SUB"), // PENDING_SUB | PENDING_GC | APPROVED | REJECTED
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  invoiceNumber: text("invoice_number").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | FLAGGED | PAYMENT_UNCONFIRMED | PAYMENT_CONFIRMED | PAYMENT_DISPUTED
  flaggedOverAmount: doublePrecision("flagged_over_amount").notNull().default(0),
  overrideReason: text("override_reason"),
  paymentDate: text("payment_date"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  paymentNotes: text("payment_notes"),
  paymentConfirmedAt: text("payment_confirmed_at"),
  disputeReason: text("dispute_reason"),
  retentionAmount: doublePrecision("retention_amount"),
  isRetentionRelease: boolean("is_retention_release").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityLogsTable = pgTable("subcontract_activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lienWaiversTable = pgTable("lien_waivers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  invoiceId: text("invoice_id").notNull().references(() => invoicesTable.id),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  signedByName: text("signed_by_name").notNull(),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  // Snapshot fields for PDF generation
  invoiceNumber: text("invoice_number").notNull(),
  amount: doublePrecision("amount").notNull(),
  paymentDate: text("payment_date"),
  paymentMethod: text("payment_method"),
  projectName: text("project_name").notNull(),
  projectAddress: text("project_address"),
  gcCompanyName: text("gc_company_name").notNull(),
  subCompanyName: text("sub_company_name").notNull(),
  subLicenseNumber: text("sub_license_number"),
});

export const insertLienWaiverSchema = createInsertSchema(lienWaiversTable).omit({ id: true, signedAt: true });
export type InsertLienWaiver = z.infer<typeof insertLienWaiverSchema>;
export type LienWaiver = typeof lienWaiversTable.$inferSelect;

export const insertSubcontractSchema = createInsertSchema(subcontractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubcontract = z.infer<typeof insertSubcontractSchema>;
export type Subcontract = typeof subcontractsTable.$inferSelect;

export const insertChangeOrderSchema = createInsertSchema(changeOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChangeOrder = z.infer<typeof insertChangeOrderSchema>;
export type ChangeOrder = typeof changeOrdersTable.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
