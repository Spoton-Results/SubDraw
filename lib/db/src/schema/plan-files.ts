import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const planFilesTable = pgTable("plan_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  fileName: text("file_name"),
  objectPath: text("object_path"),
  fileUrl: text("file_url"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlanFileSchema = createInsertSchema(planFilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlanFile = z.infer<typeof insertPlanFileSchema>;
export type PlanFile = typeof planFilesTable.$inferSelect;
