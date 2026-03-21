import { pgTable, text, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  gcId: text("gc_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("BIDDING"), // BIDDING | CONSTRUCTION | COMPLETE
  address: text("address"),
  description: text("description"),
  estimatedStartDate: text("estimated_start_date"),
  notes: text("notes"),
  // Project owner (property owner / developer — email-only, no SubTracker account needed)
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  ownerCoThreshold: doublePrecision("owner_co_threshold"),
  // Completion fields — set when GC marks project COMPLETE
  completionNote: text("completion_note"),
  retentionWaived: boolean("retention_waived").default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembersTable = pgTable("project_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  roleOnProject: text("role_on_project").notNull().default("SUB"),
  tradeCategory: text("trade_category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const insertProjectMemberSchema = createInsertSchema(projectMembersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembersTable.$inferSelect;
