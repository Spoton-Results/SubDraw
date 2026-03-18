import { pgTable, text, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const drawScheduleItemsTable = pgTable("draw_schedule_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  description: text("description").notNull(),
  budgetAmount: doublePrecision("budget_amount").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DrawScheduleItem = typeof drawScheduleItemsTable.$inferSelect;
