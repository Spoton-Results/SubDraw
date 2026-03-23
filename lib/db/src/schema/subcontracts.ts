import { pgTable, text, timestamp, doublePrecision, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
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
  drawScheduleItemId: text("draw_schedule_item_id"),
  paymentTermsDays: integer("payment_terms_days").default(30).notNull(),
  signedBySubAt: timestamp("signed_by_sub_at"),
  contractDocPath: text("contract_doc_path"),
  contractDocName: text("contract_doc_name"),
  contractDocUploadedAt: timestamp("contract_doc_uploaded_at"),
  signedContractPath: text("signed_contract_path"),
  signedContractName: text("signed_contract_name"),
  signedContractUploadedAt: timestamp("signed_contract_uploaded_at"),
  contractWaived: boolean("contract_waived").default(false).notNull(),
  contractedScope: text("contracted_scope"),
  contractedScopeTrade: text("contracted_scope_trade"),
  scopeAcknowledgedAt: timestamp("scope_acknowledged_at"),
  scopeAcknowledgedByName: text("scope_acknowledged_by_name"),
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
  pendingGcFinalApproval: boolean("pending_gc_final_approval").notNull().default(false),
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
  rejectionReason: text("rejection_reason"),
  overrideReason: text("override_reason"),
  paymentDate: text("payment_date"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  paymentNotes: text("payment_notes"),
  paymentConfirmedAt: text("payment_confirmed_at"),
  disputeReason: text("dispute_reason"),
  retentionAmount: doublePrecision("retention_amount"),
  isRetentionRelease: boolean("is_retention_release").default(false).notNull(),
  percentageComplete: integer("percentage_complete"),
  approvedAt: timestamp("approved_at"),
  paymentDueDate: timestamp("payment_due_date"),
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

export const subcontractCommentsTable = pgTable("subcontract_comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  companyName: text("company_name").notNull(),
  role: text("role").notNull(), // GC | SUB
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subcontractCommentReadsTable = pgTable("subcontract_comment_reads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("sc_comment_reads_unique").on(t.subcontractId, t.userId),
]);

export const contractorLicensesTable = pgTable("contractor_licenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().unique().references(() => subcontractsTable.id),
  licenseNumber: text("license_number"),
  licenseType: text("license_type"),
  issuingState: text("issuing_state"),
  expirationDate: text("expiration_date"),
  notifiedAt30: timestamp("notified_at_30"),
  notifiedAt7: timestamp("notified_at_7"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ContractorLicense = typeof contractorLicensesTable.$inferSelect;

export const subcontractInsurancesTable = pgTable("subcontract_insurances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subcontractId: text("subcontract_id").notNull().unique().references(() => subcontractsTable.id),
  insuranceCompany: text("insurance_company"),
  policyNumber: text("policy_number"),
  generalLiabilityCoverage: doublePrecision("general_liability_coverage"),
  workersCompCoverage: doublePrecision("workers_comp_coverage"),
  expirationDate: text("expiration_date"),
  certificateObjectPath: text("certificate_object_path"),
  additionalRequirements: text("additional_requirements"),
  notifiedAt30: timestamp("notified_at_30"),
  notifiedAt7: timestamp("notified_at_7"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubcontractInsuranceSchema = createInsertSchema(subcontractInsurancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubcontractInsurance = z.infer<typeof insertSubcontractInsuranceSchema>;
export type SubcontractInsurance = typeof subcontractInsurancesTable.$inferSelect;

export const insertSubcontractSchema = createInsertSchema(subcontractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubcontract = z.infer<typeof insertSubcontractSchema>;
export type Subcontract = typeof subcontractsTable.$inferSelect;

export const insertChangeOrderSchema = createInsertSchema(changeOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChangeOrder = z.infer<typeof insertChangeOrderSchema>;
export type ChangeOrder = typeof changeOrdersTable.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
