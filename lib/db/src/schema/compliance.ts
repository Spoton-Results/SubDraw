import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { subcontractsTable } from "./subcontracts";

export const complianceChecklistItemsTable = pgTable("compliance_checklist_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  required: boolean("required").default(true).notNull(),
  allowDocumentUpload: boolean("allow_document_upload").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complianceCompletionsTable = pgTable("compliance_completions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  checklistItemId: text("checklist_item_id").notNull().references(() => complianceChecklistItemsTable.id, { onDelete: "cascade" }),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id, { onDelete: "cascade" }),
  isComplete: boolean("is_complete").default(false).notNull(),
  completedByRole: text("completed_by_role"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at"),
  documentPath: text("document_path"),
  documentName: text("document_name"),
  documentUploadedAt: timestamp("document_uploaded_at"),
  notes: text("notes"),
  status: text("status"),
  revisionNote: text("revision_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ComplianceChecklistItem = typeof complianceChecklistItemsTable.$inferSelect;
export type ComplianceCompletion = typeof complianceCompletionsTable.$inferSelect;
