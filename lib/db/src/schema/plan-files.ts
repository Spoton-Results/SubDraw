import { pgTable, text, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const planFilesTable = pgTable("plan_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  fileName: text("file_name"),
  objectPath: text("object_path"),
  fileUrl: text("file_url"),
  fileSize: bigint("file_size", { mode: "number" }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlanFileSchema = createInsertSchema(planFilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlanFile = z.infer<typeof insertPlanFileSchema>;
export type PlanFile = typeof planFilesTable.$inferSelect;

export const planFileViewsTable = pgTable("plan_file_views", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  planFileId: text("plan_file_id").notNull().references(() => planFilesTable.id, { onDelete: "cascade" }),
  subId: text("sub_id").notNull(),
  subName: text("sub_name").notNull(),
  companyName: text("company_name").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export type PlanFileView = typeof planFileViewsTable.$inferSelect;

export const scopeDocumentsTable = pgTable("scope_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path"),
  fileSize: bigint("file_size", { mode: "number" }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScopeDocument = typeof scopeDocumentsTable.$inferSelect;
